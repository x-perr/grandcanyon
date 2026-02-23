/**
 * Fix User Mapping
 *
 * Updates the USER_MAPPING.json with actual profile IDs from the database.
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
  console.log('Fix User Mapping')
  console.log('='.repeat(60))

  // Load raw users
  const rawUsers = loadJson(RAW_DIR, 'users.json')
  console.log(`\nRaw users: ${rawUsers.length}`)

  // Get all profiles
  const { data: profiles } = await supabase.from('profiles').select('id, email, first_name, last_name')
  const emailToProfile = new Map()
  profiles?.forEach(p => {
    if (p.email) emailToProfile.set(p.email.toLowerCase(), p)
  })
  console.log(`Profiles in DB: ${profiles?.length}`)

  // First, identify which emails are shared
  const emailCounts = new Map()
  for (const user of rawUsers) {
    let email = user.user_email?.trim()?.toLowerCase()
    if (email && email.includes('@')) {
      emailCounts.set(email, (emailCounts.get(email) || 0) + 1)
    }
  }
  const sharedEmails = new Set([...emailCounts.entries()].filter(([, c]) => c > 1).map(([e]) => e))
  console.log(`\nShared emails: ${sharedEmails.size}`)

  // Build correct mapping
  const userMapping = []

  for (const user of rawUsers) {
    let email = user.user_email?.trim()?.toLowerCase()
    const hasSharedEmail = email && sharedEmails.has(email)

    // Generated email for this user
    const generatedEmail = `user_${user.user_id}@grandcanyon.local`

    let profile = null
    let finalEmail = null

    if (hasSharedEmail) {
      // For shared email users, PREFER their unique generated email profile
      profile = emailToProfile.get(generatedEmail)
      if (profile) {
        finalEmail = generatedEmail
      } else {
        // Fall back to shared email profile (not ideal but better than nothing)
        profile = emailToProfile.get(email)
        finalEmail = email
      }
    } else if (!email || !email.includes('@')) {
      // User with no valid email - use generated
      finalEmail = generatedEmail
      profile = emailToProfile.get(generatedEmail)
    } else {
      // User with unique email - use their email
      finalEmail = email
      profile = emailToProfile.get(email)
    }

    userMapping.push({
      raw_user_id: user.user_id,
      profile_id: profile?.id || null,
      legacy_email: user.user_email,
      final_email: finalEmail,
      first_name: user.user_fname,
      last_name: user.user_lname,
      profile_name: profile ? `${profile.first_name} ${profile.last_name}` : null,
      has_shared_email: hasSharedEmail,
      status: profile ? 'MATCHED' : 'NO_PROFILE',
    })
  }

  // Summary
  const matched = userMapping.filter(m => m.status === 'MATCHED').length
  const noProfile = userMapping.filter(m => m.status === 'NO_PROFILE').length

  console.log(`\nMatched: ${matched}`)
  console.log(`No profile: ${noProfile}`)

  if (noProfile > 0) {
    console.log('\nUsers without profiles:')
    userMapping.filter(m => m.status === 'NO_PROFILE').forEach(m => {
      console.log(`  - ID ${m.raw_user_id}: ${m.first_name} ${m.last_name} (${m.legacy_email})`)
    })
  }

  // Verify: count unique profile IDs
  const uniqueProfiles = new Set(userMapping.filter(m => m.profile_id).map(m => m.profile_id))
  console.log(`\nUnique profile IDs in mapping: ${uniqueProfiles.size}`)

  // Check for duplicates (multiple raw users -> same profile)
  const profileCounts = new Map()
  for (const m of userMapping) {
    if (m.profile_id) {
      profileCounts.set(m.profile_id, (profileCounts.get(m.profile_id) || 0) + 1)
    }
  }

  const sharedProfiles = [...profileCounts.entries()].filter(([, count]) => count > 1)
  console.log(`\nProfiles shared by multiple raw users: ${sharedProfiles.length}`)

  if (sharedProfiles.length > 0) {
    console.log('\nShared profiles (STILL PROBLEMATIC):')
    for (const [profileId, count] of sharedProfiles) {
      const users = userMapping.filter(m => m.profile_id === profileId)
      const profile = profiles?.find(p => p.id === profileId)
      console.log(`  Profile ${profile?.email} shared by:`)
      for (const u of users) {
        console.log(`    - ID ${u.raw_user_id}: ${u.first_name} ${u.last_name}`)
      }
    }
  }

  // Save mapping
  const mappingPath = path.join(REPORT_DIR, 'USER_MAPPING.json')
  fs.writeFileSync(mappingPath, JSON.stringify(userMapping, null, 2))
  console.log(`\nMapping saved to: ${mappingPath}`)

  console.log('\n' + '='.repeat(60))
  console.log('Done!')
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
