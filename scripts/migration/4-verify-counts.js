/**
 * Script 4: Verify Migration
 *
 * Verifies migration integrity with count checks, totals verification,
 * and data sampling.
 *
 * Usage: npm run verify
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAW_DIR = path.join(__dirname, 'data', 'raw')
const TRANSFORMED_DIR = path.join(__dirname, 'data', 'transformed')

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

// Helper functions
function loadJson(dir, filename) {
  const filepath = path.join(dir, filename)
  if (!fs.existsSync(filepath)) {
    return []
  }
  return JSON.parse(fs.readFileSync(filepath, 'utf8'))
}

// Verification checks
const COUNT_CHECKS = [
  { table: 'profiles', legacyFile: 'users.json', legacyDir: RAW_DIR },
  { table: 'clients', legacyFile: 'clients.json', legacyDir: RAW_DIR },
  { table: 'projects', legacyFile: 'projects.json', legacyDir: RAW_DIR },
  { table: 'project_tasks', legacyFile: 'tasks.json', legacyDir: RAW_DIR },
  { table: 'project_billing_roles', legacyFile: 'projectroles.json', legacyDir: RAW_DIR },
  { table: 'timesheets', legacyFile: 'timesheets.json', legacyDir: RAW_DIR },
  { table: 'timesheet_entries', legacyFile: 'timesheetdetails.json', legacyDir: RAW_DIR },
  { table: 'expenses', legacyFile: 'expenses.json', legacyDir: RAW_DIR },
  { table: 'expense_entries', legacyFile: 'expensedetails.json', legacyDir: RAW_DIR },
  { table: 'invoices', legacyFile: 'invoices.json', legacyDir: RAW_DIR },
]

/**
 * Verify record counts match
 */
async function verifyCounts() {
  console.log('\n--- Count Verification ---')
  console.log('')
  console.log('Table'.padEnd(25) + 'Legacy'.padStart(10) + 'New'.padStart(10) + 'Status'.padStart(10))
  console.log('-'.repeat(55))

  const results = []

  for (const check of COUNT_CHECKS) {
    const legacy = loadJson(check.legacyDir, check.legacyFile)
    const legacyCount = legacy.length

    const { count, error } = await supabase
      .from(check.table)
      .select('*', { count: 'exact', head: true })

    if (error) {
      results.push({
        table: check.table,
        legacy: legacyCount,
        new: 'ERROR',
        match: false,
      })
      console.log(
        check.table.padEnd(25) +
        legacyCount.toString().padStart(10) +
        'ERROR'.padStart(10) +
        '   !'
      )
    } else {
      const match = legacyCount === count
      results.push({
        table: check.table,
        legacy: legacyCount,
        new: count,
        match,
      })
      console.log(
        check.table.padEnd(25) +
        legacyCount.toString().padStart(10) +
        count.toString().padStart(10) +
        (match ? '    OK' : '    !')
      )
    }
  }

  console.log('-'.repeat(55))

  const allMatch = results.every(r => r.match)
  console.log(allMatch ? '\n All counts match!' : '\n Some counts do not match!')

  return results
}

/**
 * Verify total hours match
 */
async function verifyTotalHours() {
  console.log('\n--- Total Hours Verification ---')

  // Calculate legacy total hours
  const legacyDetails = loadJson(RAW_DIR, 'timesheetdetails.json')
  let legacyTotalHours = 0

  for (const entry of legacyDetails) {
    for (let i = 1; i <= 7; i++) {
      const hours = parseFloat(entry[`tsd_time${i}`]) || 0
      legacyTotalHours += hours
    }
  }

  // Calculate new total hours
  const { data: entries, error } = await supabase
    .from('timesheet_entries')
    .select('hours')

  if (error) {
    console.log('Error fetching entries:', error.message)
    return { legacy: legacyTotalHours, new: 0, match: false }
  }

  let newTotalHours = 0
  for (const entry of entries) {
    if (entry.hours && Array.isArray(entry.hours)) {
      newTotalHours += entry.hours.reduce((sum, h) => sum + (h || 0), 0)
    }
  }

  const match = Math.abs(legacyTotalHours - newTotalHours) < 0.01

  console.log(`Legacy total hours: ${legacyTotalHours.toFixed(2)}`)
  console.log(`New total hours:    ${newTotalHours.toFixed(2)}`)
  console.log(`Match: ${match ? 'OK' : 'MISMATCH'}`)

  return { legacy: legacyTotalHours, new: newTotalHours, match }
}

/**
 * Verify invoice totals match
 */
