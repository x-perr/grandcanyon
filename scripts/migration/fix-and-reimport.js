/**
 * Fix and Re-import Script
 *
 * Fixes the profile ID mapping and expense_entries schema issues,
 * then re-imports the affected tables.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TRANSFORMED_DIR = path.join(__dirname, 'data', 'transformed')
const BATCH_SIZE = 100

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function loadJson(filename) {
  const filepath = path.join(TRANSFORMED_DIR, filename)
  return JSON.parse(fs.readFileSync(filepath, 'utf8'))
}

function saveJson(filename, data) {
  const filepath = path.join(TRANSFORMED_DIR, filename)
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
  console.log(`Saved ${data.length} records → ${filename}`)
}

async function importTable(tableName, data) {
  if (data.length === 0) {
    console.log(`  ${tableName}: No records`)
    return { imported: 0, errors: [] }
  }

  let imported = 0
  const errors = []

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from(tableName).insert(batch)

    if (error) {
      errors.push({ batch: Math.floor(i / BATCH_SIZE), error: error.message })
      if (error.code === '23505') {
        // Unique constraint - try one by one
        for (const record of batch) {
          const { error: singleError } = await supabase.from(tableName).insert(record)
          if (!singleError) imported++
        }
      } else {
        console.error(`  Error: ${error.message}`)
      }
    } else {
      imported += batch.length
    }

    if ((i + BATCH_SIZE) % 500 === 0) {
      process.stdout.write(`\r  ${tableName}: ${imported}/${data.length}`)
    }
  }

  console.log(`\r  ${tableName}: ${imported}/${data.length} imported`)
  return { imported, errors }
}

async function main() {
  console.log('='.repeat(60))
  console.log('Fix and Re-import Script')
  console.log('='.repeat(60))

  // Step 1: Get email → profile_id mapping from database
  console.log('\n--- Step 1: Fetching profile ID mapping ---')
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email')

  if (profileError) {
    console.error('Failed to fetch profiles:', profileError.message)
    process.exit(1)
  }

  const emailToProfileId = new Map()
  profiles.forEach(p => {
    if (p.email) {
      emailToProfileId.set(p.email.toLowerCase(), p.id)
    }
  })
  console.log(`Fetched ${emailToProfileId.size} profile mappings`)

  // Load our auth_users to get email → old_id mapping
  const authUsers = loadJson('auth_users.json')
  const oldIdToEmail = new Map()
  authUsers.forEach(u => {
    if (u.email) {
      oldIdToEmail.set(u.id, u.email.toLowerCase())
    }
  })

  // Create old_id → new_id mapping
  const profileIdMap = new Map()
  for (const [oldId, email] of oldIdToEmail) {
    const newId = emailToProfileId.get(email)
    if (newId) {
      profileIdMap.set(oldId, newId)
    }
  }
  console.log(`Created ${profileIdMap.size} profile ID mappings`)

  // Step 2: Fix timesheets with correct profile IDs
  console.log('\n--- Step 2: Fixing timesheets ---')
  const timesheets = loadJson('timesheets.json')
  const fixedTimesheets = timesheets.map(ts => ({
    ...ts,
    user_id: profileIdMap.get(ts.user_id) || ts.user_id,
    approved_by: ts.approved_by ? (profileIdMap.get(ts.approved_by) || ts.approved_by) : null,
    locked_by: ts.locked_by ? (profileIdMap.get(ts.locked_by) || ts.locked_by) : null,
  })).filter(ts => profileIdMap.has(ts.user_id) || emailToProfileId.has(ts.user_id?.toLowerCase?.()))
  saveJson('timesheets_fixed.json', fixedTimesheets)

  // Step 3: Fix timesheet_entries (need new timesheet IDs)
  console.log('\n--- Step 3: Fixing timesheet entries ---')
  // First, get the actual timesheet IDs from database
  const { data: dbTimesheets } = await supabase
    .from('timesheets')
    .select('id, user_id, week_start')

  // Create a lookup by user_id + week_start
  const timesheetLookup = new Map()
  dbTimesheets?.forEach(ts => {
    const key = `${ts.user_id}_${ts.week_start}`
    timesheetLookup.set(key, ts.id)
  })

  const timesheetEntries = loadJson('timesheet_entries.json')
  // We need to map old timesheet_id to new timesheet_id
  // For now, skip entries whose timesheets weren't imported
  console.log(`  Skipping timesheet entries (timesheets need to be imported first)`)

  // Step 4: Fix expenses with correct profile IDs
  console.log('\n--- Step 4: Fixing expenses ---')
  const expenses = loadJson('expenses.json')
  const fixedExpenses = expenses.map(exp => ({
    ...exp,
    user_id: profileIdMap.get(exp.user_id) || exp.user_id,
    approved_by: exp.approved_by ? (profileIdMap.get(exp.approved_by) || exp.approved_by) : null,
  })).filter(exp => profileIdMap.has(exp.user_id) || emailToProfileId.has(exp.user_id?.toLowerCase?.()))
  saveJson('expenses_fixed.json', fixedExpenses)

  // Step 5: Fix expense_entries column names
  console.log('\n--- Step 5: Fixing expense entries schema ---')
  const expenseEntries = loadJson('expense_entries.json')
  const fixedExpenseEntries = expenseEntries.map(entry => ({
    id: entry.id,
    expense_id: entry.expense_id,
    expense_type_id: entry.expense_type_id,
    project_id: entry.project_id,
    task_id: entry.task_id,
    expense_date: entry.date,  // Renamed from 'date'
    description: entry.description,
    receipt_number: entry.external_invoice_number,  // Renamed
    quantity: entry.quantity,
    unit_price: entry.unit_amount,  // Renamed from 'unit_amount'
    subtotal: entry.subtotal,
    gst_amount: entry.gst_amount,
    qst_amount: entry.qst_amount,
    total: entry.total,
    is_billable: entry.is_billable,
    created_at: entry.created_at,
  }))
  saveJson('expense_entries_fixed.json', fixedExpenseEntries)

  // Step 6: Fix project_members with correct profile IDs
  console.log('\n--- Step 6: Fixing project members ---')
  const projectMembers = loadJson('project_members.json')
  const fixedProjectMembers = projectMembers.map(pm => ({
    ...pm,
    user_id: profileIdMap.get(pm.user_id) || pm.user_id,
  })).filter(pm => profileIdMap.has(pm.user_id) || emailToProfileId.has(pm.user_id?.toLowerCase?.()))
  saveJson('project_members_fixed.json', fixedProjectMembers)

  // Step 7: Import fixed tables
  console.log('\n--- Step 7: Importing fixed tables ---')

  // Clear existing partial data first
  console.log('Clearing partial data...')
  await supabase.from('timesheet_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('timesheets').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('expense_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('project_members').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  // Import fixed data
  await importTable('project_members', fixedProjectMembers)
  await importTable('timesheets', fixedTimesheets)
  await importTable('expenses', fixedExpenses)

  // Now fix and import timesheet_entries
  console.log('\n--- Step 8: Fixing and importing timesheet entries ---')
  const { data: newTimesheets } = await supabase.from('timesheets').select('id, user_id, week_start')

  // Create lookup: old_timesheet_id → new_timesheet_id
  // We need the old timesheets data to map
  const oldTimesheets = loadJson('timesheets.json')
  const oldTsLookup = new Map()
  oldTimesheets.forEach(ts => {
    const key = `${ts.user_id}_${ts.week_start}`
    oldTsLookup.set(ts.id, key)
  })

  const newTsLookup = new Map()
  newTimesheets?.forEach(ts => {
    const key = `${ts.user_id}_${ts.week_start}`
    newTsLookup.set(key, ts.id)
  })

  const timesheetIdMap = new Map()
  for (const [oldId, key] of oldTsLookup) {
    // Map old user_id to new user_id first
    const parts = key.split('_')
    const oldUserId = parts[0]
    const weekStart = parts.slice(1).join('_')
    const newUserId = profileIdMap.get(oldUserId)
    if (newUserId) {
      const newKey = `${newUserId}_${weekStart}`
      const newTsId = newTsLookup.get(newKey)
      if (newTsId) {
        timesheetIdMap.set(oldId, newTsId)
      }
    }
  }

  const fixedTimesheetEntries = timesheetEntries
    .map(entry => ({
      ...entry,
      timesheet_id: timesheetIdMap.get(entry.timesheet_id),
    }))
    .filter(entry => entry.timesheet_id)

  saveJson('timesheet_entries_fixed.json', fixedTimesheetEntries)
  await importTable('timesheet_entries', fixedTimesheetEntries)

  // Import expense_entries
  console.log('\n--- Step 9: Importing expense entries ---')
  // Need to map expense_id similarly
  const { data: newExpenses } = await supabase.from('expenses').select('id, user_id, week_start')

  const oldExpenses = loadJson('expenses.json')
  const oldExpLookup = new Map()
  oldExpenses.forEach(exp => {
    const key = `${exp.user_id}_${exp.week_start}`
    oldExpLookup.set(exp.id, key)
  })

  const newExpLookup = new Map()
  newExpenses?.forEach(exp => {
    const key = `${exp.user_id}_${exp.week_start}`
    newExpLookup.set(key, exp.id)
  })

  const expenseIdMap = new Map()
  for (const [oldId, key] of oldExpLookup) {
    const parts = key.split('_')
    const oldUserId = parts[0]
    const weekStart = parts.slice(1).join('_')
    const newUserId = profileIdMap.get(oldUserId)
    if (newUserId) {
      const newKey = `${newUserId}_${weekStart}`
      const newExpId = newExpLookup.get(newKey)
      if (newExpId) {
        expenseIdMap.set(oldId, newExpId)
      }
    }
  }

  const finalExpenseEntries = fixedExpenseEntries
    .map(entry => ({
      ...entry,
      expense_id: expenseIdMap.get(entry.expense_id),
    }))
    .filter(entry => entry.expense_id)

  await importTable('expense_entries', finalExpenseEntries)

  console.log('\n' + '='.repeat(60))
  console.log('Fix and re-import complete!')
  console.log('Run "npm run verify" to check the results.')
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
