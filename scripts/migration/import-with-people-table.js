/**
 * Import with People Table
 *
 * Imports legacy users into the new people table and links timesheets/expenses.
 * This creates a clean separation between identity (people) and accounts (profiles).
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

async function main() {
  console.log('='.repeat(60))
  console.log('Import with People Table')
  console.log('='.repeat(60))

  // Check if people table exists
  const { error: checkError } = await supabase.from('people').select('id').limit(1)
  if (checkError && checkError.message.includes('does not exist')) {
    console.error('\nERROR: people table does not exist!')
    console.error('Please run schema-add-people-table.sql first.')
    process.exit(1)
  }

  // Load raw users
  const rawUsers = loadJson(RAW_DIR, 'users.json')
  console.log(`\nRaw users to import: ${rawUsers.length}`)

  // Check existing people
  const existingPeople = await fetchAllPaginated('people', 'id, legacy_user_id')
  const existingLegacyIds = new Set(existingPeople.map(p => p.legacy_user_id))
  console.log(`Existing people in DB: ${existingPeople.length}`)

  // Get existing profiles
  const existingProfiles = await fetchAllPaginated('profiles', 'id, email, person_id')
  const profileByEmail = new Map()
  existingProfiles.forEach(p => {
    if (p.email) profileByEmail.set(p.email.toLowerCase(), p)
  })
  console.log(`Existing profiles in DB: ${existingProfiles.length}`)

  // Create people records
  console.log('\n--- Creating People Records ---')
  const peopleToCreate = []
  const legacyIdToPeopleId = new Map()

  // First pass: determine mapping and what to create
  for (const user of rawUsers) {
    if (existingLegacyIds.has(user.user_id)) {
      // Already exists - get the existing ID
      const existing = existingPeople.find(p => p.legacy_user_id === user.user_id)
      if (existing) {
        legacyIdToPeopleId.set(user.user_id, existing.id)
      }
    } else {
      // Need to create
      const newId = uuidv4()
      legacyIdToPeopleId.set(user.user_id, newId)

      peopleToCreate.push({
        id: newId,
        legacy_user_id: user.user_id,
        first_name: user.user_fname || '',
        last_name: user.user_lname || '',
        email: user.user_email?.trim() || null,
        is_active: user.user_active === '1' || user.user_active === 1,
        created_at: new Date().toISOString(),
      })
    }
  }

  console.log(`  People to create: ${peopleToCreate.length}`)
  console.log(`  Already exist: ${existingLegacyIds.size}`)

  // Insert new people
  if (peopleToCreate.length > 0) {
    let created = 0
    for (let i = 0; i < peopleToCreate.length; i += BATCH_SIZE) {
      const batch = peopleToCreate.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('people').insert(batch)
      if (!error) {
        created += batch.length
      } else {
        console.error(`  Batch error: ${error.message}`)
      }
    }
    console.log(`  Created: ${created}`)
  }

  // Link profiles to people
  console.log('\n--- Linking Profiles to People ---')
  let linkedProfiles = 0

  for (const user of rawUsers) {
    const personId = legacyIdToPeopleId.get(user.user_id)
    if (!personId) continue

    // Find profile by email
    let email = user.user_email?.trim()?.toLowerCase()
    if (!email || !email.includes('@')) {
      email = `user_${user.user_id}@grandcanyon.local`
    }

    const profile = profileByEmail.get(email)
    if (profile && !profile.person_id) {
      const { error } = await supabase
        .from('profiles')
        .update({ person_id: personId })
        .eq('id', profile.id)

      if (!error) {
        linkedProfiles++
      }
    }
  }
  console.log(`  Linked profiles: ${linkedProfiles}`)

  // Build other mappings
  console.log('\n--- Building Mappings ---')

  // Project mapping
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

  // Task mapping
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

  // Expense type mapping
  const dbExpTypes = await fetchAllPaginated('expense_types', 'id, code')
  const expTypeCodeToDbId = new Map(dbExpTypes.map(et => [et.code, et.id]))

  const rawExpTypes = loadJson(RAW_DIR, 'expensestype.json')
  const rawExpTypeIdToDbId = new Map()
  for (const et of rawExpTypes) {
    const dbId = expTypeCodeToDbId.get(et.et_code)
    if (dbId) rawExpTypeIdToDbId.set(et.et_id, dbId)
  }
  console.log(`  Expense type mappings: ${rawExpTypeIdToDbId.size}`)

  // Import timesheets with person_id (tables already cleared via SQL TRUNCATE)
  console.log('\n--- Importing Timesheets ---')
  const rawTimesheets = loadJson(RAW_DIR, 'timesheets.json')

  const timesheets = []
  const tsIdMapping = new Map()

  for (const ts of rawTimesheets) {
    const personId = legacyIdToPeopleId.get(ts.ts_emplid)
    if (!personId) continue

    const newId = uuidv4()
    tsIdMapping.set(ts.ts_id, newId)

    timesheets.push({
      id: newId,
      person_id: personId,
      user_id: null,  // No longer used
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
      break
    }
    if (imported % 2000 === 0) {
      process.stdout.write(`\r  Imported: ${imported}/${timesheets.length}`)
    }
  }
  console.log(`\r  Imported: ${imported}/${timesheets.length}`)

  // Import timesheet entries
  console.log('\n--- Importing Timesheet Entries ---')
  const rawTsDetails = loadJson(RAW_DIR, 'timesheetdetails.json')

  const tsEntries = []
  for (const d of rawTsDetails) {
    const timesheetId = tsIdMapping.get(d.tsd_tsid)
    if (!timesheetId) continue

    const projectId = rawProjIdToDbId.get(d.tsd_projid)
    if (!projectId) continue

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
      description: d.tsd_notes || null,
      hours,
      is_billable: d.tsd_billable === '1' || d.tsd_billable === 1,
      created_at: new Date().toISOString(),
    })
  }

  console.log(`  Entries to import: ${tsEntries.length}`)

  imported = 0
  for (let i = 0; i < tsEntries.length; i += BATCH_SIZE) {
    const batch = tsEntries.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('timesheet_entries').insert(batch)
    if (!error) {
      imported += batch.length
    } else {
      console.error(`  Batch error: ${error.message}`)
    }
    if (imported % 2000 === 0) {
      process.stdout.write(`\r  Imported: ${imported}/${tsEntries.length}`)
    }
  }
  console.log(`\r  Imported: ${imported}/${tsEntries.length}`)

  // Import expenses (tables already cleared via SQL TRUNCATE)
  console.log('\n--- Importing Expenses ---')
  const rawExpenses = loadJson(RAW_DIR, 'expenses.json')

  const expenses = []
  const expIdMapping = new Map()

  for (const exp of rawExpenses) {
    const personId = legacyIdToPeopleId.get(exp.exp_emplid)
    if (!personId) continue

    const newId = uuidv4()
    expIdMapping.set(exp.exp_id, newId)

    expenses.push({
      id: newId,
      person_id: personId,
      user_id: null,
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
  for (const d of rawExpDetails) {
    const expenseId = expIdMapping.get(d.exd_expid)
    if (!expenseId) continue

    const projectId = rawProjIdToDbId.get(d.exd_projid)
    const expTypeId = rawExpTypeIdToDbId.get(d.exd_etid)
    if (!projectId || !expTypeId) continue

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

  // Save people mapping for reference
  const peopleMapping = rawUsers.map(u => ({
    legacy_user_id: u.user_id,
    person_id: legacyIdToPeopleId.get(u.user_id),
    first_name: u.user_fname,
    last_name: u.user_lname,
    legacy_email: u.user_email,
  }))

  const mappingPath = path.join(REPORT_DIR, 'PEOPLE_MAPPING.json')
  fs.writeFileSync(mappingPath, JSON.stringify(peopleMapping, null, 2))
  console.log(`\nPeople mapping saved to: ${mappingPath}`)

  console.log('\n' + '='.repeat(60))
  console.log('Import Complete!')
  console.log('='.repeat(60))
  console.log('\nSummary:')
  console.log(`  People: ${legacyIdToPeopleId.size}`)
  console.log(`  Timesheets: ${timesheets.length}`)
  console.log(`  Timesheet Entries: ${tsEntries.length}`)
  console.log(`  Expenses: ${expenses.length}`)
  console.log(`  Expense Entries: ${expEntries.length}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
