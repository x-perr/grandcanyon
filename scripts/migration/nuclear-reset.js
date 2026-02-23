/**
 * Nuclear Reset Script
 *
 * Completely clears all data for fresh migration.
 * Deletes in proper FK order.
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function clearTable(tableName) {
  console.log(`  Clearing ${tableName}...`)
  const { count, error } = await supabase
    .from(tableName)
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (error) {
    console.error(`    Error: ${error.message}`)
    return false
  }
  console.log(`    Deleted ${count || 0} records`)
  return true
}

async function main() {
  console.log('='.repeat(60))
  console.log('Nuclear Reset - Clear ALL data for fresh migration')
  console.log('='.repeat(60))

  // Delete in reverse FK order (children first)
  console.log('\n--- Clearing tables (FK order) ---')

  // Level 1: Deepest dependencies
  await clearTable('invoice_lines')
  await clearTable('timesheet_entries')
  await clearTable('expense_entries')

  // Level 2: Mid-level
  await clearTable('invoices')
  await clearTable('timesheets')
  await clearTable('expenses')
  await clearTable('project_members')

  // Level 3: Higher level
  await clearTable('project_billing_roles')
  await clearTable('project_tasks')
  await clearTable('projects')
  await clearTable('client_contacts')
  await clearTable('clients')

  // Level 4: Base tables
  await clearTable('profiles')
  await clearTable('role_permissions')
  await clearTable('expense_types')

  // Note: roles and permissions are seeded, don't delete

  // Delete all auth users
  console.log('\n--- Deleting auth users ---')
  const { data: { users } } = await supabase.auth.admin.listUsers()
  console.log(`  Found ${users?.length || 0} auth users`)

  let deleted = 0
  for (const user of users || []) {
    const { error } = await supabase.auth.admin.deleteUser(user.id)
    if (!error) deleted++
    await sleep(50) // Rate limit
  }
  console.log(`  Deleted ${deleted} auth users`)

  console.log('\n' + '='.repeat(60))
  console.log('Nuclear reset complete!')
  console.log('Run the full migration script now.')
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
