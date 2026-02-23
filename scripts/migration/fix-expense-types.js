/**
 * Fix Expense Types Encoding
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Mapping of corrupted -> correct French text
const encodingFixes = [
  { wrong: "Ã©", correct: "é" },
  { wrong: "Ãª", correct: "ê" },
  { wrong: "Ã¨", correct: "è" },
  { wrong: "Ã ", correct: "à" },
  { wrong: "Ã®", correct: "î" },
  { wrong: "Ã´", correct: "ô" },
  { wrong: "Ã¢", correct: "â" },
  { wrong: "Ã»", correct: "û" },
  { wrong: "Ã§", correct: "ç" },
  { wrong: "Ã", correct: "É" },
]

function fixEncoding(text) {
  if (!text) return text
  let fixed = text
  for (const { wrong, correct } of encodingFixes) {
    fixed = fixed.replace(new RegExp(wrong, 'g'), correct)
  }
  return fixed
}

async function main() {
  console.log('='.repeat(60))
  console.log('Fix Expense Types Encoding')
  console.log('='.repeat(60))

  const { data: expTypes } = await supabase.from('expense_types').select('id, code, name')

  let fixed = 0
  for (const et of expTypes || []) {
    const fixedCode = fixEncoding(et.code)
    const fixedName = fixEncoding(et.name)

    if (fixedCode !== et.code || fixedName !== et.name) {
      console.log('  ' + et.code + ' -> ' + fixedCode)
      console.log('    ' + et.name + ' -> ' + fixedName)

      const { error } = await supabase
        .from('expense_types')
        .update({ code: fixedCode, name: fixedName })
        .eq('id', et.id)

      if (error) {
        console.log('    ERROR: ' + error.message)
      } else {
        fixed++
      }
    }
  }

  console.log('\nFixed: ' + fixed + ' expense types')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
