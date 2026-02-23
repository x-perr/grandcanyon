/**
 * Reimport Entries with Correct FK References
 *
 * Imports timesheet_entries and expense_entries using actual database IDs.
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
  const pageSize = 1000
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(page * pageSize, (page + 1) * pageSize - 1)
    if (error || !data || data.length === 0) break
    results.push(...data)
    if (data.length < pageSize) break
    page++
  }
  return results
}

async function main() {
  console.log('='.repeat(60))
  console.log('Reimport Entries with Correct FK References')
  console.log('='.repeat(60))

  // Build user ID mapping
  console.log('\n--- Building User Mapping ---')
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
  console.log(`  User mappings: ${userIdMap.size}`)

  // Build project mapping from raw ID to DB ID
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
      if (dbId) {
        rawProjIdToDbId.set(p.proj_id, dbId)
      }
    }
  }
  console.log(`  Project mappings: ${rawProjIdToDbId.size}`)

  // Build task mapping
  console.log('\n--- Building Task Mapping ---')
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
      if (dbTaskId) {
        rawTaskIdToDbId.set(t.task_id, dbTaskId)
      }
    }
  }
  console.log(`  Task mappings: ${rawTaskIdToDbId.size}`)

  // Build billing role mapping
  console.log('\n--- Building Billing Role Mapping ---')
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
      if (dbRoleId) {
        rawRoleIdToDbId.set(r.pr_id, dbRoleId)
      }
    }
  }
  console.log(`  Billing role mappings: ${rawRoleIdToDbId.size}`)

  // Build timesheet mapping from raw ID to DB ID
  console.log('\n--- Building Timesheet Mapping ---')
  const dbTimesheets = await fetchAllPaginated('timesheets', 'id, user_id, week_start')
  const tsKeyToDbId = new Map()
  for (const ts of dbTimesheets) {
    tsKeyToDbId.set(`${ts.user_id}_${ts.week_start}`, ts.id)
  }

  const rawTimesheets = loadJson(RAW_DIR, 'timesheets.json')
  const rawTsIdToDbId = new Map()
  for (const ts of rawTimesheets) {
    const userId = userIdMap.get(ts.ts_emplid)
    if (userId) {
      const dbTsId = tsKeyToDbId.get(`${userId}_${ts.ts_periodfrom}`)
      if (dbTsId) {
        rawTsIdToDbId.set(ts.ts_id, dbTsId)
      }
    }
  }
  console.log(`  Timesheet mappings: ${rawTsIdToDbId.size}`)

  // Build expense mapping
  console.log('\n--- Building Expense Mapping ---')
  const dbExpenses = await fetchAllPaginated('expenses', 'id, user_id, week_start')
  const expKeyToDbId = new Map()
  for (const exp of dbExpenses) {
    expKeyToDbId.set(`${exp.user_id}_${exp.week_start}`, exp.id)
  }

  const rawExpenses = loadJson(RAW_DIR, 'expenses.json')
  const rawExpIdToDbId = new Map()
  for (const exp of rawExpenses) {
    const userId = userIdMap.get(exp.exp_emplid)
    if (userId) {
      const dbExpId = expKeyToDbId.get(`${userId}_${exp.exp_periodfrom}`)
      if (dbExpId) {
        rawExpIdToDbId.set(exp.exp_id, dbExpId)
      }
    }
  }
  console.log(`  Expense mappings: ${rawExpIdToDbId.size}`)

  // Build expense type mapping
  const dbExpTypes = await fetchAllPaginated('expense_types', 'id, code')
  const expTypeCodeToDbId = new Map(dbExpTypes.map(et => [et.code, et.id]))

  const rawExpTypes = loadJson(RAW_DIR, 'expensestype.json')
  const rawExpTypeIdToDbId = new Map()
  for (const et of rawExpTypes) {
    const dbId = expTypeCodeToDbId.get(et.et_code)
    if (dbId) {
      rawExpTypeIdToDbId.set(et.et_id, dbId)
    }
  }
  console.log(`  Expense type mappings: ${rawExpTypeIdToDbId.size}`)

  // Import timesheet entries - ONLY FOR FIRST TIMESHEET (no duplicates)
  console.log('\n--- Importing Timesheet Entries ---')
  const rawTsDetails = loadJson(RAW_DIR, 'timesheetdetails.json')

  // Track which raw timesheet IDs map to which (user, week) to only import first
  const seenTimesheetKeys = new Map() // key -> first raw ts_id
  for (const ts of rawTimesheets) {
    const userId = userIdMap.get(ts.ts_emplid)
    if (!userId) continue
    const key = `${userId}_${ts.ts_periodfrom}`
    if (!seenTimesheetKeys.has(key)) {
      seenTimesheetKeys.set(key, ts.ts_id)
    }
  }

  const firstRawTsIds = new Set(seenTimesheetKeys.values())
  console.log(`  First timesheet per (user,week): ${firstRawTsIds.size}`)

  const tsEntries = []
  let skippedDuplicate = 0
  let skippedMissingProject = 0

  for (const d of rawTsDetails) {
    // Only include entries from FIRST timesheet per (user, week)
    if (!firstRawTsIds.has(d.tsd_tsid)) {
      skippedDuplicate++
      continue
    }

    const timesheetId = rawTsIdToDbId.get(d.tsd_tsid)
    if (!timesheetId) continue

    const projectId = rawProjIdToDbId.get(d.tsd_projid)
    if (!projectId) {
      skippedMissingProject++
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
  console.log(`  Skipped (duplicate timesheets): ${skippedDuplicate}`)
  console.log(`  Skipped (missing project): ${skippedMissingProject}`)

  let imported = 0
  for (let i = 0; i < tsEntries.length; i += BATCH_SIZE) {
    const batch = tsEntries.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('timesheet_entries').insert(batch)
    if (!error) {
      imported += batch.length
    } else {
      console.error(`  Batch ${Math.floor(i/BATCH_SIZE)} error: ${error.message}`)
    }
    if (imported % 1000 === 0 || i + BATCH_SIZE >= tsEntries.length) {
      process.stdout.write(`\r  Imported: ${imported}/${tsEntries.length}`)
    }
  }
  console.log(`\r  Imported: ${imported}/${tsEntries.length}`)

  // Import expense entries - ONLY FOR FIRST EXPENSE (no duplicates)
  console.log('\n--- Importing Expense Entries ---')
  const rawExpDetails = loadJson(RAW_DIR, 'expensedetails.json')

  const seenExpenseKeys = new Map()
  for (const exp of rawExpenses) {
    const userId = userIdMap.get(exp.exp_emplid)
    if (!userId) continue
    const key = `${userId}_${exp.exp_periodfrom}`
    if (!seenExpenseKeys.has(key)) {
      seenExpenseKeys.set(key, exp.exp_id)
    }
  }

  const firstRawExpIds = new Set(seenExpenseKeys.values())
  console.log(`  First expense per (user,week): ${firstRawExpIds.size}`)

  const expEntries = []
  let expSkippedDuplicate = 0
  let expSkippedMissing = 0

  for (const d of rawExpDetails) {
    if (!firstRawExpIds.has(d.exd_expid)) {
      expSkippedDuplicate++
      continue
    }

    const expenseId = rawExpIdToDbId.get(d.exd_expid)
    if (!expenseId) continue

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
  console.log(`  Skipped (duplicate expenses): ${expSkippedDuplicate}`)
  console.log(`  Skipped (missing project/type): ${expSkippedMissing}`)

  let expImported = 0
  for (let i = 0; i < expEntries.length; i += BATCH_SIZE) {
    const batch = expEntries.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('expense_entries').insert(batch)
    if (!error) {
      expImported += batch.length
    } else {
      console.error(`  Batch ${Math.floor(i/BATCH_SIZE)} error: ${error.message}`)
    }
  }
  console.log(`  Imported: ${expImported}/${expEntries.length}`)

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('Import Complete!')
  console.log('='.repeat(60))
  console.log(`  Timesheet entries: ${imported}`)
  console.log(`  Expense entries: ${expImported}`)
  console.log('\nNOTE: Only FIRST timesheet/expense per (user, week) was imported.')
  console.log('Duplicates were intentionally skipped - review FULL_COMPARISON_REPORT.md')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
