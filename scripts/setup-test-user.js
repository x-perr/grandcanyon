/**
 * Setup Test User for E2E Tests
 *
 * Ensures dev@xperr.win exists with password '123456' for E2E testing.
 *
 * Usage: node scripts/setup-test-user.js
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

const TEST_EMAIL = 'dev@xperr.win'
const TEST_PASSWORD = '123456'

async function main() {
  console.log('Setting up test user for E2E tests...')
  console.log(`Email: ${TEST_EMAIL}`)

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is required')
    process.exit(1)
  }

  // Check if user exists
  const { data: users, error: listError } = await supabase.auth.admin.listUsers()

  if (listError) {
    console.error('Error listing users:', listError.message)
    process.exit(1)
  }

  const existingUser = users.users.find(u => u.email === TEST_EMAIL)

  if (existingUser) {
    console.log(`User exists (${existingUser.id}), updating password...`)

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      existingUser.id,
      { password: TEST_PASSWORD }
    )

    if (updateError) {
      console.error('Error updating password:', updateError.message)
      process.exit(1)
    }

    console.log('Password updated successfully!')
  } else {
    console.log('User does not exist, creating...')

    const { data, error: createError } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        first_name: 'Dev',
        last_name: 'Admin',
      }
    })

    if (createError) {
      console.error('Error creating user:', createError.message)
      process.exit(1)
    }

    console.log(`User created (${data.user.id})`)

    // Also create profile with admin role
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: data.user.id,
        email: TEST_EMAIL,
        first_name: 'Dev',
        last_name: 'Admin',
        is_active: true,
        is_admin: true,
      })

    if (profileError) {
      console.error('Error creating profile:', profileError.message)
    } else {
      console.log('Profile created with admin role')
    }
  }

  console.log('\nTest user ready for E2E tests!')
  console.log(`  Email: ${TEST_EMAIL}`)
  console.log(`  Password: ${TEST_PASSWORD}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
