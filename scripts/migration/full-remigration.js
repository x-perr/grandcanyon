/**
 * Full Re-migration Script
 *
 * Creates ALL users in auth (with placeholder emails if needed),
 * then updates all profiles and re-imports all user-dependent data.
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
  console.log(`Saved ${data.length} records → ${filename}`)
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function clearTable(tableName) {
  const { error } = await supabase
    .from(tableName)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (error && !error.message.includes('not found')) {
    console.error(`  Error clearing ${tableName}:`, error.message)
  }
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
      console.error(`  Error in batch ${Math.floor(i / BATCH_SIZE)}: ${error.message}`)

      // Try one by one for constraint errors
      if (error.code === '23505' || error.code === '23503') {
        for (const record of batch) {
          const { error: singleError } = await supabase.from(tableName).insert(record)
          if (!singleError) imported++
        }
      }
    } else {
      imported += batch.length
    }

    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= data.length) {
      process.stdout.write(`\r  ${tableName}: ${imported}/${data.length}`)
    }
  }

  console.log(`\r  ${tableName}: ${imported}/${data.length} imported`)
  return { imported, errors }
}

async function main() {
  console.log('='.repeat(60))
  console.log('Full Re-migration Script - 100% Data Migration')
  console.log('='.repeat(60))

  // Step 1: Load raw users and create ALL as auth users
  console.log('\n--- Step 1: Creating ALL auth users ---')
  const rawUsers = loadJson(RAW_DIR, 'users.json')
  console.log(`Total raw users: ${rawUsers.length}`)

  // Delete existing auth users (except the owner)
  console.log('Fetching existing auth users...')
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  console.log(`Found ${existingUsers?.users?.length || 0} existing auth users`)

  // Clear dependent tables first (in reverse FK order)
  console.log('\nClearing dependent tables...')
  await clearTable('timesheet_entries')
  await clearTable('timesheets')
  await clearTable('expense_entries')
  await clearTable('expenses')
  await clearTable('project_members')

  // Delete existing auth users
  console.log('Deleting existing auth users...')
  for (const user of existingUsers?.users || []) {
    await supabase.auth.admin.deleteUser(user.id)
    await sleep(50) // Rate limit
  }
  console.log('Cleared existing auth users')

  // Clear profiles (will be recreated by trigger)
  await clearTable('profiles')

  // Create new auth users for ALL users
  console.log('\nCreating auth users for all raw users...')
  const userIdMap = new Map() // old INT id -> new UUID
  let created = 0
  let skipped = 0
  const usedEmails = new Set()

  for (const user of rawUsers) {
    let email = user.user_email?.trim()

    // Generate unique placeholder if no email or duplicate
    if (!email || !email.includes('@') || usedEmails.has(email.toLowerCase())) {
      email = `user_${user.user_id}@grandcanyon.local`
    }
    usedEmails.add(email.toLowerCase())

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        first_name: user.user_fname?.trim() || '',
        last_name: user.user_lname?.trim() || '',
        legacy_id: user.user_id,
      }
    })

    if (error) {
      console.error(`  Failed to create user ${user.user_id} (${email}): ${error.message}`)
      skipped++
    } else {
      userIdMap.set(user.user_id, data.user.id)
      created++
    }

    if (created % 50 === 0) {
      process.stdout.write(`\r  Progress: ${created} created, ${skipped} skipped`)
    }
    await sleep(100) // Rate limit
  }
  console.log(`\n  Auth users: ${created} created, ${skipped} skipped`)

  // Step 2: Update profiles with complete data
  console.log('\n--- Step 2: Updating profiles ---')

  // Load role mapping
  const rawRoles = loadJson(RAW_DIR, 'usertypes.json')
  const transRoles = loadJson(TRANS_DIR, 'roles.json')
  const roleIdMap = new Map()
  rawRoles.forEach((r, i) => {
    if (transRoles[i]) {
      roleIdMap.set(r.ut_id, transRoles[i].id)
    }
  })

  // Wait for profiles to be created by trigger
  await sleep(2000)

  // Get created profiles
  const { data: profiles } = await supabase.from('profiles').select('id, email')
  console.log(`  Found ${profiles?.length} profiles`)

  // Create email -> profile ID map
  const emailToProfileId = new Map()
  profiles?.forEach(p => {
    if (p.email) emailToProfileId.set(p.email.toLowerCase(), p.id)
  })

  // Also create user_id -> profile_id map via email
  const userIdToProfileId = new Map()
  for (const user of rawUsers) {
    let email = user.user_email?.trim()
    if (!email || !email.includes('@')) {
      email = `user_${user.user_id}@grandcanyon.local`
    }
    const profileId = emailToProfileId.get(email.toLowerCase())
    if (profileId) {
      userIdToProfileId.set(user.user_id, profileId)
    }
  }
  console.log(`  Mapped ${userIdToProfileId.size} user IDs to profile IDs`)

  // Update profiles with additional data
  let updated = 0
  for (const user of rawUsers) {
    const profileId = userIdToProfileId.get(user.user_id)
    if (!profileId) continue

    const managerId = user.user_managerid ? userIdToProfileId.get(user.user_managerid) : null

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: user.user_fname?.trim() || '',
        last_name: user.user_lname?.trim() || '',
        role_id: roleIdMap.get(user.user_utid) || null,
        manager_id: managerId,
        is_active: user.user_active === '1' || user.user_active === 1,
      })
      .eq('id', profileId)

    if (!error) updated++
  }
  console.log(`  Updated ${updated} profiles`)

  // Save the ID mapping for other tables
  const profileMapping = []
  for (const [oldId, newId] of userIdToProfileId) {
    profileMapping.push({ old_id: oldId, new_id: newId })
  }
  saveJson('profile_id_mapping.json', profileMapping)

  // Step 3: Re-transform and import timesheets
  console.log('\n--- Step 3: Re-importing timesheets ---')
  const rawTimesheets = loadJson(RAW_DIR, 'timesheets.json')

  const transformedTimesheets = rawTimesheets
    .map(ts => {
      const userId = userIdToProfileId.get(ts.ts_emplid)
      if (!userId) return null

      const approvedBy = ts.ts_approvedby ? userIdToProfileId.get(ts.ts_approvedby) : null
      const lockedBy = ts.ts_lockedby ? userIdToProfileId.get(ts.ts_lockedby) : null

      return {
        id: uuidv4(),
        user_id: userId,
        week_start: ts.ts_periodfrom,
        week_end: ts.ts_periodto,
        status: ts.ts_approved === '1' ? 'approved' : (ts.ts_submitted === '1' ? 'submitted' : 'draft'),
        submitted_at: ts.ts_submittedon || null,
        approved_at: ts.ts_approvedon || null,
        approved_by: approvedBy,
        locked_by: lockedBy,
        locked_at: null,
        created_at: new Date().toISOString(),
        _legacy_id: ts.ts_id,
      }
    })
    .filter(t => t !== null)

  saveJson('timesheets_remigrated.json', transformedTimesheets)

  // Create timesheet ID map
  const timesheetIdMap = new Map()
  transformedTimesheets.forEach(ts => {
    timesheetIdMap.set(ts._legacy_id, ts.id)
    delete ts._legacy_id
  })

  await importTable('timesheets', transformedTimesheets)

  // Step 4: Import timesheet entries
  console.log('\n--- Step 4: Importing timesheet entries ---')
  const rawTsDetails = loadJson(RAW_DIR, 'timesheetdetails.json')

  // Load project and task mappings
  const rawProjects = loadJson(RAW_DIR, 'projects.json')
  const transProjects = loadJson(TRANS_DIR, 'projects.json')
  const projectIdMap = new Map()
  rawProjects.forEach((p, i) => {
    if (transProjects[i]) {
      projectIdMap.set(p.proj_id, transProjects[i].id)
    }
  })

  const rawTasks = loadJson(RAW_DIR, 'tasks.json')
  const transTasks = loadJson(TRANS_DIR, 'project_tasks.json')
  const taskIdMap = new Map()
  rawTasks.forEach((t, i) => {
    if (transTasks[i]) {
      taskIdMap.set(t.tsk_id, transTasks[i].id)
    }
  })

  // Load billing role mapping
  const rawBillingRoles = loadJson(RAW_DIR, 'projectroles.json')
  const transBillingRoles = loadJson(TRANS_DIR, 'project_billing_roles.json')
  const billingRoleIdMap = new Map()
  rawBillingRoles.forEach((br, i) => {
    if (transBillingRoles[i]) {
      billingRoleIdMap.set(br.pr_id, transBillingRoles[i].id)
    }
  })

  const transformedTsEntries = rawTsDetails
    .map(tsd => {
      const timesheetId = timesheetIdMap.get(tsd.tsd_tsid)
      if (!timesheetId) return null

      const projectId = projectIdMap.get(tsd.tsd_projid)
      if (!projectId) return null

      // Parse hours from tsd_time1 through tsd_time7
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

  saveJson('timesheet_entries_remigrated.json', transformedTsEntries)
  await importTable('timesheet_entries', transformedTsEntries)

  // Step 5: Re-import expenses
  console.log('\n--- Step 5: Re-importing expenses ---')
  const rawExpenses = loadJson(RAW_DIR, 'expenses.json')

  const transformedExpenses = rawExpenses
    .map(exp => {
      const userId = userIdToProfileId.get(exp.exp_emplid)
      if (!userId) return null

      const approvedBy = exp.exp_approvedby ? userIdToProfileId.get(exp.exp_approvedby) : null

      return {
        id: uuidv4(),
        user_id: userId,
        week_start: exp.exp_periodfrom,
        week_end: exp.exp_periodto,
        status: exp.exp_approved === '1' ? 'approved' : (exp.exp_submitted === '1' ? 'submitted' : 'draft'),
        submitted_at: exp.exp_submittedon || null,
        approved_at: exp.exp_approvedon || null,
        approved_by: approvedBy,
        created_at: new Date().toISOString(),
        _legacy_id: exp.exp_id,
      }
    })
    .filter(e => e !== null)

  saveJson('expenses_remigrated.json', transformedExpenses)

  // Create expense ID map
  const expenseIdMap = new Map()
  transformedExpenses.forEach(exp => {
    expenseIdMap.set(exp._legacy_id, exp.id)
    delete exp._legacy_id
  })

  await importTable('expenses', transformedExpenses)

  // Step 6: Re-import expense entries
  console.log('\n--- Step 6: Re-importing expense entries ---')
  const rawExpDetails = loadJson(RAW_DIR, 'expensedetails.json')

  // Load expense type mapping
  const rawExpTypes = loadJson(RAW_DIR, 'expensestype.json')
  const { data: dbExpTypes } = await supabase.from('expense_types').select('id, code')

  const expTypeIdMap = new Map()
  rawExpTypes.forEach(et => {
    const dbType = dbExpTypes?.find(d => d.code === et.et_code)
    if (dbType) {
      expTypeIdMap.set(et.et_id, dbType.id)
    }
  })

  const transformedExpEntries = rawExpDetails
    .map(ed => {
      const expenseId = expenseIdMap.get(ed.exd_expid)
      if (!expenseId) return null

      const expTypeId = expTypeIdMap.get(ed.exd_etid)
      if (!expTypeId) return null

      const projectId = projectIdMap.get(ed.exd_projid)
      if (!projectId) return null

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

  saveJson('expense_entries_remigrated.json', transformedExpEntries)
  await importTable('expense_entries', transformedExpEntries)

  // Step 7: Re-import project_members
  console.log('\n--- Step 7: Re-importing project members ---')
  const rawProjectUserRoles = loadJson(RAW_DIR, 'projectuserroles.json')

  const transformedProjectMembers = rawProjectUserRoles
    .map(pur => {
      const userId = userIdToProfileId.get(pur.pur_emplid)
      if (!userId) return null

      const billingRoleId = billingRoleIdMap.get(pur.pur_prid)
      if (!billingRoleId) return null

      // Find project from billing role
      const billingRole = transBillingRoles.find(br => br.id === billingRoleId)
      if (!billingRole) return null

      return {
        id: uuidv4(),
        project_id: billingRole.project_id,
        user_id: userId,
        billing_role_id: billingRoleId,
        hourly_rate: parseFloat(pur.pur_txhoraire) || null,
        is_active: true,
        created_at: new Date().toISOString(),
      }
    })
    .filter(pm => pm !== null)

  saveJson('project_members_remigrated.json', transformedProjectMembers)
  await importTable('project_members', transformedProjectMembers)

  console.log('\n' + '='.repeat(60))
  console.log('Full re-migration complete!')
  console.log('Run "npm run verify" to check the results.')
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
