/**
 * Complete Migration Script
 *
 * Full reset and 100% migration of all data.
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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
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

async function importTable(tableName, data, showProgress = true) {
  if (data.length === 0) {
    console.log(`    ${tableName}: No records`)
    return 0
  }

  let imported = 0

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from(tableName).insert(batch)

    if (error) {
      // Try one by one
      for (const record of batch) {
        const { error: singleError } = await supabase.from(tableName).insert(record)
        if (!singleError) imported++
      }
    } else {
      imported += batch.length
    }

    if (showProgress && ((i + BATCH_SIZE) % 1000 === 0 || i + BATCH_SIZE >= data.length)) {
      process.stdout.write(`\r    ${tableName}: ${imported}/${data.length}`)
    }
  }

  if (showProgress) {
    console.log(`\r    ${tableName}: ${imported}/${data.length} imported`)
  }
  return imported
}

async function main() {
  console.log('='.repeat(60))
  console.log('Complete Migration - Reset + Full Import')
  console.log('='.repeat(60))

  // ========================================
  // PHASE 1: NUCLEAR RESET
  // ========================================
  console.log('\n=== PHASE 1: Nuclear Reset ===')

  console.log('\n  Clearing all tables...')
  await clearTable('invoice_lines')
  await clearTable('invoices')
  await clearTable('timesheet_entries')
  await clearTable('timesheets')
  await clearTable('expense_entries')
  await clearTable('expenses')
  await clearTable('project_members')
  await clearTable('project_billing_roles')
  await clearTable('project_tasks')
  await clearTable('projects')
  await clearTable('client_contacts')
  await clearTable('clients')
  await clearTable('profiles')
  await clearTable('role_permissions')
  await clearTable('expense_types')
  // Keep roles and permissions (seeded)

  console.log('\n  Deleting all auth users (paginated)...')
  let totalDeleted = 0
  let page = 1
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 })
    if (error || !data?.users?.length) {
      hasMore = false
      break
    }

    console.log(`    Page ${page}: Found ${data.users.length} users`)
    for (const user of data.users) {
      await supabase.auth.admin.deleteUser(user.id)
      totalDeleted++
      await sleep(30)
    }

    // Check if there are more pages
    hasMore = data.users.length === 100
    page++
  }
  console.log(`    Total deleted: ${totalDeleted} auth users`)

  // Wait for deletion to propagate
  console.log('    Waiting 10 seconds for deletion to propagate...')
  await sleep(10000)

  // ========================================
  // PHASE 2: CREATE AUTH USERS & PROFILES
  // ========================================
  console.log('\n=== PHASE 2: Create/Map Auth Users ===')

  const rawUsers = loadJson(RAW_DIR, 'users.json')
  console.log(`\n  Total raw users: ${rawUsers.length}`)

  // Get all existing auth users
  console.log('  Fetching existing auth users...')
  const existingAuthUsers = new Map()
  let listPage = 1
  let listHasMore = true
  while (listHasMore) {
    const { data } = await supabase.auth.admin.listUsers({ page: listPage, perPage: 100 })
    if (!data?.users?.length) {
      listHasMore = false
      break
    }
    data.users.forEach(u => {
      if (u.email) existingAuthUsers.set(u.email.toLowerCase(), u.id)
    })
    listHasMore = data.users.length === 100
    listPage++
  }
  console.log(`  Found ${existingAuthUsers.size} existing auth users`)

  const userIdMap = new Map() // old INT id -> new UUID (auth user ID)
  let created = 0
  let reused = 0
  const usedEmails = new Set()

  for (const user of rawUsers) {
    let email = user.user_email?.trim()

    // Generate unique placeholder if no/invalid/duplicate email
    if (!email || !email.includes('@') || usedEmails.has(email.toLowerCase())) {
      email = `user_${user.user_id}@grandcanyon.local`
    }
    usedEmails.add(email.toLowerCase())

    // Check if email already exists
    const existingId = existingAuthUsers.get(email.toLowerCase())
    if (existingId) {
      userIdMap.set(user.user_id, existingId)
      reused++
      continue
    }

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
      console.error(`    FAIL: user ${user.user_id} (${email}): ${error.message}`)
    } else {
      userIdMap.set(user.user_id, data.user.id)
      created++
    }

    if ((created + reused) % 50 === 0) {
      process.stdout.write(`\r    Progress: ${created} created, ${reused} reused`)
    }
    await sleep(100)
  }
  console.log(`\r    Auth users: ${created} created, ${reused} reused`)
  console.log(`    Total mapped: ${userIdMap.size}/${rawUsers.length}`)

  // Wait for trigger to create profiles
  await sleep(3000)

  // ========================================
  // PHASE 3: UPDATE PROFILES
  // ========================================
  console.log('\n=== PHASE 3: Update Profiles ===')

  // Load roles
  const transRoles = loadJson(TRANS_DIR, 'roles.json')
  const rawRoles = loadJson(RAW_DIR, 'usertypes.json')
  const roleIdMap = new Map()
  rawRoles.forEach((r, i) => {
    if (transRoles[i]) roleIdMap.set(r.ut_id, transRoles[i].id)
  })

  // Get created profiles and build email -> profile_id map
  const { data: profiles } = await supabase.from('profiles').select('id, email')
  const emailToProfileId = new Map()
  profiles?.forEach(p => {
    if (p.email) emailToProfileId.set(p.email.toLowerCase(), p.id)
  })
  console.log(`  Found ${profiles?.length || 0} profiles`)

  // Update userIdMap to point to profile IDs (from auth IDs)
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
  console.log(`  Mapped ${userIdMap.size} users to profiles`)

  // Update profiles with role_id and manager_id
  let updated = 0
  for (const user of rawUsers) {
    const profileId = userIdMap.get(user.user_id)
    if (!profileId) continue

    const managerId = user.user_managerid ? userIdMap.get(user.user_managerid) : null
    const roleId = roleIdMap.get(user.user_utid) || null

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: user.user_fname?.trim() || '',
        last_name: user.user_lname?.trim() || '',
        role_id: roleId,
        manager_id: managerId,
        is_active: user.user_active === '1' || user.user_active === 1,
      })
      .eq('id', profileId)

    if (!error) updated++
  }
  console.log(`  Updated ${updated} profiles`)

  // ========================================
  // PHASE 4: IMPORT BASE TABLES
  // ========================================
  console.log('\n=== PHASE 4: Import Base Tables ===')

  // Expense types
  console.log('\n  Importing expense_types...')
  const transExpTypes = loadJson(TRANS_DIR, 'expense_types.json')
  // Fix schema: add code field
  const rawExpTypes = loadJson(RAW_DIR, 'expensestype.json')
  const fixedExpTypes = rawExpTypes.map(et => ({
    id: uuidv4(),
    code: et.et_code || `TYPE${et.et_id}`,
    name: et.et_definition || `Type ${et.et_id}`,
    default_rate: et.et_defaultunitvalue || null,
    is_active: true,
    created_at: new Date().toISOString(),
  }))
  const expTypeIdMap = new Map()
  rawExpTypes.forEach((et, i) => {
    expTypeIdMap.set(et.et_id, fixedExpTypes[i].id)
  })
  await importTable('expense_types', fixedExpTypes, false)

  // Clients
  console.log('\n  Importing clients...')
  const transClients = loadJson(TRANS_DIR, 'clients.json')
  await importTable('clients', transClients)

  // Client contacts
  console.log('\n  Importing client_contacts...')
  const transContacts = loadJson(TRANS_DIR, 'client_contacts.json')
  await importTable('client_contacts', transContacts, false)

  // Projects
  console.log('\n  Importing projects...')
  const transProjects = loadJson(TRANS_DIR, 'projects.json')
  await importTable('projects', transProjects)

  // Build project ID map
  const rawProjects = loadJson(RAW_DIR, 'projects.json')
  const projectIdMap = new Map()
  rawProjects.forEach((p, i) => {
    if (transProjects[i]) projectIdMap.set(p.proj_id, transProjects[i].id)
  })

  // Project tasks
  console.log('\n  Importing project_tasks...')
  const transTasks = loadJson(TRANS_DIR, 'project_tasks.json')
  await importTable('project_tasks', transTasks)

  // Build task ID map
  const rawTasks = loadJson(RAW_DIR, 'tasks.json')
  const taskIdMap = new Map()
  rawTasks.forEach((t, i) => {
    if (transTasks[i]) taskIdMap.set(t.tsk_id, transTasks[i].id)
  })

  // Project billing roles
  console.log('\n  Importing project_billing_roles...')
  const transBillingRoles = loadJson(TRANS_DIR, 'project_billing_roles.json')
  await importTable('project_billing_roles', transBillingRoles)

  // Build billing role ID map
  const rawBillingRoles = loadJson(RAW_DIR, 'projectroles.json')
  const billingRoleIdMap = new Map()
  rawBillingRoles.forEach((br, i) => {
    if (transBillingRoles[i]) billingRoleIdMap.set(br.pr_id, transBillingRoles[i].id)
  })

  // ========================================
  // PHASE 5: IMPORT USER-DEPENDENT TABLES
  // ========================================
  console.log('\n=== PHASE 5: Import User Tables ===')

  // Project members
  console.log('\n  Generating project_members...')
  const rawProjectUserRoles = loadJson(RAW_DIR, 'projectuserrole.json')
  const projectMembers = rawProjectUserRoles
    .map(pur => {
      const userId = userIdMap.get(pur.pur_emplid)
      const billingRoleId = billingRoleIdMap.get(pur.pur_prid)
      if (!userId || !billingRoleId) return null

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
  saveJson('project_members_complete.json', projectMembers)
  await importTable('project_members', projectMembers)

  // Timesheets
  console.log('\n  Generating timesheets...')
  const rawTimesheets = loadJson(RAW_DIR, 'timesheets.json')
  const timesheetIdMap = new Map()
  const timesheets = rawTimesheets
    .map(ts => {
      const userId = userIdMap.get(ts.ts_emplid)
      if (!userId) return null

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
  saveJson('timesheets_complete.json', timesheets)
  await importTable('timesheets', timesheets)

  // Timesheet entries
  console.log('\n  Generating timesheet_entries...')
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
  saveJson('timesheet_entries_complete.json', tsEntries)
  await importTable('timesheet_entries', tsEntries)

  // Expenses
  console.log('\n  Generating expenses...')
  const rawExpenses = loadJson(RAW_DIR, 'expenses.json')
  const expenseIdMap = new Map()
  const expenses = rawExpenses
    .map(exp => {
      const userId = userIdMap.get(exp.exp_emplid)
      if (!userId) return null

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
  saveJson('expenses_complete.json', expenses)
  await importTable('expenses', expenses)

  // Expense entries
  console.log('\n  Generating expense_entries...')
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
  saveJson('expense_entries_complete.json', expEntries)
  await importTable('expense_entries', expEntries)

  // ========================================
  // PHASE 6: IMPORT INVOICES
  // ========================================
  console.log('\n=== PHASE 6: Import Invoices ===')

  console.log('\n  Importing invoices...')
  const transInvoices = loadJson(TRANS_DIR, 'invoices.json')
  await importTable('invoices', transInvoices)

  console.log('\n  Importing invoice_lines...')
  const transInvoiceLines = loadJson(TRANS_DIR, 'invoice_lines.json')
  await importTable('invoice_lines', transInvoiceLines)

  // ========================================
  // SUMMARY
  // ========================================
  console.log('\n' + '='.repeat(60))
  console.log('Complete migration finished!')
  console.log('='.repeat(60))

  console.log('\nSummary:')
  console.log(`  Auth users created: ${created}`)
  console.log(`  Profiles mapped: ${userIdMap.size}`)
  console.log(`  Timesheets: ${timesheets.length}`)
  console.log(`  Timesheet entries: ${tsEntries.length}`)
  console.log(`  Expenses: ${expenses.length}`)
  console.log(`  Expense entries: ${expEntries.length}`)
  console.log(`  Project members: ${projectMembers.length}`)

  console.log('\nRun "npm run verify" to check the results.')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
