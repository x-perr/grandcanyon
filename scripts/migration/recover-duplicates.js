/**
 * Recover Duplicate Timesheets
 *
 * Merges entries from duplicate timesheets into existing ones.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAW_DIR = path.join(__dirname, 'data', 'raw')
const TRANS_DIR = path.join(__dirname, 'data', 'transformed')
const BATCH_SIZE = 100

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
  console.log('Recovering Duplicate Timesheet Entries')
  console.log('='.repeat(60))

  // Build user ID mapping
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
  console.log(`User mappings: ${userIdMap.size}`)

  // Build project ID mapping
  const rawProjects = loadJson(RAW_DIR, 'projects.json')
  const transProjects = loadJson(TRANS_DIR, 'projects.json')
  const projectIdMap = new Map()
  rawProjects.forEach((p, i) => {
    if (transProjects[i]) projectIdMap.set(p.proj_id, transProjects[i].id)
  })

  // Build task ID mapping
  const rawTasks = loadJson(RAW_DIR, 'tasks.json')
  const transTasks = loadJson(TRANS_DIR, 'project_tasks.json')
  const taskIdMap = new Map()
  rawTasks.forEach((t, i) => {
    if (transTasks[i]) taskIdMap.set(t.tsk_id, transTasks[i].id)
  })

  // Build billing role ID mapping
  const rawBillingRoles = loadJson(RAW_DIR, 'projectroles.json')
  const transBillingRoles = loadJson(TRANS_DIR, 'project_billing_roles.json')
  const billingRoleIdMap = new Map()
  rawBillingRoles.forEach((br, i) => {
    if (transBillingRoles[i]) billingRoleIdMap.set(br.pr_id, transBillingRoles[i].id)
  })

  // Get existing timesheets from database (with pagination)
  console.log('\nFetching existing timesheets...')
  const timesheetLookup = new Map()
  let tsPage = 0
  const pageSize = 1000
  while (true) {
    const { data: dbTimesheets, error } = await supabase
      .from('timesheets')
      .select('id, user_id, week_start')
      .range(tsPage * pageSize, (tsPage + 1) * pageSize - 1)
    if (error || !dbTimesheets || dbTimesheets.length === 0) break
    dbTimesheets.forEach(ts => {
      const key = `${ts.user_id}_${ts.week_start}`
      timesheetLookup.set(key, ts.id)
    })
    if (dbTimesheets.length < pageSize) break
    tsPage++
  }
  console.log(`Existing timesheets: ${timesheetLookup.size}`)

  // Find raw timesheets that map to existing database timesheets
  const rawTimesheets = loadJson(RAW_DIR, 'timesheets.json')
  const rawTsIdToDbTsId = new Map() // raw ts_id -> database timesheet id

  for (const ts of rawTimesheets) {
    const userId = userIdMap.get(ts.ts_emplid)
    if (!userId) continue
    const key = `${userId}_${ts.ts_periodfrom}`
    const dbTsId = timesheetLookup.get(key)
    if (dbTsId) {
      rawTsIdToDbTsId.set(ts.ts_id, dbTsId)
    }
  }
  console.log(`Raw to DB timesheet mappings: ${rawTsIdToDbTsId.size}`)

  // Get existing timesheet entries (with pagination)
  console.log('\nFetching existing timesheet entries...')
  const existingEntryKeys = new Set()
  let entryPage = 0
  while (true) {
    const { data: dbEntries, error } = await supabase
      .from('timesheet_entries')
      .select('timesheet_id, project_id, task_id')
      .range(entryPage * pageSize, (entryPage + 1) * pageSize - 1)
    if (error || !dbEntries || dbEntries.length === 0) break
    dbEntries.forEach(e => {
      const key = `${e.timesheet_id}_${e.project_id}_${e.task_id || 'null'}`
      existingEntryKeys.add(key)
    })
    if (dbEntries.length < pageSize) break
    entryPage++
  }
  console.log(`Existing entries: ${existingEntryKeys.size}`)

  // Find missing timesheet entries
  const rawDetails = loadJson(RAW_DIR, 'timesheetdetails.json')
  const missingEntries = []

  for (const d of rawDetails) {
    const timesheetId = rawTsIdToDbTsId.get(d.tsd_tsid)
    if (!timesheetId) continue // Timesheet not in database

    const projectId = projectIdMap.get(d.tsd_projid)
    if (!projectId) continue // Project doesn't exist

    const taskId = taskIdMap.get(d.tsd_taskid) || null
    const entryKey = `${timesheetId}_${projectId}_${taskId || 'null'}`

    if (existingEntryKeys.has(entryKey)) continue // Already exists

    const hours = [
      parseFloat(d.tsd_time1) || 0,
      parseFloat(d.tsd_time2) || 0,
      parseFloat(d.tsd_time3) || 0,
      parseFloat(d.tsd_time4) || 0,
      parseFloat(d.tsd_time5) || 0,
      parseFloat(d.tsd_time6) || 0,
      parseFloat(d.tsd_time7) || 0,
    ]

    missingEntries.push({
      id: uuidv4(),
      timesheet_id: timesheetId,
      project_id: projectId,
      task_id: taskId,
      billing_role_id: billingRoleIdMap.get(d.tsd_prid) || null,
      description: d.tsd_notes || null,
      hours,
      is_billable: d.tsd_billable === '1' || d.tsd_billable === 1,
      created_at: new Date().toISOString(),
    })

    existingEntryKeys.add(entryKey) // Mark as added to avoid duplicates
  }

  console.log(`\nMissing entries to recover: ${missingEntries.length}`)

  // Calculate recovered hours
  let recoveredHours = 0
  for (const e of missingEntries) {
    recoveredHours += e.hours.reduce((a, b) => a + b, 0)
  }
  console.log(`Hours to recover: ${recoveredHours.toFixed(2)}`)

  // Import missing entries
  if (missingEntries.length > 0) {
    console.log('\nImporting missing entries...')
    let imported = 0

    for (let i = 0; i < missingEntries.length; i += BATCH_SIZE) {
      const batch = missingEntries.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('timesheet_entries').insert(batch)

      if (!error) {
        imported += batch.length
      } else {
        console.error(`Batch ${Math.floor(i / BATCH_SIZE)} error:`, error.message)
      }
    }
    console.log(`Imported: ${imported}/${missingEntries.length}`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('Recovery complete!')
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
