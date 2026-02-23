/**
 * Fix RÉNO-MAT client code specifically
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  // The correct code without the extra byte
  const correctCode = 'RÉNO-MAT'

  // Find the client with the corrupted code
  const { data } = await supabase.from('clients').select('id, code').ilike('code', '%NO-MAT%')

  for (const client of data || []) {
    if (client.code !== correctCode) {
      console.log('Fixing client:', client.id)
      console.log('  From:', JSON.stringify(client.code), 'chars:', [...client.code].map(c => c.charCodeAt(0)))
      console.log('  To:', JSON.stringify(correctCode), 'chars:', [...correctCode].map(c => c.charCodeAt(0)))

      const { error } = await supabase
        .from('clients')
        .update({ code: correctCode })
        .eq('id', client.id)

      if (error) {
        console.log('  Error:', error.message)
      } else {
        console.log('  Fixed!')
      }
    } else {
      console.log('Client already correct:', client.code)
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
