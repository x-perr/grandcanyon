/**
 * Find missing projects causing skipped timesheet entries
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

function loadJson(dir, filename) {
  return JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf8'))
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
  console.log('Finding Missing Projects')
  console.log('='.repeat(60))

  // Load raw data
  const rawClients = loadJson(RAW_DIR, 'clients.json')
  const rawProjects = loadJson(RAW_DIR, 'projects.json')
  const rawTsDetails = loadJson(RAW_DIR, 'timesheetdetails.json')

  // Build client code map
  const rawClientIdToCode = new Map(rawClients.map(c => [c.client_id, c.client_code]))

  // Build raw project map
  const rawProjIdToInfo = new Map()
  for (const p of rawProjects) {
    rawProjIdToInfo.set(p.proj_id, {
      code: p.proj_code,
      name: p.proj_name,
      client_id: p.proj_clientid,
      client_code: rawClientIdToCode.get(p.proj_clientid)
    })
  }

  // Get DB projects
  const dbClients = await fetchAllPaginated('clients', 'id, code')
  const clientCodeToDbId = new Map(dbClients.map(c => [c.code, c.id]))

  const dbProjects = await fetchAllPaginated('projects', 'id, code, client_id')
  const dbClientIdToCode = new Map()
  for (const [code, id] of clientCodeToDbId.entries()) {
    dbClientIdToCode.set(id, code)
  }

  const projectKeyToDbId = new Map()
  for (const p of dbProjects) {
    const clientCode = dbClientIdToCode.get(p.client_id)
    if (clientCode) {
      projectKeyToDbId.set(`${clientCode}_${p.code}`, p.id)
    }
  }

  // Build raw proj ID to DB ID mapping
  const rawProjIdToDbId = new Map()
  for (const p of rawProjects) {
    const clientCode = rawClientIdToCode.get(p.proj_clientid)
    if (clientCode) {
      const dbId = projectKeyToDbId.get(`${clientCode}_${p.proj_code}`)
      if (dbId) {
        rawProjIdToDbId.set(p.proj_id, dbId)
      }
    }
  }

  // Find entries with missing projects
  const missingByReason = {
    notInRawProjects: [],
    clientNotInDb: [],
    projectNotInDb: []
  }

  const missingProjectDetails = []

  for (const d of rawTsDetails) {
    const projId = d.tsd_projid

    if (!rawProjIdToInfo.has(projId)) {
      missingByReason.notInRawProjects.push(d)
      continue
    }

    const projInfo = rawProjIdToInfo.get(projId)
    const clientCode = projInfo.client_code

    if (!clientCode || !clientCodeToDbId.has(clientCode)) {
      missingByReason.clientNotInDb.push({ entry: d, projInfo })
      continue
    }

    const key = `${clientCode}_${projInfo.code}`
    if (!projectKeyToDbId.has(key)) {
      missingByReason.projectNotInDb.push({ entry: d, projInfo, key })

      // Track unique missing projects
      if (!missingProjectDetails.find(mp => mp.key === key)) {
        missingProjectDetails.push({
          key,
          proj_id: projId,
          proj_code: projInfo.code,
          proj_name: projInfo.name,
          client_code: clientCode,
          entry_count: 0
        })
      }
      const mp = missingProjectDetails.find(mp => mp.key === key)
      mp.entry_count++
    }
  }

  console.log('\n--- Summary ---')
  console.log(`Total timesheet entries: ${rawTsDetails.length}`)
  console.log(`Mapped to DB projects: ${rawTsDetails.length - missingByReason.notInRawProjects.length - missingByReason.clientNotInDb.length - missingByReason.projectNotInDb.length}`)
  console.log(`\nMissing breakdown:`)
  console.log(`  Not in raw projects.json: ${missingByReason.notInRawProjects.length}`)
  console.log(`  Client not in DB: ${missingByReason.clientNotInDb.length}`)
  console.log(`  Project not in DB: ${missingByReason.projectNotInDb.length}`)

  if (missingProjectDetails.length > 0) {
    console.log('\n--- Missing Projects (need to import) ---')
    for (const mp of missingProjectDetails) {
      console.log(`  ${mp.client_code} / ${mp.proj_code}: "${mp.proj_name}" (${mp.entry_count} entries)`)
    }
  }

  // Check if these projects exist in raw data but weren't imported
  console.log('\n--- Checking raw projects for missing ones ---')
  for (const mp of missingProjectDetails) {
    const rawProj = rawProjects.find(p => p.proj_code === mp.proj_code && rawClientIdToCode.get(p.proj_clientid) === mp.client_code)
    if (rawProj) {
      console.log(`  FOUND in raw: ${mp.client_code}/${mp.proj_code} (proj_id: ${rawProj.proj_id})`)
    } else {
      console.log(`  NOT in raw: ${mp.client_code}/${mp.proj_code}`)
    }
  }

  // Find missing clients
  console.log('\n--- Missing Clients (need to import) ---')
  const missingClients = new Map()

  for (const item of missingByReason.clientNotInDb) {
    const { entry, projInfo } = item
    const clientId = projInfo.client_id
    const rawClient = rawClients.find(c => c.client_id === clientId)

    if (rawClient && !missingClients.has(clientId)) {
      missingClients.set(clientId, {
        client_id: clientId,
        client_code: rawClient.client_code,
        client_name: rawClient.client_name,
        entry_count: 0,
        projects: new Set()
      })
    }

    if (missingClients.has(clientId)) {
      const mc = missingClients.get(clientId)
      mc.entry_count++
      mc.projects.add(projInfo.code)
    }
  }

  for (const [id, mc] of missingClients) {
    console.log(`  ${mc.client_code}: "${mc.client_name}" (${mc.entry_count} entries, ${mc.projects.size} projects)`)
    console.log(`    Projects: ${[...mc.projects].join(', ')}`)
  }

  // Output SQL to add missing clients
  if (missingClients.size > 0) {
    console.log('\n--- SQL to Import Missing Clients ---')
    for (const [id, mc] of missingClients) {
      const rawClient = rawClients.find(c => c.client_id === id)
      if (rawClient) {
        console.log(`INSERT INTO clients (code, name, is_active, created_at) VALUES ('${rawClient.client_code}', '${rawClient.client_name.replace(/'/g, "''")}', ${rawClient.client_active === '1'}, NOW());`)
      }
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
