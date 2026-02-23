/**
 * Re-import Missing Timesheet and Expense Entries
 *
 * After importing missing clients/projects, this script imports
 * the timesheet and expense entries that were previously skipped.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAW_DIR = path.join(__dirname, 'data', 'raw')
const BATCH_SIZE = 100

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
  console.log('Re-import Missing Entries')
  console.log('='.repeat(60))

  // Load raw data
  const rawClients = loadJson(RAW_DIR, 'clients.json')
  const rawProjects = loadJson(RAW_DIR, 'projects.json')
  const rawTasks = loadJson(RAW_DIR, 'tasks.json')
  const rawTimesheets = loadJson(RAW_DIR, 'timesheets.json')
  const rawTsDetails = loadJson(RAW_DIR, 'timesheetdetails.json')
  const rawExpenses = loadJson(RAW_DIR, 'expenses.json')
  const rawExpDetails = loadJson(RAW_DIR, 'expensedetails.json')
  const rawExpTypes = loadJson(RAW_DIR, 'expensestype.json')

  // Build mappings from raw data
  const rawClientIdToCode = new Map(rawClients.map(c => [c.client_id, c.client_code]))

  // Get all DB data
  console.log('\n--- Loading DB Data ---')
  const dbClients = await fetchAllPaginated('clients', 'id, code')
  const clientCodeToDbId = new Map(dbClients.map(c => [c.code, c.id]))
  console.log(`  DB Clients: ${dbClients.length}`)

  const dbProjects = await fetchAllPaginated('projects', 'id, code, client_id')
  const dbClientIdToCode = new Map()
  for (const [code, id] of clientCodeToDbId.entries()) {
    dbClientIdToCode.set(id, code)
  }

  const projectKeyToDbId = new Map()
  for (const p of dbProjects) {
    const clientCode = dbClientIdToCode.get(p.client_id)
    if (clientCode) {
      projectKeyToDbId.set(`${clientCode}_${p.code}`, p.id)
    }
  }
  console.log(`  DB Projects: ${dbProjects.length}`)

  // Build raw project ID to DB ID mapping
  const rawProjIdToDbId = new Map()
  for (const p of rawProjects) {
    const clientCode = rawClientIdToCode.get(p.proj_clientid)
    if (clientCode) {
      const dbId = projectKeyToDbId.get(`${clientCode}_${p.proj_code}`)
      if (dbId) rawProjIdToDbId.set(p.proj_id, dbId)
    }
  }
  console.log(`  Project mappings: ${rawProjIdToDbId.size}`)

  // Task mapping
  const dbTasks = await fetchAllPaginated('project_tasks', 'id, code, project_id')
  const taskKeyToDbId = new Map()
  for (const t of dbTasks) {
    taskKeyToDbId.set(`${t.project_id}_${t.code}`, t.id)
  }

  const rawTaskIdToDbId = new Map()
  for (const t of rawTasks) {
    const dbProjId = rawProjIdToDbId.get(t.task_projid)
    if (dbProjId) {
      const dbTaskId = taskKeyToDbId.get(`${dbProjId}_${t.task_code}`)
      if (dbTaskId) rawTaskIdToDbId.set(t.task_id, dbTaskId)
    }
  }
  console.log(`  Task mappings: ${rawTaskIdToDbId.size}`)

  // Expense type mapping
  const dbExpTypes = await fetchAllPaginated('expense_types', 'id, code')
  const expTypeCodeToDbId = new Map(dbExpTypes.map(et => [et.code, et.id]))

  const rawExpTypeIdToDbId = new Map()
  for (const et of rawExpTypes) {
    const dbId = expTypeCodeToDbId.get(et.et_code)
    if (dbId) rawExpTypeIdToDbId.set(et.et_id, dbId)
  }

  // Get people mapping
  const dbPeople = await fetchAllPaginated('people', 'id, legacy_user_id')
  const legacyIdToPeopleId = new Map(dbPeople.map(p => [p.legacy_user_id, p.id]))
  console.log(`  People mappings: ${legacyIdToPeopleId.size}`)

  // Get existing timesheets
  const dbTimesheets = await fetchAllPaginated('timesheets', 'id, person_id, week_start')
  const tsKeyToDbId = new Map()
  for (const ts of dbTimesheets) {
    tsKeyToDbId.set(`${ts.person_id}_${ts.week_start}`, ts.id)
  }
  console.log(`  DB Timesheets: ${dbTimesheets.length}`)

  // Get existing timesheet entries (to avoid duplicates)
  const dbTsEntries = await fetchAllPaginated('timesheet_entries', 'id, timesheet_id, project_id')
  const existingTsEntries = new Set(dbTsEntries.map(e => `${e.timesheet_id}_${e.project_id}`))
  console.log(`  DB Timesheet Entries: ${dbTsEntries.length}`)

  // Build raw timesheet ID to DB ID mapping
  const rawTsIdToDbId = new Map()
  for (const ts of rawTimesheets) {
    const personId = legacyIdToPeopleId.get(ts.ts_emplid)
    if (personId) {
      const dbId = tsKeyToDbId.get(`${personId}_${ts.ts_periodfrom}`)
      if (dbId) rawTsIdToDbId.set(ts.ts_id, dbId)
    }
  }
  console.log(`  Timesheet mappings: ${rawTsIdToDbId.size}`)

  // Find missing timesheet entries
  console.log('\n--- Finding Missing Timesheet Entries ---')
  const missingTsEntries = []

  for (const d of rawTsDetails) {
    const timesheetId = rawTsIdToDbId.get(d.tsd_tsid)
    if (!timesheetId) continue

    const projectId = rawProjIdToDbId.get(d.tsd_projid)
    if (!projectId) continue

    // Skip if already exists
    const key = `${timesheetId}_${projectId}`
    if (existingTsEntries.has(key)) continue

    const hours = [
      parseFloat(d.tsd_time1) || 0,
      parseFloat(d.tsd_time2) || 0,
      parseFloat(d.tsd_time3) || 0,
      parseFloat(d.tsd_time4) || 0,
      parseFloat(d.tsd_time5) || 0,
      parseFloat(d.tsd_time6) || 0,
      parseFloat(d.tsd_time7) || 0,
    ]

    missingTsEntries.push({
      id: uuidv4(),
      timesheet_id: timesheetId,
      project_id: projectId,
      task_id: rawTaskIdToDbId.get(d.tsd_taskid) || null,
      description: d.tsd_notes || null,
      hours,
      is_billable: d.tsd_billable === '1' || d.tsd_billable === 1,
      created_at: new Date().toISOString(),
    })
  }

  console.log(`  Missing timesheet entries to import: ${missingTsEntries.length}`)

  // Import missing timesheet entries
  if (missingTsEntries.length > 0) {
    let imported = 0
    for (let i = 0; i < missingTsEntries.length; i += BATCH_SIZE) {
      const batch = missingTsEntries.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('timesheet_entries').insert(batch)
      if (!error) {
        imported += batch.length
      } else {
        console.error(`  Batch error: ${error.message}`)
      }
    }
    console.log(`  Imported: ${imported}`)
  }

  // Get existing expenses
  const dbExpenses = await fetchAllPaginated('expenses', 'id, person_id, week_start')
  const expKeyToDbId = new Map()
  for (const exp of dbExpenses) {
    expKeyToDbId.set(`${exp.person_id}_${exp.week_start}`, exp.id)
  }

  // Build raw expense ID to DB ID mapping
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
  const existingExpEntries = new Set(dbExpEntries.map(e => `${e.expense_id}_${e.project_id}_${e.expense_type_id}`))
  console.log(`  DB Expense Entries: ${dbExpEntries.length}`)

  // Find missing expense entries
  console.log('\n--- Finding Missing Expense Entries ---')
  const missingExpEntries = []

  for (const d of rawExpDetails) {
    const expenseId = rawExpIdToDbId.get(d.exd_expid)
    if (!expenseId) continue

    const projectId = rawProjIdToDbId.get(d.exd_projid)
    const expTypeId = rawExpTypeIdToDbId.get(d.exd_etid)
    if (!projectId || !expTypeId) continue

    // Skip if already exists (include expense_type_id in key)
    const key = `${expenseId}_${projectId}_${expTypeId}`
    if (existingExpEntries.has(key)) continue

    missingExpEntries.push({
      id: uuidv4(),
      expense_id: expenseId,
      expense_type_id: expTypeId,
      project_id: projectId,
      task_id: rawTaskIdToDbId.get(d.exd_taskid) || null,
      expense_date: d.exd_date || null,
      description: d.exd_desc || null,
      receipt_number: d.exd_invoiceno || null,
      quantity: d.exd_unitnb || 1,
      unit_price: parseFloat(d.exd_unitvalue) || 0,
      subtotal: parseFloat(d.exd_net) || 0,
      gst_amount: parseFloat(d.exd_tps) || 0,
      qst_amount: parseFloat(d.exd_tvp) || 0,
      total: parseFloat(d.exd_total) || 0,
      is_billable: d.exd_billable === '1' || d.exd_billable === 1,
      created_at: new Date().toISOString(),
    })
  }

  console.log(`  Missing expense entries to import: ${missingExpEntries.length}`)

  // Import missing expense entries
  if (missingExpEntries.length > 0) {
    let imported = 0
    for (let i = 0; i < missingExpEntries.length; i += BATCH_SIZE) {
      const batch = missingExpEntries.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('expense_entries').insert(batch)
      if (!error) {
        imported += batch.length
      } else {
        console.error(`  Batch error: ${error.message}`)
      }
    }
    console.log(`  Imported: ${imported}`)
  }

  // Final verification
  console.log('\n' + '='.repeat(60))
  console.log('Verification')
  console.log('='.repeat(60))

  const finalTsEntries = await fetchAllPaginated('timesheet_entries', 'id, hours')
  console.log(`\nTimesheet entries in DB: ${finalTsEntries.length}`)
  console.log(`Expected (raw): ${rawTsDetails.length}`)

  const finalTotalHours = finalTsEntries.reduce((sum, e) => {
    return sum + (e.hours?.reduce((s, h) => s + (h || 0), 0) || 0)
  }, 0)
  console.log(`Total hours in DB: ${finalTotalHours}`)

  const finalExpEntries = await fetchAllPaginated('expense_entries', 'id')
  console.log(`\nExpense entries in DB: ${finalExpEntries.length}`)
  console.log(`Expected (raw): ${rawExpDetails.length}`)

  console.log('\n' + '='.repeat(60))
  console.log('Re-import Complete!')
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
