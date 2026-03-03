/**
 * Update Projects with Address Fields
 *
 * Updates existing projects with new address structure fields:
 * - civic_number, street_name, status
 * - hourly_rate, per_unit_rate, fixed_price
 * - po_number, project_manager_id, work_type, is_global
 *
 * Usage: node update-projects-address.js
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TRANSFORMED_DIR = path.join(__dirname, 'data', 'transformed')
const BATCH_SIZE = 50

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
  console.log('Update Projects with Address Fields')
  console.log('='.repeat(60))

  // Load transformed projects
  const projects = loadJson('projects.json')
  console.log(`\nLoaded ${projects.length} projects from transformed data`)

  // Get ALL existing project IDs from database (paginated)
  const existingByCode = new Map()
  let offset = 0
  const pageSize = 1000

  while (true) {
    const { data: page, error: fetchError } = await supabase
      .from('projects')
      .select('id, code')
      .range(offset, offset + pageSize - 1)

    if (fetchError) {
      console.error('Failed to fetch existing projects:', fetchError.message)
      return
    }

    if (!page || page.length === 0) break

    page.forEach(p => existingByCode.set(p.code, p.id))
    offset += page.length

    if (page.length < pageSize) break
  }

  console.log(`Found ${existingByCode.size} existing projects in database`)

  // Fields to update (excluding FKs that may not exist)
  const updateFields = [
    'civic_number',
    'street_name',
    'status',
    'hourly_rate',
    'per_unit_rate',
    'fixed_price',
    'po_number',
    // 'project_manager_id', // Skip - profiles may not exist
    'work_type',
    'is_global',
    'name',
    'address',
    'city'
  ]

  let updated = 0
  let skipped = 0
  let errors = 0

  console.log('\n--- Updating Projects ---')

  for (let i = 0; i < projects.length; i += BATCH_SIZE) {
    const batch = projects.slice(i, i + BATCH_SIZE)

    for (const project of batch) {
      const existingId = existingByCode.get(project.code)

      if (!existingId) {
        skipped++
        continue
      }

      // Build update object with only non-null fields
      const updateData = {}
      for (const field of updateFields) {
        if (project[field] !== undefined) {
          updateData[field] = project[field]
        }
      }

      const { error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', existingId)

      if (error) {
        errors++
        if (errors <= 5) {
          console.error(`\n  Error updating ${project.code}: ${error.message}`)
        }
      } else {
        updated++
      }
    }

    // Progress update
    process.stdout.write(`\r  Progress: ${updated} updated, ${skipped} skipped, ${errors} errors`)
  }

  console.log(`\n\n--- Summary ---`)
  console.log(`  Updated: ${updated}`)
  console.log(`  Skipped (not found in DB): ${skipped}`)
  console.log(`  Errors: ${errors}`)

  // Verify sample
  console.log('\n--- Sample Verification ---')
  const { data: sample } = await supabase
    .from('projects')
    .select('code, civic_number, street_name, status, display_title')
    .not('civic_number', 'is', null)
    .limit(5)

  if (sample && sample.length > 0) {
    console.log('  Projects with address parsing:')
    for (const p of sample) {
      console.log(`    ${p.code}: "${p.civic_number} ${p.street_name}" → ${p.display_title}`)
    }
  }

  console.log('\n--- Status Distribution ---')
  const { count: activeCount } = await supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null)
  const { count: completedCount } = await supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'completed')
  const { count: onHoldCount } = await supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'on_hold')
  console.log(`  Active: ${activeCount}`)
  console.log(`  Completed: ${completedCount}`)
  console.log(`  On Hold: ${onHoldCount}`)

  console.log('\n✓ Done')
}

main().catch(console.error)
