/**
 * Import Missing Clients and Projects
 *
 * These 4 clients with French characters weren't imported in the original migration.
 * This script imports them and their projects so we can achieve 100% data migration.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAW_DIR = path.join(__dirname, 'data', 'raw')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function loadJson(dir, filename) {
  return JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf8'))
}

async function main() {
  console.log('='.repeat(60))
  console.log('Import Missing Clients and Projects')
  console.log('='.repeat(60))

  // Load raw data
  const rawClients = loadJson(RAW_DIR, 'clients.json')
  const rawProjects = loadJson(RAW_DIR, 'projects.json')
  const rawTasks = loadJson(RAW_DIR, 'tasks.json')

  // Missing client codes (identified by find-missing-projects.js)
  const missingClientCodes = ["L'Archevêque", "RÉNO-MAT", "Dupré", "Guérin"]

  // Get existing DB clients
  const { data: dbClients } = await supabase.from('clients').select('id, code')
  const existingCodes = new Set(dbClients?.map(c => c.code) || [])

  console.log('\n--- Importing Missing Clients ---')
  const clientIdMapping = new Map() // legacy client_id -> new UUID

  for (const code of missingClientCodes) {
    if (existingCodes.has(code)) {
      console.log(`  ${code}: Already exists, skipping`)
      const existing = dbClients.find(c => c.code === code)
      // Find raw client to map legacy ID
      const rawClient = rawClients.find(c => c.client_code === code)
      if (existing && rawClient) {
        clientIdMapping.set(rawClient.client_id, existing.id)
      }
      continue
    }

    const rawClient = rawClients.find(c => c.client_code === code)
    if (!rawClient) {
      console.log(`  ${code}: NOT FOUND in raw data`)
      continue
    }

    const newId = uuidv4()
    clientIdMapping.set(rawClient.client_id, newId)

    const { error } = await supabase.from('clients').insert({
      id: newId,
      code: rawClient.client_code,
      name: rawClient.client_name,
      postal_address_line1: rawClient.client_add1 || null,
      postal_address_line2: rawClient.client_add2 || null,
      postal_city: rawClient.client_city || null,
      postal_province: rawClient.client_prov || null,
      postal_code: rawClient.client_postal || null,
      phone: rawClient.client_phone || null,
      created_at: new Date().toISOString(),
    })

    if (error) {
      console.log(`  ${code}: ERROR - ${error.message}`)
    } else {
      console.log(`  ${code}: Imported (${rawClient.client_name})`)
    }
  }

  console.log(`\nClient ID mappings: ${clientIdMapping.size}`)

  // Find and import projects for these clients
  console.log('\n--- Importing Missing Projects ---')
  const projectIdMapping = new Map() // legacy proj_id -> new UUID

  // Get existing DB projects
  const { data: dbProjects } = await supabase.from('projects').select('id, code, client_id')

  for (const [legacyClientId, newClientId] of clientIdMapping) {
    const clientProjects = rawProjects.filter(p => p.proj_clientid === legacyClientId)
    console.log(`\n  Client ${legacyClientId} has ${clientProjects.length} projects`)

    for (const rawProj of clientProjects) {
      // Check if already exists
      const existing = dbProjects?.find(p => p.client_id === newClientId && p.code === rawProj.proj_code)
      if (existing) {
        console.log(`    ${rawProj.proj_code}: Already exists`)
        projectIdMapping.set(rawProj.proj_id, existing.id)
        continue
      }

      const newProjId = uuidv4()
      projectIdMapping.set(rawProj.proj_id, newProjId)

      const { error } = await supabase.from('projects').insert({
        id: newProjId,
        client_id: newClientId,
        code: rawProj.proj_code,
        name: rawProj.proj_name,
        description: rawProj.proj_desc || null,
        status: rawProj.proj_active === '1' ? 'active' : 'completed',
        start_date: rawProj.proj_startdate || null,
        end_date: rawProj.proj_enddate || null,
        created_at: new Date().toISOString(),
      })

      if (error) {
        console.log(`    ${rawProj.proj_code}: ERROR - ${error.message}`)
      } else {
        console.log(`    ${rawProj.proj_code}: Imported (${rawProj.proj_name})`)
      }
    }
  }

  console.log(`\nProject ID mappings: ${projectIdMapping.size}`)

  // Import tasks for these projects
  console.log('\n--- Importing Missing Tasks ---')
  let tasksImported = 0

  for (const [legacyProjId, newProjId] of projectIdMapping) {
    const projectTasks = rawTasks.filter(t => t.task_projid === legacyProjId)

    for (const rawTask of projectTasks) {
      const { error } = await supabase.from('project_tasks').insert({
        id: uuidv4(),
        project_id: newProjId,
        code: rawTask.task_code,
        name: rawTask.task_name,
        description: rawTask.task_desc || null,
        created_at: new Date().toISOString(),
      })

      if (!error) {
        tasksImported++
      }
    }
  }

  console.log(`  Tasks imported: ${tasksImported}`)

  // Save mappings for the reimport
  const mappingPath = path.join(__dirname, 'data', 'missing-mappings.json')
  const mappings = {
    clients: Object.fromEntries(clientIdMapping),
    projects: Object.fromEntries(projectIdMapping),
  }
  fs.writeFileSync(mappingPath, JSON.stringify(mappings, null, 2))
  console.log(`\nMappings saved to: ${mappingPath}`)

  console.log('\n' + '='.repeat(60))
  console.log('Missing Clients/Projects Import Complete!')
  console.log('='.repeat(60))
  console.log('\nNow re-run: node reimport-missing-entries.js')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
