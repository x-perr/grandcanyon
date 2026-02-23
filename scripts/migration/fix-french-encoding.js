/**
 * Fix French Character Encoding in Database
 *
 * Corrects mojibake (corrupted UTF-8) in client codes and names.
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
  // Client codes
  { wrong: "L'ArchevÃªque", correct: "L'Archevêque" },
  { wrong: "RÃNO-MAT", correct: "RÉNO-MAT" },
  { wrong: "DuprÃ©", correct: "Dupré" },
  { wrong: "GuÃ©rin", correct: "Guérin" },
  // Client names
  { wrong: "DUPRÃ CONSTRUCTION INC.", correct: "DUPRÉ CONSTRUCTION INC." },
  { wrong: "Les Lofts GuÃ©rin inc", correct: "Les Lofts Guérin inc" },
  { wrong: "Les Lofts GuÃ©rin ", correct: "Les Lofts Guérin" },
  // Common mojibake patterns
  { wrong: "Ã©", correct: "é" },
  { wrong: "Ãª", correct: "ê" },
  { wrong: "Ã¨", correct: "è" },
  { wrong: "Ã ", correct: "à" },
  { wrong: "Ã®", correct: "î" },
  { wrong: "Ã´", correct: "ô" },
  { wrong: "Ã¢", correct: "â" },
  { wrong: "Ã»", correct: "û" },
  { wrong: "Ã§", correct: "ç" },
  { wrong: "Ã", correct: "É" },  // Capital É
]

async function fetchAllPaginated(table, columns = '*') {
  const results = []
  let page = 0
  while (true) {
    const { data } = await supabase
      .from(table)
      .select(columns)
      .range(page * 1000, (page + 1) * 1000 - 1)
    if (!data || data.length === 0) break
    results.push(...data)
    if (data.length < 1000) break
    page++
  }
  return results
}

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
  console.log('Fix French Character Encoding')
  console.log('='.repeat(60))

  // Fix clients
  console.log('\n--- Fixing Clients ---')
  const clients = await fetchAllPaginated('clients', 'id, code, name')
  let clientsFixed = 0

  for (const client of clients) {
    const fixedCode = fixEncoding(client.code)
    const fixedName = fixEncoding(client.name)

    if (fixedCode !== client.code || fixedName !== client.name) {
      console.log(`  ${client.code} -> ${fixedCode}`)
      console.log(`    ${client.name} -> ${fixedName}`)

      const { error } = await supabase
        .from('clients')
        .update({ code: fixedCode, name: fixedName })
        .eq('id', client.id)

      if (error) {
        console.log(`    ERROR: ${error.message}`)
      } else {
        clientsFixed++
      }
    }
  }
  console.log(`  Fixed: ${clientsFixed} clients`)

  // Fix projects
  console.log('\n--- Fixing Projects ---')
  const projects = await fetchAllPaginated('projects', 'id, name, address, description')
  let projectsFixed = 0

  for (const project of projects) {
    const fixedName = fixEncoding(project.name)
    const fixedAddress = fixEncoding(project.address)
    const fixedDesc = fixEncoding(project.description)

    if (fixedName !== project.name || fixedAddress !== project.address || fixedDesc !== project.description) {
      console.log(`  ${project.name} -> ${fixedName}`)

      const { error } = await supabase
        .from('projects')
        .update({
          name: fixedName,
          address: fixedAddress,
          description: fixedDesc
        })
        .eq('id', project.id)

      if (!error) {
        projectsFixed++
      }
    }
  }
  console.log(`  Fixed: ${projectsFixed} projects`)

  // Fix people
  console.log('\n--- Fixing People ---')
  const people = await fetchAllPaginated('people', 'id, first_name, last_name')
  let peopleFixed = 0

  for (const person of people) {
    const fixedFirst = fixEncoding(person.first_name)
    const fixedLast = fixEncoding(person.last_name)

    if (fixedFirst !== person.first_name || fixedLast !== person.last_name) {
      console.log(`  ${person.first_name} ${person.last_name} -> ${fixedFirst} ${fixedLast}`)

      const { error } = await supabase
        .from('people')
        .update({ first_name: fixedFirst, last_name: fixedLast })
        .eq('id', person.id)

      if (!error) {
        peopleFixed++
      }
    }
  }
  console.log(`  Fixed: ${peopleFixed} people`)

  // Fix profiles
  console.log('\n--- Fixing Profiles ---')
  const profiles = await fetchAllPaginated('profiles', 'id, first_name, last_name')
  let profilesFixed = 0

  for (const profile of profiles) {
    const fixedFirst = fixEncoding(profile.first_name)
    const fixedLast = fixEncoding(profile.last_name)

    if (fixedFirst !== profile.first_name || fixedLast !== profile.last_name) {
      console.log(`  ${profile.first_name} ${profile.last_name} -> ${fixedFirst} ${fixedLast}`)

      const { error } = await supabase
        .from('profiles')
        .update({ first_name: fixedFirst, last_name: fixedLast })
        .eq('id', profile.id)

      if (!error) {
        profilesFixed++
      }
    }
  }
  console.log(`  Fixed: ${profilesFixed} profiles`)

  console.log('\n' + '='.repeat(60))
  console.log('Encoding Fix Complete!')
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
