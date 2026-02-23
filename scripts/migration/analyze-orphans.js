/**
 * Analyze orphaned and duplicate records
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAW_DIR = path.join(__dirname, 'data', 'raw')

function loadJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(RAW_DIR, filename), 'utf8'))
}

const rawTimesheets = loadJson('timesheets.json')
const rawTsDetails = loadJson('timesheetdetails.json')
const rawUsers = loadJson('users.json')
const rawProjects = loadJson('projects.json')
const rawTasks = loadJson('tasks.json')

// Build lookup maps
const userById = new Map(rawUsers.map(u => [u.user_id, u]))
const projectById = new Map(rawProjects.map(p => [p.proj_id, p]))
const taskById = new Map(rawTasks.map(t => [t.task_id, t]))

// 1. Find duplicate timesheet (same person + same week)
const byKey = new Map()
for (const ts of rawTimesheets) {
  const key = `${ts.ts_emplid}_${ts.ts_periodfrom}`
  if (!byKey.has(key)) byKey.set(key, [])
  byKey.get(key).push(ts)
}

console.log('='.repeat(70))
console.log('ISSUE 1: DUPLICATE TIMESHEETS (same person + same week)')
console.log('='.repeat(70))
let dupCount = 0
for (const [key, entries] of byKey) {
  if (entries.length > 1) {
    dupCount++
    const user = userById.get(entries[0].ts_emplid)
    console.log('')
    console.log(`Person: ${user ? user.user_fname + ' ' + user.user_lname : 'Unknown'} (user_id: ${entries[0].ts_emplid})`)
    console.log(`Week: ${entries[0].ts_periodfrom} to ${entries[0].ts_periodto}`)
    console.log('Duplicate records:')
    for (const ts of entries) {
      console.log(`  ts_id: ${ts.ts_id} | submitted: ${ts.ts_submitted} | approved: ${ts.ts_approved} | submittedon: ${ts.ts_submittedon || 'null'}`)
    }
  }
}
console.log('')
console.log(`Total duplicate groups: ${dupCount}`)

// 2. Find timesheet with missing user
console.log('')
console.log('='.repeat(70))
console.log('ISSUE 2: TIMESHEETS WITH MISSING USER')
console.log('='.repeat(70))
const userIds = new Set(rawUsers.map(u => u.user_id))
let missingUserCount = 0
for (const ts of rawTimesheets) {
  if (!userIds.has(ts.ts_emplid)) {
    missingUserCount++
    console.log('')
    console.log(`ts_id: ${ts.ts_id}`)
    console.log(`Missing user_id: ${ts.ts_emplid}`)
    console.log(`Week: ${ts.ts_periodfrom} to ${ts.ts_periodto}`)
    console.log(`Status: submitted=${ts.ts_submitted}, approved=${ts.ts_approved}`)

    // Check if any entries reference this timesheet
    const entriesForTs = rawTsDetails.filter(d => d.tsd_tsid === ts.ts_id)
    console.log(`Entries referencing this timesheet: ${entriesForTs.length}`)
    for (const e of entriesForTs) {
      const hours = [1,2,3,4,5,6,7].reduce((s, i) => s + (parseFloat(e[`tsd_time${i}`]) || 0), 0)
      const proj = projectById.get(e.tsd_projid)
      console.log(`  tsd_id: ${e.tsd_id}, project: ${proj ? proj.proj_code + ' - ' + proj.proj_name : e.tsd_projid}, hours: ${hours.toFixed(1)}`)
    }
  }
}
console.log('')
console.log(`Total timesheets with missing user: ${missingUserCount}`)

// 3. Find orphaned timesheet entries (entries referencing non-existent timesheets)
console.log('')
console.log('='.repeat(70))
console.log('ISSUE 3: ORPHANED TIMESHEET ENTRIES (reference non-existent timesheets)')
console.log('='.repeat(70))
const tsIds = new Set(rawTimesheets.map(ts => ts.ts_id))
let orphanCount = 0
for (const d of rawTsDetails) {
  if (!tsIds.has(d.tsd_tsid)) {
    orphanCount++
    const hours = [1,2,3,4,5,6,7].reduce((s, i) => s + (parseFloat(d[`tsd_time${i}`]) || 0), 0)
    const proj = projectById.get(d.tsd_projid)
    const task = taskById.get(d.tsd_taskid)

    console.log('')
    console.log(`Entry #${orphanCount}`)
    console.log(`  tsd_id: ${d.tsd_id}`)
    console.log(`  References non-existent ts_id: ${d.tsd_tsid}`)
    console.log(`  Project: ${proj ? proj.proj_code + ' - ' + proj.proj_name : d.tsd_projid}`)
    console.log(`  Task: ${task ? task.task_code + ' - ' + task.task_name : d.tsd_taskid || 'None'}`)
    console.log(`  Hours: [${[1,2,3,4,5,6,7].map(i => d[`tsd_time${i}`] || 0).join(', ')}] = ${hours.toFixed(1)} total`)
    console.log(`  Notes: ${d.tsd_notes || '(empty)'}`)
    console.log(`  Billable: ${d.tsd_billable}`)
  }
}
console.log('')
console.log(`Total orphaned entries: ${orphanCount}`)

// Summary
console.log('')
console.log('='.repeat(70))
console.log('SUMMARY')
console.log('='.repeat(70))
console.log(`1. Duplicate timesheets (same person + week): ${dupCount} groups`)
console.log(`2. Timesheets with missing user: ${missingUserCount}`)
console.log(`3. Orphaned timesheet entries: ${orphanCount}`)
console.log('')
console.log('These are data integrity issues in the LEGACY MySQL database.')
console.log('They cannot be imported because their parent records do not exist.')
