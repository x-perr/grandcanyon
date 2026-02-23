/**
 * Generate Migration Discrepancy Report
 *
 * Creates a detailed report of all data discrepancies for manual verification
 * in the original Grand Canyon system.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAW_DIR = path.join(__dirname, 'data', 'raw')
const TRANS_DIR = path.join(__dirname, 'data', 'transformed')
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
  console.log('Generating Migration Discrepancy Report')
  console.log('='.repeat(60))

  const report = {
    generated_at: new Date().toISOString(),
    summary: {},
    duplicates: {
      timesheets: [],
      expenses: [],
    },
    missing_users: [],
    orphan_entries: {
      timesheet_entries: [],
      expense_entries: [],
      invoice_lines: [],
    },
    encoding_issues: [],
    count_discrepancies: {},
  }

  // Build user ID mapping
  console.log('\nBuilding mappings...')
  const { data: profiles } = await supabase.from('profiles').select('id, email')
  const emailToProfileId = new Map()
  profiles?.forEach(p => {
    if (p.email) emailToProfileId.set(p.email.toLowerCase(), p.id)
  })

  const rawUsers = loadJson(RAW_DIR, 'users.json')
  const userIdMap = new Map()
  const unmappedUsers = []

  for (const user of rawUsers) {
    let email = user.user_email?.trim()
    if (!email || !email.includes('@')) {
      email = `user_${user.user_id}@grandcanyon.local`
    }
    const profileId = emailToProfileId.get(email.toLowerCase())
    if (profileId) {
      userIdMap.set(user.user_id, profileId)
    } else {
      unmappedUsers.push({
        legacy_id: user.user_id,
        email: user.user_email || `(no email - id: ${user.user_id})`,
        name: `${user.user_firstname || ''} ${user.user_lastname || ''}`.trim(),
      })
    }
  }
  report.missing_users = unmappedUsers

  // ============================================================
  // TIMESHEETS ANALYSIS
  // ============================================================
  console.log('\nAnalyzing timesheets...')
  const rawTimesheets = loadJson(RAW_DIR, 'timesheets.json')

  // Find duplicate timesheets (same user + week_start)
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

  // Report duplicates with full details
  for (const [key, group] of timesheetGroups) {
    if (group.length > 1) {
      const [userId, weekStart] = key.split('_')
      const user = rawUsers.find(u => userIdMap.get(u.user_id) === userId)
      report.duplicates.timesheets.push({
        user_id: userId,
        user_email: user?.user_email || 'unknown',
        week_start: weekStart,
        count: group.length,
        legacy_ids: group.map(ts => ts.ts_id),
        details: group.map(ts => ({
          ts_id: ts.ts_id,
          period_from: ts.ts_periodfrom,
          period_to: ts.ts_periodto,
          status: ts.ts_approved === '1' ? 'approved' : ts.ts_submitted === '1' ? 'submitted' : 'draft',
          submitted_on: ts.ts_submittedon,
          approved_on: ts.ts_approvedon,
        })),
      })
    }
  }

  // ============================================================
  // EXPENSES ANALYSIS
  // ============================================================
  console.log('Analyzing expenses...')
  const rawExpenses = loadJson(RAW_DIR, 'expenses.json')

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

  for (const [key, group] of expenseGroups) {
    if (group.length > 1) {
      const [userId, weekStart] = key.split('_')
      const user = rawUsers.find(u => userIdMap.get(u.user_id) === userId)
      report.duplicates.expenses.push({
        user_id: userId,
        user_email: user?.user_email || 'unknown',
        week_start: weekStart,
        count: group.length,
        legacy_ids: group.map(exp => exp.exp_id),
        details: group.map(exp => ({
          exp_id: exp.exp_id,
          period_from: exp.exp_periodfrom,
          period_to: exp.exp_periodto,
          status: exp.exp_approved === '1' ? 'approved' : exp.exp_submitted === '1' ? 'submitted' : 'draft',
        })),
      })
    }
  }

  // ============================================================
  // ORPHAN ENTRIES ANALYSIS
  // ============================================================
  console.log('Analyzing orphan entries...')

  // Build project ID mapping
  const rawProjects = loadJson(RAW_DIR, 'projects.json')
  const transProjects = loadJson(TRANS_DIR, 'projects.json')
  const projectIdMap = new Map()
  rawProjects.forEach((p, i) => {
    if (transProjects[i]) projectIdMap.set(p.proj_id, transProjects[i].id)
  })

  // Timesheet entries with missing projects
  const rawTsDetails = loadJson(RAW_DIR, 'timesheetdetails.json')
  const orphanTsEntries = []

  for (const tsd of rawTsDetails) {
    const projectId = projectIdMap.get(tsd.tsd_projid)
    if (!projectId && tsd.tsd_projid) {
      const hours = [
        parseFloat(tsd.tsd_time1) || 0,
        parseFloat(tsd.tsd_time2) || 0,
        parseFloat(tsd.tsd_time3) || 0,
        parseFloat(tsd.tsd_time4) || 0,
        parseFloat(tsd.tsd_time5) || 0,
        parseFloat(tsd.tsd_time6) || 0,
        parseFloat(tsd.tsd_time7) || 0,
      ]
      const totalHours = hours.reduce((a, b) => a + b, 0)

      orphanTsEntries.push({
        tsd_id: tsd.tsd_id,
        ts_id: tsd.tsd_tsid,
        missing_project_id: tsd.tsd_projid,
        hours: totalHours,
        notes: tsd.tsd_notes,
      })
    }
  }
  report.orphan_entries.timesheet_entries = orphanTsEntries

  // Expense entries with missing expense parent
  const rawExpDetails = loadJson(RAW_DIR, 'expensedetails.json')
  const rawExpIds = new Set(rawExpenses.map(e => e.exp_id))
  const orphanExpEntries = []

  for (const exd of rawExpDetails) {
    if (!rawExpIds.has(exd.exd_expid)) {
      orphanExpEntries.push({
        exd_id: exd.exd_id,
        missing_expense_id: exd.exd_expid,
        date: exd.exd_date,
        description: exd.exd_desc,
        total: parseFloat(exd.exd_total) || 0,
      })
    }
  }
  report.orphan_entries.expense_entries = orphanExpEntries

  // ============================================================
  // ENCODING ISSUES
  // ============================================================
  console.log('Analyzing encoding issues...')
  const rawClients = loadJson(RAW_DIR, 'clients.json')

  const encodingIssues = []
  const badPatterns = ['Ã©', 'Ã¨', 'Ã ', 'Ã´', 'Ã¢', 'Ã®', 'Ã§', 'Ãª', 'Ã»', 'Ã¼']

  for (const client of rawClients) {
    const name = client.cl_name || ''
    for (const pattern of badPatterns) {
      if (name.includes(pattern)) {
        encodingIssues.push({
          table: 'clients',
          id: client.cl_id,
          field: 'cl_name',
          value: name,
          issue: `Contains "${pattern}" (likely encoding issue)`,
        })
        break
      }
    }
  }
  report.encoding_issues = encodingIssues

  // ============================================================
  // COUNT DISCREPANCIES
  // ============================================================
  console.log('Calculating count discrepancies...')

  const dbTimesheets = await fetchAllPaginated('timesheets', 'id')
  const dbTsEntries = await fetchAllPaginated('timesheet_entries', 'id')
  const dbExpenses = await fetchAllPaginated('expenses', 'id')
  const dbExpEntries = await fetchAllPaginated('expense_entries', 'id')

  report.count_discrepancies = {
    timesheets: {
      legacy: rawTimesheets.length,
      new: dbTimesheets.length,
      difference: rawTimesheets.length - dbTimesheets.length,
      reason: 'Duplicate (user_id, week_start) combinations merged into single records',
    },
    timesheet_entries: {
      legacy: rawTsDetails.length,
      new: dbTsEntries.length,
      difference: rawTsDetails.length - dbTsEntries.length,
      reason: 'Entries from duplicate timesheets merged; some had missing projects',
    },
    expenses: {
      legacy: rawExpenses.length,
      new: dbExpenses.length,
      difference: rawExpenses.length - dbExpenses.length,
      reason: 'Duplicate (user_id, week_start) combinations merged',
    },
    expense_entries: {
      legacy: rawExpDetails.length,
      new: dbExpEntries.length,
      difference: rawExpDetails.length - dbExpEntries.length,
      reason: 'Some entries reference non-existent expense types or projects',
    },
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  report.summary = {
    total_duplicate_timesheets: report.duplicates.timesheets.length,
    total_duplicate_timesheet_records: report.duplicates.timesheets.reduce((a, b) => a + b.count, 0),
    total_duplicate_expenses: report.duplicates.expenses.length,
    total_duplicate_expense_records: report.duplicates.expenses.reduce((a, b) => a + b.count, 0),
    total_orphan_ts_entries: report.orphan_entries.timesheet_entries.length,
    total_orphan_exp_entries: report.orphan_entries.expense_entries.length,
    total_encoding_issues: report.encoding_issues.length,
    total_unmapped_users: report.missing_users.length,
  }

  // ============================================================
  // WRITE REPORT
  // ============================================================
  console.log('\nWriting report...')

  // Ensure report directory exists
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true })
  }

  // Write JSON report
  const jsonPath = path.join(REPORT_DIR, 'MIGRATION_DISCREPANCY_REPORT.json')
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2))

  // Write Markdown report
  const mdPath = path.join(REPORT_DIR, 'MIGRATION_DISCREPANCY_REPORT.md')
  const md = generateMarkdownReport(report)
  fs.writeFileSync(mdPath, md)

  console.log(`\nReports written to:`)
  console.log(`  JSON: ${jsonPath}`)
  console.log(`  Markdown: ${mdPath}`)

  console.log('\n' + '='.repeat(60))
  console.log('Report generation complete!')
  console.log('='.repeat(60))
}

function generateMarkdownReport(report) {
  let md = `# Grand Canyon Migration Discrepancy Report

**Generated**: ${report.generated_at}

---

## Summary

| Metric | Count |
|--------|-------|
| Duplicate Timesheet Groups | ${report.summary.total_duplicate_timesheets} |
| Total Duplicate Timesheet Records | ${report.summary.total_duplicate_timesheet_records} |
| Duplicate Expense Groups | ${report.summary.total_duplicate_expenses} |
| Total Duplicate Expense Records | ${report.summary.total_duplicate_expense_records} |
| Orphan Timesheet Entries | ${report.summary.total_orphan_ts_entries} |
| Orphan Expense Entries | ${report.summary.total_orphan_exp_entries} |
| Encoding Issues | ${report.summary.total_encoding_issues} |
| Unmapped Users | ${report.summary.total_unmapped_users} |

---

## Count Discrepancies

| Table | Legacy | New | Difference | Reason |
|-------|--------|-----|------------|--------|
`

  for (const [table, data] of Object.entries(report.count_discrepancies)) {
    md += `| ${table} | ${data.legacy} | ${data.new} | ${data.difference > 0 ? '+' : ''}${data.difference} | ${data.reason} |\n`
  }

  md += `
---

## Duplicate Timesheets

These timesheet records have the same (user, week_start) combination in the legacy system.
**Action taken**: Merged into single timesheet, entries preserved.

| User Email | Week Start | Count | Legacy IDs |
|------------|------------|-------|------------|
`

  for (const dup of report.duplicates.timesheets.slice(0, 50)) {
    md += `| ${dup.user_email} | ${dup.week_start} | ${dup.count} | ${dup.legacy_ids.join(', ')} |\n`
  }

  if (report.duplicates.timesheets.length > 50) {
    md += `\n*...and ${report.duplicates.timesheets.length - 50} more*\n`
  }

  md += `
---

## Duplicate Expenses

Same (user, week_start) combination in the legacy system.

| User Email | Week Start | Count | Legacy IDs |
|------------|------------|-------|------------|
`

  for (const dup of report.duplicates.expenses.slice(0, 50)) {
    md += `| ${dup.user_email} | ${dup.week_start} | ${dup.count} | ${dup.legacy_ids.join(', ')} |\n`
  }

  if (report.duplicates.expenses.length > 50) {
    md += `\n*...and ${report.duplicates.expenses.length - 50} more*\n`
  }

  md += `
---

## Orphan Timesheet Entries

These entries reference projects that don't exist in the transformed data.

| TSD ID | TS ID | Missing Project ID | Hours | Notes |
|--------|-------|-------------------|-------|-------|
`

  for (const entry of report.orphan_entries.timesheet_entries.slice(0, 30)) {
    const notes = (entry.notes || '').substring(0, 30).replace(/\|/g, '\\|')
    md += `| ${entry.tsd_id} | ${entry.ts_id} | ${entry.missing_project_id} | ${entry.hours} | ${notes} |\n`
  }

  if (report.orphan_entries.timesheet_entries.length > 30) {
    md += `\n*...and ${report.orphan_entries.timesheet_entries.length - 30} more*\n`
  }

  md += `
---

## Encoding Issues (Sample)

French characters not properly encoded.

| Table | ID | Field | Current Value |
|-------|-----|-------|---------------|
`

  for (const issue of report.encoding_issues.slice(0, 20)) {
    const val = issue.value.substring(0, 40).replace(/\|/g, '\\|')
    md += `| ${issue.table} | ${issue.id} | ${issue.field} | ${val} |\n`
  }

  if (report.encoding_issues.length > 20) {
    md += `\n*...and ${report.encoding_issues.length - 20} more*\n`
  }

  md += `
---

## Unmapped Users

Users from legacy system that couldn't be mapped to profiles.

| Legacy ID | Email | Name |
|-----------|-------|------|
`

  for (const user of report.missing_users.slice(0, 20)) {
    md += `| ${user.legacy_id} | ${user.email} | ${user.name} |\n`
  }

  if (report.missing_users.length > 20) {
    md += `\n*...and ${report.missing_users.length - 20} more*\n`
  }

  md += `
---

## Full Details

See \`MIGRATION_DISCREPANCY_REPORT.json\` for complete data including all records.

---

*Report generated by: generate-discrepancy-report.js*
`

  return md
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
