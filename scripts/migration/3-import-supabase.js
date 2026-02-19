/**
 * Script 3: Import to Supabase
 *
 * Imports transformed JSON data to Supabase, respecting FK order.
 * Uses service role key to bypass RLS.
 *
 * Usage: npm run import
 *
 * Environment variables required:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TRANSFORMED_DIR = path.join(__dirname, 'data', 'transformed')

// Configuration
const BATCH_SIZE = 100
const AUTH_DELAY_MS = 300 // Delay between auth user creations

// Supabase client with service role (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

// Helper functions
function loadJson(filename) {
  const filepath = path.join(TRANSFORMED_DIR, filename)
  if (!fs.existsSync(filepath)) {
    console.warn(`Warning: ${filename} not found, returning empty array`)
    return []
  }
  return JSON.parse(fs.readFileSync(filepath, 'utf8'))
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Import a table with batched inserts
 */
async function importTable(tableName, data, options = {}) {
  const { skipIfExists = false } = options

  if (data.length === 0) {
    console.log(`  ${tableName}: No records to import`)
    return { imported: 0, errors: [] }
  }

  // Check if table already has data
  if (skipIfExists) {
    const { count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })

    if (count > 0) {
      console.log(`  ${tableName}: Already has ${count} records, skipping`)
      return { imported: 0, errors: [], skipped: true }
    }
  }

  let imported = 0
  const errors = []

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE)

    const { error } = await supabase.from(tableName).insert(batch)

    if (error) {
      errors.push({
        batch: Math.floor(i / BATCH_SIZE),
        startIndex: i,
        error: error.message,
        code: error.code,
      })

      // Stop on critical errors
      if (error.code === '23505') {
        // Unique violation
        console.error(`    Unique constraint violation in batch ${Math.floor(i / BATCH_SIZE)}`)
        // Try inserting one by one to find the problem
        for (const record of batch) {
          const { error: singleError } = await supabase.from(tableName).insert(record)
          if (!singleError) {
            imported++
          }
        }
      } else if (error.code === '23503') {
        // Foreign key violation
        console.error(`    Foreign key violation in batch ${Math.floor(i / BATCH_SIZE)}`)
        break
      } else {
        console.error(`    Error in batch ${Math.floor(i / BATCH_SIZE)}: ${error.message}`)
      }
    } else {
      imported += batch.length
    }

    // Progress indicator
    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= data.length) {
      process.stdout.write(`\r  ${tableName}: ${imported}/${data.length}`)
    }
  }

  console.log(`\r  ${tableName}: ${imported}/${data.length} imported` +
    (errors.length > 0 ? ` (${errors.length} batch errors)` : ''))

  return { imported, errors }
}

/**
 * Create auth users via Supabase Admin API
 */
async function createAuthUsers(authUsers) {
  console.log('\n--- Creating Auth Users ---')
  console.log(`Total users to create: ${authUsers.length}`)

  let created = 0
  let skipped = 0
  const errors = []

  for (const user of authUsers) {
    try {
      // Check if user already exists
      const { data: existingUser } = await supabase.auth.admin.getUserById(user.id)

      if (existingUser?.user) {
        skipped++
        continue
      }

      // Create auth user with matching UUID
      const { error } = await supabase.auth.admin.createUser({
        id: user.id,
        email: user.email,
        email_confirm: true,
        user_metadata: {
          first_name: user.first_name,
          last_name: user.last_name,
        },
      })

      if (error) {
        if (error.message.includes('already been registered')) {
          skipped++
        } else {
          errors.push({ email: user.email, error: error.message })
          console.error(`    Failed: ${user.email} - ${error.message}`)
        }
      } else {
        created++
      }

      // Rate limiting
      await sleep(AUTH_DELAY_MS)

      // Progress
      if ((created + skipped + errors.length) % 50 === 0) {
        console.log(`  Progress: ${created} created, ${skipped} skipped, ${errors.length} errors`)
      }
    } catch (err) {
      errors.push({ email: user.email, error: err.message })
    }
  }

  console.log(`\nAuth users: ${created} created, ${skipped} skipped, ${errors.length} errors`)

  if (errors.length > 0) {
    fs.writeFileSync(
      path.join(TRANSFORMED_DIR, '_auth_errors.json'),
      JSON.stringify(errors, null, 2)
    )
    console.log('Auth errors saved to _auth_errors.json')
  }

  return { created, skipped, errors }
}

/**
 * Clear existing data (use with caution!)
 */
