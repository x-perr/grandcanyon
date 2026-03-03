/**
 * Investigate Known Migration Issues
 *
 * Generates a detailed report on all known data integrity issues.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TRANSFORMED_DIR = path.join(__dirname, 'data', 'transformed')
const RAW_DIR = path.join(__dirname, 'data', 'raw')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function loadJson(dir, filename) {
  const filepath = path.join(dir, filename)
  if (!fs.existsSync(filepath)) return null
  return JSON.parse(fs.readFileSync(filepath, 'utf8'))
}

async function getAllRecords(tableName, selectFields = '*') {
  const records = []
  let offset = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select(selectFields)
      .range(offset, offset + pageSize - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    records.push(...data)
    offset += data.length
    if (data.length < pageSize) break
  }

  return records
}

async function main() {
  console.log('='.repeat(70))
  console.log('KNOWN ISSUES INVESTIGATION REPORT')
  console.log('Generated:', new Date().toISOString())
  console.log('='.repeat(70))

  // ================================================================
  // ISSUE 1: 68 Profiles Not Matched
  // ================================================================
  console.log('\n' + '='.repeat(70))
  console.log('ISSUE 1: 68 Profiles Not Matched')
  console.log('='.repeat(70))

  const transformedProfiles = loadJson(TRANSFORMED_DIR, 'profiles.json') || []
  const dbProfiles = await getAllRecords('profiles', 'id, email, first_name, last_name, is_active')

  console.log(`\nTransformed profiles: ${transformedProfiles.length}`)
  console.log(`DB profiles: ${dbProfiles.length}`)
  console.log(`Difference: ${dbProfiles.length - transformedProfiles.length}`)

  const dbEmails = new Set(dbProfiles.map(p => p.email?.toLowerCase()).filter(Boolean))

  const unmatched = transformedProfiles.filter(p =>
    !p.email || !dbEmails.has(p.email.toLowerCase())
  )

  console.log(`\nUnmatched from transform: ${unmatched.length}`)

  // Check for profiles in DB not in transform
  const transformEmails = new Set(transformedProfiles.map(p => p.email?.toLowerCase()).filter(Boolean))
  const extraInDb = dbProfiles.filter(p => !transformEmails.has(p.email?.toLowerCase()))

  console.log(`Extra profiles in DB (not in transform): ${extraInDb.length}`)
  if (extraInDb.length > 0) {
    console.log('\nExtra profiles in DB:')
    extraInDb.forEach(p => {
      console.log(`  - ${p.email} (${p.first_name} ${p.last_name}) is_active=${p.is_active}`)
    })
  }

  if (unmatched.length > 0) {
    console.log('\nUnmatched profiles from transform (sample):')
    unmatched.slice(0, 15).forEach(p => {
      console.log(`  - ${p.email || '(no email)'} | ${p.first_name} ${p.last_name} | is_active=${p.is_active}`)
    })

    // Analyze is_active distribution
    const unmatchedActive = unmatched.filter(p => p.is_active).length
    const unmatchedInactive = unmatched.filter(p => !p.is_active).length
    console.log(`\nUnmatched is_active breakdown:`)
    console.log(`  Active: ${unmatchedActive}`)
    console.log(`  Inactive: ${unmatchedInactive}`)
  }

  // ================================================================
  // ISSUE 2: Hours Mismatch (157 hours)
  // ================================================================
  console.log('\n' + '='.repeat(70))
  console.log('ISSUE 2: Hours Mismatch')
  console.log('='.repeat(70))

  // Calculate DB hours
  const timesheetEntries = await getAllRecords('timesheet_entries', 'id, hours')
  let dbTotalHours = 0
  for (const entry of timesheetEntries) {
    if (entry.hours && Array.isArray(entry.hours)) {
      dbTotalHours += entry.hours.reduce((sum, h) => sum + (h || 0), 0)
    }
  }

  // Load raw timesheet entries for comparison
  const rawEntries = loadJson(RAW_DIR, 'timesheetdetails.json') || []
  let rawTotalHours = 0
  for (const entry of rawEntries) {
    // Raw entries have individual day columns
    const days = ['tsd_day1', 'tsd_day2', 'tsd_day3', 'tsd_day4', 'tsd_day5', 'tsd_day6', 'tsd_day7']
    for (const day of days) {
      rawTotalHours += parseFloat(entry[day]) || 0
    }
  }

  console.log(`\nRaw legacy hours: ${rawTotalHours.toFixed(2)}`)
  console.log(`DB hours: ${dbTotalHours.toFixed(2)}`)
  console.log(`Difference: ${(rawTotalHours - dbTotalHours).toFixed(2)} hours`)
  console.log(`Percentage: ${((rawTotalHours - dbTotalHours) / rawTotalHours * 100).toFixed(4)}%`)

  console.log(`\nEntry counts:`)
  console.log(`  Raw entries: ${rawEntries.length}`)
  console.log(`  DB entries: ${timesheetEntries.length}`)
  console.log(`  Missing entries: ${rawEntries.length - timesheetEntries.length}`)

  // ================================================================
  // ISSUE 3: Orphan expense_entries (300 records)
  // ================================================================
  console.log('\n' + '='.repeat(70))
  console.log('ISSUE 3: Orphan expense_entries')
  console.log('='.repeat(70))

  // Find entries with invalid FK (expense doesn't exist)
  const expenses = await getAllRecords('expenses', 'id')
  const expenseIds = new Set(expenses.map(e => e.id))

  const expenseEntries = await getAllRecords('expense_entries', 'id, expense_id, description, subtotal')
  const invalidFkEntries = expenseEntries.filter(e => e.expense_id && !expenseIds.has(e.expense_id))

  console.log(`\nTotal expense_entries: ${expenseEntries.length}`)
  console.log(`Total expenses: ${expenses.length}`)
  console.log(`Entries with invalid expense_id (FK violation): ${invalidFkEntries.length}`)

  if (invalidFkEntries.length > 0) {
    console.log('\nSample invalid FK entries:')
    invalidFkEntries.slice(0, 10).forEach(e => {
      console.log(`  - ID: ${e.id.slice(0,8)}... expense_id: ${e.expense_id?.slice(0,8)}... subtotal: $${e.subtotal}`)
    })

    // Get unique invalid expense_ids
    const uniqueInvalidIds = [...new Set(invalidFkEntries.map(e => e.expense_id))]
    console.log(`\nUnique missing expense IDs: ${uniqueInvalidIds.length}`)

    // Calculate total amount affected
    const totalOrphanAmount = invalidFkEntries.reduce((sum, e) => sum + (parseFloat(e.subtotal) || 0), 0)
    console.log(`Total subtotal in orphan entries: $${totalOrphanAmount.toFixed(2)}`)
  }

  // ================================================================
  // ISSUE 4: Orphan invoice_lines (9 records)
  // ================================================================
  console.log('\n' + '='.repeat(70))
  console.log('ISSUE 4: Orphan invoice_lines')
  console.log('='.repeat(70))

  const invoices = await getAllRecords('invoices', 'id')
  const invoiceIds = new Set(invoices.map(i => i.id))

  const invoiceLines = await getAllRecords('invoice_lines', 'id, invoice_id, description, amount, quantity')
  const invalidInvoiceLines = invoiceLines.filter(l => l.invoice_id && !invoiceIds.has(l.invoice_id))

  console.log(`\nTotal invoice_lines: ${invoiceLines.length}`)
  console.log(`Total invoices: ${invoices.length}`)
  console.log(`Lines with invalid invoice_id (FK violation): ${invalidInvoiceLines.length}`)

  if (invalidInvoiceLines.length > 0) {
    console.log('\nInvalid invoice_lines:')
    invalidInvoiceLines.forEach(l => {
      console.log(`  - ID: ${l.id.slice(0,8)}... invoice_id: ${l.invoice_id?.slice(0,8)}... amount: $${l.amount} qty: ${l.quantity}`)
    })

    const uniqueMissingInvoiceIds = [...new Set(invalidInvoiceLines.map(l => l.invoice_id))]
    console.log(`\nUnique missing invoice IDs: ${uniqueMissingInvoiceIds.length}`)

    const totalOrphanLineAmount = invalidInvoiceLines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0)
    console.log(`Total amount in orphan lines: $${totalOrphanLineAmount.toFixed(2)}`)
  }

  // ================================================================
  // SUMMARY
  // ================================================================
  console.log('\n' + '='.repeat(70))
  console.log('SUMMARY')
  console.log('='.repeat(70))

  const orphanExpenseTotal = invalidFkEntries.reduce((sum, e) => sum + (parseFloat(e.subtotal) || 0), 0)
  const orphanInvoiceTotal = invalidInvoiceLines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0)
  const hoursVariance = rawTotalHours > 0 ? ((rawTotalHours - dbTotalHours) / rawTotalHours * 100).toFixed(4) : 'N/A'

  console.log(`
| Issue | Count | Impact | Recommendation |
|-------|-------|--------|----------------|
| Unmatched profiles | ${unmatched.length} | ${unmatched.filter(p => p.is_active).length} active users not synced | Email domain mismatch (@placeholder vs @grandcanyon) |
| Hours mismatch | ${(rawTotalHours - dbTotalHours).toFixed(2)} hrs | ${hoursVariance}% variance | Check if raw file loaded correctly |
| Orphan expense_entries | ${invalidFkEntries.length} | $${orphanExpenseTotal.toFixed(2)} affected | Delete orphans or recreate parent expenses |
| Orphan invoice_lines | ${invalidInvoiceLines.length} | $${orphanInvoiceTotal.toFixed(2)} affected | Delete orphans or recreate parent invoices |
`)

  console.log('='.repeat(70))
  console.log('END OF REPORT')
  console.log('='.repeat(70))
}

main().catch(console.error)
