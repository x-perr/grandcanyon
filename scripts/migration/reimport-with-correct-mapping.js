/**
 * Reimport with Correct User Mapping
 *
 * Reimports timesheets and expenses using the corrected user mapping
 * where each legacy user has their own unique profile.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAW_DIR = path.join(__dirname, 'data', 'raw')
const REPORT_DIR = path.join(__dirname, '..', '..', 'docs', 'migration')
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

async function clearTable(table) {
  let deleted = 0
  while (true) {
    const { data } = await supabase.from(table).select('id').limit(1000)
    if (!data || data.length === 0) break
    const ids = data.map(r => r.id)
    await supabase.from(table).delete().in('id', ids)
    deleted += ids.length
  }
  return deleted
}

async function main() {
  console.log('='.repeat(60))
  console.log('Reimport with Correct User Mapping')
  console.log('='.repeat(60))

  // Load user mapping
  const mappingPath = path.join(REPORT_DIR, 'USER_MAPPING.json')
  const userMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'))
  const rawUserIdToProfileId = new Map(userMapping.map(m => [m.raw_user_id, m.profile_id]))
  console.log(`\nUser mapping loaded: ${rawUserIdToProfileId.size} users`)

  // Build project mapping
  console.log('\n--- Building Project Mapping ---')
  const rawClients = loadJson(RAW_DIR, 'clients.json')
  const rawClientIdToCode = new Map(rawClients.map(c => [c.client_id, c.client_code]))

  const dbClients = await fetchAllPaginated('clients', 'id, code')
  const clientCodeToDbId = new Map(dbClients.map(c => [c.code, c.id]))

  const dbProjects = await fetchAllPaginated('projects', 'id, code, client_id')
  const dbClientIdToCode = new Map([...clientCodeToDbId.entries()].map(([code, id]) => [id, code]))
  const projectKeyToDbId = new Map()
  for (const p of dbProjects) {
    const clientCode = dbClientIdToCode.get(p.client_id)
    if (clientCode) {
      projectKeyToDbId.set(`${clientCode}_${p.code}`, p.id)
    }
  }

  const rawProjects = loadJson(RAW_DIR, 'projects.json')
  const rawProjIdToDbId = new Map()
  for (const p of rawProjects) {
    const clientCode = rawClientIdToCode.get(p.proj_clientid)
    if (clientCode) {
      const dbId = projectKeyToDbId.get(`${clientCode}_${p.proj_code}`)
      if (dbId) rawProjIdToDbId.set(p.proj_id, dbId)
    }
  }
  console.log(`  Project mappings: ${rawProjIdToDbId.size}`)

  // Build task mapping
  const dbTasks = await fetchAllPaginated('project_tasks', 'id, code, project_id')
  const taskKeyToDbId = new Map()
  for (const t of dbTasks) {
    taskKeyToDbId.set(`${t.project_id}_${t.code}`, t.id)
  }

  const rawTasks = loadJson(RAW_DIR, 'tasks.json')
  const rawTaskIdToDbId = new Map()
  for (const t of rawTasks) {
    const dbProjId = rawProjIdToDbId.get(t.task_projid)
    if (dbProjId) {
      const dbTaskId = taskKeyToDbId.get(`${dbProjId}_${t.task_code}`)
      if (dbTaskId) rawTaskIdToDbId.set(t.task_id, dbTaskId)
    }
  }
  console.log(`  Task mappings: ${rawTaskIdToDbId.size}`)

  // Build billing role mapping
  const dbRoles = await fetchAllPaginated('project_billing_roles', 'id, code, project_id')
  const roleKeyToDbId = new Map()
  for (const r of dbRoles) {
    roleKeyToDbId.set(`${r.project_id}_${r.code}`, r.id)
  }

  const rawRoles = loadJson(RAW_DIR, 'projectroles.json')
  const rawRoleIdToDbId = new Map()
  for (const r of rawRoles) {
    const dbProjId = rawProjIdToDbId.get(r.pr_projid)
    if (dbProjId) {
      const dbRoleId = roleKeyToDbId.get(`${dbProjId}_${r.pr_code}`)
      if (dbRoleId) rawRoleIdToDbId.set(r.pr_id, dbRoleId)
    }
  }
  console.log(`  Billing role mappings: ${rawRoleIdToDbId.size}`)

  // Build expense type mapping
  const dbExpTypes = await fetchAllPaginated('expense_types', 'id, code')
  const expTypeCodeToDbId = new Map(dbExpTypes.map(et => [et.code, et.id]))

  const rawExpTypes = loadJson(RAW_DIR, 'expensestype.json')
  const rawExpTypeIdToDbId = new Map()
  for (const et of rawExpTypes) {
    const dbId = expTypeCodeToDbId.get(et.et_code)
    if (dbId) rawExpTypeIdToDbId.set(et.et_id, dbId)
  }
  console.log(`  Expense type mappings: ${rawExpTypeIdToDbId.size}`)

  // Clear existing user-related data
  console.log('\n--- Clearing Existing Data ---')
  let deleted = await clearTable('timesheet_entries')
  console.log(`  timesheet_entries: ${deleted} deleted`)
  deleted = await clearTable('timesheets')
  console.log(`  timesheets: ${deleted} deleted`)
  deleted = await clearTable('expense_entries')
  console.log(`  expense_entries: ${deleted} deleted`)
  deleted = await clearTable('expenses')
  console.log(`  expenses: ${deleted} deleted`)

  // Import timesheets (now each user has unique profile)
  console.log('\n--- Importing Timesheets ---')
  const rawTimesheets = loadJson(RAW_DIR, 'timesheets.json')

  const timesheets = []
  const tsIdMapping = new Map() // raw ts_id -> new db id

  for (const ts of rawTimesheets) {
    const userId = rawUserIdToProfileId.get(ts.ts_emplid)
    if (!userId) continue

    const newId = uuidv4()
    tsIdMapping.set(ts.ts_id, newId)

    timesheets.push({
      id: newId,
      user_id: userId,
      week_start: ts.ts_periodfrom,
      week_end: ts.ts_periodto,
      status: ts.ts_approved === '1' ? 'approved' : ts.ts_submitted === '1' ? 'submitted' : 'draft',
      submitted_at: ts.ts_submittedon || null,
      approved_at: ts.ts_approvedon || null,
      created_at: new Date().toISOString(),
    })
  }

  console.log(`  Timesheets to import: ${timesheets.length}`)

  let imported = 0
  for (let i = 0; i < timesheets.length; i += BATCH_SIZE) {
    const batch = timesheets.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('timesheets').insert(batch)
    if (!error) {
      imported += batch.length
    } else {
      console.error(`  Batch error: ${error.message}`)
    }
    if (imported % 1000 === 0) {
      process.stdout.write(`\r  Imported: ${imported}/${timesheets.length}`)
    }
  }
  console.log(`\r  Imported: ${imported}/${timesheets.length}`)

  // Import timesheet entries
  console.log('\n--- Importing Timesheet Entries ---')
  const rawTsDetails = loadJson(RAW_DIR, 'timesheetdetails.json')

  const tsEntries = []
  let skippedMissingTs = 0
  let skippedMissingProj = 0

  for (const d of rawTsDetails) {
    const timesheetId = tsIdMapping.get(d.tsd_tsid)
    if (!timesheetId) {
      skippedMissingTs++
      continue
    }

    const projectId = rawProjIdToDbId.get(d.tsd_projid)
    if (!projectId) {
      skippedMissingProj++
      continue
    }

    const hours = [
      parseFloat(d.tsd_time1) || 0,
      parseFloat(d.tsd_time2) || 0,
      parseFloat(d.tsd_time3) || 0,
      parseFloat(d.tsd_time4) || 0,
      parseFloat(d.tsd_time5) || 0,
      parseFloat(d.tsd_time6) || 0,
      parseFloat(d.tsd_time7) || 0,
    ]

    tsEntries.push({
      id: uuidv4(),
      timesheet_id: timesheetId,
      project_id: projectId,
      task_id: rawTaskIdToDbId.get(d.tsd_taskid) || null,
      billing_role_id: rawRoleIdToDbId.get(d.tsd_prid) || null,
      description: d.tsd_notes || null,
      hours,
      is_billable: d.tsd_billable === '1' || d.tsd_billable === 1,
      created_at: new Date().toISOString(),
    })
  }

  console.log(`  Entries to import: ${tsEntries.length}`)
  console.log(`  Skipped (missing timesheet): ${skippedMissingTs}`)
  console.log(`  Skipped (missing project): ${skippedMissingProj}`)

  imported = 0
  for (let i = 0; i < tsEntries.length; i += BATCH_SIZE) {
    const batch = tsEntries.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('timesheet_entries').insert(batch)
    if (!error) {
      imported += batch.length
    } else {
      console.error(`  Batch error: ${error.message}`)
    }
    if (imported % 1000 === 0) {
      process.stdout.write(`\r  Imported: ${imported}/${tsEntries.length}`)
    }
  }
  console.log(`\r  Imported: ${imported}/${tsEntries.length}`)

  // Import expenses
  console.log('\n--- Importing Expenses ---')
  const rawExpenses = loadJson(RAW_DIR, 'expenses.json')

  const expenses = []
  const expIdMapping = new Map()

  for (const exp of rawExpenses) {
    const userId = rawUserIdToProfileId.get(exp.exp_emplid)
    if (!userId) continue

    const newId = uuidv4()
    expIdMapping.set(exp.exp_id, newId)

    expenses.push({
      id: newId,
      user_id: userId,
      week_start: exp.exp_periodfrom,
      week_end: exp.exp_periodto,
      status: exp.exp_approved === '1' ? 'approved' : exp.exp_submitted === '1' ? 'submitted' : 'draft',
      submitted_at: exp.exp_submittedon || null,
      approved_at: exp.exp_approvedon || null,
      created_at: new Date().toISOString(),
    })
  }

  console.log(`  Expenses to import: ${expenses.length}`)

  imported = 0
  for (let i = 0; i < expenses.length; i += BATCH_SIZE) {
    const batch = expenses.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('expenses').insert(batch)
    if (!error) {
      imported += batch.length
    } else {
      console.error(`  Batch error: ${error.message}`)
    }
  }
  console.log(`  Imported: ${imported}/${expenses.length}`)

  // Import expense entries
  console.log('\n--- Importing Expense Entries ---')
  const rawExpDetails = loadJson(RAW_DIR, 'expensedetails.json')

  const expEntries = []
  let expSkippedMissing = 0

  for (const d of rawExpDetails) {
    const expenseId = expIdMapping.get(d.exd_expid)
    if (!expenseId) {
      expSkippedMissing++
      continue
    }

    const projectId = rawProjIdToDbId.get(d.exd_projid)
    const expTypeId = rawExpTypeIdToDbId.get(d.exd_etid)
    if (!projectId || !expTypeId) {
      expSkippedMissing++
      continue
    }

    expEntries.push({
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

  console.log(`  Entries to import: ${expEntries.length}`)
  console.log(`  Skipped (missing parent/type/project): ${expSkippedMissing}`)

  imported = 0
  for (let i = 0; i < expEntries.length; i += BATCH_SIZE) {
    const batch = expEntries.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('expense_entries').insert(batch)
    if (!error) {
      imported += batch.length
    } else {
      console.error(`  Batch error: ${error.message}`)
    }
  }
  console.log(`  Imported: ${imported}/${expEntries.length}`)

  console.log('\n' + '='.repeat(60))
  console.log('Import Complete!')
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
