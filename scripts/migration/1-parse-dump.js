/**
 * Script 1: Parse MySQL SQL Dump
 *
 * Reads the SQLyog dump file and extracts INSERT statements into JSON files.
 * Handles latin1 → UTF-8 encoding conversion for French characters.
 *
 * Usage: npm run parse
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import iconv from 'iconv-lite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Tables to extract (in order they appear in dump)
const TABLES_TO_EXTRACT = [
  'apprights',
  'clients',
  'contacts',
  'expensedetails',
  'expenses',
  'expensestype',
  'invoices',
  'notes',
  'projectroles',
  'projects',
  'projectuserrole',
  'tasks',
  'timesheetdetails',
  'timesheets',
  'users',
  'usertypes',
  'usertypesrights',
]

// Path to SQL dump
const SQL_DUMP_PATH = process.env.SQL_DUMP_PATH ||
  'C:/Users/imxpe/xperr lifeos/GrandCanyon/DB/si-gc.sql'

/**
 * Parse a single value from the VALUES clause
 * Handles: 'string', NULL, numbers, dates
 */
function parseValue(valueStr) {
  const trimmed = valueStr.trim()

  // NULL value
  if (trimmed === 'NULL') {
    return null
  }

  // String value (single quoted)
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    // Remove quotes and unescape
    let str = trimmed.slice(1, -1)
    // Unescape escaped single quotes
    str = str.replace(/''/g, "'")
    // Unescape backslash escapes
    str = str.replace(/\\'/g, "'")
    str = str.replace(/\\"/g, '"')
    str = str.replace(/\\\\/g, '\\')
    str = str.replace(/\\n/g, '\n')
    str = str.replace(/\\r/g, '\r')
    str = str.replace(/\\t/g, '\t')
    return str
  }

  // Number (integer or decimal)
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return trimmed.includes('.') ? parseFloat(trimmed) : parseInt(trimmed, 10)
  }

  // Fallback: return as string
  return trimmed
}

/**
 * Parse a row of values: (val1,val2,val3,...)
 * Handles quoted strings that may contain commas or parentheses
 */
function parseValuesRow(rowStr) {
  const values = []
  let current = ''
  let inString = false
  let escaped = false

  // Remove leading/trailing parentheses
  const content = rowStr.trim().slice(1, -1)

  for (let i = 0; i < content.length; i++) {
    const char = content[i]

    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === '\\') {
      current += char
      escaped = true
      continue
    }

    if (char === "'" && !escaped) {
      inString = !inString
      current += char
      continue
    }

    if (char === ',' && !inString) {
      values.push(parseValue(current))
      current = ''
      continue
    }

    current += char
  }

  // Don't forget the last value
  if (current.length > 0) {
    values.push(parseValue(current))
  }

  return values
}

/**
 * Parse all value rows from VALUES clause
 * Format: values (v1,v2),(v1,v2),(v1,v2);
 */
function parseAllValueRows(valuesStr) {
  const rows = []
  let current = ''
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i]

    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === '\\') {
      current += char
      escaped = true
      continue
    }

    if (char === "'" && !escaped) {
      inString = !inString
      current += char
      continue
    }

    if (!inString) {
      if (char === '(') {
        depth++
        current += char
        continue
      }

      if (char === ')') {
        depth--
        current += char

        // End of a row
        if (depth === 0 && current.trim().length > 0) {
          rows.push(parseValuesRow(current.trim()))
          current = ''
        }
        continue
      }

      // Skip commas between rows (when depth is 0)
      if (char === ',' && depth === 0) {
        continue
      }
    }

    current += char
  }

  return rows
}

/**
 * Parse column names from INSERT statement
 * Format: `col1`,`col2`,`col3`
 */
