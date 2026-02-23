import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAW_DIR = path.join(__dirname, 'data', 'raw')

const ts = JSON.parse(fs.readFileSync(path.join(RAW_DIR, 'timesheets.json'), 'utf8'))
console.log('Total timesheets:', ts.length)

const groups = new Map()
for (const t of ts) {
  const key = `${t.ts_emplid}_${t.ts_periodfrom}`
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(t)
}

const dups = [...groups.entries()].filter(([k, v]) => v.length > 1)
console.log('Total unique (user, week):', groups.size)
console.log('Duplicate groups:', dups.length)

// Show sample
if (dups.length > 0) {
  console.log('\nSample duplicates:')
  for (let i = 0; i < Math.min(5, dups.length); i++) {
    const [key, group] = dups[i]
    console.log(`  ${key}: ${group.length} timesheets (IDs: ${group.map(t => t.ts_id).join(', ')})`)
  }
}
