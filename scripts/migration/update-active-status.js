/**
 * Update is_active Status for Clients and Profiles
 *
 * Fixes the is_active field that was incorrectly imported.
 * Uses the correct French boolean mapping: 'O' = true, 'N' = false
 *
 * Usage: node update-active-status.js
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TRANSFORMED_DIR = path.join(__dirname, 'data', 'transformed')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function loadJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(TRANSFORMED_DIR, filename), 'utf8'))
}

async function getAllRecords(tableName, selectFields = 'id') {
  const records = []
  let offset = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select(selectFields)
      .range(offset, offset + pageSize - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    records.push(...data)
    offset += data.length
    if (data.length < pageSize) break
  }

  return records
}

async function main() {
  console.log('='.repeat(60))
  console.log('Update is_active Status')
  console.log('='.repeat(60))

  // ==================== CLIENTS ====================
  console.log('\n--- Updating Clients ---')

  const clients = loadJson('clients.json')
  const existingClients = await getAllRecords('clients', 'id, code')
  const clientByCode = new Map()
  existingClients.forEach(c => clientByCode.set(c.code, c.id))

  console.log(`  Transformed: ${clients.length}`)
  console.log(`  In database: ${existingClients.length}`)

  let clientsUpdated = 0
  let clientsSkipped = 0

  for (const client of clients) {
    const existingId = clientByCode.get(client.code)
    if (!existingId) {
      clientsSkipped++
      continue
    }

    const { error } = await supabase
      .from('clients')
      .update({ is_active: client.is_active })
      .eq('id', existingId)

    if (!error) clientsUpdated++
  }

  // Verify
  const { count: activeClients } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .is('deleted_at', null)

  const { count: inactiveClients } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', false)

  console.log(`  Updated: ${clientsUpdated}`)
  console.log(`  Active clients: ${activeClients}`)
  console.log(`  Inactive clients: ${inactiveClients}`)

  // ==================== PROFILES ====================
  console.log('\n--- Updating Profiles ---')

  const profiles = loadJson('profiles.json')
  const existingProfiles = await getAllRecords('profiles', 'id, email')
  const profileByEmail = new Map()
  existingProfiles.forEach(p => {
    if (p.email) profileByEmail.set(p.email.toLowerCase(), p.id)
  })

  console.log(`  Transformed: ${profiles.length}`)
  console.log(`  In database: ${existingProfiles.length}`)

  let profilesUpdated = 0
  let profilesSkipped = 0

  for (const profile of profiles) {
    if (!profile.email) {
      profilesSkipped++
      continue
    }

    const existingId = profileByEmail.get(profile.email.toLowerCase())
    if (!existingId) {
      profilesSkipped++
      continue
    }

    const { error } = await supabase
      .from('profiles')
      .update({ is_active: profile.is_active })
      .eq('id', existingId)

    if (!error) profilesUpdated++
  }

  // Verify
  const { count: activeProfiles } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  const { count: inactiveProfiles } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', false)

  console.log(`  Updated: ${profilesUpdated}`)
  console.log(`  Skipped (no match): ${profilesSkipped}`)
  console.log(`  Active profiles: ${activeProfiles}`)
  console.log(`  Inactive profiles: ${inactiveProfiles}`)

  console.log('\n✓ Done')
}

main().catch(console.error)
