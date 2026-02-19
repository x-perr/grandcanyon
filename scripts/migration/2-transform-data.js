/**
 * Script 2: Transform Data
 *
 * Transforms raw parsed data with:
 * - INT IDs to UUIDs
 * - Column name mapping (legacy → new schema)
 * - Timesheet hours array conversion (16 cols → 7 array)
 * - Invoice line extraction
 * - Status enum mapping
 *
 * Usage: npm run transform
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAW_DIR = path.join(__dirname, 'data', 'raw')
const TRANSFORMED_DIR = path.join(__dirname, 'data', 'transformed')

// ID mapping tables (legacy INT → new UUID)
const idMaps = {
  users: new Map(),
  roles: new Map(),
  permissions: new Map(),
  clients: new Map(),
  contacts: new Map(),
  projects: new Map(),
  tasks: new Map(),
  billing_roles: new Map(),
  timesheets: new Map(),
  expense_types: new Map(),
  expenses: new Map(),
  invoices: new Map(),
}

// Helper functions
function loadJson(filename) {
  const filepath = path.join(RAW_DIR, filename)
  if (!fs.existsSync(filepath)) {
    console.warn(`Warning: ${filename} not found, returning empty array`)
    return []
  }
  return JSON.parse(fs.readFileSync(filepath, 'utf8'))
}

function saveJson(filename, data) {
  const filepath = path.join(TRANSFORMED_DIR, filename)
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
  console.log(`Saved ${data.length.toString().padStart(6)} records → ${filename}`)
}

function parseBoolean(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value
  return value === '1' || value === 1 || value === 'O' || value === 'Y' || value === 'true'
}

function parseDate(value) {
  if (!value || value === '0000-00-00' || value === '0000-00-00 00:00:00') return null
  return value
}

function parseDecimal(value) {
  if (value === null || value === undefined) return null
  const num = parseFloat(value)
  return isNaN(num) ? null : num
}

// Transform functions

function transformRoles() {
  console.log('\n--- Transforming Roles ---')
  const legacy = loadJson('usertypes.json')

  const transformed = legacy.map(role => {
    const newId = uuidv4()
    idMaps.roles.set(role.ut_id, newId)

    return {
      id: newId,
      name: role.ut_desc?.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_') || 'unknown',
      description: role.ut_definition || role.ut_desc || null,
      created_at: new Date().toISOString(),
    }
  })

  saveJson('roles.json', transformed)
  return transformed
}

function transformPermissions() {
  console.log('\n--- Transforming Permissions ---')
  const legacy = loadJson('apprights.json')

  const transformed = legacy.map(perm => {
    const newId = uuidv4()
    idMaps.permissions.set(perm.ar_id, newId)

    // Map legacy permission names to new format
    const code = perm.ar_code?.toLowerCase().replace(/\s+/g, '.') || `perm_${perm.ar_id}`

    return {
      id: newId,
      code: code,
      description: perm.ar_desc || null,
      category: null,
      created_at: new Date().toISOString(),
    }
  })

  saveJson('permissions.json', transformed)
  return transformed
}

function transformRolePermissions() {
  console.log('\n--- Transforming Role Permissions ---')
  const legacy = loadJson('usertypesrights.json')

  const transformed = legacy
    .filter(rp => parseBoolean(rp.utr_active))
    .map(rp => ({
      id: uuidv4(),
      role_id: idMaps.roles.get(rp.utr_utid) || null,
      permission_id: idMaps.permissions.get(rp.utr_arid) || null,
      created_at: new Date().toISOString(),
    }))
    .filter(rp => rp.role_id && rp.permission_id)

  saveJson('role_permissions.json', transformed)
  return transformed
}

function transformUsers() {
  console.log('\n--- Transforming Users → Profiles ---')
  const legacy = loadJson('users.json')

  // First pass: create profiles with UUID mapping
  const profiles = legacy.map(user => {
    const newId = uuidv4()
    idMaps.users.set(user.user_id, newId)

    return {
      id: newId,
      email: user.user_email || `user_${user.user_id}@placeholder.local`,
      first_name: user.user_fname?.trim() || '',
      last_name: user.user_lname?.trim() || '',
      phone: null,
      role_id: idMaps.roles.get(user.user_utid) || null,
      manager_id: null, // Resolved in second pass
      is_active: parseBoolean(user.user_active),
      created_at: new Date().toISOString(),
      // Keep legacy reference for manager resolution
      _legacy_manager_id: user.user_managerid,
    }
  })

  // Second pass: resolve manager_id self-references
  profiles.forEach(profile => {
    if (profile._legacy_manager_id) {
      profile.manager_id = idMaps.users.get(profile._legacy_manager_id) || null
    }
    delete profile._legacy_manager_id
  })

  saveJson('profiles.json', profiles)

  // Create auth user records (for import script to use)
  const authUsers = legacy
    .filter(u => u.user_email && u.user_email.includes('@'))
    .map(user => ({
      id: idMaps.users.get(user.user_id),
      email: user.user_email,
      first_name: user.user_fname?.trim() || '',
      last_name: user.user_lname?.trim() || '',
      is_active: parseBoolean(user.user_active),
    }))

  saveJson('auth_users.json', authUsers)
  return profiles
}

function transformClients() {
  console.log('\n--- Transforming Clients ---')
  const legacy = loadJson('clients.json')

  const transformed = legacy.map(client => {
    const newId = uuidv4()
    idMaps.clients.set(client.client_id, newId)

    // Generate short code from name if not present
    const code = client.client_code ||
      (client.client_shortname?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)) ||
      `CLI${client.client_id}`

    const shortName = client.client_shortname ||
      client.client_name?.slice(0, 50) ||
      code

    return {
      id: newId,
      code: code,
      name: client.client_name || `Client ${client.client_id}`,
      short_name: shortName,
      primary_contact_name: client.client_primarycontact || null,
      primary_contact_email: client.client_primaryemail || null,
      primary_contact_phone: client.client_primaryphone || null,
      phone: client.client_phone || null,
      general_email: client.client_email || null,
      postal_address_line1: client.client_post_adrl1 || null,
      postal_address_line2: client.client_post_adrl2 || null,
      postal_city: client.client_post_city || null,
      postal_province: client.client_post_prov || 'QC',
      postal_country: client.client_post_country || 'Canada',
      postal_code: client.client_post_pc || null,
      billing_address_line1: client.client_invo_adrl1 || client.client_post_adrl1 || null,
      billing_address_line2: client.client_invo_adrl2 || client.client_post_adrl2 || null,
      billing_city: client.client_invo_city || client.client_post_city || null,
      billing_province: client.client_invo_prov || client.client_post_prov || 'QC',
      billing_country: client.client_invo_country || client.client_post_country || 'Canada',
      billing_postal_code: client.client_invo_pc || client.client_post_pc || null,
      charges_gst: client.client_paietps === 'O' || parseBoolean(client.client_gst),
      charges_qst: client.client_paietvq === 'O' || parseBoolean(client.client_qst),
      notes: null,
      website: null,
      deleted_at: parseBoolean(client.client_actif) === false ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
    }
  })

  saveJson('clients.json', transformed)
  return transformed
}

function transformContacts() {
  console.log('\n--- Transforming Contacts → Client Contacts ---')
  const legacy = loadJson('contacts.json')

  const transformed = legacy.map(contact => {
    const newId = uuidv4()
    idMaps.contacts.set(contact.contact_id, newId)

    return {
      id: newId,
      client_id: idMaps.clients.get(contact.contact_client_id) || null,
      first_name: contact.contact_fname || '',
      last_name: contact.contact_lname || '',
      title: contact.contact_title || null,
      email: contact.contact_email || null,
      phone: contact.contact_phone || contact.contact_mobile || null,
      is_primary: false,
      created_at: new Date().toISOString(),
    }
  }).filter(c => c.client_id)

  saveJson('client_contacts.json', transformed)
  return transformed
}

function transformProjects() {
  console.log('\n--- Transforming Projects ---')
  const legacy = loadJson('projects.json')

  const transformed = legacy.map(proj => {
    const newId = uuidv4()
    idMaps.projects.set(proj.proj_id, newId)

    // Map status
    let status = 'active'
    const legacyStatus = proj.proj_status?.toLowerCase()
    if (legacyStatus === 'completed' || legacyStatus === 'termine' || legacyStatus === 'terminé') {
      status = 'completed'
    } else if (legacyStatus === 'on hold' || legacyStatus === 'en attente') {
      status = 'on_hold'
    } else if (legacyStatus === 'cancelled' || legacyStatus === 'annule' || legacyStatus === 'annulé') {
      status = 'cancelled'
    } else if (legacyStatus === 'draft' || legacyStatus === 'brouillon') {
      status = 'draft'
    }

    return {
      id: newId,
      client_id: idMaps.clients.get(proj.proj_clientid) || null,
      code: proj.proj_code || `PROJ${proj.proj_id}`,
      name: proj.proj_name || `Project ${proj.proj_id}`,
      description: proj.proj_desc || null,
      status: status,
      billing_type: 'hourly',
      hourly_rate: parseDecimal(proj.proj_rate) || null,
      start_date: parseDate(proj.proj_start) || null,
      end_date: parseDate(proj.proj_end) || null,
      address: proj.proj_address || null,
      is_global: false,
      deleted_at: parseBoolean(proj.proj_active) === false ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
    }
  }).filter(p => p.client_id)

  saveJson('projects.json', transformed)
  return transformed
}

function transformTasks() {
  console.log('\n--- Transforming Tasks → Project Tasks ---')
  const legacy = loadJson('tasks.json')

  const transformed = legacy.map(task => {
    const newId = uuidv4()
    idMaps.tasks.set(task.task_id, newId)

    return {
      id: newId,
      project_id: idMaps.projects.get(task.task_projid) || null,
      code: task.task_code || `T${task.task_id}`,
      name: task.task_name || `Task ${task.task_id}`,
      description: task.task_desc || null,
      sort_order: task.task_order || null,
      created_at: new Date().toISOString(),
    }
  }).filter(t => t.project_id)

  saveJson('project_tasks.json', transformed)
  return transformed
}

function transformBillingRoles() {
  console.log('\n--- Transforming Project Roles → Billing Roles ---')
  const legacy = loadJson('projectroles.json')

  const transformed = legacy.map(role => {
    const newId = uuidv4()
    idMaps.billing_roles.set(role.pr_id, newId)

    return {
      id: newId,
      project_id: idMaps.projects.get(role.pr_projid) || null,
      name: role.pr_definition || `Role ${role.pr_id}`,
      rate: parseDecimal(role.pr_rate) || 0,
      created_at: new Date().toISOString(),
    }
  }).filter(r => r.project_id)

  saveJson('project_billing_roles.json', transformed)
  return transformed
}

function transformProjectMembers() {
  console.log('\n--- Transforming Project User Roles → Project Members ---')
  const legacy = loadJson('projectuserrole.json')

  // Load billing roles to get project_id from billing_role
  const billingRoles = loadJson('projectroles.json')
  const billingRoleProjectMap = new Map()
  billingRoles.forEach(br => {
    billingRoleProjectMap.set(br.pr_id, br.pr_projid)
  })

  const transformed = legacy.map(pur => {
    const legacyProjectId = billingRoleProjectMap.get(pur.pur_prid)
    return {
      id: uuidv4(),
      project_id: legacyProjectId ? idMaps.projects.get(legacyProjectId) : null,
      user_id: idMaps.users.get(pur.pur_userid) || null,
      billing_role_id: idMaps.billing_roles.get(pur.pur_prid) || null,
      is_active: parseBoolean(pur.pur_active) !== false,
      created_at: new Date().toISOString(),
    }
  }).filter(pm => pm.project_id && pm.user_id)

  saveJson('project_members.json', transformed)
  return transformed
}

function transformExpenseTypes() {
  console.log('\n--- Transforming Expense Types ---')
  const legacy = loadJson('expensestype.json')

  const transformed = legacy.map(et => {
    const newId = uuidv4()
    idMaps.expense_types.set(et.et_id, newId)

    return {
      id: newId,
      name: et.et_name || `Type ${et.et_id}`,
      description: et.et_desc || null,
      default_rate: parseDecimal(et.et_rate) || null,
      unit: et.et_unit || null,
      is_active: parseBoolean(et.et_active) !== false,
      created_at: new Date().toISOString(),
    }
  })

  saveJson('expense_types.json', transformed)
  return transformed
}

function transformTimesheets() {
  console.log('\n--- Transforming Timesheets ---')
  const legacy = loadJson('timesheets.json')

  const transformed = legacy.map(ts => {
    const newId = uuidv4()
    idMaps.timesheets.set(ts.ts_id, newId)

    // Map status
    let status = 'draft'
    if (parseBoolean(ts.ts_locked)) {
      status = 'locked'
    } else if (parseBoolean(ts.ts_approved)) {
      status = 'approved'
    } else if (parseBoolean(ts.ts_submitted)) {
      status = 'submitted'
    }

    return {
      id: newId,
      user_id: idMaps.users.get(ts.ts_emplid) || null,
      week_start: parseDate(ts.ts_periodfrom),
      week_end: parseDate(ts.ts_periodto),
      status: status,
      submitted_at: parseDate(ts.ts_submittedon),
      approved_at: parseDate(ts.ts_approvedon),
      approved_by: ts.ts_approvedby ? idMaps.users.get(ts.ts_approvedby) : null,
      locked_at: parseBoolean(ts.ts_locked) ? parseDate(ts.ts_approvedon) : null,
      locked_by: parseBoolean(ts.ts_locked) && ts.ts_approvedby
        ? idMaps.users.get(ts.ts_approvedby)
        : null,
      created_at: new Date().toISOString(),
    }
  }).filter(ts => ts.user_id && ts.week_start)

  saveJson('timesheets.json', transformed)
  return transformed
}

function transformTimesheetEntries() {
  console.log('\n--- Transforming Timesheet Details → Entries ---')
  const legacy = loadJson('timesheetdetails.json')

  const transformed = legacy.map(entry => {
    // Convert 16 columns to 7-element array (Mon-Sun)
    const hours = [
      parseDecimal(entry.tsd_time1) || 0,
      parseDecimal(entry.tsd_time2) || 0,
      parseDecimal(entry.tsd_time3) || 0,
      parseDecimal(entry.tsd_time4) || 0,
      parseDecimal(entry.tsd_time5) || 0,
      parseDecimal(entry.tsd_time6) || 0,
      parseDecimal(entry.tsd_time7) || 0,
    ]

    return {
      id: uuidv4(),
      timesheet_id: idMaps.timesheets.get(entry.tsd_tsid) || null,
      project_id: idMaps.projects.get(entry.tsd_projid) || null,
      task_id: entry.tsd_taskid ? idMaps.tasks.get(entry.tsd_taskid) : null,
      billing_role_id: entry.tsd_prid ? idMaps.billing_roles.get(entry.tsd_prid) : null,
      hours: hours,
      description: entry.tsd_desc || null,
      is_billable: parseBoolean(entry.tsd_billable) !== false,
      created_at: new Date().toISOString(),
    }
  }).filter(e => e.timesheet_id && e.project_id)

  saveJson('timesheet_entries.json', transformed)
  return transformed
}

function transformExpenses() {
  console.log('\n--- Transforming Expenses ---')
  const legacy = loadJson('expenses.json')

  const transformed = legacy.map(exp => {
    const newId = uuidv4()
    idMaps.expenses.set(exp.exp_id, newId)

    // Map status
    let status = 'draft'
    if (parseBoolean(exp.exp_approved)) {
      status = 'approved'
    } else if (parseBoolean(exp.exp_submitted)) {
      status = 'submitted'
    }

    return {
      id: newId,
      user_id: idMaps.users.get(exp.exp_emplid) || null,
      week_start: parseDate(exp.exp_periodfrom),
      week_end: parseDate(exp.exp_periodto),
      status: status,
      submitted_at: parseDate(exp.exp_submittedon),
      approved_at: parseDate(exp.exp_approvedon),
      approved_by: exp.exp_approvedby ? idMaps.users.get(exp.exp_approvedby) : null,
      created_at: new Date().toISOString(),
    }
  }).filter(e => e.user_id && e.week_start)

  saveJson('expenses.json', transformed)
  return transformed
}

function transformExpenseEntries() {
  console.log('\n--- Transforming Expense Details → Entries ---')
  const legacy = loadJson('expensedetails.json')

  const transformed = legacy.map(entry => ({
    id: uuidv4(),
    expense_id: idMaps.expenses.get(entry.exd_expid) || null,
    project_id: entry.exd_projid ? idMaps.projects.get(entry.exd_projid) : null,
    task_id: entry.exd_taskid ? idMaps.tasks.get(entry.exd_taskid) : null,
    expense_type_id: idMaps.expense_types.get(entry.exd_etid) || null,
    date: parseDate(entry.exd_date),
    description: entry.exd_desc || null,
    quantity: parseDecimal(entry.exd_unitnb) || 1,
    unit_amount: parseDecimal(entry.exd_unitvalue) || parseDecimal(entry.exd_net) || 0,
    subtotal: parseDecimal(entry.exd_net) || 0,
    gst_amount: parseDecimal(entry.exd_tps) || 0,
    qst_amount: parseDecimal(entry.exd_tvp) || 0,
    total: parseDecimal(entry.exd_total) || 0,
    is_billable: parseBoolean(entry.exd_billable),
    receipt_url: null,
    external_invoice_number: entry.exd_invoiceno || null,
    created_at: new Date().toISOString(),
  })).filter(e => e.expense_id && e.date)

  saveJson('expense_entries.json', transformed)
  return transformed
}

function transformInvoices() {
  console.log('\n--- Transforming Invoices ---')
  const legacy = loadJson('invoices.json')

  // Load projects once for client lookup
  const projects = loadJson('projects.json')
  const projectClientMap = new Map()
  projects.forEach(p => {
    projectClientMap.set(p.proj_id, p.proj_clientid)
  })

  const invoices = []
  const invoiceLines = []

  legacy.forEach(inv => {
    const invoiceId = uuidv4()
    idMaps.invoices.set(inv.inv_no, invoiceId)

    // Get project to find client
    const projectId = idMaps.projects.get(inv.inv_projid)
    const legacyClientId = projectClientMap.get(inv.inv_projid)
    const clientId = legacyClientId ? idMaps.clients.get(legacyClientId) : null

    if (!projectId || !clientId) {
      return // Skip invalid invoices
    }

    // Main invoice record
    invoices.push({
      id: invoiceId,
      invoice_number: inv.inv_no.toString(),
      client_id: clientId,
      project_id: projectId,
      invoice_date: parseDate(inv.inv_date) || new Date().toISOString().split('T')[0],
      period_start: parseDate(inv.inv_from) || parseDate(inv.inv_date),
      period_end: parseDate(inv.inv_to) || parseDate(inv.inv_date),
      subtotal: parseDecimal(inv.inv_net) || 0,
      gst_amount: parseDecimal(inv.inv_tps) || 0,
      qst_amount: parseDecimal(inv.inv_tvp) || 0,
      total: parseDecimal(inv.inv_total) || 0,
      status: 'paid', // All legacy invoices are historical
      paid_at: parseDate(inv.inv_date), // Assume paid on invoice date
      created_at: parseDate(inv.inv_date) || new Date().toISOString(),
    })

    // Create invoice lines
    let sortOrder = 1

    // Main hours line
    const hours = parseDecimal(inv.inv_nbheure)
    const price = parseDecimal(inv.inv_price)
    if (hours && hours > 0) {
      invoiceLines.push({
        id: uuidv4(),
        invoice_id: invoiceId,
        description: 'Professional Services',
        quantity: hours,
        unit_price: price && hours ? price / hours : 0,
        amount: price || 0,
        sort_order: sortOrder++,
        created_at: new Date().toISOString(),
      })
    }

    // Extra line 1
    if (inv.inv_extra1_txt && parseDecimal(inv.inv_extra1_amt)) {
      invoiceLines.push({
        id: uuidv4(),
        invoice_id: invoiceId,
        description: inv.inv_extra1_txt,
        quantity: 1,
        unit_price: parseDecimal(inv.inv_extra1_amt),
        amount: parseDecimal(inv.inv_extra1_amt),
        sort_order: sortOrder++,
        created_at: new Date().toISOString(),
      })
    }

    // Extra line 2
    if (inv.inv_extra2_txt && parseDecimal(inv.inv_extra2_amt)) {
      invoiceLines.push({
        id: uuidv4(),
        invoice_id: invoiceId,
        description: inv.inv_extra2_txt,
        quantity: 1,
        unit_price: parseDecimal(inv.inv_extra2_amt),
        amount: parseDecimal(inv.inv_extra2_amt),
        sort_order: sortOrder++,
        created_at: new Date().toISOString(),
      })
    }

    // Extra line 3
    if (inv.inv_extra3_txt && parseDecimal(inv.inv_extra3_amt)) {
      invoiceLines.push({
        id: uuidv4(),
        invoice_id: invoiceId,
        description: inv.inv_extra3_txt,
        quantity: 1,
        unit_price: parseDecimal(inv.inv_extra3_amt),
        amount: parseDecimal(inv.inv_extra3_amt),
        sort_order: sortOrder++,
        created_at: new Date().toISOString(),
      })
    }
  })

  saveJson('invoices.json', invoices)
  saveJson('invoice_lines.json', invoiceLines)
  return { invoices, invoiceLines }
}

// Main execution
async function main() {
  console.log('='.repeat(60))
  console.log('Grand Canyon Migration - Step 2: Transform Data')
  console.log('='.repeat(60))

  // Create output directory
  if (!fs.existsSync(TRANSFORMED_DIR)) {
    fs.mkdirSync(TRANSFORMED_DIR, { recursive: true })
  }

  // Check for raw data
  if (!fs.existsSync(RAW_DIR)) {
    console.error('\nERROR: Raw data directory not found.')
    console.error('Run "npm run parse" first to parse the SQL dump.')
    process.exit(1)
  }

  // Transform in dependency order
  transformRoles()
  transformPermissions()
  transformRolePermissions()
  transformUsers()
  transformExpenseTypes()
  transformClients()
  transformContacts()
  transformProjects()
  transformTasks()
  transformBillingRoles()
  transformProjectMembers()
  transformTimesheets()
  transformTimesheetEntries()
  transformExpenses()
  transformExpenseEntries()
  transformInvoices()

  // Save ID maps for debugging
  const idMapsObj = {}
  for (const [key, map] of Object.entries(idMaps)) {
    idMapsObj[key] = Object.fromEntries(map)
  }
  fs.writeFileSync(
    path.join(TRANSFORMED_DIR, '_id_maps.json'),
    JSON.stringify(idMapsObj, null, 2)
  )
  console.log('\nSaved ID mappings → _id_maps.json')

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('Transformation complete!')
  console.log(`Output directory: ${TRANSFORMED_DIR}`)
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
