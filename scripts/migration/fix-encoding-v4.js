/**
 * Fix Encoding Issues (v4)
 *
 * Correct field names and ID mapping approach.
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
  console.log('Fixing Encoding Issues (v4)')
  console.log('='.repeat(60))

  // Build raw client ID to code mapping
  console.log('\n--- Building ID mappings ---')
  const rawClients = loadJson('clients.json')
  const rawClientIdToCode = new Map(rawClients.map(c => [c.client_id, c.client_code]))
  console.log(`  Raw client ID mappings: ${rawClientIdToCode.size}`)

  // Get DB client code to ID
  const dbClients = await fetchAllPaginated('clients', 'id, code')
  const clientCodeToDbId = new Map(dbClients.map(c => [c.code, c.id]))
  console.log(`  DB client mappings: ${clientCodeToDbId.size}`)

  // Clients already updated (350/360), skip

  // Update profiles by email (correct field names: user_fname, user_lname)
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
        first_name: user.user_fname || '',
        last_name: user.user_lname || '',
      })
      .eq('email', email.toLowerCase())
      .select('id')

    if (data && data.length > 0) {
      updatedProfiles++
    }
  }
  console.log(`  Updated: ${updatedProfiles}/${rawUsers.length}`)

  // Update expense_types by code (correct field: et_definition)
  console.log('\n--- Updating Expense Types ---')
  const rawExpTypes = loadJson('expensestype.json')
  let updatedExpTypes = 0

  for (const et of rawExpTypes) {
    const { data } = await supabase
      .from('expense_types')
      .update({ name: et.et_definition })
      .eq('code', et.et_code)
      .select('id')

    if (data && data.length > 0) {
      updatedExpTypes++
    }
  }
  console.log(`  Updated: ${updatedExpTypes}/${rawExpTypes.length}`)

  // Update projects (use raw client ID -> code -> DB ID)
  console.log('\n--- Updating Projects ---')
  const rawProjects = loadJson('projects.json')
  let updatedProjects = 0

  for (const proj of rawProjects) {
    const clientCode = rawClientIdToCode.get(proj.proj_clientid)
    if (!clientCode) continue
    const clientId = clientCodeToDbId.get(clientCode)
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

  // Build project mappings for tasks/roles
  const dbProjects = await fetchAllPaginated('projects', 'id, code, client_id')
  const dbClientIdToCode = new Map([...clientCodeToDbId.entries()].map(([code, id]) => [id, code]))
  const projectKeyToId = new Map()
  for (const proj of dbProjects) {
    const clientCode = dbClientIdToCode.get(proj.client_id)
    if (clientCode) {
      projectKeyToId.set(`${clientCode}_${proj.code}`, proj.id)
    }
  }
  console.log(`  Project mappings: ${projectKeyToId.size}`)

  // Update tasks
  console.log('\n--- Updating Project Tasks ---')
  const rawTasks = loadJson('tasks.json')
  let updatedTasks = 0

  for (const task of rawTasks) {
    // Get client code from task's client ID
    const clientCode = rawClientIdToCode.get(task.tsk_clientid)
    if (!clientCode) continue

    // Build project key
    const projectKey = `${clientCode}_${task.tsk_projectcode}`
    const projectId = projectKeyToId.get(projectKey)
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
    const clientCode = rawClientIdToCode.get(role.pr_clientid)
    if (!clientCode) continue

    const projectKey = `${clientCode}_${role.pr_projectcode}`
    const projectId = projectKeyToId.get(projectKey)
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
