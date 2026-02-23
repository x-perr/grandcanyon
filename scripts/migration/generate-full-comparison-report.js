/**
 * Generate Full Comparison Report
 *
 * Creates a detailed report with ALL duplicates and side-by-side
 * comparison of legacy vs new data for verification.
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
  console.log('Generating Full Comparison Report')
  console.log('='.repeat(60))

  // Build user mappings
  console.log('\nBuilding mappings...')
  const { data: profiles } = await supabase.from('profiles').select('id, email, first_name, last_name')
  const emailToProfile = new Map()
  profiles?.forEach(p => {
    if (p.email) emailToProfile.set(p.email.toLowerCase(), p)
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
    const profile = emailToProfile.get(email.toLowerCase())
    if (profile) {
      userIdMap.set(user.user_id, profile.id)
    }
  }

  // ============================================================
  // TIMESHEETS - FULL DUPLICATE ANALYSIS
  // ============================================================
  console.log('\nAnalyzing ALL timesheet duplicates...')
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

  // Get DB timesheets
  const dbTimesheets = await fetchAllPaginated('timesheets', 'id, user_id, week_start, week_end, status, submitted_at, approved_at')
  const dbTsEntries = await fetchAllPaginated('timesheet_entries', 'id, timesheet_id, hours')

  // Build DB lookup
  const dbTsLookup = new Map()
  dbTimesheets.forEach(ts => {
    const key = `${ts.user_id}_${ts.week_start}`
    dbTsLookup.set(key, ts)
  })

  const dbEntriesByTsId = new Map()
  for (const e of dbTsEntries) {
    if (!dbEntriesByTsId.has(e.timesheet_id)) {
      dbEntriesByTsId.set(e.timesheet_id, [])
    }
    dbEntriesByTsId.get(e.timesheet_id).push(e)
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

  // Build full duplicate report
  const timesheetDuplicates = []
  for (const [key, group] of timesheetGroups) {
    if (group.length > 1) {
      const [userId, weekStart] = key.split('_')
      const rawUser = rawUsers.find(u => userIdMap.get(u.user_id) === userId)
      const profile = profiles?.find(p => p.id === userId)

      // Get DB timesheet for this key
      const dbTs = dbTsLookup.get(key)
      const dbEntries = dbTs ? (dbEntriesByTsId.get(dbTs.id) || []) : []
      const dbTotalHours = dbEntries.reduce((sum, e) => {
        if (e.hours && Array.isArray(e.hours)) {
          return sum + e.hours.reduce((a, b) => a + (b || 0), 0)
        }
        return sum
      }, 0)

      // Build legacy details for each duplicate
      const legacyRecords = group.map(ts => {
        const details = detailsByTsId.get(ts.ts_id) || []
        const totalHours = details.reduce((sum, d) => {
          return sum + (parseFloat(d.tsd_time1) || 0) +
                       (parseFloat(d.tsd_time2) || 0) +
                       (parseFloat(d.tsd_time3) || 0) +
                       (parseFloat(d.tsd_time4) || 0) +
                       (parseFloat(d.tsd_time5) || 0) +
                       (parseFloat(d.tsd_time6) || 0) +
                       (parseFloat(d.tsd_time7) || 0)
        }, 0)

        return {
          ts_id: ts.ts_id,
          period_from: ts.ts_periodfrom,
          period_to: ts.ts_periodto,
          status: ts.ts_approved === '1' ? 'approved' : ts.ts_submitted === '1' ? 'submitted' : 'draft',
          submitted_on: ts.ts_submittedon || null,
          approved_on: ts.ts_approvedon || null,
          entry_count: details.length,
          total_hours: totalHours,
          entries: details.map(d => ({
            tsd_id: d.tsd_id,
            project_id: d.tsd_projid,
            task_id: d.tsd_taskid,
            hours: [
              parseFloat(d.tsd_time1) || 0,
              parseFloat(d.tsd_time2) || 0,
              parseFloat(d.tsd_time3) || 0,
              parseFloat(d.tsd_time4) || 0,
              parseFloat(d.tsd_time5) || 0,
              parseFloat(d.tsd_time6) || 0,
              parseFloat(d.tsd_time7) || 0,
            ],
            notes: d.tsd_notes,
          })),
        }
      })

      const legacyTotalHours = legacyRecords.reduce((sum, r) => sum + r.total_hours, 0)
      const legacyEntryCount = legacyRecords.reduce((sum, r) => sum + r.entry_count, 0)

      timesheetDuplicates.push({
        user: {
          legacy_id: rawUser?.user_id,
          email: rawUser?.user_email || `user_${rawUser?.user_id}@grandcanyon.local`,
          name: `${rawUser?.user_fname || ''} ${rawUser?.user_lname || ''}`.trim(),
        },
        week_start: weekStart,
        duplicate_count: group.length,
        legacy: {
          total_records: group.length,
          total_entries: legacyEntryCount,
          total_hours: legacyTotalHours,
          records: legacyRecords,
        },
        new_db: {
          timesheet_id: dbTs?.id || null,
          status: dbTs?.status || null,
          entry_count: dbEntries.length,
          total_hours: dbTotalHours,
        },
        comparison: {
          hours_match: Math.abs(legacyTotalHours - dbTotalHours) < 0.01,
          hours_difference: dbTotalHours - legacyTotalHours,
          entries_difference: dbEntries.length - legacyEntryCount,
        },
      })
    }
  }

  // Sort by user email and week
  timesheetDuplicates.sort((a, b) => {
    if (a.user.email !== b.user.email) return a.user.email.localeCompare(b.user.email)
    return a.week_start.localeCompare(b.week_start)
  })

  // ============================================================
  // EXPENSES - FULL DUPLICATE ANALYSIS
  // ============================================================
  console.log('Analyzing ALL expense duplicates...')
  const rawExpenses = loadJson(RAW_DIR, 'expenses.json')
  const rawExpDetails = loadJson(RAW_DIR, 'expensedetails.json')

  const expDetailsByExpId = new Map()
  for (const d of rawExpDetails) {
    if (!expDetailsByExpId.has(d.exd_expid)) {
      expDetailsByExpId.set(d.exd_expid, [])
    }
    expDetailsByExpId.get(d.exd_expid).push(d)
  }

  const dbExpenses = await fetchAllPaginated('expenses', 'id, user_id, week_start, week_end, status')
  const dbExpEntries = await fetchAllPaginated('expense_entries', 'id, expense_id, total')

  const dbExpLookup = new Map()
  dbExpenses.forEach(exp => {
    const key = `${exp.user_id}_${exp.week_start}`
    dbExpLookup.set(key, exp)
  })

  const dbExpEntriesByExpId = new Map()
  for (const e of dbExpEntries) {
    if (!dbExpEntriesByExpId.has(e.expense_id)) {
      dbExpEntriesByExpId.set(e.expense_id, [])
    }
    dbExpEntriesByExpId.get(e.expense_id).push(e)
  }

  const expenseGroups = new Map()
  for (const exp of rawExpenses) {
    const userId = userIdMap.get(exp.exp_emplid)
    if (!userId) continue
    const key = `${userId}_${exp.exp_periodfrom}`
    if (!expenseGroups.has(key)) {
      expenseGroups.set(key, [])
    }
    expenseGroups.get(key).push(exp)
  }

  const expenseDuplicates = []
  for (const [key, group] of expenseGroups) {
    if (group.length > 1) {
      const [userId, weekStart] = key.split('_')
      const rawUser = rawUsers.find(u => userIdMap.get(u.user_id) === userId)

      const dbExp = dbExpLookup.get(key)
      const dbEntries = dbExp ? (dbExpEntriesByExpId.get(dbExp.id) || []) : []
      const dbTotalAmount = dbEntries.reduce((sum, e) => sum + (parseFloat(e.total) || 0), 0)

      const legacyRecords = group.map(exp => {
        const details = expDetailsByExpId.get(exp.exp_id) || []
        const totalAmount = details.reduce((sum, d) => sum + (parseFloat(d.exd_total) || 0), 0)

        return {
          exp_id: exp.exp_id,
          period_from: exp.exp_periodfrom,
          period_to: exp.exp_periodto,
          status: exp.exp_approved === '1' ? 'approved' : exp.exp_submitted === '1' ? 'submitted' : 'draft',
          entry_count: details.length,
          total_amount: totalAmount,
          entries: details.map(d => ({
            exd_id: d.exd_id,
            date: d.exd_date,
            description: d.exd_desc,
            total: parseFloat(d.exd_total) || 0,
          })),
        }
      })

      const legacyTotalAmount = legacyRecords.reduce((sum, r) => sum + r.total_amount, 0)
      const legacyEntryCount = legacyRecords.reduce((sum, r) => sum + r.entry_count, 0)

      expenseDuplicates.push({
        user: {
          legacy_id: rawUser?.user_id,
          email: rawUser?.user_email || `user_${rawUser?.user_id}@grandcanyon.local`,
          name: `${rawUser?.user_fname || ''} ${rawUser?.user_lname || ''}`.trim(),
        },
        week_start: weekStart,
        duplicate_count: group.length,
        legacy: {
          total_records: group.length,
          total_entries: legacyEntryCount,
          total_amount: legacyTotalAmount,
          records: legacyRecords,
        },
        new_db: {
          expense_id: dbExp?.id || null,
          status: dbExp?.status || null,
          entry_count: dbEntries.length,
          total_amount: dbTotalAmount,
        },
        comparison: {
          amount_match: Math.abs(legacyTotalAmount - dbTotalAmount) < 0.01,
          amount_difference: dbTotalAmount - legacyTotalAmount,
          entries_difference: dbEntries.length - legacyEntryCount,
        },
      })
    }
  }

  expenseDuplicates.sort((a, b) => {
    if (a.user.email !== b.user.email) return a.user.email.localeCompare(b.user.email)
    return a.week_start.localeCompare(b.week_start)
  })

  // ============================================================
  // WRITE REPORTS
  // ============================================================
  console.log('\nWriting reports...')

  const fullReport = {
    generated_at: new Date().toISOString(),
    summary: {
      timesheet_duplicate_groups: timesheetDuplicates.length,
      timesheet_duplicate_records: timesheetDuplicates.reduce((sum, d) => sum + d.duplicate_count, 0),
      expense_duplicate_groups: expenseDuplicates.length,
      expense_duplicate_records: expenseDuplicates.reduce((sum, d) => sum + d.duplicate_count, 0),
    },
    timesheet_duplicates: timesheetDuplicates,
    expense_duplicates: expenseDuplicates,
  }

  // Write JSON
  const jsonPath = path.join(REPORT_DIR, 'FULL_COMPARISON_REPORT.json')
  fs.writeFileSync(jsonPath, JSON.stringify(fullReport, null, 2))

  // Write Markdown
  const mdPath = path.join(REPORT_DIR, 'FULL_COMPARISON_REPORT.md')
  const md = generateMarkdown(fullReport)
  fs.writeFileSync(mdPath, md)

  console.log(`\nReports written to:`)
  console.log(`  JSON: ${jsonPath}`)
  console.log(`  Markdown: ${mdPath}`)

  console.log('\n' + '='.repeat(60))
  console.log('Report generation complete!')
  console.log('='.repeat(60))
}

function generateMarkdown(report) {
  let md = `# Grand Canyon Migration - Full Comparison Report

**Generated**: ${report.generated_at}

---

## Summary

| Metric | Count |
|--------|-------|
| Timesheet Duplicate Groups | ${report.summary.timesheet_duplicate_groups} |
| Total Timesheet Duplicate Records | ${report.summary.timesheet_duplicate_records} |
| Expense Duplicate Groups | ${report.summary.expense_duplicate_groups} |
| Total Expense Duplicate Records | ${report.summary.expense_duplicate_records} |

---

## ALL Timesheet Duplicates (${report.timesheet_duplicates.length} groups)

Each group shows records with the same (user, week_start) in the legacy system.

`

  for (const dup of report.timesheet_duplicates) {
    md += `### ${dup.user.email} - Week of ${dup.week_start}

**User**: ${dup.user.name} (Legacy ID: ${dup.user.legacy_id})

#### Legacy System (${dup.duplicate_count} records)

| TS ID | Status | Entries | Hours | Submitted | Approved |
|-------|--------|---------|-------|-----------|----------|
`
    for (const rec of dup.legacy.records) {
      md += `| ${rec.ts_id} | ${rec.status} | ${rec.entry_count} | ${rec.total_hours.toFixed(2)} | ${rec.submitted_on || '-'} | ${rec.approved_on || '-'} |\n`
    }

    md += `
**Legacy Total**: ${dup.legacy.total_entries} entries, ${dup.legacy.total_hours.toFixed(2)} hours

#### New Database

| Timesheet ID | Status | Entries | Hours |
|--------------|--------|---------|-------|
| ${dup.new_db.timesheet_id || 'N/A'} | ${dup.new_db.status || '-'} | ${dup.new_db.entry_count} | ${dup.new_db.total_hours.toFixed(2)} |

#### Comparison

- Hours Match: ${dup.comparison.hours_match ? '✓ YES' : '✗ NO'}
- Hours Difference: ${dup.comparison.hours_difference >= 0 ? '+' : ''}${dup.comparison.hours_difference.toFixed(2)}
- Entries Difference: ${dup.comparison.entries_difference >= 0 ? '+' : ''}${dup.comparison.entries_difference}

---

`
  }

  md += `## ALL Expense Duplicates (${report.expense_duplicates.length} groups)

`

  for (const dup of report.expense_duplicates) {
    md += `### ${dup.user.email} - Week of ${dup.week_start}

**User**: ${dup.user.name} (Legacy ID: ${dup.user.legacy_id})

#### Legacy System (${dup.duplicate_count} records)

| Exp ID | Status | Entries | Amount |
|--------|--------|---------|--------|
`
    for (const rec of dup.legacy.records) {
      md += `| ${rec.exp_id} | ${rec.status} | ${rec.entry_count} | $${rec.total_amount.toFixed(2)} |\n`
    }

    md += `
**Legacy Total**: ${dup.legacy.total_entries} entries, $${dup.legacy.total_amount.toFixed(2)}

#### New Database

| Expense ID | Status | Entries | Amount |
|------------|--------|---------|--------|
| ${dup.new_db.expense_id || 'N/A'} | ${dup.new_db.status || '-'} | ${dup.new_db.entry_count} | $${dup.new_db.total_amount.toFixed(2)} |

#### Comparison

- Amount Match: ${dup.comparison.amount_match ? '✓ YES' : '✗ NO'}
- Amount Difference: ${dup.comparison.amount_difference >= 0 ? '+' : ''}$${dup.comparison.amount_difference.toFixed(2)}
- Entries Difference: ${dup.comparison.entries_difference >= 0 ? '+' : ''}${dup.comparison.entries_difference}

---

`
  }

  md += `
## Full Data

See \`FULL_COMPARISON_REPORT.json\` for complete data including all entry details.

---

*Report generated by: generate-full-comparison-report.js*
`

  return md
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
