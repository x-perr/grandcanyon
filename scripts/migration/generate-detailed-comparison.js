/**
 * Generate Detailed Comparison Report
 *
 * Shows day-by-day hour breakdown for each duplicate timesheet
 * to help identify corrections vs merges.
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
  const filepath = path.join(dir, filename)
  if (!fs.existsSync(filepath)) return []
  return JSON.parse(fs.readFileSync(filepath, 'utf8'))
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

async function main() {
  console.log('='.repeat(60))
  console.log('Generating Detailed Comparison Report')
  console.log('='.repeat(60))

  // Build user mappings
  console.log('\nBuilding mappings...')
  const { data: profiles } = await supabase.from('profiles').select('id, email')
  const emailToProfileId = new Map()
  profiles?.forEach(p => {
    if (p.email) emailToProfileId.set(p.email.toLowerCase(), p.id)
  })

  const rawUsers = loadJson(RAW_DIR, 'users.json')
  const userIdMap = new Map()
  const rawUserById = new Map()

  for (const user of rawUsers) {
    rawUserById.set(user.user_id, user)
    let email = user.user_email?.trim()
    if (!email || !email.includes('@')) {
      email = `user_${user.user_id}@grandcanyon.local`
    }
    const profileId = emailToProfileId.get(email.toLowerCase())
    if (profileId) {
      userIdMap.set(user.user_id, profileId)
    }
  }

  // Load raw projects for name lookup
  const rawProjects = loadJson(RAW_DIR, 'projects.json')
  const rawProjById = new Map(rawProjects.map(p => [p.proj_id, p]))

  // Load timesheet data
  const rawTimesheets = loadJson(RAW_DIR, 'timesheets.json')
  const rawTsDetails = loadJson(RAW_DIR, 'timesheetdetails.json')

  // Build timesheet detail lookup
  const detailsByTsId = new Map()
  for (const d of rawTsDetails) {
    if (!detailsByTsId.has(d.tsd_tsid)) {
      detailsByTsId.set(d.tsd_tsid, [])
    }
    detailsByTsId.get(d.tsd_tsid).push(d)
  }

  // Find duplicate timesheets
  const timesheetGroups = new Map()
  for (const ts of rawTimesheets) {
    const userId = userIdMap.get(ts.ts_emplid)
    if (!userId) continue
    const key = `${userId}_${ts.ts_periodfrom}`
    if (!timesheetGroups.has(key)) {
      timesheetGroups.set(key, [])
    }
    timesheetGroups.get(key).push(ts)
  }

  // Build detailed report for duplicates
  const duplicates = []

  for (const [key, group] of timesheetGroups) {
    if (group.length <= 1) continue

    const [userId, weekStart] = key.split('_')
    const rawUser = rawUsers.find(u => userIdMap.get(u.user_id) === userId)

    // Build detailed records for each timesheet
    const records = group.map(ts => {
      const details = detailsByTsId.get(ts.ts_id) || []

      const entries = details.map(d => {
        const proj = rawProjById.get(d.tsd_projid)
        const hours = [
          parseFloat(d.tsd_time1) || 0,
          parseFloat(d.tsd_time2) || 0,
          parseFloat(d.tsd_time3) || 0,
          parseFloat(d.tsd_time4) || 0,
          parseFloat(d.tsd_time5) || 0,
          parseFloat(d.tsd_time6) || 0,
          parseFloat(d.tsd_time7) || 0,
        ]
        return {
          tsd_id: d.tsd_id,
          project_id: d.tsd_projid,
          project_name: proj?.proj_name || `Project ${d.tsd_projid}`,
          project_code: proj?.proj_code || '???',
          hours,
          total: hours.reduce((a, b) => a + b, 0),
          notes: d.tsd_notes || '',
        }
      })

      // Calculate day totals across all entries
      const dayTotals = [0, 0, 0, 0, 0, 0, 0]
      for (const e of entries) {
        for (let i = 0; i < 7; i++) {
          dayTotals[i] += e.hours[i]
        }
      }

      return {
        ts_id: ts.ts_id,
        status: ts.ts_approved === '1' ? 'approved' : ts.ts_submitted === '1' ? 'submitted' : 'draft',
        submitted_on: ts.ts_submittedon || null,
        approved_on: ts.ts_approvedon || null,
        entry_count: entries.length,
        total_hours: dayTotals.reduce((a, b) => a + b, 0),
        day_totals: dayTotals,
        entries,
      }
    })

    // Sort by ts_id (chronological)
    records.sort((a, b) => a.ts_id - b.ts_id)

    // Analyze pattern
    let pattern = 'unknown'
    if (records.length === 2) {
      const r1 = records[0]
      const r2 = records[1]

      // Check if same days have hours
      const sameDays = r1.day_totals.every((h, i) =>
        (h > 0) === (r2.day_totals[i] > 0)
      )

      // Check if hours are identical
      const sameHours = r1.day_totals.every((h, i) =>
        Math.abs(h - r2.day_totals[i]) < 0.01
      )

      if (sameHours && r1.entry_count === r2.entry_count) {
        pattern = 'DUPLICATE - Exact same data, keep either'
      } else if (sameDays && !sameHours) {
        pattern = 'CORRECTION - Same days, different hours. Likely second is the fix.'
      } else if (!sameDays) {
        pattern = 'SPLIT - Different days worked, may need to MERGE'
      }
    }

    duplicates.push({
      user_email: rawUser?.user_email || `user_${rawUser?.user_id}@grandcanyon.local`,
      user_name: `${rawUser?.user_fname || ''} ${rawUser?.user_lname || ''}`.trim(),
      week_start: weekStart,
      pattern,
      records,
    })
  }

  // Sort by user and week
  duplicates.sort((a, b) => {
    if (a.user_email !== b.user_email) return a.user_email.localeCompare(b.user_email)
    return a.week_start.localeCompare(b.week_start)
  })

  // Write markdown report
  console.log('\nWriting report...')

  let md = `# Detailed Timesheet Duplicate Analysis

**Generated**: ${new Date().toISOString()}

**Total Duplicate Groups**: ${duplicates.length}

---

## Pattern Legend

| Pattern | Meaning | Action |
|---------|---------|--------|
| DUPLICATE | Exact same data | Keep first, skip second |
| CORRECTION | Same days, different hours | Keep SECOND (the correction) |
| SPLIT | Different days | Need to MERGE both |

---

`

  for (const dup of duplicates) {
    md += `## ${dup.user_email} - Week of ${dup.week_start}

**User**: ${dup.user_name}
**Pattern**: **${dup.pattern}**

`

    for (let i = 0; i < dup.records.length; i++) {
      const rec = dup.records[i]
      md += `### Timesheet #${i + 1} (ID: ${rec.ts_id})

**Status**: ${rec.status} | **Submitted**: ${rec.submitted_on || 'N/A'} | **Approved**: ${rec.approved_on || 'N/A'}

#### Day Totals

| Mon | Tue | Wed | Thu | Fri | Sat | Sun | **TOTAL** |
|-----|-----|-----|-----|-----|-----|-----|-----------|
| ${rec.day_totals.map(h => h.toFixed(1)).join(' | ')} | **${rec.total_hours.toFixed(1)}** |

#### Entries (${rec.entry_count})

| Project | ${DAYS.join(' | ')} | Total | Notes |
|---------|${DAYS.map(() => '----').join('|')}|-------|-------|
`

      for (const entry of rec.entries) {
        const projName = entry.project_name.length > 25
          ? entry.project_name.substring(0, 22) + '...'
          : entry.project_name
        const notes = entry.notes.length > 20
          ? entry.notes.substring(0, 17) + '...'
          : entry.notes
        md += `| ${entry.project_code}: ${projName} | ${entry.hours.map(h => h.toFixed(1)).join(' | ')} | ${entry.total.toFixed(1)} | ${notes.replace(/\|/g, '/')} |\n`
      }

      md += '\n'
    }

    md += `---

`
  }

  // Write files
  const mdPath = path.join(REPORT_DIR, 'DETAILED_DUPLICATE_ANALYSIS.md')
  fs.writeFileSync(mdPath, md)

  // Also write JSON for programmatic access
  const jsonPath = path.join(REPORT_DIR, 'DETAILED_DUPLICATE_ANALYSIS.json')
  fs.writeFileSync(jsonPath, JSON.stringify(duplicates, null, 2))

  console.log(`\nReports written to:`)
  console.log(`  Markdown: ${mdPath}`)
  console.log(`  JSON: ${jsonPath}`)

  // Summary stats
  const patterns = {}
  for (const dup of duplicates) {
    patterns[dup.pattern] = (patterns[dup.pattern] || 0) + 1
  }

  console.log('\n--- Pattern Summary ---')
  for (const [pattern, count] of Object.entries(patterns)) {
    console.log(`  ${pattern}: ${count}`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('Report generation complete!')
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
