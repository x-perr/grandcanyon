/**
 * Find the final gaps in timesheet/expense entries
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAW_DIR = path.join(__dirname, 'data', 'raw')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function loadJson(dir, filename) {
  return JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf8'))
}

async function fetchAllPaginated(table, columns = '*') {
  const results = []
  let page = 0
  while (true) {
    const { data } = await supabase
      .from(table)
      .select(columns)
      .range(page * 1000, (page + 1) * 1000 - 1)
    if (!data || data.length === 0) break
    results.push(...data)
    if (data.length < 1000) break
    page++
  }
  return results
}

async function main() {
  console.log('='.repeat(60))
  console.log('Finding Final Gaps')
  console.log('='.repeat(60))

  // Load raw data
  const rawClients = loadJson(RAW_DIR, 'clients.json')
  const rawProjects = loadJson(RAW_DIR, 'projects.json')
  const rawTimesheets = loadJson(RAW_DIR, 'timesheets.json')
  const rawTsDetails = loadJson(RAW_DIR, 'timesheetdetails.json')
  const rawExpenses = loadJson(RAW_DIR, 'expenses.json')
  const rawExpDetails = loadJson(RAW_DIR, 'expensedetails.json')
  const rawExpTypes = loadJson(RAW_DIR, 'expensestype.json')
  const rawUsers = loadJson(RAW_DIR, 'users.json')

  // Build mappings from raw data
  const rawClientIdToCode = new Map(rawClients.map(c => [c.client_id, c.client_code]))

  // Get all DB data
  const dbClients = await fetchAllPaginated('clients', 'id, code')
  const clientCodeToDbId = new Map(dbClients.map(c => [c.code, c.id]))
  const dbClientIdToCode = new Map([...clientCodeToDbId.entries()].map(([code, id]) => [id, code]))

  const dbProjects = await fetchAllPaginated('projects', 'id, code, client_id')
  const projectKeyToDbId = new Map()
  for (const p of dbProjects) {
    const clientCode = dbClientIdToCode.get(p.client_id)
    if (clientCode) {
      projectKeyToDbId.set(`${clientCode}_${p.code}`, p.id)
    }
  }

  const rawProjIdToDbId = new Map()
  for (const p of rawProjects) {
    const clientCode = rawClientIdToCode.get(p.proj_clientid)
    if (clientCode) {
      const dbId = projectKeyToDbId.get(`${clientCode}_${p.proj_code}`)
      if (dbId) rawProjIdToDbId.set(p.proj_id, dbId)
    }
  }

  // Get people mapping
  const dbPeople = await fetchAllPaginated('people', 'id, legacy_user_id')
  const legacyIdToPeopleId = new Map(dbPeople.map(p => [p.legacy_user_id, p.id]))

  // Get existing timesheets
  const dbTimesheets = await fetchAllPaginated('timesheets', 'id, person_id, week_start')
  const tsKeyToDbId = new Map()
  for (const ts of dbTimesheets) {
    tsKeyToDbId.set(`${ts.person_id}_${ts.week_start}`, ts.id)
  }

  // Build raw timesheet ID to DB ID mapping
  const rawTsIdToDbId = new Map()
  for (const ts of rawTimesheets) {
    const personId = legacyIdToPeopleId.get(ts.ts_emplid)
    if (personId) {
      const dbId = tsKeyToDbId.get(`${personId}_${ts.ts_periodfrom}`)
      if (dbId) rawTsIdToDbId.set(ts.ts_id, dbId)
    }
  }

  // Get existing timesheet entries
  const dbTsEntries = await fetchAllPaginated('timesheet_entries', 'id, timesheet_id, project_id')
  const existingTsEntries = new Set()
  for (const e of dbTsEntries) {
    existingTsEntries.add(`${e.timesheet_id}_${e.project_id}`)
  }

  // Find missing timesheet entries with reasons
  console.log('\n--- Analyzing Missing Timesheet Entries ---')

  const missingReasons = {
    noTimesheet: [],
    noProject: [],
    alreadyExists: [],
  }

  for (const d of rawTsDetails) {
    const timesheetId = rawTsIdToDbId.get(d.tsd_tsid)
    const projectId = rawProjIdToDbId.get(d.tsd_projid)

    if (!timesheetId) {
      // Find out why timesheet is missing
      const rawTs = rawTimesheets.find(ts => ts.ts_id === d.tsd_tsid)
      if (!rawTs) {
        missingReasons.noTimesheet.push({ entry: d, reason: 'Timesheet not in raw data' })
      } else {
        const personId = legacyIdToPeopleId.get(rawTs.ts_emplid)
        if (!personId) {
          const rawUser = rawUsers.find(u => u.user_id === rawTs.ts_emplid)
          missingReasons.noTimesheet.push({
            entry: d,
            reason: `Person not found for employee ${rawTs.ts_emplid}`,
            user: rawUser ? `${rawUser.user_fname} ${rawUser.user_lname}` : 'Unknown'
          })
        } else {
          missingReasons.noTimesheet.push({
            entry: d,
            reason: `Timesheet not in DB for person ${personId}, week ${rawTs.ts_periodfrom}`
          })
        }
      }
      continue
    }

    if (!projectId) {
      missingReasons.noProject.push({ entry: d, reason: 'Project not mapped' })
      continue
    }

    const key = `${timesheetId}_${projectId}`
    if (existingTsEntries.has(key)) {
      missingReasons.alreadyExists.push({ entry: d })
    }
  }

  console.log(`  No timesheet: ${missingReasons.noTimesheet.length}`)
  console.log(`  No project: ${missingReasons.noProject.length}`)
  console.log(`  Already exists: ${missingReasons.alreadyExists.length}`)
  console.log(`  Total in DB: ${dbTsEntries.length}`)
  console.log(`  Expected: ${rawTsDetails.length}`)

  if (missingReasons.noTimesheet.length > 0) {
    console.log('\n  Details of missing timesheets:')
    for (const item of missingReasons.noTimesheet.slice(0, 20)) {
      console.log(`    tsd_id: ${item.entry.tsd_id}, ts_id: ${item.entry.tsd_tsid}`)
      console.log(`      Reason: ${item.reason}`)
      if (item.user) console.log(`      User: ${item.user}`)
    }
  }

  // Expense types mapping
  const dbExpTypes = await fetchAllPaginated('expense_types', 'id, code')
  const expTypeCodeToDbId = new Map(dbExpTypes.map(et => [et.code, et.id]))

  const rawExpTypeIdToDbId = new Map()
  for (const et of rawExpTypes) {
    const dbId = expTypeCodeToDbId.get(et.et_code)
    if (dbId) rawExpTypeIdToDbId.set(et.et_id, dbId)
  }

  // Get existing expenses
  const dbExpenses = await fetchAllPaginated('expenses', 'id, person_id, week_start')
  const expKeyToDbId = new Map()
  for (const exp of dbExpenses) {
    expKeyToDbId.set(`${exp.person_id}_${exp.week_start}`, exp.id)
  }

  const rawExpIdToDbId = new Map()
  for (const exp of rawExpenses) {
    const personId = legacyIdToPeopleId.get(exp.exp_emplid)
    if (personId) {
      const dbId = expKeyToDbId.get(`${personId}_${exp.exp_periodfrom}`)
      if (dbId) rawExpIdToDbId.set(exp.exp_id, dbId)
    }
  }

  // Get existing expense entries
  const dbExpEntries = await fetchAllPaginated('expense_entries', 'id, expense_id, project_id, expense_type_id')
  const existingExpEntries = new Set()
  for (const e of dbExpEntries) {
    existingExpEntries.add(`${e.expense_id}_${e.project_id}_${e.expense_type_id}`)
  }

  // Analyze expense entries
  console.log('\n--- Analyzing Missing Expense Entries ---')

  const expMissingReasons = {
    noExpense: [],
    noProject: [],
    noType: [],
    notInDb: []
  }

  for (const d of rawExpDetails) {
    const expenseId = rawExpIdToDbId.get(d.exd_expid)
    const projectId = rawProjIdToDbId.get(d.exd_projid)
    const expTypeId = rawExpTypeIdToDbId.get(d.exd_etid)

    if (!expenseId) {
      // Find why expense is missing
      const rawExp = rawExpenses.find(e => e.exp_id === d.exd_expid)
      expMissingReasons.noExpense.push({ entry: d, rawExp })
      continue
    }

    if (!projectId) {
      expMissingReasons.noProject.push({ entry: d })
      continue
    }

    if (!expTypeId) {
      expMissingReasons.noType.push({ entry: d })
      continue
    }

    // Check if in DB
    const key = `${expenseId}_${projectId}_${expTypeId}`
    if (!existingExpEntries.has(key)) {
      expMissingReasons.notInDb.push({ entry: d, expenseId, projectId, expTypeId })
    }
  }

  console.log(`  No expense parent: ${expMissingReasons.noExpense.length}`)
  console.log(`  No project: ${expMissingReasons.noProject.length}`)
  console.log(`  No expense type: ${expMissingReasons.noType.length}`)
  console.log(`  Not in DB (should be imported): ${expMissingReasons.notInDb.length}`)
  console.log(`  Total in DB: ${dbExpEntries.length}`)
  console.log(`  Expected: ${rawExpDetails.length}`)

  // Check for missing expense types
  if (expMissingReasons.noType.length > 0) {
    console.log('\n  Missing expense types:')
    const missingTypes = new Set()
    for (const item of expMissingReasons.noType) {
      missingTypes.add(item.entry.exd_etid)
    }
    for (const typeId of missingTypes) {
      const rawType = rawExpTypes.find(t => t.et_id === typeId)
      console.log(`    Type ID ${typeId}: ${rawType ? rawType.et_code + ' - ' + rawType.et_name : 'NOT FOUND'}`)
    }
  }

  // Show details of orphaned expense entries
  if (expMissingReasons.noExpense.length > 0) {
    console.log('\n  Details of orphaned expense entries (parent expense missing):')
    for (const item of expMissingReasons.noExpense.slice(0, 20)) {
      console.log(`    exd_id: ${item.entry.exd_id}, exp_id: ${item.entry.exd_expid}`)
      if (item.rawExp) {
        const personId = legacyIdToPeopleId.get(item.rawExp.exp_emplid)
        console.log(`      Raw expense exists but person/timesheet not mapped. emplid: ${item.rawExp.exp_emplid}, person: ${personId || 'NONE'}`)
      } else {
        console.log(`      Parent expense not in raw data`)
      }
    }
  }

  // Show details of entries not in DB
  if (expMissingReasons.notInDb.length > 0) {
    console.log('\n  Entries that should be in DB but are not:')
    for (const item of expMissingReasons.notInDb.slice(0, 20)) {
      console.log(`    exd_id: ${item.entry.exd_id}`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('Analysis Complete')
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
