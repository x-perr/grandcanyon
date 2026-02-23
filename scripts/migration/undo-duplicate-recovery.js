/**
 * Undo Duplicate Recovery
 *
 * CRITICAL: Removes entries that were added by recover-duplicates.js
 * These may have been corrections, not duplicates to merge.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAW_DIR = path.join(__dirname, 'data', 'raw')
const TRANS_DIR = path.join(__dirname, 'data', 'transformed')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function loadJson(dir, filename) {
  return JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf8'))
}

async function fetchAllPaginated(table, columns = '*') {
  const results = []
  let page = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(page * pageSize, (page + 1) * pageSize - 1)
    if (error || !data || data.length === 0) break
    results.push(...data)
    if (data.length < pageSize) break
    page++
  }
  return results
}

async function main() {
  console.log('='.repeat(60))
  console.log('UNDO Duplicate Recovery')
  console.log('='.repeat(60))
  console.log('\nThis will remove entries that were added from "duplicate" timesheets.')
  console.log('These duplicates may have been CORRECTIONS, not data to merge.\n')

  // Build user ID mapping
  console.log('Building mappings...')
  const { data: profiles } = await supabase.from('profiles').select('id, email')
  const emailToProfileId = new Map()
  profiles?.forEach(p => {
    if (p.email) emailToProfileId.set(p.email.toLowerCase(), p.id)
  })

  const rawUsers = loadJson(RAW_DIR, 'users.json')
  const userIdMap = new Map()
  for (const user of rawUsers) {
    let email = user.user_email?.trim()
    if (!email || !email.includes('@')) {
      email = `user_${user.user_id}@grandcanyon.local`
    }
    const profileId = emailToProfileId.get(email.toLowerCase())
    if (profileId) userIdMap.set(user.user_id, profileId)
  }

  // Load transformed data (this is what was ORIGINALLY imported)
  const transTimesheets = loadJson(TRANS_DIR, 'timesheets.json')
  const transEntries = loadJson(TRANS_DIR, 'timesheet_entries.json')

  // Build set of original entry IDs
  const originalEntryIds = new Set(transEntries.map(e => e.id))
  console.log(`Original entry IDs from transform: ${originalEntryIds.size}`)

  // Get all current entries from database
  console.log('\nFetching current database entries...')
  const dbEntries = await fetchAllPaginated('timesheet_entries', 'id')
  console.log(`Current entries in database: ${dbEntries.length}`)

  // Find entries that were ADDED (not in original transform)
  const addedEntryIds = dbEntries
    .filter(e => !originalEntryIds.has(e.id))
    .map(e => e.id)

  console.log(`Entries added by recovery script: ${addedEntryIds.length}`)

  if (addedEntryIds.length === 0) {
    console.log('\nNo entries to remove. Database matches original import.')
    return
  }

  // Delete the added entries
  console.log(`\nDeleting ${addedEntryIds.length} recovered entries...`)

  let deleted = 0
  const BATCH_SIZE = 100

  for (let i = 0; i < addedEntryIds.length; i += BATCH_SIZE) {
    const batch = addedEntryIds.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('timesheet_entries')
      .delete()
      .in('id', batch)

    if (!error) {
      deleted += batch.length
    } else {
      console.error(`Batch delete error: ${error.message}`)
    }

    process.stdout.write(`\r  Deleted: ${deleted}/${addedEntryIds.length}`)
  }
  console.log(`\r  Deleted: ${deleted}/${addedEntryIds.length}`)

  // Verify
  const { count } = await supabase
    .from('timesheet_entries')
    .select('*', { count: 'exact', head: true })

  console.log(`\nEntries remaining: ${count}`)
  console.log(`Expected (original): ${originalEntryIds.size}`)

  console.log('\n' + '='.repeat(60))
  console.log('Undo complete!')
  console.log('='.repeat(60))
  console.log('\nDatabase now contains only the FIRST timesheet for each (user, week).')
  console.log('Review FULL_COMPARISON_REPORT.md to decide which duplicates need attention.')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
