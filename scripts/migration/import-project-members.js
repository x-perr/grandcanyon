/**
 * Import Project Members
 *
 * Imports project team assignments from project_members_final2.json
 * Uses upsert to handle duplicates gracefully.
 *
 * Usage: node import-project-members.js
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TRANSFORMED_DIR = path.join(__dirname, 'data', 'transformed')
const BATCH_SIZE = 100

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function loadJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(TRANSFORMED_DIR, filename), 'utf8'))
}

async function main() {
  console.log('='.repeat(60))
  console.log('Import Project Members')
  console.log('='.repeat(60))

  // Load project members
  const members = loadJson('project_members_final2.json')
  console.log(`\nLoaded ${members.length} project members`)

  // Check current count
  const { count: existingCount } = await supabase
    .from('project_members')
    .select('id', { count: 'exact', head: true })

  console.log(`Current project_members in DB: ${existingCount}`)

  // Get valid project IDs
  const projectIds = new Set()
  let offset = 0
  while (true) {
    const { data } = await supabase
      .from('projects')
      .select('id')
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    data.forEach(p => projectIds.add(p.id))
    offset += data.length
    if (data.length < 1000) break
  }
  console.log(`Valid projects: ${projectIds.size}`)

  // Get valid user IDs
  const userIds = new Set()
  offset = 0
  while (true) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    data.forEach(p => userIds.add(p.id))
    offset += data.length
    if (data.length < 1000) break
  }
  console.log(`Valid profiles: ${userIds.size}`)

  // Filter to valid members and remove extra fields
  const validMembers = members
    .filter(m => projectIds.has(m.project_id) && userIds.has(m.user_id))
    .map(m => ({
      id: m.id,
      project_id: m.project_id,
      user_id: m.user_id,
      billing_role_id: m.billing_role_id,
      is_active: m.is_active,
      created_at: m.created_at
      // Note: hourly_rate not in schema, omitted
    }))
  const invalidMembers = members.length - validMembers.length

  console.log(`\nValid members to import: ${validMembers.length}`)
  console.log(`Invalid (missing FK): ${invalidMembers}`)

  // Import using upsert
  let imported = 0
  let errors = 0

  console.log('\n--- Importing ---')

  for (let i = 0; i < validMembers.length; i += BATCH_SIZE) {
    const batch = validMembers.slice(i, i + BATCH_SIZE)

    // Try batch insert, fall back to individual inserts on conflict
    const { error } = await supabase
      .from('project_members')
      .upsert(batch, {
        onConflict: 'project_id,user_id,billing_role_id',
        ignoreDuplicates: true
      })

    if (error) {
      errors++
      if (errors <= 3) {
        console.error(`\n  Batch ${Math.floor(i / BATCH_SIZE)} error: ${error.message}`)
      }
    } else {
      imported += batch.length
    }

    process.stdout.write(`\r  Progress: ${imported} imported, ${errors} batch errors`)
  }

  console.log('\n')

  // Verify
  const { count: finalCount } = await supabase
    .from('project_members')
    .select('id', { count: 'exact', head: true })

  console.log('--- Summary ---')
  console.log(`  Before: ${existingCount}`)
  console.log(`  After: ${finalCount}`)
  console.log(`  Added: ${finalCount - existingCount}`)
  console.log(`  Invalid FK skipped: ${invalidMembers}`)
  console.log(`  Batch errors: ${errors}`)

  console.log('\n✓ Done')
}

main().catch(console.error)
