/**
 * Fix Remaining Issues
 *
 * Imports project_members and invoices.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAW_DIR = path.join(__dirname, 'data', 'raw')
const TRANS_DIR = path.join(__dirname, 'data', 'transformed')
const BATCH_SIZE = 100

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function loadJson(dir, filename) {
  return JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf8'))
}

function saveJson(filename, data) {
  fs.writeFileSync(path.join(TRANS_DIR, filename), JSON.stringify(data, null, 2))
  console.log(`  Saved ${data.length} records → ${filename}`)
}

async function importTable(tableName, data) {
  if (data.length === 0) {
    console.log(`    ${tableName}: No records`)
    return 0
  }

  let imported = 0

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from(tableName).insert(batch)

    if (!error) {
      imported += batch.length
    }

    if ((i + BATCH_SIZE) % 1000 === 0 || i + BATCH_SIZE >= data.length) {
      process.stdout.write(`\r    ${tableName}: ${imported}/${data.length}`)
    }
  }

  console.log(`\r    ${tableName}: ${imported}/${data.length} imported`)
  return imported
}

async function main() {
  console.log('='.repeat(60))
  console.log('Fix Remaining Issues')
  console.log('='.repeat(60))

  // Build user ID mapping
  console.log('\n--- Building Mappings ---')
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
    if (profileId) {
      userIdMap.set(user.user_id, profileId)
    }
  }
  console.log(`  Users mapped: ${userIdMap.size}`)

  // Build billing role ID map
  const rawBillingRoles = loadJson(RAW_DIR, 'projectroles.json')
  const transBillingRoles = loadJson(TRANS_DIR, 'project_billing_roles.json')
  const billingRoleIdMap = new Map()
  rawBillingRoles.forEach((br, i) => {
    if (transBillingRoles[i]) billingRoleIdMap.set(br.pr_id, transBillingRoles[i].id)
  })
  console.log(`  Billing roles mapped: ${billingRoleIdMap.size}`)

  // Import project_members
  console.log('\n--- Importing project_members ---')
  const rawProjectUserRoles = loadJson(RAW_DIR, 'projectuserrole.json')
  const projectMembers = rawProjectUserRoles
    .map(pur => {
      const userId = userIdMap.get(pur.pur_userid)
      const billingRoleId = billingRoleIdMap.get(pur.pur_prid)
      if (!userId || !billingRoleId) return null

      const billingRole = transBillingRoles.find(br => br.id === billingRoleId)
      if (!billingRole) return null

      return {
        id: uuidv4(),
        project_id: billingRole.project_id,
        user_id: userId,
        billing_role_id: billingRoleId,
        hourly_rate: null,
        is_active: pur.pur_active === '1' || pur.pur_active === 1,
        created_at: new Date().toISOString(),
      }
    })
    .filter(pm => pm !== null)
  saveJson('project_members_final2.json', projectMembers)
  await importTable('project_members', projectMembers)

  // Import invoices
  console.log('\n--- Importing invoices ---')
  const transInvoices = loadJson(TRANS_DIR, 'invoices.json')
  await importTable('invoices', transInvoices)

  // Import invoice_lines
  console.log('\n--- Importing invoice_lines ---')
  const transInvoiceLines = loadJson(TRANS_DIR, 'invoice_lines.json')
  await importTable('invoice_lines', transInvoiceLines)

  console.log('\n' + '='.repeat(60))
  console.log('Done!')
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
