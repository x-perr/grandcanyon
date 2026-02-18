# Grand Canyon - Data Migration Guide

Migration guide from legacy MySQL to Supabase PostgreSQL.

## Overview

| Metric | Legacy | New |
|--------|--------|-----|
| Database | MySQL (latin1) | PostgreSQL (UTF-8) |
| Tables | 21 | 20 |
| Primary Keys | INT auto-increment | UUID |
| Auth | MD5 hashed passwords | Supabase Auth (bcrypt) |

### Estimated Data Volumes

| Table | Est. Records | Notes |
|-------|-------------|-------|
| users | ~50 | → profiles + auth.users |
| clients | ~100 | Direct migration |
| contacts | ~200 | → client_contacts |
| projects | ~500 | Direct migration |
| tasks | ~1,000 | → project_tasks |
| projectroles | ~1,500 | → project_billing_roles |
| projectuserrole | ~3,000 | → project_members |
| timesheets | ~5,000 | Direct migration |
| timesheetdetails | ~50,000 | 16 columns → 1 array |
| invoices | ~2,000 | Direct migration |
| expenses | ~1,000 | Direct migration |
| expensedetails | ~5,000 | → expense_entries |

---

## Key Transformations

### 1. ID Conversion (INT → UUID)

All legacy INT primary keys need UUID mapping:

```
Legacy: user_id = 1
New:    id = '550e8400-e29b-41d4-a716-446655440000'
```

Maintain lookup maps during migration for foreign key resolution.

### 2. Character Encoding (latin1 → UTF-8)

French characters may be corrupted in legacy MySQL:

```
Legacy: "Systèmes Intérieurs" (possibly corrupted)
New:    "Systèmes Intérieurs" (proper UTF-8)
```

Migration scripts handle charset conversion.

### 3. Timesheet Hours (16 columns → 1 array)

The most significant structural change:

```sql
-- Legacy: 16 separate DECIMAL columns
tsd_time1: 8.0, tsd_time2: 7.5, tsd_time3: 8.0, ...tsd_time16: 0

-- New: PostgreSQL NUMERIC array (7 elements = Mon-Sun)
hours: [8.0, 7.5, 8.0, 8.0, 7.5, 0, 0]
```

Legacy used 16 columns to support biweekly timesheets, but only used 7 (Mon-Sun).

### 4. Authentication (MD5 → Supabase Auth)

Legacy passwords cannot be migrated (MD5 is insecure). Options:

1. **Password Reset Flow** (Recommended)
   - Create Supabase Auth users programmatically
   - Send welcome email with password reset link
   - Users set new password on first login

2. **Manual Creation**
   - Create users in Supabase Dashboard
   - Manually communicate temporary passwords

---

## Table Mapping Reference

| Legacy Table | New Table | Notes |
|--------------|-----------|-------|
| `users` | `profiles` + `auth.users` | Split: auth separate from profile |
| `usertypes` | `roles` | Same structure |
| `apprights` | `permissions` | Same structure |
| `usertypesrights` | `role_permissions` | Same structure |
| `clients` | `clients` | Direct migration |
| `contacts` | `client_contacts` | Renamed |
| `projects` | `projects` | Added fields (billing_type enum) |
| `tasks` | `project_tasks` | Renamed |
| `projectroles` | `project_billing_roles` | Renamed |
| `projectuserrole` | `project_members` | Simplified |
| `timesheets` | `timesheets` | Same workflow |
| `timesheetdetails` | `timesheet_entries` | Hours restructured |
| `invoices` | `invoices` | Direct migration |
| (embedded) | `invoice_lines` | Extracted from invoices |
| `expenses` | `expenses` | Direct migration |
| `expensedetails` | `expense_entries` | Renamed |
| `expensestype` | `expense_types` | Same structure |
| `notes` | `project_notes` | Renamed |
| `attachments` | Supabase Storage | No longer in DB |
| `audit` | `audit_logs` | Simplified |
| `config` | `settings` | JSONB instead of text |

---

## Migration Scripts

### Directory Structure

Create this structure in the project:

```
scripts/migration/
├── 1-export-mysql.js      # Export legacy data to JSON
├── 2-transform-data.js    # Transform and map IDs
├── 3-import-supabase.js   # Import to Supabase
├── 4-verify-counts.js     # Verification script
├── package.json           # Script dependencies
└── data/                  # JSON export files (gitignored)
```

### package.json for Scripts

