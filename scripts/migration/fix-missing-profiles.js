/**
 * Fix Missing Profiles
 *
 * Creates profiles for auth users that don't have them.
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  console.log('='.repeat(60))
  console.log('Fix Missing Profiles')
  console.log('='.repeat(60))

  // Get all auth users
  console.log('\n  Fetching auth users...')
  const authUsers = []
  let page = 1
  while (true) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 100 })
    if (!data?.users?.length) break
    authUsers.push(...data.users)
    if (data.users.length < 100) break
    page++
  }
  console.log(`  Found ${authUsers.length} auth users`)

  // Get all profiles
  const { data: profiles } = await supabase.from('profiles').select('id, email')
  console.log(`  Found ${profiles?.length || 0} profiles`)

  // Build set of profile IDs
  const profileIds = new Set(profiles?.map(p => p.id) || [])
  const profileEmails = new Set(profiles?.map(p => p.email?.toLowerCase()) || [])

  // Find auth users without profiles
  const missingProfiles = authUsers.filter(u => {
    // Check by ID first
    if (profileIds.has(u.id)) return false
    // Also check by email in case IDs don't match
    if (u.email && profileEmails.has(u.email.toLowerCase())) return false
    return true
  })

  console.log(`  Auth users without profiles: ${missingProfiles.length}`)

  if (missingProfiles.length === 0) {
    console.log('  All auth users have profiles!')
    return
  }

  // Create missing profiles
  console.log('\n  Creating missing profiles...')
  let created = 0
  for (const user of missingProfiles) {
    const { error } = await supabase.from('profiles').insert({
      id: user.id,
      email: user.email,
      first_name: user.user_metadata?.first_name || '',
      last_name: user.user_metadata?.last_name || '',
      is_active: true,
      created_at: new Date().toISOString(),
    })

    if (error) {
      console.error(`    Error creating profile for ${user.email}: ${error.message}`)
    } else {
      created++
    }

    if (created % 20 === 0) {
      process.stdout.write(`\r    Created: ${created}/${missingProfiles.length}`)
    }
  }
  console.log(`\r    Created ${created} profiles`)

  // Verify
  const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
  console.log(`\n  Total profiles now: ${count}`)

  console.log('\n' + '='.repeat(60))
  console.log('Done!')
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