function parseColumnNames(columnsStr) {
  return columnsStr
    .split(',')
    .map(col => col.trim().replace(/`/g, ''))
}

/**
 * Parse an INSERT statement
 * Format: insert  into `tablename`(`col1`,`col2`) values (v1,v2),(v1,v2);
 */
function parseInsertStatement(line) {
  // Match: insert into `tablename`(`columns`) values (...)
  const match = line.match(
    /insert\s+into\s+`(\w+)`\s*\(([^)]+)\)\s*values\s*(.*);?$/i
  )

  if (!match) {
    return null
  }

  const tableName = match[1]
  const columnsStr = match[2]
  let valuesStr = match[3]

  // Remove trailing semicolon if present
  if (valuesStr.endsWith(';')) {
    valuesStr = valuesStr.slice(0, -1)
  }

  const columns = parseColumnNames(columnsStr)
  const rows = parseAllValueRows(valuesStr)

  // Convert rows to objects using column names
  const records = rows.map(row => {
    const obj = {}
    columns.forEach((col, idx) => {
      obj[col] = row[idx] !== undefined ? row[idx] : null
    })
    return obj
  })

  return {
    tableName,
    columns,
    records,
  }
}

/**
 * Main function to parse the SQL dump
 */
async function main() {
  console.log('='.repeat(60))
  console.log('Grand Canyon Migration - Step 1: Parse SQL Dump')
  console.log('='.repeat(60))
  console.log(`\nSource: ${SQL_DUMP_PATH}`)

  // Check if dump file exists
  if (!fs.existsSync(SQL_DUMP_PATH)) {
    console.error(`\nERROR: SQL dump file not found at ${SQL_DUMP_PATH}`)
    console.error('Set SQL_DUMP_PATH environment variable or check the path.')
    process.exit(1)
  }

  // Read file as binary buffer, decode as latin1
  console.log('\nReading SQL dump file...')
  const buffer = fs.readFileSync(SQL_DUMP_PATH)
  const content = iconv.decode(buffer, 'latin1')
  console.log(`File size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`)

  // Create output directories
  const rawDir = path.join(__dirname, 'data', 'raw')
  if (!fs.existsSync(rawDir)) {
    fs.mkdirSync(rawDir, { recursive: true })
  }

  // Split content into lines
  const lines = content.split('\n')
  console.log(`Total lines: ${lines.length.toLocaleString()}`)

  // Track results
  const results = {}
  let insertLines = 0

  // Process each line
  console.log('\nParsing INSERT statements...\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Skip empty lines and comments
    if (!line || line.startsWith('/*') || line.startsWith('--')) {
      continue
    }

    // Check for INSERT statements
    if (line.toLowerCase().startsWith('insert')) {
      insertLines++
      const parsed = parseInsertStatement(line)

      if (parsed && TABLES_TO_EXTRACT.includes(parsed.tableName)) {
        // Accumulate records for this table
        if (!results[parsed.tableName]) {
          results[parsed.tableName] = []
        }
        results[parsed.tableName].push(...parsed.records)
      }
    }
  }

  // Write results to JSON files
  console.log('Writing JSON files...\n')
  console.log('-'.repeat(50))
  console.log('Table'.padEnd(25) + 'Records'.padStart(15))
  console.log('-'.repeat(50))

  let totalRecords = 0

  for (const [tableName, records] of Object.entries(results)) {
    const outputPath = path.join(rawDir, `${tableName}.json`)
    fs.writeFileSync(outputPath, JSON.stringify(records, null, 2))
    console.log(tableName.padEnd(25) + records.length.toString().padStart(15))
    totalRecords += records.length
  }

  console.log('-'.repeat(50))
  console.log('TOTAL'.padEnd(25) + totalRecords.toString().padStart(15))
  console.log('-'.repeat(50))

  // Log any tables that weren't found
  const missingTables = TABLES_TO_EXTRACT.filter(t => !results[t])
  if (missingTables.length > 0) {
    console.log('\nTables not found in dump:')
    missingTables.forEach(t => console.log(`  - ${t}`))
  }

  console.log(`\n${insertLines} INSERT statements processed`)
  console.log(`Output directory: ${rawDir}`)
  console.log('\nParsing complete!')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
