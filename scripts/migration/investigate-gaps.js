/**
 * Investigate Data Gaps
 *
 * Analyzes why some records weren't imported.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAW_DIR = path.join(__dirname, 'data', 'raw')
const TRANS_DIR = path.join(__dirname, 'data', 'transformed')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function loadJson(dir, filename) {
  return JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf8'))
}

async function main() {
  console.log('='.repeat(60))
  console.log('Investigating Data Gaps')
  console.log('='.repeat(60))

  // Get profile mapping
  const { data: profiles } = await supabase.from('profiles').select('id, email')
  const emailToProfileId = new Map()
  profiles?.forEach(p => {
    if (p.email) emailToProfileId.set(p.email.toLowerCase(), p.id)
  })

  const rawUsers = loadJson(RAW_DIR, 'users.json')
  const userIdMap = new Map()
  for (const user of rawUsers) {
    let email = user.user_email?.trim()
    if (!email || !email.includes('@')) {
      email = `user_${user.user_id}@grandcanyon.local`
    }
    const profileId = emailToProfileId.get(email.toLowerCase())
    if (profileId) userIdMap.set(user.user_id, profileId)
  }

  // ===== TIMESHEETS =====
  console.log('\n--- Timesheet Analysis ---')
  const rawTimesheets = loadJson(RAW_DIR, 'timesheets.json')
  console.log(`Raw timesheets: ${rawTimesheets.length}`)

  // Check for timesheets without valid users
  const tsWithoutUser = rawTimesheets.filter(ts => !userIdMap.has(ts.ts_emplid))
  console.log(`Timesheets without valid user: ${tsWithoutUser.length}`)

  // Check for duplicate (user, week_start) combinations
  const seenKeys = new Map()
  const duplicates = []
  for (const ts of rawTimesheets) {
    const userId = userIdMap.get(ts.ts_emplid)
    if (!userId) continue
    const key = `${userId}_${ts.ts_periodfrom}`
    if (seenKeys.has(key)) {
      duplicates.push({ first: seenKeys.get(key), second: ts.ts_id })
    } else {
      seenKeys.set(key, ts.ts_id)
    }
  }
  console.log(`Duplicate (user, week_start) combinations: ${duplicates.length}`)
  console.log(`Unique valid timesheets: ${seenKeys.size}`)

  // ===== TIMESHEET ENTRIES =====
  console.log('\n--- Timesheet Entry Analysis ---')
  const rawDetails = loadJson(RAW_DIR, 'timesheetdetails.json')
  console.log(`Raw timesheet details: ${rawDetails.length}`)

  // Get imported timesheets
  const { data: dbTimesheets } = await supabase.from('timesheets').select('id')
  const dbTimesheetIds = new Set(dbTimesheets?.map(t => t.id))

  // Get timesheet ID mapping
  const timesheetIdMap = new Map()
  const timesheetFinal = loadJson(TRANS_DIR, 'timesheets_final.json')
  // We need the raw timesheet IDs mapped to the new IDs
  const rawTsToNew = new Map()
  let idx = 0
  const seenTsKeys = new Set()
  for (const ts of rawTimesheets) {
    const userId = userIdMap.get(ts.ts_emplid)
    if (!userId) continue
    const key = `${userId}_${ts.ts_periodfrom}`
    if (seenTsKeys.has(key)) continue
    seenTsKeys.add(key)
    if (timesheetFinal[idx]) {
      rawTsToNew.set(ts.ts_id, timesheetFinal[idx].id)
    }
    idx++
  }
  console.log(`Timesheet ID mappings: ${rawTsToNew.size}`)

  // Check entries with missing parent timesheet
  let entriesWithMissingTs = 0
  let entriesWithMissingProject = 0
  const rawProjects = loadJson(RAW_DIR, 'projects.json')
  const transProjects = loadJson(TRANS_DIR, 'projects.json')
  const projectIdMap = new Map()
  rawProjects.forEach((p, i) => {
    if (transProjects[i]) projectIdMap.set(p.proj_id, transProjects[i].id)
  })

  for (const d of rawDetails) {
    if (!rawTsToNew.has(d.tsd_tsid)) entriesWithMissingTs++
    if (!projectIdMap.has(d.tsd_projid)) entriesWithMissingProject++
  }
  console.log(`Entries with missing parent timesheet: ${entriesWithMissingTs}`)
  console.log(`Entries with missing project: ${entriesWithMissingProject}`)

  // Calculate hours in missing entries
  let missingHours = 0
  for (const d of rawDetails) {
    if (!rawTsToNew.has(d.tsd_tsid) || !projectIdMap.has(d.tsd_projid)) {
      for (let i = 1; i <= 7; i++) {
        missingHours += parseFloat(d[`tsd_time${i}`]) || 0
      }
    }
  }
  console.log(`Hours in missing entries: ${missingHours.toFixed(2)}`)

  // ===== EXPENSES =====
  console.log('\n--- Expense Analysis ---')
  const rawExpenses = loadJson(RAW_DIR, 'expenses.json')
  console.log(`Raw expenses: ${rawExpenses.length}`)

  const expWithoutUser = rawExpenses.filter(e => !userIdMap.has(e.exp_emplid))
  console.log(`Expenses without valid user: ${expWithoutUser.length}`)

  // Duplicate expenses
  const seenExpKeys = new Set()
  let dupExpenses = 0
  for (const exp of rawExpenses) {
    const userId = userIdMap.get(exp.exp_emplid)
    if (!userId) continue
    const key = `${userId}_${exp.exp_periodfrom}`
    if (seenExpKeys.has(key)) {
      dupExpenses++
    } else {
      seenExpKeys.add(key)
    }
  }
  console.log(`Duplicate expense (user, week_start): ${dupExpenses}`)

  console.log('\n' + '='.repeat(60))
  console.log('Summary')
  console.log('='.repeat(60))
  console.log(`
Missing data is due to:
1. Timesheets without valid users: ${tsWithoutUser.length}
2. Duplicate timesheet (user+week): ${duplicates.length}
3. Timesheet entries with missing parent: ${entriesWithMissingTs}
4. Timesheet entries with missing project: ${entriesWithMissingProject}
5. Missing hours: ${missingHours.toFixed(2)}
  `)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
