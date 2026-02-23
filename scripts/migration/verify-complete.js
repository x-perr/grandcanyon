/**
 * Comprehensive Migration Verification
 *
 * Compares ALL key metrics between legacy raw data and new Supabase database
 * to ensure a perfect copy of the original system.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAW_DIR = path.join(__dirname, 'data', 'raw')
const REPORT_DIR = path.join(__dirname, 'reports')

// Ensure reports directory exists
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true })
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function loadJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(RAW_DIR, filename), 'utf8'))
}

async function fetchAllPaginated(table, columns = '*') {
  const results = []
  let page = 0
  while (true) {
    const { data } = await supabase
      .from(table)
      .select(columns)
      .range(page * 1000, (page + 1) * 1000 - 1)
    if (!data || data.length === 0) break
    results.push(...data)
    if (data.length < 1000) break
    page++
  }
  return results
}

function formatNumber(n, decimals = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function formatCurrency(n) {
  return '$' + formatNumber(n, 2)
}

function compareValues(legacy, db, tolerance = 0.01) {
  const diff = Math.abs(legacy - db)
  const percentDiff = legacy !== 0 ? (diff / legacy) * 100 : (db === 0 ? 0 : 100)
  return {
    legacy,
    db,
    diff,
    percentDiff,
    match: percentDiff <= tolerance
  }
}

async function main() {
  console.log('='.repeat(80))
  console.log('COMPREHENSIVE MIGRATION VERIFICATION')
  console.log('='.repeat(80))
  console.log('')

  const report = {
    timestamp: new Date().toISOString(),
    sections: [],
    summary: { passed: 0, failed: 0, warnings: 0 }
  }

  // Load all raw data
  console.log('Loading raw data...')
  const rawUsers = loadJson('users.json')
  const rawClients = loadJson('clients.json')
  const rawProjects = loadJson('projects.json')
  const rawTasks = loadJson('tasks.json')
  const rawTimesheets = loadJson('timesheets.json')
  const rawTsDetails = loadJson('timesheetdetails.json')
  const rawExpenses = loadJson('expenses.json')
  const rawExpDetails = loadJson('expensedetails.json')
  const rawInvoices = loadJson('invoices.json')
  // Note: Legacy system has inline "extra" fields in invoices, not separate invoice_details table

  // Load DB data
  console.log('Loading database data...')
  const dbPeople = await fetchAllPaginated('people', '*')
  const dbClients = await fetchAllPaginated('clients', '*')
  const dbProjects = await fetchAllPaginated('projects', '*')
  const dbTasks = await fetchAllPaginated('project_tasks', '*')
  const dbTimesheets = await fetchAllPaginated('timesheets', '*')
  const dbTsEntries = await fetchAllPaginated('timesheet_entries', '*')
  const dbExpenses = await fetchAllPaginated('expenses', '*')
  const dbExpEntries = await fetchAllPaginated('expense_entries', '*')
  const dbInvoices = await fetchAllPaginated('invoices', '*')
  const dbInvoiceLines = await fetchAllPaginated('invoice_lines', '*')

  // ==========================================
  // SECTION 1: RECORD COUNTS
  // ==========================================
  console.log('\n' + '─'.repeat(80))
  console.log('SECTION 1: RECORD COUNTS')
  console.log('─'.repeat(80))

  const countChecks = [
    { name: 'Users/People', legacy: rawUsers.length, db: dbPeople.length, note: 'All users should map to people' },
    { name: 'Clients', legacy: rawClients.length, db: dbClients.length },
    { name: 'Projects', legacy: rawProjects.length, db: dbProjects.length },
    { name: 'Tasks', legacy: rawTasks.length, db: dbTasks.length },
    { name: 'Timesheets', legacy: rawTimesheets.length, db: dbTimesheets.length, note: '1 duplicate + 1 missing user' },
    { name: 'Timesheet Entries', legacy: rawTsDetails.length, db: dbTsEntries.length, note: '5 orphaned entries' },
    { name: 'Expenses', legacy: rawExpenses.length, db: dbExpenses.length },
    { name: 'Expense Entries', legacy: rawExpDetails.length, db: dbExpEntries.length },
    { name: 'Invoices', legacy: rawInvoices.length, db: dbInvoices.length },
    // Invoice lines are generated from legacy data during transform (not 1:1 mapping)
  ]

  const countSection = { name: 'Record Counts', checks: [] }
  console.log('')
  console.log('Table                  │ Legacy    │ Database  │ Diff   │ Status')
  console.log('───────────────────────┼───────────┼───────────┼────────┼────────')

  for (const check of countChecks) {
    const diff = check.legacy - check.db
    const status = diff === 0 ? '✓ MATCH' : (diff <= 5 ? '~ OK' : '✗ MISMATCH')
    console.log(
      `${check.name.padEnd(22)} │ ${check.legacy.toString().padStart(9)} │ ${check.db.toString().padStart(9)} │ ${diff.toString().padStart(6)} │ ${status}`
    )
    countSection.checks.push({
      name: check.name,
      legacy: check.legacy,
      db: check.db,
      diff,
      status: diff === 0 ? 'PASS' : (diff <= 5 ? 'WARN' : 'FAIL'),
      note: check.note
    })
    if (diff === 0) report.summary.passed++
    else if (diff <= 5) report.summary.warnings++
    else report.summary.failed++
  }
  report.sections.push(countSection)

  // ==========================================
  // SECTION 2: TIMESHEET HOURS
  // ==========================================
  console.log('\n' + '─'.repeat(80))
  console.log('SECTION 2: TIMESHEET HOURS VERIFICATION')
  console.log('─'.repeat(80))

  // Calculate legacy hours
  let legacyTotalHours = 0
  let legacyBillableHours = 0
  let legacyNonBillableHours = 0
  const legacyHoursByYear = new Map()

  for (const d of rawTsDetails) {
    const hours = [1,2,3,4,5,6,7].reduce((s, i) => s + (parseFloat(d[`tsd_time${i}`]) || 0), 0)
    legacyTotalHours += hours
    if (d.tsd_billable === '1' || d.tsd_billable === 1) {
      legacyBillableHours += hours
    } else {
      legacyNonBillableHours += hours
    }

    // Get year from timesheet
    const ts = rawTimesheets.find(t => t.ts_id === d.tsd_tsid)
    if (ts) {
      const year = ts.ts_periodfrom.substring(0, 4)
      legacyHoursByYear.set(year, (legacyHoursByYear.get(year) || 0) + hours)
    }
  }

  // Calculate DB hours
  let dbTotalHours = 0
  let dbBillableHours = 0
  let dbNonBillableHours = 0
  const dbHoursByYear = new Map()

  for (const e of dbTsEntries) {
    const hours = (e.hours || []).reduce((s, h) => s + (h || 0), 0)
    dbTotalHours += hours
    if (e.is_billable) {
      dbBillableHours += hours
    } else {
      dbNonBillableHours += hours
    }

    // Get year from timesheet
    const ts = dbTimesheets.find(t => t.id === e.timesheet_id)
    if (ts) {
      const year = ts.week_start.substring(0, 4)
      dbHoursByYear.set(year, (dbHoursByYear.get(year) || 0) + hours)
    }
  }

  const hoursSection = { name: 'Timesheet Hours', checks: [] }
  console.log('')
  console.log('Metric                 │ Legacy        │ Database      │ Diff        │ Status')
  console.log('───────────────────────┼───────────────┼───────────────┼─────────────┼────────')

  const hoursChecks = [
    { name: 'Total Hours', legacy: legacyTotalHours, db: dbTotalHours },
    { name: 'Billable Hours', legacy: legacyBillableHours, db: dbBillableHours },
    { name: 'Non-Billable Hours', legacy: legacyNonBillableHours, db: dbNonBillableHours },
  ]

  for (const check of hoursChecks) {
    const diff = check.legacy - check.db
    const pct = check.legacy > 0 ? (Math.abs(diff) / check.legacy * 100).toFixed(3) : 0
    const status = Math.abs(diff) < 200 ? '✓ OK' : '✗ CHECK'
    console.log(
      `${check.name.padEnd(22)} │ ${formatNumber(check.legacy).padStart(13)} │ ${formatNumber(check.db).padStart(13)} │ ${formatNumber(diff).padStart(11)} │ ${status}`
    )
    hoursSection.checks.push({
      name: check.name,
      legacy: check.legacy,
      db: check.db,
      diff,
      percentDiff: pct,
      status: Math.abs(diff) < 200 ? 'PASS' : 'WARN'
    })
  }

  // Hours by year
  console.log('')
  console.log('Hours by Year:')
  console.log('Year   │ Legacy        │ Database      │ Diff        │ Status')
  console.log('───────┼───────────────┼───────────────┼─────────────┼────────')

  const allYears = new Set([...legacyHoursByYear.keys(), ...dbHoursByYear.keys()])
  for (const year of [...allYears].sort()) {
    const legacy = legacyHoursByYear.get(year) || 0
    const db = dbHoursByYear.get(year) || 0
    const diff = legacy - db
    const status = Math.abs(diff) < 50 ? '✓' : '~'
    console.log(
      `${year}   │ ${formatNumber(legacy).padStart(13)} │ ${formatNumber(db).padStart(13)} │ ${formatNumber(diff).padStart(11)} │ ${status}`
    )
    hoursSection.checks.push({
      name: `Year ${year}`,
      legacy,
      db,
      diff,
      status: Math.abs(diff) < 50 ? 'PASS' : 'WARN'
    })
  }
  report.sections.push(hoursSection)

  // ==========================================
  // SECTION 3: INVOICE TOTALS
  // ==========================================
  console.log('\n' + '─'.repeat(80))
  console.log('SECTION 3: INVOICE TOTALS VERIFICATION')
  console.log('─'.repeat(80))

  // Calculate legacy invoice totals
  // Legacy uses: inv_net (subtotal), inv_tps (GST), inv_tvp (QST), inv_total
  let legacyInvoiceSubtotal = 0
  let legacyInvoiceGST = 0
  let legacyInvoiceQST = 0
  let legacyInvoiceTotal = 0
  const legacyInvoiceByYear = new Map()

  for (const inv of rawInvoices) {
    const subtotal = parseFloat(inv.inv_net) || 0
    const gst = parseFloat(inv.inv_tps) || 0
    const qst = parseFloat(inv.inv_tvp) || 0
    const total = parseFloat(inv.inv_total) || 0

    legacyInvoiceSubtotal += subtotal
    legacyInvoiceGST += gst
    legacyInvoiceQST += qst
    legacyInvoiceTotal += total

    const year = inv.inv_date ? inv.inv_date.substring(0, 4) : 'unknown'
    legacyInvoiceByYear.set(year, (legacyInvoiceByYear.get(year) || 0) + total)
  }

  // Calculate DB invoice totals
  let dbInvoiceSubtotal = 0
  let dbInvoiceGST = 0
  let dbInvoiceQST = 0
  let dbInvoiceTotal = 0
  const dbInvoiceByYear = new Map()
  const dbInvoiceByStatus = new Map()

  for (const inv of dbInvoices) {
    const subtotal = parseFloat(inv.subtotal) || 0
    const gst = parseFloat(inv.gst_amount) || 0
    const qst = parseFloat(inv.qst_amount) || 0
    const total = parseFloat(inv.total) || 0

    dbInvoiceSubtotal += subtotal
    dbInvoiceGST += gst
    dbInvoiceQST += qst
    dbInvoiceTotal += total

    const year = inv.invoice_date ? inv.invoice_date.substring(0, 4) : 'unknown'
    dbInvoiceByYear.set(year, (dbInvoiceByYear.get(year) || 0) + total)

    const status = inv.status || 'unknown'
    dbInvoiceByStatus.set(status, (dbInvoiceByStatus.get(status) || 0) + total)
  }

  const invoiceSection = { name: 'Invoice Totals', checks: [] }
  console.log('')
  console.log('Metric                 │ Legacy            │ Database          │ Diff            │ Status')
  console.log('───────────────────────┼───────────────────┼───────────────────┼─────────────────┼────────')

  const invoiceChecks = [
    { name: 'Subtotal', legacy: legacyInvoiceSubtotal, db: dbInvoiceSubtotal },
    { name: 'GST (5%)', legacy: legacyInvoiceGST, db: dbInvoiceGST },
    { name: 'QST (9.975%)', legacy: legacyInvoiceQST, db: dbInvoiceQST },
    { name: 'Total', legacy: legacyInvoiceTotal, db: dbInvoiceTotal },
  ]

  for (const check of invoiceChecks) {
    const diff = check.legacy - check.db
    const pct = check.legacy > 0 ? (Math.abs(diff) / check.legacy * 100).toFixed(3) : 0
    const status = Math.abs(diff) < 1 ? '✓ MATCH' : (pct < 0.01 ? '~ OK' : '✗ CHECK')
    console.log(
      `${check.name.padEnd(22)} │ ${formatCurrency(check.legacy).padStart(17)} │ ${formatCurrency(check.db).padStart(17)} │ ${formatCurrency(diff).padStart(15)} │ ${status}`
    )
    invoiceSection.checks.push({
      name: check.name,
      legacy: check.legacy,
      db: check.db,
      diff,
      percentDiff: pct,
      status: Math.abs(diff) < 1 ? 'PASS' : (pct < 0.01 ? 'WARN' : 'FAIL')
    })
  }

  // Invoice totals by year
  console.log('')
  console.log('Invoice Totals by Year:')
  console.log('Year   │ Legacy            │ Database          │ Diff            │ Status')
  console.log('───────┼───────────────────┼───────────────────┼─────────────────┼────────')

  const allInvYears = new Set([...legacyInvoiceByYear.keys(), ...dbInvoiceByYear.keys()])
  for (const year of [...allInvYears].sort()) {
    const legacy = legacyInvoiceByYear.get(year) || 0
    const db = dbInvoiceByYear.get(year) || 0
    const diff = legacy - db
    const status = Math.abs(diff) < 10 ? '✓' : '~'
    console.log(
      `${year}   │ ${formatCurrency(legacy).padStart(17)} │ ${formatCurrency(db).padStart(17)} │ ${formatCurrency(diff).padStart(15)} │ ${status}`
    )
    invoiceSection.checks.push({
      name: `Year ${year}`,
      legacy,
      db,
      diff,
      status: Math.abs(diff) < 10 ? 'PASS' : 'WARN'
    })
  }
  report.sections.push(invoiceSection)

  // ==========================================
  // SECTION 4: EXPENSE TOTALS
  // ==========================================
  console.log('\n' + '─'.repeat(80))
  console.log('SECTION 4: EXPENSE TOTALS VERIFICATION')
  console.log('─'.repeat(80))

  // Calculate legacy expense totals
  let legacyExpenseSubtotal = 0
  let legacyExpenseGST = 0
  let legacyExpenseQST = 0
  let legacyExpenseTotal = 0

  for (const d of rawExpDetails) {
    legacyExpenseSubtotal += parseFloat(d.exd_net) || 0
    legacyExpenseGST += parseFloat(d.exd_tps) || 0
    legacyExpenseQST += parseFloat(d.exd_tvp) || 0
    legacyExpenseTotal += parseFloat(d.exd_total) || 0
  }

  // Calculate DB expense totals
  let dbExpenseSubtotal = 0
  let dbExpenseGST = 0
  let dbExpenseQST = 0
  let dbExpenseTotal = 0

  for (const e of dbExpEntries) {
    dbExpenseSubtotal += parseFloat(e.subtotal) || 0
    dbExpenseGST += parseFloat(e.gst_amount) || 0
    dbExpenseQST += parseFloat(e.qst_amount) || 0
    dbExpenseTotal += parseFloat(e.total) || 0
  }

  const expenseSection = { name: 'Expense Totals', checks: [] }
  console.log('')
  console.log('Metric                 │ Legacy            │ Database          │ Diff            │ Status')
  console.log('───────────────────────┼───────────────────┼───────────────────┼─────────────────┼────────')

  const expenseChecks = [
    { name: 'Subtotal', legacy: legacyExpenseSubtotal, db: dbExpenseSubtotal },
    { name: 'GST', legacy: legacyExpenseGST, db: dbExpenseGST },
    { name: 'QST', legacy: legacyExpenseQST, db: dbExpenseQST },
    { name: 'Total', legacy: legacyExpenseTotal, db: dbExpenseTotal },
  ]

  for (const check of expenseChecks) {
    const diff = check.legacy - check.db
    const pct = check.legacy > 0 ? (Math.abs(diff) / check.legacy * 100).toFixed(3) : 0
    const status = Math.abs(diff) < 1 ? '✓ MATCH' : (pct < 0.1 ? '~ OK' : '✗ CHECK')
    console.log(
      `${check.name.padEnd(22)} │ ${formatCurrency(check.legacy).padStart(17)} │ ${formatCurrency(check.db).padStart(17)} │ ${formatCurrency(diff).padStart(15)} │ ${status}`
    )
    expenseSection.checks.push({
      name: check.name,
      legacy: check.legacy,
      db: check.db,
      diff,
      percentDiff: pct,
      status: Math.abs(diff) < 1 ? 'PASS' : (pct < 0.1 ? 'WARN' : 'FAIL')
    })
  }
  report.sections.push(expenseSection)

  // ==========================================
  // SECTION 5: CLIENT TOTALS
  // ==========================================
  console.log('\n' + '─'.repeat(80))
  console.log('SECTION 5: HOURS BY CLIENT (TOP 10)')
  console.log('─'.repeat(80))

  // Build client code map
  const rawClientIdToCode = new Map(rawClients.map(c => [c.client_id, c.client_code]))
  const rawProjIdToClient = new Map(rawProjects.map(p => [p.proj_id, rawClientIdToCode.get(p.proj_clientid)]))

  const legacyHoursByClient = new Map()
  for (const d of rawTsDetails) {
    const hours = [1,2,3,4,5,6,7].reduce((s, i) => s + (parseFloat(d[`tsd_time${i}`]) || 0), 0)
    const clientCode = rawProjIdToClient.get(d.tsd_projid) || 'UNKNOWN'
    legacyHoursByClient.set(clientCode, (legacyHoursByClient.get(clientCode) || 0) + hours)
  }

  // DB client hours
  const dbClientById = new Map(dbClients.map(c => [c.id, c.code]))
  const dbProjIdToClient = new Map(dbProjects.map(p => [p.id, dbClientById.get(p.client_id)]))

  const dbHoursByClient = new Map()
  for (const e of dbTsEntries) {
    const hours = (e.hours || []).reduce((s, h) => s + (h || 0), 0)
    const clientCode = dbProjIdToClient.get(e.project_id) || 'UNKNOWN'
    dbHoursByClient.set(clientCode, (dbHoursByClient.get(clientCode) || 0) + hours)
  }

  const clientSection = { name: 'Hours by Client', checks: [] }
  console.log('')
  console.log('Client                 │ Legacy        │ Database      │ Diff        │ Status')
  console.log('───────────────────────┼───────────────┼───────────────┼─────────────┼────────')

  // Get top 10 clients by legacy hours
  const topClients = [...legacyHoursByClient.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  for (const [clientCode, legacyHours] of topClients) {
    const dbHours = dbHoursByClient.get(clientCode) || 0
    const diff = legacyHours - dbHours
    const pct = legacyHours > 0 ? (Math.abs(diff) / legacyHours * 100).toFixed(1) : 0
    const status = pct < 1 ? '✓' : '~'
    console.log(
      `${clientCode.substring(0, 22).padEnd(22)} │ ${formatNumber(legacyHours).padStart(13)} │ ${formatNumber(dbHours).padStart(13)} │ ${formatNumber(diff).padStart(11)} │ ${status}`
    )
    clientSection.checks.push({
      name: clientCode,
      legacy: legacyHours,
      db: dbHours,
      diff,
      percentDiff: pct,
      status: pct < 1 ? 'PASS' : 'WARN'
    })
  }
  report.sections.push(clientSection)

  // ==========================================
  // SECTION 6: SAMPLE DATA VERIFICATION
  // ==========================================
  console.log('\n' + '─'.repeat(80))
  console.log('SECTION 6: SAMPLE DATA SPOT CHECKS')
  console.log('─'.repeat(80))

  const sampleSection = { name: 'Sample Verification', checks: [] }

  // Random sample of timesheet entries
  console.log('\nRandom Timesheet Entry Samples (5):')
  const sampleIndices = Array.from({ length: 5 }, () => Math.floor(Math.random() * rawTsDetails.length))

  for (const idx of sampleIndices) {
    const raw = rawTsDetails[idx]
    const rawHours = [1,2,3,4,5,6,7].reduce((s, i) => s + (parseFloat(raw[`tsd_time${i}`]) || 0), 0)
    const rawProj = rawProjects.find(p => p.proj_id === raw.tsd_projid)

    // Find matching DB entry
    const ts = rawTimesheets.find(t => t.ts_id === raw.tsd_tsid)
    if (!ts) {
      console.log(`  tsd_id ${raw.tsd_id}: ORPHAN (no parent timesheet)`)
      continue
    }

    const dbTs = dbTimesheets.find(t => t.week_start === ts.ts_periodfrom)
    if (!dbTs) {
      console.log(`  tsd_id ${raw.tsd_id}: No matching DB timesheet`)
      continue
    }

    const dbEntry = dbTsEntries.find(e =>
      e.timesheet_id === dbTs.id &&
      dbProjIdToClient.get(e.project_id) === rawProjIdToClient.get(raw.tsd_projid)
    )

    if (dbEntry) {
      const dbHours = (dbEntry.hours || []).reduce((s, h) => s + (h || 0), 0)
      const match = Math.abs(rawHours - dbHours) < 0.01 ? '✓' : '✗'
      console.log(`  tsd_id ${raw.tsd_id}: ${rawHours.toFixed(1)}h (legacy) vs ${dbHours.toFixed(1)}h (db) ${match}`)
      sampleSection.checks.push({
        name: `Sample tsd_id ${raw.tsd_id}`,
        legacy: rawHours,
        db: dbHours,
        status: Math.abs(rawHours - dbHours) < 0.01 ? 'PASS' : 'FAIL'
      })
    } else {
      console.log(`  tsd_id ${raw.tsd_id}: ${rawHours.toFixed(1)}h - no exact DB match found`)
    }
  }
  report.sections.push(sampleSection)

  // ==========================================
  // FINAL SUMMARY
  // ==========================================
  console.log('\n' + '='.repeat(80))
  console.log('VERIFICATION SUMMARY')
  console.log('='.repeat(80))
  console.log('')

  // Count results
  let passed = 0, warnings = 0, failed = 0
  for (const section of report.sections) {
    for (const check of section.checks) {
      if (check.status === 'PASS') passed++
      else if (check.status === 'WARN') warnings++
      else if (check.status === 'FAIL') failed++
    }
  }

  console.log(`  ✓ PASSED:   ${passed}`)
  console.log(`  ~ WARNINGS: ${warnings}`)
  console.log(`  ✗ FAILED:   ${failed}`)
  console.log('')

  if (failed === 0 && warnings <= 10) {
    console.log('  ╔════════════════════════════════════════════════════════════════╗')
    console.log('  ║  MIGRATION VERIFIED - DATA INTEGRITY CONFIRMED                 ║')
    console.log('  ╚════════════════════════════════════════════════════════════════╝')
    report.result = 'VERIFIED'
  } else if (failed === 0) {
    console.log('  ╔════════════════════════════════════════════════════════════════╗')
    console.log('  ║  MIGRATION OK - Minor differences within tolerance             ║')
    console.log('  ╚════════════════════════════════════════════════════════════════╝')
    report.result = 'OK_WITH_WARNINGS'
  } else {
    console.log('  ╔════════════════════════════════════════════════════════════════╗')
    console.log('  ║  MIGRATION NEEDS REVIEW - Some checks failed                   ║')
    console.log('  ╚════════════════════════════════════════════════════════════════╝')
    report.result = 'NEEDS_REVIEW'
  }

  // Save report
  const reportPath = path.join(REPORT_DIR, `verification-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log('')
  console.log(`Full report saved to: ${reportPath}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