async function verifyInvoiceTotals() {
  console.log('\n--- Invoice Totals Verification ---')

  // Calculate legacy totals
  const legacyInvoices = loadJson(RAW_DIR, 'invoices.json')
  let legacyTotal = 0
  let legacySubtotal = 0
  let legacyGst = 0
  let legacyQst = 0

  for (const inv of legacyInvoices) {
    legacyTotal += parseFloat(inv.inv_total) || 0
    legacySubtotal += parseFloat(inv.inv_net) || 0
    legacyGst += parseFloat(inv.inv_tps) || 0
    legacyQst += parseFloat(inv.inv_tvp) || 0
  }

  // Calculate new totals
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('total, subtotal, gst_amount, qst_amount')

  if (error) {
    console.log('Error fetching invoices:', error.message)
    return { match: false }
  }

  let newTotal = 0
  let newSubtotal = 0
  let newGst = 0
  let newQst = 0

  for (const inv of invoices) {
    newTotal += inv.total || 0
    newSubtotal += inv.subtotal || 0
    newGst += inv.gst_amount || 0
    newQst += inv.qst_amount || 0
  }

  const totalMatch = Math.abs(legacyTotal - newTotal) < 0.01
  const subtotalMatch = Math.abs(legacySubtotal - newSubtotal) < 0.01

  console.log(`\nSubtotals:`)
  console.log(`  Legacy: $${legacySubtotal.toFixed(2)}`)
  console.log(`  New:    $${newSubtotal.toFixed(2)}`)
  console.log(`  Match:  ${subtotalMatch ? 'OK' : 'MISMATCH'}`)

  console.log(`\nTotals (with tax):`)
  console.log(`  Legacy: $${legacyTotal.toFixed(2)}`)
  console.log(`  New:    $${newTotal.toFixed(2)}`)
  console.log(`  Match:  ${totalMatch ? 'OK' : 'MISMATCH'}`)

  return {
    legacyTotal,
    newTotal,
    legacySubtotal,
    newSubtotal,
    totalMatch,
    subtotalMatch,
  }
}

/**
 * Spot check random samples
 */
async function spotCheckSamples() {
  console.log('\n--- Random Sample Verification ---')

  const idMaps = loadJson(TRANSFORMED_DIR, '_id_maps.json')[0] || loadJson(TRANSFORMED_DIR, '_id_maps.json')

  // Sample timesheet entries
  const legacyDetails = loadJson(RAW_DIR, 'timesheetdetails.json')
  const sampleSize = Math.min(10, legacyDetails.length)
  const sampleIndices = []

  while (sampleIndices.length < sampleSize && legacyDetails.length > 0) {
    const idx = Math.floor(Math.random() * legacyDetails.length)
    if (!sampleIndices.includes(idx)) {
      sampleIndices.push(idx)
    }
  }

  console.log(`\nChecking ${sampleSize} random timesheet entries...`)

  let matches = 0
  let mismatches = 0

  for (const idx of sampleIndices) {
    const legacy = legacyDetails[idx]
    const legacyHours = [
      parseFloat(legacy.tsd_time1) || 0,
      parseFloat(legacy.tsd_time2) || 0,
      parseFloat(legacy.tsd_time3) || 0,
      parseFloat(legacy.tsd_time4) || 0,
      parseFloat(legacy.tsd_time5) || 0,
      parseFloat(legacy.tsd_time6) || 0,
      parseFloat(legacy.tsd_time7) || 0,
    ]
    const legacyTotal = legacyHours.reduce((a, b) => a + b, 0)

    // Find corresponding entry by timesheet_id and project_id
    const timesheetId = idMaps.timesheets?.[legacy.tsd_tsid]
    const projectId = idMaps.projects?.[legacy.tsd_projid]

    if (!timesheetId || !projectId) {
      continue
    }

    const { data: newEntry } = await supabase
      .from('timesheet_entries')
      .select('hours')
      .eq('timesheet_id', timesheetId)
      .eq('project_id', projectId)
      .single()

    if (newEntry?.hours) {
      const newTotal = newEntry.hours.reduce((a, b) => a + (b || 0), 0)
      if (Math.abs(legacyTotal - newTotal) < 0.01) {
        matches++
      } else {
        mismatches++
        console.log(`  Mismatch: Entry ${legacy.tsd_id}`)
        console.log(`    Legacy: ${legacyHours.join(', ')} = ${legacyTotal}`)
        console.log(`    New:    ${newEntry.hours.join(', ')} = ${newTotal}`)
      }
    }
  }

  console.log(`\nSample results: ${matches} matches, ${mismatches} mismatches`)
  return { matches, mismatches }
}

/**
 * Verify French character encoding
 */
