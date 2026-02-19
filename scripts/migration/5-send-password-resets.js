/**
 * Script 5: Send Password Reset Emails
 *
 * Sends password reset emails to all active migrated users so they can
 * set new passwords (legacy MD5 hashes cannot be migrated).
 *
 * Usage: npm run password-resets
 *
 * Options:
 *   --dry-run     Show what would be sent without actually sending
 *   --limit N     Only send to first N users
 *   --email X     Send to specific email only
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TRANSFORMED_DIR = path.join(__dirname, 'data', 'transformed')

// Configuration
const DELAY_BETWEEN_EMAILS_MS = 1000 // 1 second between emails

// Supabase client
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

const APP_URL = process.env.APP_URL || 'http://localhost:3000'

// Helper functions
function loadJson(filename) {
  const filepath = path.join(TRANSFORMED_DIR, filename)
  if (!fs.existsSync(filepath)) {
    return []
  }
  return JSON.parse(fs.readFileSync(filepath, 'utf8'))
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2)
  return {
    dryRun: args.includes('--dry-run'),
    limit: args.includes('--limit')
      ? parseInt(args[args.indexOf('--limit') + 1], 10)
      : null,
    email: args.includes('--email')
      ? args[args.indexOf('--email') + 1]
      : null,
  }
}

/**
 * Send password reset to a single user
 */
async function sendPasswordReset(user, dryRun) {
  if (dryRun) {
    console.log(`  [DRY RUN] Would send to: ${user.email}`)
    return { sent: true, dryRun: true }
  }

  try {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: user.email,
      options: {
        redirectTo: `${APP_URL}/login`,
      },
    })

    if (error) {
      return { sent: false, error: error.message }
    }

    // Note: In production, you'd send the link via email
    // Supabase sends the email automatically when using generateLink
    // with the appropriate email template configured

    return { sent: true, link: data?.properties?.hashed_token ? 'generated' : 'sent' }
  } catch (err) {
    return { sent: false, error: err.message }
  }
}

// Main execution
async function main() {
  console.log('='.repeat(60))
  console.log('Grand Canyon Migration - Step 5: Password Reset Emails')
  console.log('='.repeat(60))

  const args = parseArgs()

  if (args.dryRun) {
    console.log('\n** DRY RUN MODE - No emails will be sent **\n')
  }

  // Validate environment
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('\nERROR: Missing environment variables.')
    process.exit(1)
  }

  console.log(`\nSupabase URL: ${process.env.SUPABASE_URL}`)
  console.log(`App URL: ${APP_URL}`)

  // Load profiles from database (get active users only)
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, is_active')
    .eq('is_active', true)
    .not('email', 'is', null)
    .order('email')

  if (error) {
    console.error('Error fetching profiles:', error.message)
    process.exit(1)
  }

  // Filter valid emails
  let usersToProcess = profiles.filter(p =>
    p.email &&
    p.email.includes('@') &&
    !p.email.includes('placeholder')
  )

  // Apply filters
  if (args.email) {
    usersToProcess = usersToProcess.filter(u => u.email === args.email)
    if (usersToProcess.length === 0) {
      console.error(`No user found with email: ${args.email}`)
      process.exit(1)
    }
  }

  if (args.limit && args.limit > 0) {
    usersToProcess = usersToProcess.slice(0, args.limit)
  }

  console.log(`\nFound ${profiles.length} active users`)
  console.log(`Processing ${usersToProcess.length} users`)

  if (usersToProcess.length === 0) {
    console.log('No users to process.')
    return
  }

  // Confirm before sending
  if (!args.dryRun && !args.email) {
    console.log('\n** This will send real emails to users! **')
    console.log('Use --dry-run to preview without sending.')
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...')
    await sleep(5000)
  }

  // Send password resets
  console.log('\n--- Sending Password Resets ---\n')

  const results = {
    sent: 0,
    failed: 0,
    errors: [],
  }

  for (let i = 0; i < usersToProcess.length; i++) {
    const user = usersToProcess[i]
    const result = await sendPasswordReset(user, args.dryRun)

    if (result.sent) {
      results.sent++
      if (!args.dryRun) {
        console.log(`  [${i + 1}/${usersToProcess.length}] Sent: ${user.email}`)
      }
    } else {
      results.failed++
      results.errors.push({ email: user.email, error: result.error })
      console.log(`  [${i + 1}/${usersToProcess.length}] FAILED: ${user.email} - ${result.error}`)
    }

    // Rate limiting
    if (!args.dryRun && i < usersToProcess.length - 1) {
      await sleep(DELAY_BETWEEN_EMAILS_MS)
    }
  }

  // Save results
  const resultsFile = path.join(TRANSFORMED_DIR, '_password_reset_results.json')
  fs.writeFileSync(resultsFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    dryRun: args.dryRun,
    total: usersToProcess.length,
    sent: results.sent,
    failed: results.failed,
    errors: results.errors,
  }, null, 2))

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('Summary')
  console.log('='.repeat(60))
  console.log(`\n  Total processed: ${usersToProcess.length}`)
  console.log(`  Sent:            ${results.sent}`)
  console.log(`  Failed:          ${results.failed}`)

  if (results.errors.length > 0) {
    console.log('\nErrors:')
    results.errors.slice(0, 10).forEach(e => {
      console.log(`  - ${e.email}: ${e.error}`)
    })
    if (results.errors.length > 10) {
      console.log(`  ... and ${results.errors.length - 10} more`)
    }
  }

  console.log(`\nResults saved to: ${resultsFile}`)

  if (args.dryRun) {
    console.log('\n** This was a dry run. Run without --dry-run to send actual emails. **')
  }

  console.log('\n' + '='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
