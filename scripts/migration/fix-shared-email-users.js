/**
 * Fix Shared Email Users
 *
 * Creates unique profiles for legacy users who share email addresses.
 * Tracks the mapping between legacy user IDs and new profile IDs.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
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
  console.log('Fix Shared Email Users')
  console.log('='.repeat(60))

  // Load raw users
  const rawUsers = loadJson(RAW_DIR, 'users.json')
  console.log(`\nRaw users: ${rawUsers.length}`)

  // Get existing profiles
  const { data: profiles } = await supabase.from('profiles').select('id, email, first_name, last_name')
  const emailToProfile = new Map()
  profiles?.forEach(p => {
    if (p.email) emailToProfile.set(p.email.toLowerCase(), p)
  })
  console.log(`Existing profiles: ${profiles?.length}`)

  // Analyze raw users by email
  const usersByEmail = new Map()
  for (const user of rawUsers) {
    let email = user.user_email?.trim()?.toLowerCase()
    if (!email || !email.includes('@')) {
      // Already a generated email in legacy - keep it unique
      email = `user_${user.user_id}@grandcanyon.local`
    }
    if (!usersByEmail.has(email)) {
      usersByEmail.set(email, [])
    }
    usersByEmail.get(email).push(user)
  }

  // Categorize: unique emails vs shared emails
  const uniqueEmailUsers = []
  const sharedEmailUsers = []

  for (const [email, users] of usersByEmail) {
    if (users.length === 1) {
      uniqueEmailUsers.push({ email, user: users[0] })
    } else {
      sharedEmailUsers.push({ email, users })
    }
  }

  console.log(`\nUnique email users: ${uniqueEmailUsers.length}`)
  console.log(`Shared email groups: ${sharedEmailUsers.length}`)
  console.log(`Users in shared groups: ${sharedEmailUsers.reduce((sum, g) => sum + g.users.length, 0)}`)

  // Build mapping: raw_user_id -> profile_id
  const userMapping = []

  // 1. Handle unique email users - match to existing profiles
  console.log('\n--- Processing Unique Email Users ---')
  for (const { email, user } of uniqueEmailUsers) {
    const existingProfile = emailToProfile.get(email)
    if (existingProfile) {
      userMapping.push({
        raw_user_id: user.user_id,
        profile_id: existingProfile.id,
        legacy_email: user.user_email,
        final_email: email,
        first_name: user.user_fname,
        last_name: user.user_lname,
        status: 'MATCHED_EXISTING',
      })
    } else {
      // No profile exists - this shouldn't happen if import ran
      userMapping.push({
        raw_user_id: user.user_id,
        profile_id: null,
        legacy_email: user.user_email,
        final_email: email,
        first_name: user.user_fname,
        last_name: user.user_lname,
        status: 'NO_PROFILE_FOUND',
      })
    }
  }

  // 2. Handle shared email users
  console.log('\n--- Processing Shared Email Users ---')
  const profilesToCreate = []

  for (const { email, users } of sharedEmailUsers) {
    console.log(`\n  Email: ${email} (${users.length} users)`)

    // Check if profile exists
    const existingProfile = emailToProfile.get(email)

    for (let i = 0; i < users.length; i++) {
      const user = users[i]

      if (i === 0 && existingProfile) {
        // First user keeps the existing profile
        console.log(`    - ${user.user_fname} ${user.user_lname} (ID ${user.user_id}): KEEP existing profile`)
        userMapping.push({
          raw_user_id: user.user_id,
          profile_id: existingProfile.id,
          legacy_email: user.user_email,
          final_email: email,
          first_name: user.user_fname,
          last_name: user.user_lname,
          status: 'KEEP_EXISTING',
        })
      } else {
        // Create new profile with unique email
        const newEmail = `user_${user.user_id}@grandcanyon.local`
        const newProfileId = uuidv4()

        console.log(`    - ${user.user_fname} ${user.user_lname} (ID ${user.user_id}): CREATE new → ${newEmail}`)

        profilesToCreate.push({
          id: newProfileId,
          email: newEmail,
          first_name: user.user_fname || '',
          last_name: user.user_lname || '',
          is_active: user.user_active === '1' || user.user_active === 1,
          created_at: new Date().toISOString(),
        })

        userMapping.push({
          raw_user_id: user.user_id,
          profile_id: newProfileId,
          legacy_email: user.user_email,
          final_email: newEmail,
          first_name: user.user_fname,
          last_name: user.user_lname,
          status: 'CREATE_NEW',
        })
      }
    }
  }

  // 3. Create new profiles
  console.log(`\n--- Creating ${profilesToCreate.length} New Profiles ---`)

  if (profilesToCreate.length > 0) {
    const { error } = await supabase.from('profiles').insert(profilesToCreate)
    if (error) {
      console.error('Error creating profiles:', error.message)
    } else {
      console.log(`  Created ${profilesToCreate.length} profiles`)
    }
  }

  // 4. Save mapping file
  const mappingPath = path.join(REPORT_DIR, 'USER_MAPPING.json')
  fs.writeFileSync(mappingPath, JSON.stringify(userMapping, null, 2))
  console.log(`\nMapping saved to: ${mappingPath}`)

  // 5. Generate summary report
  const mdPath = path.join(REPORT_DIR, 'USER_MAPPING_REPORT.md')
  let md = `# User Mapping Report

**Generated**: ${new Date().toISOString()}

## Summary

| Status | Count |
|--------|-------|
| MATCHED_EXISTING | ${userMapping.filter(m => m.status === 'MATCHED_EXISTING').length} |
| KEEP_EXISTING | ${userMapping.filter(m => m.status === 'KEEP_EXISTING').length} |
| CREATE_NEW | ${userMapping.filter(m => m.status === 'CREATE_NEW').length} |
| NO_PROFILE_FOUND | ${userMapping.filter(m => m.status === 'NO_PROFILE_FOUND').length} |

## Shared Email Resolution

`

  for (const { email, users } of sharedEmailUsers) {
    md += `### ${email}

| Raw ID | Name | Final Email | Status |
|--------|------|-------------|--------|
`
    for (const user of users) {
      const mapping = userMapping.find(m => m.raw_user_id === user.user_id)
      md += `| ${user.user_id} | ${user.user_fname} ${user.user_lname} | ${mapping?.final_email} | ${mapping?.status} |\n`
    }
    md += '\n'
  }

  fs.writeFileSync(mdPath, md)
  console.log(`Report saved to: ${mdPath}`)

  // 6. Show next steps
  console.log('\n' + '='.repeat(60))
  console.log('Next Steps:')
  console.log('='.repeat(60))
  console.log('1. Run reimport-with-user-mapping.js to update timesheets/expenses')
  console.log('2. This will use the new profile IDs for the correct users')
  console.log('3. Then re-run verification')

  return userMapping
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
