/**
 * Re-import User Tables
 *
 * Clears and re-imports user-dependent tables with all 225 profiles.
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

function saveJson(filename, data) {
  fs.writeFileSync(path.join(TRANS_DIR, filename), JSON.stringify(data, null, 2))
  console.log(`  Saved ${data.length} records → ${filename}`)
}

async function clearTable(tableName) {
  const { count, error } = await supabase
    .from(tableName)
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) {
    console.log(`    ${tableName}: Error - ${error.message}`)
  } else {
    console.log(`    ${tableName}: ${count || 0} deleted`)
  }
}

async function importTable(tableName, data) {
  if (data.length === 0) {
    console.log(`    ${tableName}: No records`)
    return 0
  }

  let imported = 0

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from(tableName).insert(batch)

    if (error) {
      // Try one by one only for specific errors
      if (error.code === '23505') {
        // Skip duplicates silently
      } else {
        console.error(`    Batch ${Math.floor(i / BATCH_SIZE)} error: ${error.message}`)
      }
    } else {
      imported += batch.length
    }

    if ((i + BATCH_SIZE) % 1000 === 0 || i + BATCH_SIZE >= data.length) {
      process.stdout.write(`\r    ${tableName}: ${imported}/${data.length}`)
    }
  }

  console.log(`\r    ${tableName}: ${imported}/${data.length} imported`)
  return imported
}

async function main() {
  console.log('='.repeat(60))
  console.log('Re-import User Tables')
  console.log('='.repeat(60))

  // Build user ID mapping from profiles
  console.log('\n--- Building User ID Mapping ---')
  const { data: profiles } = await supabase.from('profiles').select('id, email')
  const emailToProfileId = new Map()
  profiles?.forEach(p => {
    if (p.email) emailToProfileId.set(p.email.toLowerCase(), p.id)
  })
  console.log(`  Found ${profiles?.length} profiles`)

  const rawUsers = loadJson(RAW_DIR, 'users.json')
  const userIdMap = new Map() // old INT id -> profile UUID

  for (const user of rawUsers) {
    let email = user.user_email?.trim()
    if (!email || !email.includes('@')) {
      email = `user_${user.user_id}@grandcanyon.local`
    }
    const profileId = emailToProfileId.get(email.toLowerCase())
    if (profileId) {
      userIdMap.set(user.user_id, profileId)
    }
  }
  console.log(`  Mapped ${userIdMap.size} users`)

  // Load other ID maps
  const rawProjects = loadJson(RAW_DIR, 'projects.json')
  const transProjects = loadJson(TRANS_DIR, 'projects.json')
  const projectIdMap = new Map()
  rawProjects.forEach((p, i) => {
    if (transProjects[i]) projectIdMap.set(p.proj_id, transProjects[i].id)
  })

  const rawTasks = loadJson(RAW_DIR, 'tasks.json')
  const transTasks = loadJson(TRANS_DIR, 'project_tasks.json')
  const taskIdMap = new Map()
  rawTasks.forEach((t, i) => {
    if (transTasks[i]) taskIdMap.set(t.tsk_id, transTasks[i].id)
  })

  const rawBillingRoles = loadJson(RAW_DIR, 'projectroles.json')
  const transBillingRoles = loadJson(TRANS_DIR, 'project_billing_roles.json')
  const billingRoleIdMap = new Map()
  rawBillingRoles.forEach((br, i) => {
    if (transBillingRoles[i]) billingRoleIdMap.set(br.pr_id, transBillingRoles[i].id)
  })

  const rawExpTypes = loadJson(RAW_DIR, 'expensestype.json')
  const { data: dbExpTypes } = await supabase.from('expense_types').select('id, code')
  const expTypeIdMap = new Map()
  rawExpTypes.forEach(et => {
    const dbType = dbExpTypes?.find(d => d.code === et.et_code)
    if (dbType) expTypeIdMap.set(et.et_id, dbType.id)
  })

  // Clear user-dependent tables
  console.log('\n--- Clearing Tables ---')
  await clearTable('timesheet_entries')
  await clearTable('timesheets')
  await clearTable('expense_entries')
  await clearTable('expenses')
  await clearTable('project_members')

  // Import project_members
  console.log('\n--- Importing project_members ---')
  const rawProjectUserRoles = loadJson(RAW_DIR, 'projectuserrole.json')
  const projectMembers = rawProjectUserRoles
    .map(pur => {
      const userId = userIdMap.get(pur.pur_userid)  // Fixed: pur_userid not pur_emplid
      const billingRoleId = billingRoleIdMap.get(pur.pur_prid)
      if (!userId || !billingRoleId) return null

      const billingRole = transBillingRoles.find(br => br.id === billingRoleId)
      if (!billingRole) return null

      return {
        id: uuidv4(),
        project_id: billingRole.project_id,
        user_id: userId,
        billing_role_id: billingRoleId,
        hourly_rate: null,  // No rate in raw data
        is_active: pur.pur_active === '1' || pur.pur_active === 1,
        created_at: new Date().toISOString(),
      }
    })
    .filter(pm => pm !== null)
  saveJson('project_members_final.json', projectMembers)
  await importTable('project_members', projectMembers)

  // Import timesheets
  console.log('\n--- Importing timesheets ---')
  const rawTimesheets = loadJson(RAW_DIR, 'timesheets.json')
  const timesheetIdMap = new Map()
  const seenTimesheetKeys = new Set()

  const timesheets = rawTimesheets
    .map(ts => {
      const userId = userIdMap.get(ts.ts_emplid)
      if (!userId) return null

      // Skip duplicates
      const key = `${userId}_${ts.ts_periodfrom}`
      if (seenTimesheetKeys.has(key)) return null
      seenTimesheetKeys.add(key)

      const id = uuidv4()
      timesheetIdMap.set(ts.ts_id, id)

      return {
        id,
        user_id: userId,
        week_start: ts.ts_periodfrom,
        week_end: ts.ts_periodto,
        status: ts.ts_approved === '1' ? 'approved' : (ts.ts_submitted === '1' ? 'submitted' : 'draft'),
        submitted_at: ts.ts_submittedon || null,
        approved_at: ts.ts_approvedon || null,
        approved_by: ts.ts_approvedby ? userIdMap.get(ts.ts_approvedby) : null,
        locked_by: ts.ts_lockedby ? userIdMap.get(ts.ts_lockedby) : null,
        locked_at: null,
        created_at: new Date().toISOString(),
      }
    })
    .filter(t => t !== null)
  saveJson('timesheets_final.json', timesheets)
  await importTable('timesheets', timesheets)

  // Import timesheet_entries
  console.log('\n--- Importing timesheet_entries ---')
  const rawTsDetails = loadJson(RAW_DIR, 'timesheetdetails.json')
  const tsEntries = rawTsDetails
    .map(tsd => {
      const timesheetId = timesheetIdMap.get(tsd.tsd_tsid)
      const projectId = projectIdMap.get(tsd.tsd_projid)
      if (!timesheetId || !projectId) return null

      const hours = [
        parseFloat(tsd.tsd_time1) || 0,
        parseFloat(tsd.tsd_time2) || 0,
        parseFloat(tsd.tsd_time3) || 0,
        parseFloat(tsd.tsd_time4) || 0,
        parseFloat(tsd.tsd_time5) || 0,
        parseFloat(tsd.tsd_time6) || 0,
        parseFloat(tsd.tsd_time7) || 0,
      ]

      return {
        id: uuidv4(),
        timesheet_id: timesheetId,
        project_id: projectId,
        task_id: taskIdMap.get(tsd.tsd_taskid) || null,
        billing_role_id: billingRoleIdMap.get(tsd.tsd_prid) || null,
        description: tsd.tsd_notes || null,
        hours,
        is_billable: tsd.tsd_billable === '1' || tsd.tsd_billable === 1,
        created_at: new Date().toISOString(),
      }
    })
    .filter(e => e !== null)
  saveJson('timesheet_entries_final.json', tsEntries)
  await importTable('timesheet_entries', tsEntries)

  // Import expenses
  console.log('\n--- Importing expenses ---')
  const rawExpenses = loadJson(RAW_DIR, 'expenses.json')
  const expenseIdMap = new Map()
  const seenExpenseKeys = new Set()

  const expenses = rawExpenses
    .map(exp => {
      const userId = userIdMap.get(exp.exp_emplid)
      if (!userId) return null

      // Skip duplicates
      const key = `${userId}_${exp.exp_periodfrom}`
      if (seenExpenseKeys.has(key)) return null
      seenExpenseKeys.add(key)

      const id = uuidv4()
      expenseIdMap.set(exp.exp_id, id)

      return {
        id,
        user_id: userId,
        week_start: exp.exp_periodfrom,
        week_end: exp.exp_periodto,
        status: exp.exp_approved === '1' ? 'approved' : (exp.exp_submitted === '1' ? 'submitted' : 'draft'),
        submitted_at: exp.exp_submittedon || null,
        approved_at: exp.exp_approvedon || null,
        approved_by: exp.exp_approvedby ? userIdMap.get(exp.exp_approvedby) : null,
        created_at: new Date().toISOString(),
      }
    })
    .filter(e => e !== null)
  saveJson('expenses_final.json', expenses)
  await importTable('expenses', expenses)

  // Import expense_entries
  console.log('\n--- Importing expense_entries ---')
  const rawExpDetails = loadJson(RAW_DIR, 'expensedetails.json')
  const expEntries = rawExpDetails
    .map(ed => {
      const expenseId = expenseIdMap.get(ed.exd_expid)
      const projectId = projectIdMap.get(ed.exd_projid)
      const expTypeId = expTypeIdMap.get(ed.exd_etid)
      if (!expenseId || !projectId || !expTypeId) return null

      return {
        id: uuidv4(),
        expense_id: expenseId,
        expense_type_id: expTypeId,
        project_id: projectId,
        task_id: taskIdMap.get(ed.exd_taskid) || null,
        expense_date: ed.exd_date || null,
        description: ed.exd_desc || null,
        receipt_number: ed.exd_invoiceno || null,
        quantity: ed.exd_unitnb || 1,
        unit_price: parseFloat(ed.exd_unitvalue) || 0,
        subtotal: parseFloat(ed.exd_net) || 0,
        gst_amount: parseFloat(ed.exd_tps) || 0,
        qst_amount: parseFloat(ed.exd_tvp) || 0,
        total: parseFloat(ed.exd_total) || 0,
        is_billable: ed.exd_billable === '1' || ed.exd_billable === 1,
        created_at: new Date().toISOString(),
      }
    })
    .filter(e => e !== null)
  saveJson('expense_entries_final.json', expEntries)
  await importTable('expense_entries', expEntries)

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('Summary')
  console.log('='.repeat(60))
  console.log(`  Profiles mapped: ${userIdMap.size}`)
  console.log(`  Project members: ${projectMembers.length}`)
  console.log(`  Timesheets: ${timesheets.length}`)
  console.log(`  Timesheet entries: ${tsEntries.length}`)
  console.log(`  Expenses: ${expenses.length}`)
  console.log(`  Expense entries: ${expEntries.length}`)
  console.log('\nRun "npm run verify" to check results.')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
