import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function check() {
  const { count } = await supabase.from('timesheet_entries').select('*', { count: 'exact', head: true })
  console.log('Database timesheet_entries count:', count)

  let total = 0
  let page = 0
  const pageSize = 1000

  while (true) {
    const { data } = await supabase
      .from('timesheet_entries')
      .select('hours')
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (!data || data.length === 0) break

    for (const e of data) {
      if (Array.isArray(e.hours)) {
        e.hours.forEach(h => { total += h || 0 })
      }
    }

    page++
    if (page % 10 === 0) console.log('Page', page, 'total so far:', total.toFixed(2))
  }

  console.log('Final total hours:', total.toFixed(2))
}

check()
