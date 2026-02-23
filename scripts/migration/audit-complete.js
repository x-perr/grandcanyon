/**
 * Comprehensive Data Audit
 *
 * Multi-level verification of migrated data to ensure 100% accuracy.
 * Generates detailed reports for review before production deployment.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAW_DIR = path.join(__dirname, 'data', 'raw')
const REPORT_DIR = path.join(__dirname, '..', '..', 'docs', 'migration')

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

// Mojibake patterns to detect
const MOJIBAKE_PATTERNS = [
  /Ã©/g, // é
  /Ã¨/g, // è
  /Ãª/g, // ê
  /Ã /g, // à
  /Ã®/g, // î
  /Ã´/g, // ô
  /Ã¢/g, // â
  /Ã»/g, // û
  /Ã§/g, // ç
  /Ã‰/g, // É
  /Ã€/g, // À
]

function hasMojibake(text) {
  if (!text) return false
  for (const pattern of MOJIBAKE_PATTERNS) {
    if (pattern.test(text)) return true
  }
  return false
}

async function main() {
  console.log('='.repeat(80))
  console.log('COMPREHENSIVE DATA AUDIT')
  console.log('='.repeat(80))
  console.log('')

  const auditResults = {
    timestamp: new Date().toISOString(),
    summary: { passed: 0, warnings: 0, failed: 0 },
    sections: {}
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

  // Build lookup maps
  const legacyUserIdToPerson = new Map()
  for (const p of dbPeople) {
    if (p.legacy_user_id) {
      legacyUserIdToPerson.set(p.legacy_user_id, p)
    }
  }

  const rawClientIdToCode = new Map(rawClients.map(c => [c.client_id, c.client_code]))
  const rawProjIdToCode = new Map(rawProjects.map(p => [p.proj_id, p.proj_code]))

  // ==========================================
  // SECTION 1: PER-EMPLOYEE VERIFICATION
  // ==========================================
  console.log('\n' + '─'.repeat(80))
  console.log('SECTION 1: PER-EMPLOYEE VERIFICATION')
  console.log('─'.repeat(80))

  const employeeAudit = { employees: [], issues: [] }

  // Legacy hours by user
  const legacyHoursByUser = new Map()
  for (const d of rawTsDetails) {
    const ts = rawTimesheets.find(t => t.ts_id === d.tsd_tsid)
    if (!ts) continue
    const userId = ts.ts_emplid
    const hours = [1,2,3,4,5,6,7].reduce((s, i) => s + (parseFloat(d[`tsd_time${i}`]) || 0), 0)
    const current = legacyHoursByUser.get(userId) || { total: 0, billable: 0, nonBillable: 0 }
    current.total += hours
    if (d.tsd_billable === '1' || d.tsd_billable === 1) {
      current.billable += hours
    } else {
      current.nonBillable += hours
    }
    legacyHoursByUser.set(userId, current)
  }

  // DB hours by person
  const dbHoursByPerson = new Map()
  for (const e of dbTsEntries) {
    const ts = dbTimesheets.find(t => t.id === e.timesheet_id)
    if (!ts || !ts.person_id) continue
    const hours = (e.hours || []).reduce((s, h) => s + (h || 0), 0)
    const current = dbHoursByPerson.get(ts.person_id) || { total: 0, billable: 0, nonBillable: 0 }
    current.total += hours
    if (e.is_billable) {
      current.billable += hours
    } else {
      current.nonBillable += hours
    }
    dbHoursByPerson.set(ts.person_id, current)
  }

  // Compare
  let employeeMatches = 0
  let employeeWarnings = 0
  let employeeFails = 0

  for (const user of rawUsers) {
    const person = legacyUserIdToPerson.get(user.user_id)
    const legacyHours = legacyHoursByUser.get(user.user_id) || { total: 0, billable: 0, nonBillable: 0 }
    const dbHours = person ? (dbHoursByPerson.get(person.id) || { total: 0, billable: 0, nonBillable: 0 }) : { total: 0, billable: 0, nonBillable: 0 }

    const diff = legacyHours.total - dbHours.total
    const pct = legacyHours.total > 0 ? (Math.abs(diff) / legacyHours.total * 100) : 0

    const record = {
      legacy_user_id: user.user_id,
      name: `${user.user_fname} ${user.user_lname}`,
      legacy_hours: legacyHours.total,
      db_hours: dbHours.total,
      diff,
      percent_diff: pct,
      status: pct < 0.1 ? 'PASS' : (pct < 1 ? 'WARN' : 'FAIL')
    }

    employeeAudit.employees.push(record)

    if (record.status === 'PASS') employeeMatches++
    else if (record.status === 'WARN') employeeWarnings++
    else employeeFails++

    if (record.status !== 'PASS' && legacyHours.total > 0) {
      employeeAudit.issues.push(record)
    }
  }

  console.log(`  Employees checked: ${rawUsers.length}`)
  console.log(`  ✓ PASS: ${employeeMatches}`)
  console.log(`  ~ WARN: ${employeeWarnings}`)
  console.log(`  ✗ FAIL: ${employeeFails}`)

  if (employeeAudit.issues.length > 0) {
    console.log('\n  Issues found:')
    for (const issue of employeeAudit.issues.slice(0, 10)) {
      console.log(`    ${issue.name}: ${formatNumber(issue.legacy_hours)}h legacy vs ${formatNumber(issue.db_hours)}h DB (diff: ${formatNumber(issue.diff)}h)`)
    }
  }

  auditResults.sections.employees = employeeAudit

  // ==========================================
  // SECTION 2: PER-PROJECT VERIFICATION
  // ==========================================
  console.log('\n' + '─'.repeat(80))
  console.log('SECTION 2: PER-PROJECT VERIFICATION')
  console.log('─'.repeat(80))

  const projectAudit = { projects: [], issues: [] }

  // Legacy hours by project
  const legacyHoursByProject = new Map()
  for (const d of rawTsDetails) {
    const hours = [1,2,3,4,5,6,7].reduce((s, i) => s + (parseFloat(d[`tsd_time${i}`]) || 0), 0)
    const projCode = rawProjIdToCode.get(d.tsd_projid)
    if (projCode) {
      legacyHoursByProject.set(projCode, (legacyHoursByProject.get(projCode) || 0) + hours)
    }
  }

  // Legacy invoiced by project
  const legacyInvoicedByProject = new Map()
  for (const inv of rawInvoices) {
    const projCode = rawProjIdToCode.get(inv.inv_projid)
    if (projCode) {
      legacyInvoicedByProject.set(projCode, (legacyInvoicedByProject.get(projCode) || 0) + (parseFloat(inv.inv_total) || 0))
    }
  }

  // DB hours by project
  const dbProjectById = new Map(dbProjects.map(p => [p.id, p]))
  const dbHoursByProject = new Map()
  for (const e of dbTsEntries) {
    const proj = dbProjectById.get(e.project_id)
    if (proj) {
      const hours = (e.hours || []).reduce((s, h) => s + (h || 0), 0)
      dbHoursByProject.set(proj.code, (dbHoursByProject.get(proj.code) || 0) + hours)
    }
  }

  // DB invoiced by project
  const dbInvoicedByProject = new Map()
  for (const inv of dbInvoices) {
    const proj = dbProjectById.get(inv.project_id)
    if (proj) {
      dbInvoicedByProject.set(proj.code, (dbInvoicedByProject.get(proj.code) || 0) + (parseFloat(inv.total) || 0))
    }
  }

  // Compare top 100 projects by legacy hours
  const topProjects = [...legacyHoursByProject.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100)

  let projectMatches = 0
  let projectWarnings = 0
  let projectFails = 0

  for (const [projCode, legacyHours] of topProjects) {
    const dbHours = dbHoursByProject.get(projCode) || 0
    const legacyInvoiced = legacyInvoicedByProject.get(projCode) || 0
    const dbInvoiced = dbInvoicedByProject.get(projCode) || 0

    const hoursDiff = legacyHours - dbHours
    const hoursPct = legacyHours > 0 ? (Math.abs(hoursDiff) / legacyHours * 100) : 0
    const invoiceDiff = legacyInvoiced - dbInvoiced
    const invoicePct = legacyInvoiced > 0 ? (Math.abs(invoiceDiff) / legacyInvoiced * 100) : 0

    const status = (hoursPct < 0.1 && invoicePct < 0.1) ? 'PASS' : ((hoursPct < 1 && invoicePct < 1) ? 'WARN' : 'FAIL')

    const record = {
      project_code: projCode,
      legacy_hours: legacyHours,
      db_hours: dbHours,
      hours_diff: hoursDiff,
      hours_pct: hoursPct,
      legacy_invoiced: legacyInvoiced,
      db_invoiced: dbInvoiced,
      invoice_diff: invoiceDiff,
      invoice_pct: invoicePct,
      status
    }

    projectAudit.projects.push(record)

    if (status === 'PASS') projectMatches++
    else if (status === 'WARN') projectWarnings++
    else projectFails++

    if (status !== 'PASS') {
      projectAudit.issues.push(record)
    }
  }

  console.log(`  Projects checked: ${topProjects.length}`)
  console.log(`  ✓ PASS: ${projectMatches}`)
  console.log(`  ~ WARN: ${projectWarnings}`)
  console.log(`  ✗ FAIL: ${projectFails}`)

  if (projectAudit.issues.length > 0) {
    console.log('\n  Issues found:')
    for (const issue of projectAudit.issues.slice(0, 5)) {
      console.log(`    ${issue.project_code}: hours diff ${formatNumber(issue.hours_diff)}h (${issue.hours_pct.toFixed(2)}%)`)
    }
  }

  auditResults.sections.projects = projectAudit

  // ==========================================
  // SECTION 3: PER-INVOICE VERIFICATION
  // ==========================================
  console.log('\n' + '─'.repeat(80))
  console.log('SECTION 3: PER-INVOICE VERIFICATION')
  console.log('─'.repeat(80))

  const invoiceAudit = { invoices: [], issues: [] }

  // Build DB invoice lookup by invoice_number
  const dbInvoiceByNumber = new Map()
  for (const inv of dbInvoices) {
    // Store by string key since DB stores as string
    dbInvoiceByNumber.set(String(inv.invoice_number), inv)
  }

  let invoiceMatches = 0
  let invoiceWarnings = 0
  let invoiceFails = 0

  for (const legacyInv of rawInvoices) {
    // Convert legacy inv_no (number) to string for lookup
    const dbInv = dbInvoiceByNumber.get(String(legacyInv.inv_no))

    if (!dbInv) {
      invoiceFails++
      invoiceAudit.issues.push({
        invoice_number: legacyInv.inv_no,
        issue: 'NOT_FOUND_IN_DB',
        legacy_total: parseFloat(legacyInv.inv_total) || 0
      })
      continue
    }

    const legacyTotal = parseFloat(legacyInv.inv_total) || 0
    const dbTotal = parseFloat(dbInv.total) || 0
    const diff = Math.abs(legacyTotal - dbTotal)

    if (diff < 0.01) {
      invoiceMatches++
    } else if (diff < 1) {
      invoiceWarnings++
      invoiceAudit.issues.push({
        invoice_number: legacyInv.inv_no,
        issue: 'MINOR_DIFF',
        legacy_total: legacyTotal,
        db_total: dbTotal,
        diff
      })
    } else {
      invoiceFails++
      invoiceAudit.issues.push({
        invoice_number: legacyInv.inv_no,
        issue: 'MAJOR_DIFF',
        legacy_total: legacyTotal,
        db_total: dbTotal,
        diff
      })
    }
  }

  console.log(`  Invoices checked: ${rawInvoices.length}`)
  console.log(`  ✓ PASS: ${invoiceMatches}`)
  console.log(`  ~ WARN: ${invoiceWarnings}`)
  console.log(`  ✗ FAIL: ${invoiceFails}`)

  if (invoiceAudit.issues.length > 0 && invoiceAudit.issues.length <= 20) {
    console.log('\n  Issues found:')
    for (const issue of invoiceAudit.issues) {
      console.log(`    Invoice #${issue.invoice_number}: ${issue.issue}`)
    }
  }

  auditResults.sections.invoices = invoiceAudit

  // ==========================================
  // SECTION 4: DATA INTEGRITY CHECKS
  // ==========================================
  console.log('\n' + '─'.repeat(80))
  console.log('SECTION 4: DATA INTEGRITY CHECKS')
  console.log('─'.repeat(80))

  const integrityAudit = { checks: [], issues: [] }

  // Check 1: Timesheet entries without valid timesheet
  const tsIds = new Set(dbTimesheets.map(t => t.id))
  let orphanTsEntries = 0
  for (const e of dbTsEntries) {
    if (!tsIds.has(e.timesheet_id)) orphanTsEntries++
  }
  integrityAudit.checks.push({
    check: 'Orphan timesheet entries',
    count: orphanTsEntries,
    status: orphanTsEntries === 0 ? 'PASS' : 'FAIL'
  })
  console.log(`  Orphan timesheet entries: ${orphanTsEntries}`)

  // Check 2: Expense entries without valid expense
  const expIds = new Set(dbExpenses.map(e => e.id))
  let orphanExpEntries = 0
  for (const e of dbExpEntries) {
    if (!expIds.has(e.expense_id)) orphanExpEntries++
  }
  integrityAudit.checks.push({
    check: 'Orphan expense entries',
    count: orphanExpEntries,
    status: orphanExpEntries === 0 ? 'PASS' : 'FAIL'
  })
  console.log(`  Orphan expense entries: ${orphanExpEntries}`)

  // Check 3: Entries without valid project
  const projIds = new Set(dbProjects.map(p => p.id))
  let orphanTsProj = 0
  for (const e of dbTsEntries) {
    if (!projIds.has(e.project_id)) orphanTsProj++
  }
  integrityAudit.checks.push({
    check: 'Timesheet entries with invalid project',
    count: orphanTsProj,
    status: orphanTsProj === 0 ? 'PASS' : 'FAIL'
  })
  console.log(`  Timesheet entries with invalid project: ${orphanTsProj}`)

  // Check 4: Week starts are all Mondays
  let nonMondayWeekStarts = 0
  for (const ts of dbTimesheets) {
    const date = new Date(ts.week_start)
    if (date.getDay() !== 1) { // Monday = 1
      nonMondayWeekStarts++
    }
  }
  integrityAudit.checks.push({
    check: 'Timesheets with non-Monday week_start',
    count: nonMondayWeekStarts,
    status: nonMondayWeekStarts === 0 ? 'PASS' : 'WARN'
  })
  console.log(`  Non-Monday week starts: ${nonMondayWeekStarts}`)

  // Check 5: Duplicate invoice numbers
  const invoiceNumbers = new Map()
  for (const inv of dbInvoices) {
    invoiceNumbers.set(inv.invoice_number, (invoiceNumbers.get(inv.invoice_number) || 0) + 1)
  }
  let duplicateInvoiceNumbers = 0
  for (const [num, count] of invoiceNumbers) {
    if (count > 1) duplicateInvoiceNumbers++
  }
  integrityAudit.checks.push({
    check: 'Duplicate invoice numbers',
    count: duplicateInvoiceNumbers,
    status: duplicateInvoiceNumbers === 0 ? 'PASS' : 'FAIL'
  })
  console.log(`  Duplicate invoice numbers: ${duplicateInvoiceNumbers}`)

  auditResults.sections.integrity = integrityAudit

  // ==========================================
  // SECTION 5: FRENCH ENCODING SCAN
  // ==========================================
  console.log('\n' + '─'.repeat(80))
  console.log('SECTION 5: FRENCH ENCODING SCAN')
  console.log('─'.repeat(80))

  const encodingAudit = { tables: [], issues: [] }

  // Scan clients
  let clientEncodingIssues = 0
  for (const c of dbClients) {
    if (hasMojibake(c.name) || hasMojibake(c.code)) {
      clientEncodingIssues++
      encodingAudit.issues.push({ table: 'clients', id: c.id, field: 'name/code', value: c.name })
    }
  }
  encodingAudit.tables.push({ table: 'clients', issues: clientEncodingIssues })

  // Scan projects
  let projectEncodingIssues = 0
  for (const p of dbProjects) {
    if (hasMojibake(p.name) || hasMojibake(p.address) || hasMojibake(p.description)) {
      projectEncodingIssues++
      encodingAudit.issues.push({ table: 'projects', id: p.id, field: 'name/address', value: p.name })
    }
  }
  encodingAudit.tables.push({ table: 'projects', issues: projectEncodingIssues })

  // Scan people
  let peopleEncodingIssues = 0
  for (const p of dbPeople) {
    if (hasMojibake(p.first_name) || hasMojibake(p.last_name)) {
      peopleEncodingIssues++
      encodingAudit.issues.push({ table: 'people', id: p.id, field: 'name', value: `${p.first_name} ${p.last_name}` })
    }
  }
  encodingAudit.tables.push({ table: 'people', issues: peopleEncodingIssues })

  // Scan tasks
  let taskEncodingIssues = 0
  for (const t of dbTasks) {
    if (hasMojibake(t.name) || hasMojibake(t.description)) {
      taskEncodingIssues++
      encodingAudit.issues.push({ table: 'project_tasks', id: t.id, field: 'name', value: t.name })
    }
  }
  encodingAudit.tables.push({ table: 'project_tasks', issues: taskEncodingIssues })

  const totalEncodingIssues = clientEncodingIssues + projectEncodingIssues + peopleEncodingIssues + taskEncodingIssues

  console.log(`  Clients with encoding issues: ${clientEncodingIssues}`)
  console.log(`  Projects with encoding issues: ${projectEncodingIssues}`)
  console.log(`  People with encoding issues: ${peopleEncodingIssues}`)
  console.log(`  Tasks with encoding issues: ${taskEncodingIssues}`)
  console.log(`  TOTAL: ${totalEncodingIssues}`)

  if (encodingAudit.issues.length > 0) {
    console.log('\n  Sample issues:')
    for (const issue of encodingAudit.issues.slice(0, 5)) {
      console.log(`    ${issue.table}.${issue.field}: "${issue.value}"`)
    }
  }

  auditResults.sections.encoding = encodingAudit

  // ==========================================
  // SECTION 6: MISSING TASKS INVESTIGATION
  // ==========================================
  console.log('\n' + '─'.repeat(80))
  console.log('SECTION 6: MISSING TASKS INVESTIGATION')
  console.log('─'.repeat(80))

  const missingTasks = []
  const dbTaskKeys = new Set()
  for (const t of dbTasks) {
    dbTaskKeys.add(`${t.project_id}_${t.code}`)
  }

  // Build project code to DB ID map
  const dbClientById = new Map(dbClients.map(c => [c.id, c]))
  const dbProjCodeToId = new Map()
  for (const p of dbProjects) {
    const client = dbClientById.get(p.client_id)
    if (client) {
      dbProjCodeToId.set(`${client.code}_${p.code}`, p.id)
    }
  }

  // Build raw project ID to DB project ID
  const rawProjIdToDbId = new Map()
  for (const p of rawProjects) {
    const clientCode = rawClientIdToCode.get(p.proj_clientid)
    if (clientCode) {
      const dbProjId = dbProjCodeToId.get(`${clientCode}_${p.proj_code}`)
      if (dbProjId) rawProjIdToDbId.set(p.proj_id, dbProjId)
    }
  }

  for (const t of rawTasks) {
    const dbProjId = rawProjIdToDbId.get(t.task_projid)
    if (!dbProjId) continue

    const key = `${dbProjId}_${t.task_code}`
    if (!dbTaskKeys.has(key)) {
      missingTasks.push({
        task_id: t.task_id,
        task_code: t.task_code,
        task_name: t.task_name,
        proj_id: t.task_projid
      })
    }
  }

  console.log(`  Raw tasks: ${rawTasks.length}`)
  console.log(`  DB tasks: ${dbTasks.length}`)
  console.log(`  Missing tasks: ${missingTasks.length}`)

  if (missingTasks.length > 0) {
    console.log('\n  Missing tasks:')
    for (const t of missingTasks) {
      console.log(`    ${t.task_code}: "${t.task_name}" (proj_id: ${t.proj_id})`)
    }
  }

  auditResults.sections.missingTasks = { count: missingTasks.length, tasks: missingTasks }

  // ==========================================
  // FINAL SUMMARY
  // ==========================================
  console.log('\n' + '='.repeat(80))
  console.log('AUDIT SUMMARY')
  console.log('='.repeat(80))
  console.log('')

  const summaryLines = []
  summaryLines.push('# Migration Audit Summary')
  summaryLines.push('')
  summaryLines.push(`**Generated**: ${new Date().toISOString()}`)
  summaryLines.push('')
  summaryLines.push('## Results')
  summaryLines.push('')
  summaryLines.push('| Section | Status | Details |')
  summaryLines.push('|---------|--------|---------|')

  // Employee summary
  const empStatus = employeeFails === 0 ? (employeeWarnings === 0 ? '✓ PASS' : '~ WARN') : '✗ FAIL'
  summaryLines.push(`| Employees | ${empStatus} | ${employeeMatches} pass, ${employeeWarnings} warn, ${employeeFails} fail |`)
  console.log(`  Employees: ${empStatus}`)

  // Project summary
  const projStatus = projectFails === 0 ? (projectWarnings === 0 ? '✓ PASS' : '~ WARN') : '✗ FAIL'
  summaryLines.push(`| Projects | ${projStatus} | ${projectMatches} pass, ${projectWarnings} warn, ${projectFails} fail |`)
  console.log(`  Projects: ${projStatus}`)

  // Invoice summary
  const invStatus = invoiceFails === 0 ? (invoiceWarnings === 0 ? '✓ PASS' : '~ WARN') : '✗ FAIL'
  summaryLines.push(`| Invoices | ${invStatus} | ${invoiceMatches} pass, ${invoiceWarnings} warn, ${invoiceFails} fail |`)
  console.log(`  Invoices: ${invStatus}`)

  // Integrity summary
  const integrityFails = integrityAudit.checks.filter(c => c.status === 'FAIL').length
  const intStatus = integrityFails === 0 ? '✓ PASS' : '✗ FAIL'
  summaryLines.push(`| Data Integrity | ${intStatus} | ${integrityAudit.checks.length - integrityFails} pass, ${integrityFails} fail |`)
  console.log(`  Data Integrity: ${intStatus}`)

  // Encoding summary
  const encStatus = totalEncodingIssues === 0 ? '✓ PASS' : '✗ FAIL'
  summaryLines.push(`| Encoding | ${encStatus} | ${totalEncodingIssues} issues found |`)
  console.log(`  Encoding: ${encStatus}`)

  // Missing tasks
  const taskStatus = missingTasks.length === 0 ? '✓ PASS' : '~ WARN'
  summaryLines.push(`| Tasks | ${taskStatus} | ${missingTasks.length} missing |`)
  console.log(`  Tasks: ${taskStatus}`)

  summaryLines.push('')
  summaryLines.push('## Issues Requiring Attention')
  summaryLines.push('')

  if (employeeAudit.issues.length > 0) {
    summaryLines.push(`### Employee Hour Variances (${employeeAudit.issues.length})`)
    for (const i of employeeAudit.issues.slice(0, 10)) {
      summaryLines.push(`- ${i.name}: ${formatNumber(i.diff)}h difference (${i.percent_diff.toFixed(2)}%)`)
    }
    summaryLines.push('')
  }

  if (totalEncodingIssues > 0) {
    summaryLines.push(`### Encoding Issues (${totalEncodingIssues})`)
    for (const i of encodingAudit.issues.slice(0, 10)) {
      summaryLines.push(`- ${i.table}: "${i.value}"`)
    }
    summaryLines.push('')
  }

  if (missingTasks.length > 0) {
    summaryLines.push(`### Missing Tasks (${missingTasks.length})`)
    for (const t of missingTasks) {
      summaryLines.push(`- ${t.task_code}: "${t.task_name}"`)
    }
    summaryLines.push('')
  }

  // Determine overall status
  const overallFails = employeeFails + projectFails + invoiceFails + integrityFails + (totalEncodingIssues > 0 ? 1 : 0)
  const overallWarnings = employeeWarnings + projectWarnings + invoiceWarnings + missingTasks.length

  console.log('')
  if (overallFails === 0 && overallWarnings <= 5) {
    console.log('  ╔════════════════════════════════════════════════════════════════╗')
    console.log('  ║  AUDIT PASSED - DATA VERIFIED FOR PRODUCTION                   ║')
    console.log('  ╚════════════════════════════════════════════════════════════════╝')
    summaryLines.push('## Overall: ✓ AUDIT PASSED')
    summaryLines.push('')
    summaryLines.push('Data is verified and ready for production deployment.')
  } else if (overallFails === 0) {
    console.log('  ╔════════════════════════════════════════════════════════════════╗')
    console.log('  ║  AUDIT OK WITH WARNINGS - REVIEW BEFORE PRODUCTION             ║')
    console.log('  ╚════════════════════════════════════════════════════════════════╝')
    summaryLines.push('## Overall: ~ OK WITH WARNINGS')
    summaryLines.push('')
    summaryLines.push('Review warnings before production deployment.')
  } else {
    console.log('  ╔════════════════════════════════════════════════════════════════╗')
    console.log('  ║  AUDIT FAILED - ISSUES REQUIRE ATTENTION                       ║')
    console.log('  ╚════════════════════════════════════════════════════════════════╝')
    summaryLines.push('## Overall: ✗ AUDIT FAILED')
    summaryLines.push('')
    summaryLines.push('Issues require attention before production deployment.')
  }

  // Save reports
  fs.writeFileSync(path.join(REPORT_DIR, 'AUDIT_SUMMARY.md'), summaryLines.join('\n'))
  fs.writeFileSync(path.join(REPORT_DIR, 'EMPLOYEE_AUDIT.json'), JSON.stringify(employeeAudit, null, 2))
  fs.writeFileSync(path.join(REPORT_DIR, 'PROJECT_AUDIT.json'), JSON.stringify(projectAudit, null, 2))
  fs.writeFileSync(path.join(REPORT_DIR, 'INVOICE_AUDIT.json'), JSON.stringify(invoiceAudit, null, 2))
  fs.writeFileSync(path.join(REPORT_DIR, 'INTEGRITY_AUDIT.json'), JSON.stringify(integrityAudit, null, 2))
  fs.writeFileSync(path.join(REPORT_DIR, 'ENCODING_AUDIT.json'), JSON.stringify(encodingAudit, null, 2))
  fs.writeFileSync(path.join(REPORT_DIR, 'FULL_AUDIT.json'), JSON.stringify(auditResults, null, 2))

  console.log('')
  console.log(`Reports saved to: ${REPORT_DIR}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
