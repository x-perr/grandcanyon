/**
 * Fix Encoding Issues (v5)
 *
 * Correct field names and ID mapping with proper project ID references.
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
  console.log('Fixing Encoding Issues (v5)')
  console.log('='.repeat(60))

  // Build raw mappings
  console.log('\n--- Building mappings ---')

  // Raw client_id -> client_code
  const rawClients = loadJson('clients.json')
  const rawClientIdToCode = new Map(rawClients.map(c => [c.client_id, c.client_code]))
  console.log(`  Raw client ID->code: ${rawClientIdToCode.size}`)

  // Raw proj_id -> (client_code, proj_code)
  const rawProjects = loadJson('projects.json')
  const rawProjIdToKey = new Map()
  for (const p of rawProjects) {
    const clientCode = rawClientIdToCode.get(p.proj_clientid)
    if (clientCode) {
      rawProjIdToKey.set(p.proj_id, { clientCode, projCode: p.proj_code })
    }
  }
  console.log(`  Raw project ID->key: ${rawProjIdToKey.size}`)

  // DB client code -> ID
  const dbClients = await fetchAllPaginated('clients', 'id, code')
  const clientCodeToDbId = new Map(dbClients.map(c => [c.code, c.id]))
  console.log(`  DB client code->ID: ${clientCodeToDbId.size}`)

  // DB (client_code, proj_code) -> project ID
  const dbProjects = await fetchAllPaginated('projects', 'id, code, client_id')
  const dbClientIdToCode = new Map([...clientCodeToDbId.entries()].map(([code, id]) => [id, code]))
  const projectKeyToDbId = new Map()
  for (const p of dbProjects) {
    const clientCode = dbClientIdToCode.get(p.client_id)
    if (clientCode) {
      projectKeyToDbId.set(`${clientCode}_${p.code}`, p.id)
    }
  }
  console.log(`  DB project key->ID: ${projectKeyToDbId.size}`)

  // Raw proj_id -> DB project ID
  const rawProjIdToDbId = new Map()
  for (const [rawId, { clientCode, projCode }] of rawProjIdToKey) {
    const dbId = projectKeyToDbId.get(`${clientCode}_${projCode}`)
    if (dbId) {
      rawProjIdToDbId.set(rawId, dbId)
    }
  }
  console.log(`  Raw proj_id->DB ID: ${rawProjIdToDbId.size}`)

  // Update profiles by email (fields: user_fname, user_lname)
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

  // Update expense_types by code (field: et_definition)
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

  // Update projects
  console.log('\n--- Updating Projects ---')
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

  // Update tasks (fields: task_projid, task_code, task_desc)
  console.log('\n--- Updating Project Tasks ---')
  const rawTasks = loadJson('tasks.json')
  let updatedTasks = 0

  for (const task of rawTasks) {
    const dbProjectId = rawProjIdToDbId.get(task.task_projid)
    if (!dbProjectId) continue

    const { data } = await supabase
      .from('project_tasks')
      .update({ name: task.task_desc })
      .eq('project_id', dbProjectId)
      .eq('code', task.task_code)
      .select('id')

    if (data && data.length > 0) {
      updatedTasks++
    }

    if (updatedTasks % 500 === 0 && updatedTasks > 0) {
      process.stdout.write(`\r  Updated: ${updatedTasks}`)
    }
  }
  console.log(`\r  Updated: ${updatedTasks}/${rawTasks.length}`)

  // Update billing roles (fields: pr_projid, pr_definition)
  // Note: roles don't have a 'code' field, they have pr_id
  console.log('\n--- Updating Billing Roles ---')
  const rawRoles = loadJson('projectroles.json')
  let updatedRoles = 0

  // For roles, we need to match by name pattern since no code exists
  // Let's try matching by project_id and rate (which should be unique enough)
  for (const role of rawRoles) {
    const dbProjectId = rawProjIdToDbId.get(role.pr_projid)
    if (!dbProjectId) continue

    // Update by project_id and rate
    const { data } = await supabase
      .from('project_billing_roles')
      .update({ name: role.pr_definition })
      .eq('project_id', dbProjectId)
      .eq('hourly_rate', role.pr_rate)
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