async function clearTables() {
  console.log('\n--- Clearing Existing Data ---')
  console.log('WARNING: This will delete all data in the target tables!')

  const tablesToClear = [
    'invoice_lines',
    'invoices',
    'expense_entries',
    'expenses',
    'timesheet_entries',
    'timesheets',
    'project_members',
    'project_billing_roles',
    'project_tasks',
    'project_notes',
    'projects',
    'client_contacts',
    'clients',
    'role_permissions',
    'permissions',
    // Don't clear roles - they may have custom entries
    // Don't clear profiles - linked to auth.users
    // Don't clear expense_types - may have seeded data
  ]

  for (const table of tablesToClear) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      console.log(`  ${table}: ${error.message}`)
    } else {
      console.log(`  ${table}: cleared`)
    }
  }
}

// Import order (respecting FK dependencies)
const IMPORT_ORDER = [
  // Level 1: No dependencies
  { table: 'roles', file: 'roles.json', skipIfExists: true },
  { table: 'permissions', file: 'permissions.json', skipIfExists: true },
  { table: 'expense_types', file: 'expense_types.json', skipIfExists: true },

  // Level 2: Reference tables
  { table: 'role_permissions', file: 'role_permissions.json' },

  // Level 3: Core entities (auth users handled separately)
  { table: 'profiles', file: 'profiles.json' },
  { table: 'clients', file: 'clients.json' },
  { table: 'client_contacts', file: 'client_contacts.json' },

  // Level 4: Project hierarchy
  { table: 'projects', file: 'projects.json' },
  { table: 'project_tasks', file: 'project_tasks.json' },
  { table: 'project_billing_roles', file: 'project_billing_roles.json' },
  { table: 'project_members', file: 'project_members.json' },

  // Level 5: Time & expense tracking
  { table: 'timesheets', file: 'timesheets.json' },
  { table: 'timesheet_entries', file: 'timesheet_entries.json' },
  { table: 'expenses', file: 'expenses.json' },
  { table: 'expense_entries', file: 'expense_entries.json' },

  // Level 6: Invoicing
  { table: 'invoices', file: 'invoices.json' },
  { table: 'invoice_lines', file: 'invoice_lines.json' },
]

// Main execution
async function main() {
  console.log('='.repeat(60))
  console.log('Grand Canyon Migration - Step 3: Import to Supabase')
  console.log('='.repeat(60))

  // Validate environment
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('\nERROR: Missing environment variables.')
    console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
    console.error('Copy .env.example to .env and fill in the values.')
    process.exit(1)
  }

  console.log(`\nSupabase URL: ${process.env.SUPABASE_URL}`)

  // Check for transformed data
  if (!fs.existsSync(TRANSFORMED_DIR)) {
    console.error('\nERROR: Transformed data directory not found.')
    console.error('Run "npm run transform" first.')
    process.exit(1)
  }

  // Check for command line flags
  const clearFirst = process.argv.includes('--clear')
  const skipAuth = process.argv.includes('--skip-auth')

  if (clearFirst) {
    await clearTables()
  }

  // Step 1: Create auth users
  if (!skipAuth) {
    const authUsers = loadJson('auth_users.json')
    if (authUsers.length > 0) {
      await createAuthUsers(authUsers)
    }
  } else {
    console.log('\n--- Skipping Auth Users (--skip-auth flag) ---')
  }

  // Step 2: Import tables
  console.log('\n--- Importing Tables ---')

  const results = []

  for (const { table, file, skipIfExists } of IMPORT_ORDER) {
    const data = loadJson(file)
    const result = await importTable(table, data, { skipIfExists })
    results.push({ table, ...result })
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('Import Summary')
  console.log('='.repeat(60))
  console.log('')
  console.log('Table'.padEnd(25) + 'Imported'.padStart(10) + 'Errors'.padStart(10))
  console.log('-'.repeat(45))

  let totalImported = 0
  let totalErrors = 0

  for (const result of results) {
    console.log(
      result.table.padEnd(25) +
      result.imported.toString().padStart(10) +
      result.errors.length.toString().padStart(10)
    )
    totalImported += result.imported
    totalErrors += result.errors.length
  }

  console.log('-'.repeat(45))
  console.log(
    'TOTAL'.padEnd(25) +
    totalImported.toString().padStart(10) +
    totalErrors.toString().padStart(10)
  )

  // Save detailed errors
  const allErrors = results
    .filter(r => r.errors.length > 0)
    .map(r => ({ table: r.table, errors: r.errors }))

  if (allErrors.length > 0) {
    fs.writeFileSync(
      path.join(TRANSFORMED_DIR, '_import_errors.json'),
      JSON.stringify(allErrors, null, 2)
    )
    console.log('\nDetailed errors saved to _import_errors.json')
  }

  console.log('\n' + '='.repeat(60))
  console.log('Import complete!')
  console.log('')
  console.log('Next steps:')
  console.log('1. Run "npm run verify" to verify migration')
  console.log('2. Run "npm run password-resets" to send reset emails')
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