```json
{
  "name": "grandcanyon-migration",
  "type": "module",
  "dependencies": {
    "mysql2": "^3.6.0",
    "@supabase/supabase-js": "^2.96.0",
    "uuid": "^9.0.0",
    "dotenv": "^16.0.0"
  }
}
```

---

### Script 1: Export from MySQL

```javascript
// scripts/migration/1-export-mysql.js
import mysql from 'mysql2/promise'
import fs from 'fs'
import path from 'path'

const TABLES = [
  'users', 'usertypes', 'apprights', 'usertypesrights',
  'clients', 'contacts', 'projects', 'tasks',
  'projectroles', 'projectuserrole', 'timesheets',
  'timesheetdetails', 'invoices', 'expenses',
  'expensedetails', 'expensestype'
]

async function exportTable(connection, table) {
  const [rows] = await connection.query(`SELECT * FROM ${table}`)

  // Convert latin1 buffer fields to UTF-8 strings
  const cleaned = rows.map(row => {
    const obj = {}
    for (const [key, value] of Object.entries(row)) {
      if (Buffer.isBuffer(value)) {
        obj[key] = value.toString('latin1')
      } else if (value instanceof Date) {
        obj[key] = value.toISOString()
      } else {
        obj[key] = value
      }
    }
    return obj
  })

  const dataDir = path.join(import.meta.dirname, 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  fs.writeFileSync(
    path.join(dataDir, `${table}.json`),
    JSON.stringify(cleaned, null, 2)
  )

  console.log(`Exported ${cleaned.length} rows from ${table}`)
  return cleaned.length
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || 'grandcanyon',
    charset: 'latin1'
  })

  console.log('Connected to MySQL')

  let totalRows = 0
  for (const table of TABLES) {
    try {
      totalRows += await exportTable(connection, table)
    } catch (error) {
      console.error(`Error exporting ${table}:`, error.message)
    }
  }

  await connection.end()
  console.log(`\nExport complete: ${totalRows} total rows`)
}

main().catch(console.error)
```

---

### Script 2: Transform Data

