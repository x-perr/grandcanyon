/**
 * Fix Encoding Issues (v2)
 *
 * Updates database records by matching on unique fields (code, email, etc.)
 * rather than UUID since UUIDs were regenerated.
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

function loadJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(RAW_DIR, filename), 'utf8'))
}

async function main() {
  console.log('='.repeat(60))
  console.log('Fixing Encoding Issues (v2 - Match by unique fields)')
  console.log('='.repeat(60))

  // Update clients by code
  console.log('\n--- Updating Clients (by code) ---')
  const rawClients = loadJson('clients.json')
  let updatedClients = 0

  for (const client of rawClients) {
    const { error } = await supabase
      .from('clients')
      .update({
        name: client.client_name,
        short_name: client.client_shortname,
        address_line1: client.client_post_adrl1,
        address_line2: client.client_post_adrl2,
        city: client.client_post_city,
        province: client.client_post_prov,
        postal_code: client.client_post_pc,
        invoice_address_line1: client.client_invo_adrl1,
        invoice_address_line2: client.client_invo_adrl2,
        invoice_city: client.client_invo_city,
        invoice_province: client.client_invo_prov,
        invoice_postal_code: client.client_invo_pc,
      })
      .eq('code', client.client_code)

    if (!error) {
      updatedClients++
    } else {
      console.error(`Error updating client ${client.client_code}: ${error.message}`)
    }

    if (updatedClients % 50 === 0) {
      process.stdout.write(`\r  Updated: ${updatedClients}/${rawClients.length}`)
    }
  }
  console.log(`\r  Updated: ${updatedClients}/${rawClients.length}`)

  // Update profiles by email
  console.log('\n--- Updating Profiles (by email) ---')
  const rawUsers = loadJson('users.json')
  let updatedProfiles = 0

  for (const user of rawUsers) {
    let email = user.user_email?.trim()
    if (!email || !email.includes('@')) {
      email = `user_${user.user_id}@grandcanyon.local`
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: user.user_firstname || '',
        last_name: user.user_lastname || '',
        initials: user.user_initials || '',
      })
      .eq('email', email.toLowerCase())

    if (!error) {
      updatedProfiles++
    }
  }
  console.log(`  Updated: ${updatedProfiles}/${rawUsers.length}`)

  // Update expense_types by code
  console.log('\n--- Updating Expense Types (by code) ---')
  const rawExpTypes = loadJson('expensestype.json')
  let updatedExpTypes = 0

  for (const et of rawExpTypes) {
    const { error } = await supabase
      .from('expense_types')
      .update({ name: et.et_desc })
      .eq('code', et.et_code)

    if (!error) {
      updatedExpTypes++
    }
  }
  console.log(`  Updated: ${updatedExpTypes}/${rawExpTypes.length}`)

  // For projects, tasks, and billing roles, we need to look up by a combination
  // of fields since they don't have unique codes. We'll need to match via
  // the original import order which matched the ID mapping.

  // Get current DB records
  console.log('\n--- Updating Projects (by client + code) ---')
  const rawProjects = loadJson('projects.json')
  const { data: dbClients } = await supabase.from('clients').select('id, code')
  const clientCodeToId = new Map(dbClients?.map(c => [c.code, c.id]) || [])
  let updatedProjects = 0

  for (const proj of rawProjects) {
    const clientId = clientCodeToId.get(proj.proj_clientcode)
    if (!clientId) continue

    const { error } = await supabase
      .from('projects')
      .update({
        name: proj.proj_name,
        description: proj.proj_desc,
      })
      .eq('client_id', clientId)
      .eq('code', proj.proj_code)

    if (!error) {
      updatedProjects++
    }

    if (updatedProjects % 500 === 0) {
      process.stdout.write(`\r  Updated: ${updatedProjects}/${rawProjects.length}`)
    }
  }
  console.log(`\r  Updated: ${updatedProjects}/${rawProjects.length}`)

  // Update project_tasks by project + name (since task name is what needs fixing)
  console.log('\n--- Updating Project Tasks (by project + code) ---')
  const rawTasks = loadJson('tasks.json')
  const { data: dbProjects } = await supabase.from('projects').select('id, code, client_id')
  const projectKeyToId = new Map()
  for (const proj of dbProjects || []) {
    // Find client code for this project
    const clientCode = [...clientCodeToId.entries()].find(([code, id]) => id === proj.client_id)?.[0]
    if (clientCode) {
      projectKeyToId.set(`${clientCode}_${proj.code}`, proj.id)
    }
  }

  let updatedTasks = 0
  for (const task of rawTasks) {
    const projectId = projectKeyToId.get(`${task.tsk_clientcode}_${task.tsk_projectcode}`)
    if (!projectId) continue

    const { error } = await supabase
      .from('project_tasks')
      .update({ name: task.tsk_name })
      .eq('project_id', projectId)
      .eq('code', task.tsk_code)

    if (!error) {
      updatedTasks++
    }

    if (updatedTasks % 500 === 0) {
      process.stdout.write(`\r  Updated: ${updatedTasks}/${rawTasks.length}`)
    }
  }
  console.log(`\r  Updated: ${updatedTasks}/${rawTasks.length}`)

  // Update billing roles
  console.log('\n--- Updating Billing Roles (by project + name) ---')
  const rawRoles = loadJson('projectroles.json')
  let updatedRoles = 0

  for (const role of rawRoles) {
    const projectId = projectKeyToId.get(`${role.pr_clientcode}_${role.pr_projectcode}`)
    if (!projectId) continue

    // Match by project_id and old name pattern to update to correct encoding
    const { error } = await supabase
      .from('project_billing_roles')
      .update({ name: role.pr_desc })
      .eq('project_id', projectId)
      .eq('code', role.pr_code)

    if (!error) {
      updatedRoles++
    }

    if (updatedRoles % 500 === 0) {
      process.stdout.write(`\r  Updated: ${updatedRoles}/${rawRoles.length}`)
    }
  }
  console.log(`\r  Updated: ${updatedRoles}/${rawRoles.length}`)

  console.log('\n' + '='.repeat(60))
  console.log('Encoding fix complete!')
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
