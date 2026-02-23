import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAW_DIR = path.join(__dirname, 'data', 'raw')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  // Get profiles
  const { data: profiles } = await supabase.from('profiles').select('id, email')
  const emailToProfileId = new Map()
  profiles?.forEach(p => {
    if (p.email) emailToProfileId.set(p.email.toLowerCase(), p.id)
  })
  console.log('Profiles:', profiles?.length)

  // Load raw users
  const rawUsers = JSON.parse(fs.readFileSync(path.join(RAW_DIR, 'users.json'), 'utf8'))
  console.log('Raw users:', rawUsers.length)

  // Map raw users to profiles
  const userIdToProfileId = new Map()
  const profileIdToRawUsers = new Map()

  for (const user of rawUsers) {
    let email = user.user_email?.trim()
    if (!email || !email.includes('@')) {
      email = `user_${user.user_id}@grandcanyon.local`
    }
    const profileId = emailToProfileId.get(email.toLowerCase())
    if (profileId) {
      userIdToProfileId.set(user.user_id, profileId)

      if (!profileIdToRawUsers.has(profileId)) {
        profileIdToRawUsers.set(profileId, [])
      }
      profileIdToRawUsers.get(profileId).push(user)
    }
  }

  console.log('Mapped users:', userIdToProfileId.size)

  // Find profiles with multiple raw users
  const multipleUsers = [...profileIdToRawUsers.entries()]
    .filter(([, users]) => users.length > 1)

  console.log('\nProfiles with multiple raw users:', multipleUsers.length)

  for (const [profileId, users] of multipleUsers.slice(0, 10)) {
    const profile = profiles?.find(p => p.id === profileId)
    console.log(`\n  Profile: ${profile?.email}`)
    for (const u of users) {
      console.log(`    - Raw ID ${u.user_id}: ${u.user_email || '(no email)'} - ${u.user_fname} ${u.user_lname}`)
    }
  }

  // Check timesheets for these profiles
  console.log('\n--- Timesheet Analysis ---')
  const rawTimesheets = JSON.parse(fs.readFileSync(path.join(RAW_DIR, 'timesheets.json'), 'utf8'))

  for (const [profileId, users] of multipleUsers.slice(0, 3)) {
    const profile = profiles?.find(p => p.id === profileId)
    console.log(`\nProfile: ${profile?.email}`)

    const rawUserIds = users.map(u => u.user_id)

    // Find timesheets for these raw users
    const userTimesheets = rawTimesheets.filter(ts => rawUserIds.includes(ts.ts_emplid))
    console.log(`  Total timesheets: ${userTimesheets.length}`)

    // Group by week
    const byWeek = new Map()
    for (const ts of userTimesheets) {
      if (!byWeek.has(ts.ts_periodfrom)) byWeek.set(ts.ts_periodfrom, [])
      byWeek.get(ts.ts_periodfrom).push(ts)
    }

    const duplicateWeeks = [...byWeek.entries()].filter(([, tss]) => tss.length > 1)
    console.log(`  Weeks with multiple timesheets: ${duplicateWeeks.length}`)

    // Show a sample
    if (duplicateWeeks.length > 0) {
      const [week, tss] = duplicateWeeks[0]
      console.log(`  Sample week ${week}:`)
      for (const ts of tss) {
        const rawUser = users.find(u => u.user_id === ts.ts_emplid)
        console.log(`    - TS ${ts.ts_id}: raw user ${ts.ts_emplid} (${rawUser?.user_email || rawUser?.user_fname})`)
      }
    }
  }
}

main().catch(console.error)