```javascript
// scripts/migration/2-transform-data.js
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const dataDir = path.join(import.meta.dirname, 'data')

// ID mapping tables (old INT -> new UUID)
const idMaps = {
  users: new Map(),
  clients: new Map(),
  projects: new Map(),
  tasks: new Map(),
  billing_roles: new Map(),
  timesheets: new Map(),
  roles: new Map(),
  permissions: new Map(),
  expense_types: new Map(),
  expenses: new Map(),
}

function loadJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, filename)))
}

function saveJson(filename, data) {
  fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(data, null, 2))
  console.log(`Saved ${data.length} records to ${filename}`)
}

// Transform functions for each table
function transformRoles() {
  const legacy = loadJson('usertypes.json')

  const transformed = legacy.map(role => {
    const newId = uuidv4()
    idMaps.roles.set(role.ut_id, newId)

    return {
      id: newId,
      name: role.ut_name.toLowerCase().replace(/\s+/g, '_'),
      description: role.ut_name,
      created_at: new Date().toISOString(),
    }
  })

  saveJson('roles_new.json', transformed)
}

function transformUsers() {
  const legacy = loadJson('users.json')

  const transformed = legacy.map(user => {
    const newId = uuidv4()
    idMaps.users.set(user.user_id, newId)

    return {
      id: newId, // Will match auth.users.id
      first_name: user.user_fname || '',
      last_name: user.user_lname || '',
      email: user.user_email,
      phone: user.user_phone || null,
      role_id: idMaps.roles.get(user.user_utid) || null,
      is_active: user.user_active === '1' || user.user_active === 1,
      hourly_rate: user.user_rate ? parseFloat(user.user_rate) : null,
      created_at: new Date().toISOString(),
      legacy_id: user.user_id, // For debugging
    }
  })

  // Second pass: resolve manager_id
  legacy.forEach((legacyUser, index) => {
    if (legacyUser.user_managerid) {
      transformed[index].manager_id = idMaps.users.get(legacyUser.user_managerid) || null
    }
  })

  saveJson('profiles_new.json', transformed)
}

function transformClients() {
  const legacy = loadJson('clients.json')

  const transformed = legacy.map(client => {
    const newId = uuidv4()
    idMaps.clients.set(client.client_id, newId)

    return {
      id: newId,
      name: client.client_name,
      code: client.client_code || null,
      address: client.client_address || null,
      city: client.client_city || null,
      province: client.client_prov || 'QC',
      postal_code: client.client_postal || null,
      phone: client.client_phone || null,
      email: client.client_email || null,
      charges_gst: client.client_gst === '1' || client.client_gst === 1,
      charges_qst: client.client_qst === '1' || client.client_qst === 1,
      is_active: client.client_active === '1' || client.client_active === 1,
      created_at: new Date().toISOString(),
    }
  })

  saveJson('clients_new.json', transformed)
}

function transformProjects() {
  const legacy = loadJson('projects.json')

  const transformed = legacy.map(project => {
    const newId = uuidv4()
    idMaps.projects.set(project.proj_id, newId)

    return {
      id: newId,
      client_id: idMaps.clients.get(project.proj_clientid) || null,
      code: project.proj_code,
      name: project.proj_name,
      description: project.proj_desc || null,
      status: mapProjectStatus(project.proj_status),
      billing_type: 'hourly', // Default, adjust as needed
      start_date: project.proj_start || null,
      end_date: project.proj_end || null,
      budget_hours: project.proj_budget ? parseFloat(project.proj_budget) : null,
      is_active: project.proj_active === '1' || project.proj_active === 1,
      created_at: new Date().toISOString(),
    }
  })

  saveJson('projects_new.json', transformed)
}

function transformTasks() {
  const legacy = loadJson('tasks.json')

  const transformed = legacy.map(task => {
    const newId = uuidv4()
    idMaps.tasks.set(task.task_id, newId)

    return {
      id: newId,
      project_id: idMaps.projects.get(task.task_projid) || null,
      code: task.task_code,
      name: task.task_name,
      description: task.task_desc || null,
      is_billable: task.task_billable === '1' || task.task_billable === 1,
      is_active: task.task_active === '1' || task.task_active === 1,
      created_at: new Date().toISOString(),
    }
  })

  saveJson('project_tasks_new.json', transformed)
}

function transformBillingRoles() {
  const legacy = loadJson('projectroles.json')

  const transformed = legacy.map(role => {
    const newId = uuidv4()
    idMaps.billing_roles.set(role.pr_id, newId)

    return {
      id: newId,
      project_id: idMaps.projects.get(role.pr_projid) || null,
      name: role.pr_name,
      hourly_rate: role.pr_rate ? parseFloat(role.pr_rate) : 0,
      is_active: true,
      created_at: new Date().toISOString(),
    }
  })

  saveJson('project_billing_roles_new.json', transformed)
}

function transformTimesheets() {
  const legacy = loadJson('timesheets.json')

  const transformed = legacy.map(ts => {
    const newId = uuidv4()
    idMaps.timesheets.set(ts.ts_id, newId)

    return {
      id: newId,
      user_id: idMaps.users.get(ts.ts_userid) || null,
      week_start: ts.ts_weekof, // Should be Monday of the week
      status: mapTimesheetStatus(ts.ts_status),
      submitted_at: ts.ts_submitted || null,
      approved_at: ts.ts_approved || null,
      approved_by: ts.ts_approvedby ? idMaps.users.get(ts.ts_approvedby) : null,
      notes: ts.ts_notes || null,
      created_at: new Date().toISOString(),
    }
  })

  saveJson('timesheets_new.json', transformed)
}

function transformTimesheetEntries() {
  const legacy = loadJson('timesheetdetails.json')

  const transformed = legacy.map(entry => ({
    id: uuidv4(),
    timesheet_id: idMaps.timesheets.get(entry.tsd_tsid) || null,
    project_id: idMaps.projects.get(entry.tsd_projid) || null,
    task_id: entry.tsd_taskid ? idMaps.tasks.get(entry.tsd_taskid) : null,
    billing_role_id: entry.tsd_prid ? idMaps.billing_roles.get(entry.tsd_prid) : null,
    // Convert 16 columns to 7-element array (Mon-Sun)
    hours: [
      parseFloat(entry.tsd_time1) || 0,
      parseFloat(entry.tsd_time2) || 0,
      parseFloat(entry.tsd_time3) || 0,
      parseFloat(entry.tsd_time4) || 0,
      parseFloat(entry.tsd_time5) || 0,
      parseFloat(entry.tsd_time6) || 0,
      parseFloat(entry.tsd_time7) || 0,
    ],
    description: entry.tsd_desc || null,
    is_billable: entry.tsd_billable === '1' || entry.tsd_billable === 1,
    created_at: new Date().toISOString(),
  }))

  saveJson('timesheet_entries_new.json', transformed)
}

// Status mapping helpers
function mapProjectStatus(legacyStatus) {
  const statusMap = {
    'active': 'active',
    'completed': 'completed',
    'on hold': 'on_hold',
    'cancelled': 'cancelled',
  }
  return statusMap[legacyStatus?.toLowerCase()] || 'draft'
}

function mapTimesheetStatus(legacyStatus) {
  const statusMap = {
    'draft': 'draft',
    'submitted': 'submitted',
    'approved': 'approved',
    'rejected': 'rejected',
    'locked': 'locked',
  }
  return statusMap[legacyStatus?.toLowerCase()] || 'draft'
}

// Main execution
async function main() {
  console.log('Starting data transformation...\n')

  // Transform in order (respecting dependencies)
  transformRoles()
  transformUsers()
  transformClients()
  transformProjects()
  transformTasks()
  transformBillingRoles()
  transformTimesheets()
  transformTimesheetEntries()

  // TODO: Add remaining transforms
  // transformContacts()
  // transformProjectMembers()
  // transformInvoices()
  // transformExpenseTypes()
  // transformExpenses()
  // transformExpenseEntries()

  // Save ID maps for reference/debugging
  const idMapsObj = {}
  for (const [key, map] of Object.entries(idMaps)) {
    idMapsObj[key] = Object.fromEntries(map)
  }
  saveJson('_id_maps.json', [idMapsObj])

  console.log('\nTransformation complete!')
}

main().catch(console.error)
```

