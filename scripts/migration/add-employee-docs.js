/**
 * Add employee document columns
 * Run: node --env-file=.env.local scripts/migration/add-employee-docs.js
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function checkColumnExists(table, column) {
  const { data, error } = await supabase
    .from(table)
    .select(column)
    .limit(1)

  if (error && error.message.includes('does not exist')) {
    return false
  }
  return true
}

async function main() {
  console.log('Checking employee document columns...\n')

  // Check profiles columns
  const profileCols = ['ccq_card_number', 'ccq_card_expiry', 'ccq_card_url', 'ccq_card_uploaded_at']
  for (const col of profileCols) {
    const exists = await checkColumnExists('profiles', col)
    console.log(`profiles.${col}: ${exists ? 'EXISTS' : 'MISSING'}`)
  }

  // Check expense_entries columns
  const expenseCols = ['receipt_url', 'receipt_uploaded_at']
  for (const col of expenseCols) {
    const exists = await checkColumnExists('expense_entries', col)
    console.log(`expense_entries.${col}: ${exists ? 'EXISTS' : 'MISSING'}`)
  }

  // Check timesheet_entries columns
  const timesheetCols = ['receipt_url', 'receipt_note']
  for (const col of timesheetCols) {
    const exists = await checkColumnExists('timesheet_entries', col)
    console.log(`timesheet_entries.${col}: ${exists ? 'EXISTS' : 'MISSING'}`)
  }

  // Check storage bucket
  const { data: buckets } = await supabase.storage.listBuckets()
  const hasDocsBucket = buckets?.some(b => b.id === 'employee-documents')
  console.log(`\nemployee-documents bucket: ${hasDocsBucket ? 'EXISTS' : 'MISSING'}`)

  if (!hasDocsBucket) {
    console.log('\nCreating employee-documents bucket...')
    const { error } = await supabase.storage.createBucket('employee-documents', {
      public: false,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    })
    if (error) {
      console.log('Bucket creation error:', error.message)
    } else {
      console.log('Bucket created successfully!')
    }
  }

  console.log('\n---')
  console.log('To add missing columns, run the SQL migration in Supabase Dashboard:')
  console.log('SQL Editor > paste contents of supabase/migrations/20260303100000_employee_documents.sql')
}

main().catch(console.error)
