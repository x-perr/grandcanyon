/**
 * Debug script to investigate missing users
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAW_DIR = path.join(__dirname, 'data', 'raw')
const TRANS_DIR = path.join(__dirname, 'data', 'transformed')

function loadJson(dir, filename) {
  return JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf8'))
}

const rawUsers = loadJson(RAW_DIR, 'users.json')
const authUsers = loadJson(TRANS_DIR, 'auth_users.json')
const profiles = loadJson(TRANS_DIR, 'profiles.json')

console.log('=== User Analysis ===')
console.log('Raw users:', rawUsers.length)
console.log('Generated auth_users:', authUsers.length)
console.log('Generated profiles:', profiles.length)
console.log('')

// Check raw user structure
console.log('Raw user sample fields:', Object.keys(rawUsers[0]))
console.log('')

// Find email field name
const emailField = rawUsers[0].usr_mail !== undefined ? 'usr_mail' : 'usr_email'
console.log('Email field:', emailField)
console.log('')

// Users without valid email
const usersNoEmail = rawUsers.filter(u => {
  const email = u[emailField]
  return !email || email.trim() === ''
})
console.log('Users without email:', usersNoEmail.length)

// Users with email
const usersWithEmail = rawUsers.filter(u => {
  const email = u[emailField]
  return email && email.trim() !== ''
})
console.log('Users with email:', usersWithEmail.length)
console.log('')

// Check if auth_users match
const authEmails = new Set(authUsers.map(u => u.email.toLowerCase()))
const usersWithEmailNotInAuth = usersWithEmail.filter(u => {
  const email = u[emailField].toLowerCase()
  return !authEmails.has(email)
})
console.log('Users with email but NOT in auth_users:', usersWithEmailNotInAuth.length)
if (usersWithEmailNotInAuth.length > 0) {
  console.log('Sample:', usersWithEmailNotInAuth.slice(0, 3).map(u => ({
    id: u.usr_id,
    email: u[emailField],
    name: `${u.usr_firstname} ${u.usr_lastname}`
  })))
}
console.log('')

// Duplicate emails in raw data?
const emailCounts = new Map()
rawUsers.forEach(u => {
  const email = u[emailField]
  if (email) {
    const lower = email.toLowerCase()
    emailCounts.set(lower, (emailCounts.get(lower) || 0) + 1)
  }
})
const duplicateEmails = [...emailCounts.entries()].filter(([_, count]) => count > 1)
console.log('Duplicate emails in raw data:', duplicateEmails.length)
if (duplicateEmails.length > 0) {
  console.log('Duplicates:', duplicateEmails.slice(0, 5))
}