---

### Script 3: Import to Supabase

```javascript
// scripts/migration/3-import-supabase.js
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import 'dotenv/config'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const dataDir = path.join(import.meta.dirname, 'data')
const BATCH_SIZE = 100

function loadJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, filename)))
}

async function importTable(tableName, fileName) {
  const data = loadJson(fileName)

  if (data.length === 0) {
    console.log(`${tableName}: No records to import`)
    return 0
  }

  // Remove legacy_id field before import
  const cleanData = data.map(row => {
    const { legacy_id, ...rest } = row
    return rest
  })

  // Import in batches
  let imported = 0
  for (let i = 0; i < cleanData.length; i += BATCH_SIZE) {
    const batch = cleanData.slice(i, i + BATCH_SIZE)

    const { error } = await supabase
      .from(tableName)
      .insert(batch)

    if (error) {
      console.error(`Error importing ${tableName} batch ${i}:`, error.message)
      throw error
    }

    imported += batch.length
    console.log(`${tableName}: ${imported}/${cleanData.length}`)
  }

  return imported
}

async function createAuthUsers() {
  const profiles = loadJson('profiles_new.json')

  console.log('\nCreating auth users...')

  for (const profile of profiles) {
    try {
      // Create auth user with the same ID as profile
      const { data, error } = await supabase.auth.admin.createUser({
        id: profile.id, // Use same UUID
        email: profile.email,
        email_confirm: true,
        user_metadata: {
          first_name: profile.first_name,
          last_name: profile.last_name,
        },
      })

      if (error) {
        console.error(`Failed to create auth user for ${profile.email}:`, error.message)
      } else {
        console.log(`Created auth user: ${profile.email}`)
      }
    } catch (err) {
      console.error(`Exception for ${profile.email}:`, err.message)
    }
  }
}

async function main() {
  console.log('Starting Supabase import...\n')

  // 1. Create auth users first (they need password reset)
  await createAuthUsers()

  // 2. Import in order (respecting foreign keys)
  console.log('\nImporting tables...')

  const imports = [
    ['roles', 'roles_new.json'],
    ['profiles', 'profiles_new.json'],
    ['clients', 'clients_new.json'],
    ['projects', 'projects_new.json'],
    ['project_tasks', 'project_tasks_new.json'],
    ['project_billing_roles', 'project_billing_roles_new.json'],
    ['timesheets', 'timesheets_new.json'],
    ['timesheet_entries', 'timesheet_entries_new.json'],
    // Add more as transform scripts are completed
  ]

  for (const [table, file] of imports) {
    try {
      await importTable(table, file)
    } catch (error) {
      console.error(`Failed on ${table}. Stopping.`)
      break
    }
  }

  console.log('\nImport complete!')
  console.log('\nNEXT STEPS:')
  console.log('1. Send password reset emails to all users')
  console.log('2. Run verification script (4-verify-counts.js)')
  console.log('3. Spot-check French character encoding')
}

main().catch(console.error)
```

---

### Script 4: Verify Counts

