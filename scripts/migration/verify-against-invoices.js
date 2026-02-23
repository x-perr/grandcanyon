/**
 * Verify Timesheets Against Invoices
 *
 * For each duplicate timesheet, compare the hours to invoice line items
 * to determine which timesheet was actually billed.
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

async function main() {
  console.log('='.repeat(60))
  console.log('Verify Timesheets Against Invoices')
  console.log('='.repeat(60))

  // Load raw data
  console.log('\nLoading raw data...')
  const rawUsers = loadJson(RAW_DIR, 'users.json')
  const rawClients = loadJson(RAW_DIR, 'clients.json')
  const rawProjects = loadJson(RAW_DIR, 'projects.json')
  const rawTimesheets = loadJson(RAW_DIR, 'timesheets.json')
  const rawTsDetails = loadJson(RAW_DIR, 'timesheetdetails.json')
  const rawInvoices = loadJson(RAW_DIR, 'invoices.json')

  // Build lookups
  const rawUserById = new Map(rawUsers.map(u => [u.user_id, u]))
  const rawClientById = new Map(rawClients.map(c => [c.client_id, c]))
  const rawProjById = new Map(rawProjects.map(p => [p.proj_id, p]))

  // Build timesheet detail lookup
  const detailsByTsId = new Map()
  for (const d of rawTsDetails) {
    if (!detailsByTsId.has(d.tsd_tsid)) {
      detailsByTsId.set(d.tsd_tsid, [])
    }
    detailsByTsId.get(d.tsd_tsid).push(d)
  }

  // Build invoice lookup by project
  // Invoices have: inv_projid, inv_invdate, and line items embedded or separate
  const invoicesByProject = new Map()
  for (const inv of rawInvoices) {
    if (!invoicesByProject.has(inv.inv_projid)) {
      invoicesByProject.set(inv.inv_projid, [])
    }
    invoicesByProject.get(inv.inv_projid).push(inv)
  }
  console.log(`  Invoices loaded: ${rawInvoices.length}`)

  // Find duplicate timesheets
  console.log('\nFinding duplicate timesheets...')
  const timesheetGroups = new Map()
  for (const ts of rawTimesheets) {
    const key = `${ts.ts_emplid}_${ts.ts_periodfrom}`
    if (!timesheetGroups.has(key)) {
      timesheetGroups.set(key, [])
    }
    timesheetGroups.get(key).push(ts)
  }

  const duplicates = [...timesheetGroups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, group }))

  console.log(`  Duplicate groups: ${duplicates.length}`)

  // Analyze each duplicate against invoices
  console.log('\nAnalyzing against invoices...')

  const results = []
  let matchedFirst = 0
  let matchedSecond = 0
  let matchedNeither = 0
  let matchedBoth = 0
  let noInvoice = 0

  for (const { key, group } of duplicates) {
    const [userId, weekStart] = key.split('_')
    const user = rawUserById.get(parseInt(userId))
    const weekEnd = group[0].ts_periodto

    // Sort by ts_id (first = older, second = newer)
    group.sort((a, b) => a.ts_id - b.ts_id)

    // Get project IDs from timesheet entries
    const projectIds = new Set()
    for (const ts of group) {
      const details = detailsByTsId.get(ts.ts_id) || []
      for (const d of details) {
        projectIds.add(d.tsd_projid)
      }
    }

    // Build hours per project for each timesheet
    const timesheetHours = group.map(ts => {
      const details = detailsByTsId.get(ts.ts_id) || []
      const hoursByProject = new Map()

      for (const d of details) {
        const hours = (parseFloat(d.tsd_time1) || 0) +
                      (parseFloat(d.tsd_time2) || 0) +
                      (parseFloat(d.tsd_time3) || 0) +
                      (parseFloat(d.tsd_time4) || 0) +
                      (parseFloat(d.tsd_time5) || 0) +
                      (parseFloat(d.tsd_time6) || 0) +
                      (parseFloat(d.tsd_time7) || 0)

        const current = hoursByProject.get(d.tsd_projid) || 0
        hoursByProject.set(d.tsd_projid, current + hours)
      }

      return {
        ts_id: ts.ts_id,
        status: ts.ts_approved === '1' ? 'approved' : ts.ts_submitted === '1' ? 'submitted' : 'draft',
        submitted: ts.ts_submittedon,
        hoursByProject,
        totalHours: [...hoursByProject.values()].reduce((a, b) => a + b, 0),
      }
    })

    // Find invoices for these projects in a relevant date range
    // Invoices are typically created after the week ends
    const weekEndDate = new Date(weekEnd)
    const searchEndDate = new Date(weekEndDate)
    searchEndDate.setMonth(searchEndDate.getMonth() + 3) // Look 3 months ahead

    const relevantInvoices = []
    for (const projId of projectIds) {
      const projInvoices = invoicesByProject.get(projId) || []
      for (const inv of projInvoices) {
        const invDate = new Date(inv.inv_invdate)
        if (invDate >= weekEndDate && invDate <= searchEndDate) {
          relevantInvoices.push({
            ...inv,
            proj_id: projId,
            proj_name: rawProjById.get(projId)?.proj_name || `Project ${projId}`,
          })
        }
      }
    }

    // Check which timesheet's hours match invoice hours
    // Invoice fields: inv_hoursqty (billed hours for that invoice)
    let matchResult = 'NO_INVOICE'
    let invoiceMatches = []

    if (relevantInvoices.length > 0) {
      // For each relevant invoice, check if hours match either timesheet
      for (const inv of relevantInvoices) {
        const invHours = parseFloat(inv.inv_hoursqty) || 0
        if (invHours === 0) continue

        const projId = inv.proj_id

        // Get hours from each timesheet for this project
        const ts1Hours = timesheetHours[0]?.hoursByProject.get(projId) || 0
        const ts2Hours = timesheetHours[1]?.hoursByProject.get(projId) || 0

        const matchesFirst = Math.abs(ts1Hours - invHours) < 0.01
        const matchesSecond = Math.abs(ts2Hours - invHours) < 0.01

        if (matchesFirst || matchesSecond) {
          invoiceMatches.push({
            invoice_id: inv.inv_id,
            invoice_date: inv.inv_invdate,
            project_id: projId,
            project_name: inv.proj_name,
            invoice_hours: invHours,
            ts1_hours: ts1Hours,
            ts2_hours: ts2Hours,
            matches_first: matchesFirst,
            matches_second: matchesSecond,
          })
        }
      }

      // Determine overall result
      const anyMatchesFirst = invoiceMatches.some(m => m.matches_first && !m.matches_second)
      const anyMatchesSecond = invoiceMatches.some(m => m.matches_second && !m.matches_first)
      const anyMatchesBoth = invoiceMatches.some(m => m.matches_first && m.matches_second)

      if (anyMatchesFirst && !anyMatchesSecond) {
        matchResult = 'KEEP_FIRST'
        matchedFirst++
      } else if (anyMatchesSecond && !anyMatchesFirst) {
        matchResult = 'KEEP_SECOND'
        matchedSecond++
      } else if (anyMatchesBoth || (anyMatchesFirst && anyMatchesSecond)) {
        matchResult = 'BOTH_MATCH'
        matchedBoth++
      } else {
        matchResult = 'NEITHER_MATCH'
        matchedNeither++
      }
    } else {
      noInvoice++
    }

    results.push({
      user_id: userId,
      user_email: user?.user_email || `user_${userId}`,
      user_name: `${user?.user_fname || ''} ${user?.user_lname || ''}`.trim(),
      week_start: weekStart,
      week_end: weekEnd,
      timesheets: timesheetHours,
      relevant_invoices: relevantInvoices.length,
      invoice_matches: invoiceMatches,
      result: matchResult,
    })
  }

  // Summary
  console.log('\n--- Results Summary ---')
  console.log(`  KEEP_FIRST (invoice matches first timesheet): ${matchedFirst}`)
  console.log(`  KEEP_SECOND (invoice matches second timesheet): ${matchedSecond}`)
  console.log(`  BOTH_MATCH (invoice matches both - true duplicate): ${matchedBoth}`)
  console.log(`  NEITHER_MATCH (invoice doesn't match either): ${matchedNeither}`)
  console.log(`  NO_INVOICE (no invoice found for that period): ${noInvoice}`)

  // Write detailed report
  console.log('\nWriting report...')

  let md = `# Timesheet Verification Against Invoices

**Generated**: ${new Date().toISOString()}

---

## Summary

| Result | Count | Recommendation |
|--------|-------|----------------|
| KEEP_FIRST | ${matchedFirst} | Invoice matches first timesheet - keep first |
| KEEP_SECOND | ${matchedSecond} | Invoice matches second timesheet - keep second |
| BOTH_MATCH | ${matchedBoth} | True duplicate - either is fine |
| NEITHER_MATCH | ${matchedNeither} | Manual review needed |
| NO_INVOICE | ${noInvoice} | No invoice found - may not have been billed |

---

## Detailed Results

`

  // Group by result for easier review
  const byResult = {
    'KEEP_SECOND': results.filter(r => r.result === 'KEEP_SECOND'),
    'KEEP_FIRST': results.filter(r => r.result === 'KEEP_FIRST'),
    'NEITHER_MATCH': results.filter(r => r.result === 'NEITHER_MATCH'),
    'BOTH_MATCH': results.filter(r => r.result === 'BOTH_MATCH'),
    'NO_INVOICE': results.filter(r => r.result === 'NO_INVOICE'),
  }

  for (const [result, items] of Object.entries(byResult)) {
    if (items.length === 0) continue

    md += `### ${result} (${items.length} cases)

`

    for (const item of items) {
      md += `#### ${item.user_email} - Week ${item.week_start}

**User**: ${item.user_name}

| Timesheet | ID | Status | Total Hours |
|-----------|-----|--------|-------------|
| First | ${item.timesheets[0]?.ts_id} | ${item.timesheets[0]?.status} | ${item.timesheets[0]?.totalHours.toFixed(1)} |
| Second | ${item.timesheets[1]?.ts_id} | ${item.timesheets[1]?.status} | ${item.timesheets[1]?.totalHours.toFixed(1)} |

`

      if (item.invoice_matches.length > 0) {
        md += `**Invoice Matches**:

| Invoice ID | Date | Project | Inv Hours | TS1 Hours | TS2 Hours | Match |
|------------|------|---------|-----------|-----------|-----------|-------|
`
        for (const m of item.invoice_matches) {
          const match = m.matches_first && m.matches_second ? 'BOTH' :
                        m.matches_first ? 'FIRST' : 'SECOND'
          md += `| ${m.invoice_id} | ${m.invoice_date} | ${m.project_name.substring(0, 20)} | ${m.invoice_hours} | ${m.ts1_hours} | ${m.ts2_hours} | ${match} |\n`
        }
        md += '\n'
      }

      md += '---\n\n'
    }
  }

  const mdPath = path.join(REPORT_DIR, 'INVOICE_VERIFICATION_REPORT.md')
  fs.writeFileSync(mdPath, md)

  const jsonPath = path.join(REPORT_DIR, 'INVOICE_VERIFICATION_REPORT.json')
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2))

  console.log(`\nReports written to:`)
  console.log(`  Markdown: ${mdPath}`)
  console.log(`  JSON: ${jsonPath}`)

  console.log('\n' + '='.repeat(60))
  console.log('Verification complete!')
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