async function verifyFrenchCharacters() {
  console.log('\n--- French Character Verification ---')

  // Check clients for French characters
  const { data: clients, error } = await supabase
    .from('clients')
    .select('name')
    .limit(100)

  if (error) {
    console.log('Error fetching clients:', error.message)
    return { ok: false }
  }

  // Look for encoding corruption indicators
  const corrupted = []

  for (const client of clients) {
    if (client.name) {
      // Check for mojibake patterns
      if (
        client.name.includes('\ufffd') || // Replacement character
        client.name.includes('?') && /[^\x00-\x7F]/.test(client.name) ||
        /Ã©|Ã¨|Ã |Ã§|Ãª|Ã®|Ã´|Ã¹|Ã»/.test(client.name) // Common mojibake
      ) {
        corrupted.push(client.name)
      }
    }
  }

  // Check profiles for French names
  const { data: profiles } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .limit(100)

  for (const profile of profiles || []) {
    const name = `${profile.first_name} ${profile.last_name}`
    if (/Ã©|Ã¨|Ã |Ã§|Ãª|Ã®|Ã´|Ã¹|Ã»/.test(name)) {
      corrupted.push(name)
    }
  }

  if (corrupted.length > 0) {
    console.log('Potential encoding issues found:')
    corrupted.slice(0, 5).forEach(s => console.log(`  - ${s}`))
    if (corrupted.length > 5) {
      console.log(`  ... and ${corrupted.length - 5} more`)
    }
    return { ok: false, corrupted }
  }

  console.log('No obvious encoding corruption detected')
  return { ok: true }
}

/**
 * Check foreign key integrity
 */
async function verifyForeignKeys() {
  console.log('\n--- Foreign Key Integrity ---')

  const checks = [
    {
      table: 'timesheet_entries',
      fk: 'timesheet_id',
      ref: 'timesheets',
    },
    {
      table: 'timesheet_entries',
      fk: 'project_id',
      ref: 'projects',
    },
    {
      table: 'expense_entries',
      fk: 'expense_id',
      ref: 'expenses',
    },
    {
      table: 'invoice_lines',
      fk: 'invoice_id',
      ref: 'invoices',
    },
    {
      table: 'projects',
      fk: 'client_id',
      ref: 'clients',
    },
  ]

  let allOk = true

  for (const check of checks) {
    // Get distinct FK values from child table
    const { data: children, error } = await supabase
      .from(check.table)
      .select(check.fk)
      .not(check.fk, 'is', null)
      .limit(1000)

    if (error) {
      console.log(`  ${check.table}.${check.fk}: Error - ${error.message}`)
      continue
    }

    // Get all IDs from parent table
    const { data: parents } = await supabase
      .from(check.ref)
      .select('id')

    const parentIds = new Set((parents || []).map(p => p.id))
    const orphans = children.filter(c => !parentIds.has(c[check.fk]))

    if (orphans.length > 0) {
      console.log(`  ${check.table}.${check.fk} -> ${check.ref}: ${orphans.length} orphan records`)
      allOk = false
    } else {
      console.log(`  ${check.table}.${check.fk} -> ${check.ref}: OK`)
    }
  }

  return { ok: allOk }
}

// Main execution
async function main() {
  console.log('='.repeat(60))
  console.log('Grand Canyon Migration - Step 4: Verification')
  console.log('='.repeat(60))

  // Validate environment
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('\nERROR: Missing environment variables.')
    process.exit(1)
  }

  console.log(`\nSupabase URL: ${process.env.SUPABASE_URL}`)

  // Run all verifications
  const countResults = await verifyCounts()
  const hoursResult = await verifyTotalHours()
  const invoiceResult = await verifyInvoiceTotals()
  const sampleResult = await spotCheckSamples()
  const encodingResult = await verifyFrenchCharacters()
  const fkResult = await verifyForeignKeys()

  // Final summary
  console.log('\n' + '='.repeat(60))
  console.log('Verification Summary')
  console.log('='.repeat(60))

  const allCountsMatch = countResults.every(r => r.match)
  const hoursMatch = hoursResult.match
  const totalsMatch = invoiceResult.totalMatch

  console.log(`\n  Record counts:      ${allCountsMatch ? 'PASS' : 'FAIL'}`)
  console.log(`  Total hours:        ${hoursMatch ? 'PASS' : 'FAIL'}`)
  console.log(`  Invoice totals:     ${totalsMatch ? 'PASS' : 'FAIL'}`)
  console.log(`  Sample verification: ${sampleResult.mismatches === 0 ? 'PASS' : 'WARN'}`)
  console.log(`  French encoding:    ${encodingResult.ok ? 'PASS' : 'WARN'}`)
  console.log(`  FK integrity:       ${fkResult.ok ? 'PASS' : 'WARN'}`)

  const allPassed = allCountsMatch && hoursMatch && totalsMatch

  console.log('\n' + '='.repeat(60))
  if (allPassed) {
    console.log('All critical verifications passed!')
    console.log('Migration is ready for production use.')
  } else {
    console.log('Some verifications failed.')
    console.log('Review the results above before proceeding.')
  }
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
