/**
 * Fix Shared Email Users v2
 *
 * Creates auth users + profiles for legacy users who share email addresses.
 * Tracks the mapping between legacy user IDs and new profile IDs.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAW_DIR = path.join(__dirname, 'data', 'raw')
const REPORT_DIR = path.join(__dirname, '..', '..', 'docs', 'migration')

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
  console.log('Fix Shared Email Users v2')
  console.log('='.repeat(60))

  // Load existing mapping if it exists
  const mappingPath = path.join(REPORT_DIR, 'USER_MAPPING.json')
  let userMapping = []
  if (fs.existsSync(mappingPath)) {
    userMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'))
    console.log(`\nLoaded existing mapping: ${userMapping.length} users`)
  }

  // Find users that need new profiles (CREATE_NEW status but no profile_id in DB)
  const usersToCreate = userMapping.filter(m => m.status === 'CREATE_NEW')
  console.log(`Users needing new profiles: ${usersToCreate.length}`)

  if (usersToCreate.length === 0) {
    console.log('No users to create. Exiting.')
    return
  }

  // Check which ones already exist (in case of partial run)
  const { data: existingProfiles } = await supabase
    .from('profiles')
    .select('id, email')

  const existingEmails = new Set(existingProfiles?.map(p => p.email.toLowerCase()) || [])
  const existingIds = new Set(existingProfiles?.map(p => p.id) || [])

  const actuallyNeedCreating = usersToCreate.filter(u =>
    !existingEmails.has(u.final_email.toLowerCase()) &&
    !existingIds.has(u.profile_id)
  )

  console.log(`Actually need creating: ${actuallyNeedCreating.length}`)

  // Create auth users and profiles
  let created = 0
  for (const user of actuallyNeedCreating) {
    console.log(`\nCreating: ${user.first_name} ${user.last_name} (${user.final_email})`)

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.final_email,
      email_confirm: true,
      password: 'TempPassword123!', // They'll need to reset
      user_metadata: {
        first_name: user.first_name,
        last_name: user.last_name,
        legacy_user_id: user.raw_user_id,
      },
    })

    if (authError) {
      console.error(`  Auth error: ${authError.message}`)
      continue
    }

    if (!authData.user) {
      console.error('  No user returned from auth')
      continue
    }

    // Update mapping with actual profile ID (auth trigger creates profile)
    const authUserId = authData.user.id
    console.log(`  Auth user created: ${authUserId}`)

    // Update the mapping
    const mappingEntry = userMapping.find(m => m.raw_user_id === user.raw_user_id)
    if (mappingEntry) {
      mappingEntry.profile_id = authUserId
    }

    // Update profile with correct name (trigger might not have it)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        is_active: true,
      })
      .eq('id', authUserId)

    if (profileError) {
      console.error(`  Profile update error: ${profileError.message}`)
    }

    created++
  }

  console.log(`\n--- Created ${created} users ---`)

  // Save updated mapping
  fs.writeFileSync(mappingPath, JSON.stringify(userMapping, null, 2))
  console.log(`Updated mapping saved to: ${mappingPath}`)

  // Verify profile count
  const { count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  console.log(`\nTotal profiles now: ${count}`)

  console.log('\n' + '='.repeat(60))
  console.log('Done!')
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