```javascript
// scripts/migration/4-verify-counts.js
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import 'dotenv/config'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const dataDir = path.join(import.meta.dirname, 'data')

function loadJson(filename) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataDir, filename)))
  } catch {
    return []
  }
}

async function verifyTable(tableName, legacyFile) {
  const legacy = loadJson(legacyFile)
  const legacyCount = legacy.length

  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true })

  if (error) {
    return { table: tableName, legacy: legacyCount, new: 'ERROR', match: false }
  }

  return {
    table: tableName,
    legacy: legacyCount,
    new: count,
    match: legacyCount === count,
  }
}

async function main() {
  console.log('Verifying migration counts...\n')

  const checks = [
    ['roles', 'usertypes.json'],
    ['profiles', 'users.json'],
    ['clients', 'clients.json'],
    ['projects', 'projects.json'],
    ['project_tasks', 'tasks.json'],
    ['project_billing_roles', 'projectroles.json'],
    ['timesheets', 'timesheets.json'],
    ['timesheet_entries', 'timesheetdetails.json'],
  ]

  const results = []
  for (const [table, file] of checks) {
    const result = await verifyTable(table, file)
    results.push(result)
    const status = result.match ? '✓' : '✗'
    console.log(`${status} ${result.table}: ${result.legacy} → ${result.new}`)
  }

  const allMatch = results.every(r => r.match)
  console.log('\n' + (allMatch ? 'All counts match!' : 'SOME COUNTS DO NOT MATCH'))

  // Verify total hours match
  console.log('\nVerifying total hours...')

  const legacyDetails = loadJson('timesheetdetails.json')
  const legacyTotalHours = legacyDetails.reduce((sum, entry) => {
    let hours = 0
    for (let i = 1; i <= 7; i++) {
      hours += parseFloat(entry[`tsd_time${i}`]) || 0
    }
    return sum + hours
  }, 0)

  const { data: entries } = await supabase
    .from('timesheet_entries')
    .select('hours')

  const newTotalHours = entries?.reduce((sum, entry) => {
    return sum + (entry.hours?.reduce((h, v) => h + v, 0) || 0)
  }, 0) || 0

  console.log(`Legacy total hours: ${legacyTotalHours.toFixed(2)}`)
  console.log(`New total hours: ${newTotalHours.toFixed(2)}`)
  console.log(`Match: ${Math.abs(legacyTotalHours - newTotalHours) < 0.01 ? '✓' : '✗'}`)
}

main().catch(console.error)
```

---

## User Migration - Password Reset Flow

After importing users, send password reset emails:

```javascript
// scripts/migration/5-send-password-resets.js
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import 'dotenv/config'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const dataDir = path.join(import.meta.dirname, 'data')

async function main() {
  const profiles = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'profiles_new.json'))
  )

  console.log(`Sending password reset emails to ${profiles.length} users...\n`)

  for (const profile of profiles) {
    const { error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: profile.email,
    })

    if (error) {
      console.error(`Failed for ${profile.email}: ${error.message}`)
    } else {
      console.log(`Sent reset email to: ${profile.email}`)
    }

    // Rate limit: 1 per second
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  console.log('\nDone!')
}

main().catch(console.error)
```

---

## Verification Checklist

After migration, verify:

- [ ] User counts match (legacy users = new profiles)
- [ ] Client counts match
- [ ] Project counts match
- [ ] Timesheet counts match
- [ ] Total hours match (run aggregation query)
- [ ] Invoice totals match
- [ ] Expense totals match
- [ ] Random sample spot-checks (10 records per table)
- [ ] French characters display correctly ("Systèmes", "Québec")
- [ ] All FK relationships valid (no orphaned records)
- [ ] Users can log in via password reset

---

## Rollback Plan

Keep legacy MySQL running during validation period:

| Day | Action |
|-----|--------|
| Day 1 | Run migration |
| Days 2-7 | Parallel running, user validation |
| Day 8-13 | Production cutover, monitor |
| Day 14 | Archive legacy MySQL |

### Emergency Rollback

If critical issues found:

1. Stop new system access
2. Switch DNS/deployment back to legacy
3. Document issues for next attempt
4. Legacy remains source of truth

---

## Post-Migration Tasks

- [ ] Verify all users can log in
- [ ] Run full application test suite (docs/TESTING.md)
- [ ] Check report totals against legacy reports
- [ ] Archive legacy MySQL backup
- [ ] Update documentation
- [ ] Communicate changeover to users
