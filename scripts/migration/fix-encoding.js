/**
 * Fix Encoding Issues
 *
 * Updates database records with correctly encoded French characters.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TRANS_DIR = path.join(__dirname, 'data', 'transformed')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function loadJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(TRANS_DIR, filename), 'utf8'))
}

async function main() {
  console.log('='.repeat(60))
  console.log('Fixing Encoding Issues')
  console.log('='.repeat(60))

  // Update clients
  console.log('\n--- Updating Clients ---')
  const clients = loadJson('clients.json')
  let updatedClients = 0

  for (const client of clients) {
    const { error } = await supabase
      .from('clients')
      .update({ name: client.name, short_name: client.short_name })
      .eq('id', client.id)

    if (!error) {
      updatedClients++
    } else {
      console.error(`Error updating client ${client.id}: ${error.message}`)
    }

    if (updatedClients % 50 === 0) {
      process.stdout.write(`\r  Updated: ${updatedClients}/${clients.length}`)
    }
  }
  console.log(`\r  Updated: ${updatedClients}/${clients.length}`)

  // Update projects (name field)
  console.log('\n--- Updating Projects ---')
  const projects = loadJson('projects.json')
  let updatedProjects = 0

  for (const project of projects) {
    const { error } = await supabase
      .from('projects')
      .update({ name: project.name, description: project.description })
      .eq('id', project.id)

    if (!error) {
      updatedProjects++
    }

    if (updatedProjects % 500 === 0) {
      process.stdout.write(`\r  Updated: ${updatedProjects}/${projects.length}`)
    }
  }
  console.log(`\r  Updated: ${updatedProjects}/${projects.length}`)

  // Update profiles (first_name, last_name)
  console.log('\n--- Updating Profiles ---')
  const profiles = loadJson('profiles.json')
  let updatedProfiles = 0

  for (const profile of profiles) {
    const { error } = await supabase
      .from('profiles')
      .update({ first_name: profile.first_name, last_name: profile.last_name })
      .eq('id', profile.id)

    if (!error) {
      updatedProfiles++
    }
  }
  console.log(`  Updated: ${updatedProfiles}/${profiles.length}`)

  // Update expense_types (name)
  console.log('\n--- Updating Expense Types ---')
  const expTypes = loadJson('expense_types.json')
  let updatedExpTypes = 0

  for (const et of expTypes) {
    const { error } = await supabase
      .from('expense_types')
      .update({ name: et.name })
      .eq('id', et.id)

    if (!error) {
      updatedExpTypes++
    }
  }
  console.log(`  Updated: ${updatedExpTypes}/${expTypes.length}`)

  // Update project_tasks (name)
  console.log('\n--- Updating Project Tasks ---')
  const tasks = loadJson('project_tasks.json')
  let updatedTasks = 0

  for (const task of tasks) {
    const { error } = await supabase
      .from('project_tasks')
      .update({ name: task.name })
      .eq('id', task.id)

    if (!error) {
      updatedTasks++
    }

    if (updatedTasks % 500 === 0) {
      process.stdout.write(`\r  Updated: ${updatedTasks}/${tasks.length}`)
    }
  }
  console.log(`\r  Updated: ${updatedTasks}/${tasks.length}`)

  // Update project_billing_roles (name)
  console.log('\n--- Updating Billing Roles ---')
  const roles = loadJson('project_billing_roles.json')
  let updatedRoles = 0

  for (const role of roles) {
    const { error } = await supabase
      .from('project_billing_roles')
      .update({ name: role.name })
      .eq('id', role.id)

    if (!error) {
      updatedRoles++
    }

    if (updatedRoles % 500 === 0) {
      process.stdout.write(`\r  Updated: ${updatedRoles}/${roles.length}`)
    }
  }
  console.log(`\r  Updated: ${updatedRoles}/${roles.length}`)

  // Update timesheet_entries (description)
  console.log('\n--- Updating Timesheet Entry Descriptions ---')
  const tsEntries = loadJson('timesheet_entries.json')
  const entriesWithDesc = tsEntries.filter(e => e.description)
  let updatedTsEntries = 0

  for (const entry of entriesWithDesc) {
    const { error } = await supabase
      .from('timesheet_entries')
      .update({ description: entry.description })
      .eq('id', entry.id)

    if (!error) {
      updatedTsEntries++
    }

    if (updatedTsEntries % 500 === 0) {
      process.stdout.write(`\r  Updated: ${updatedTsEntries}/${entriesWithDesc.length}`)
    }
  }
  console.log(`\r  Updated: ${updatedTsEntries}/${entriesWithDesc.length}`)

  console.log('\n' + '='.repeat(60))
  console.log('Encoding fix complete!')
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
