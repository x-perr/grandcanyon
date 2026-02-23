/**
 * Fix Encoding Issues (v3)
 *
 * Direct updates using raw data with correct UTF-8 encoding.
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
  console.log('Fixing Encoding Issues (v3)')
  console.log('='.repeat(60))

  // Update clients by code
  console.log('\n--- Updating Clients ---')
  const rawClients = loadJson('clients.json')
  let updatedClients = 0

  for (const client of rawClients) {
    const { data, error } = await supabase
      .from('clients')
      .update({
        name: client.client_name,
        short_name: client.client_shortname,
        postal_address_line1: client.client_post_adrl1 || null,
        postal_address_line2: client.client_post_adrl2 || null,
        postal_city: client.client_post_city || null,
        postal_province: client.client_post_prov || null,
        billing_address_line1: client.client_invo_adrl1 || null,
        billing_address_line2: client.client_invo_adrl2 || null,
        billing_city: client.client_invo_city || null,
        billing_province: client.client_invo_prov || null,
      })
      .eq('code', client.client_code)
      .select('id')

    if (data && data.length > 0) {
      updatedClients++
    } else if (error) {
      console.error(`\nError: ${client.client_code}: ${error.message}`)
    }

    if (updatedClients % 50 === 0 && updatedClients > 0) {
      process.stdout.write(`\r  Updated: ${updatedClients}`)
    }
  }
  console.log(`\r  Updated: ${updatedClients}/${rawClients.length}`)

  // Update profiles by email
  console.log('\n--- Updating Profiles ---')
  const rawUsers = loadJson('users.json')
  let updatedProfiles = 0

  for (const user of rawUsers) {
    let email = user.user_email?.trim()
    if (!email || !email.includes('@')) {
      email = `user_${user.user_id}@grandcanyon.local`
    }

    const { data } = await supabase
      .from('profiles')
      .update({
        first_name: user.user_firstname || '',
        last_name: user.user_lastname || '',
        initials: user.user_initials || '',
      })
      .eq('email', email.toLowerCase())
      .select('id')

    if (data && data.length > 0) {
      updatedProfiles++
    }
  }
  console.log(`  Updated: ${updatedProfiles}/${rawUsers.length}`)

  // Update expense_types by code
  console.log('\n--- Updating Expense Types ---')
  const rawExpTypes = loadJson('expensestype.json')
  let updatedExpTypes = 0

  for (const et of rawExpTypes) {
    const { data } = await supabase
      .from('expense_types')
      .update({ name: et.et_desc })
      .eq('code', et.et_code)
      .select('id')

    if (data && data.length > 0) {
      updatedExpTypes++
    }
  }
  console.log(`  Updated: ${updatedExpTypes}/${rawExpTypes.length}`)

  // Get client mapping for projects (with pagination)
  console.log('\n--- Building mappings ---')
  const clientCodeToId = new Map()
  let clientPage = 0
  while (true) {
    const { data: dbClients } = await supabase
      .from('clients')
      .select('id, code')
      .range(clientPage * 1000, (clientPage + 1) * 1000 - 1)
    if (!dbClients || dbClients.length === 0) break
    dbClients.forEach(c => clientCodeToId.set(c.code, c.id))
    if (dbClients.length < 1000) break
    clientPage++
  }
  console.log(`  Client mappings: ${clientCodeToId.size}`)

  // Update projects
  console.log('\n--- Updating Projects ---')
  const rawProjects = loadJson('projects.json')
  let updatedProjects = 0

  for (const proj of rawProjects) {
    const clientId = clientCodeToId.get(proj.proj_clientcode)
    if (!clientId) continue

    const { data } = await supabase
      .from('projects')
      .update({
        name: proj.proj_name,
        description: proj.proj_desc || null,
      })
      .eq('client_id', clientId)
      .eq('code', proj.proj_code)
      .select('id')

    if (data && data.length > 0) {
      updatedProjects++
    }

    if (updatedProjects % 500 === 0 && updatedProjects > 0) {
      process.stdout.write(`\r  Updated: ${updatedProjects}`)
    }
  }
  console.log(`\r  Updated: ${updatedProjects}/${rawProjects.length}`)

  // Build project mapping (with pagination)
  // First build reverse client map for efficiency
  const clientIdToCode = new Map([...clientCodeToId.entries()].map(([code, id]) => [id, code]))

  const projectKeyToId = new Map()
  let projPage = 0
  while (true) {
    const { data: dbProjects } = await supabase
      .from('projects')
      .select('id, code, client_id')
      .range(projPage * 1000, (projPage + 1) * 1000 - 1)
    if (!dbProjects || dbProjects.length === 0) break
    for (const proj of dbProjects) {
      const clientCode = clientIdToCode.get(proj.client_id)
      if (clientCode) {
        projectKeyToId.set(`${clientCode}_${proj.code}`, proj.id)
      }
    }
    if (dbProjects.length < 1000) break
    projPage++
  }
  console.log(`  Project mappings: ${projectKeyToId.size}`)

  // Update tasks
  console.log('\n--- Updating Project Tasks ---')
  const rawTasks = loadJson('tasks.json')
  let updatedTasks = 0

  for (const task of rawTasks) {
    const projectId = projectKeyToId.get(`${task.tsk_clientcode}_${task.tsk_projectcode}`)
    if (!projectId) continue

    const { data } = await supabase
      .from('project_tasks')
      .update({ name: task.tsk_name })
      .eq('project_id', projectId)
      .eq('code', task.tsk_code)
      .select('id')

    if (data && data.length > 0) {
      updatedTasks++
    }

    if (updatedTasks % 500 === 0 && updatedTasks > 0) {
      process.stdout.write(`\r  Updated: ${updatedTasks}`)
    }
  }
  console.log(`\r  Updated: ${updatedTasks}/${rawTasks.length}`)

  // Update billing roles
  console.log('\n--- Updating Billing Roles ---')
  const rawRoles = loadJson('projectroles.json')
  let updatedRoles = 0

  for (const role of rawRoles) {
    const projectId = projectKeyToId.get(`${role.pr_clientcode}_${role.pr_projectcode}`)
    if (!projectId) continue

    const { data } = await supabase
      .from('project_billing_roles')
      .update({ name: role.pr_desc })
      .eq('project_id', projectId)
      .eq('code', role.pr_code)
      .select('id')

    if (data && data.length > 0) {
      updatedRoles++
    }

    if (updatedRoles % 500 === 0 && updatedRoles > 0) {
      process.stdout.write(`\r  Updated: ${updatedRoles}`)
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
