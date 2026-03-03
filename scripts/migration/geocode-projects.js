/**
 * Pre-geocode Project Addresses
 *
 * Geocodes all project addresses using OpenStreetMap Nominatim and stores
 * the lat/lng coordinates in the database. This eliminates the need for
 * client-side geocoding on every dashboard load.
 *
 * Usage: node geocode-projects.js
 *
 * Rate limiting: 1 request per second (Nominatim policy)
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

// Use NEXT_PUBLIC vars if service role not available
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  console.error('Either set these directly, or ensure NEXT_PUBLIC_SUPABASE_URL is available')
  process.exit(1)
}

const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Geocoding cache
const geocodeCache = new Map()

async function geocodeAddress(address) {
  if (geocodeCache.has(address)) {
    return geocodeCache.get(address)
  }

  try {
    // Add Quebec context for better results
    const searchAddress = `${address}, Quebec, Canada`
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddress)}&limit=1`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'GrandCanyonApp/1.0 (geocoding migration script)'
      }
    })

    if (!response.ok) {
      console.log(`    HTTP ${response.status} for: ${address}`)
      geocodeCache.set(address, null)
      return null
    }

    const data = await response.json()

    if (data && data.length > 0) {
      const result = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      }
      geocodeCache.set(address, result)
      return result
    }

    geocodeCache.set(address, null)
    return null
  } catch (error) {
    console.log(`    Error geocoding: ${error.message}`)
    geocodeCache.set(address, null)
    return null
  }
}

async function getAllProjects() {
  const projects = []
  let offset = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('projects')
      .select('id, code, address, city, lat, lng')
      // Geocode all non-deleted projects
      .is('deleted_at', null)
      .range(offset, offset + pageSize - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    projects.push(...data)
    offset += data.length
    if (data.length < pageSize) break
  }

  return projects
}

async function main() {
  console.log('='.repeat(60))
  console.log('Pre-Geocode Project Addresses')
  console.log('='.repeat(60))

  const projects = await getAllProjects()
  console.log(`\nTotal projects: ${projects.length}`)

  // Find projects that need geocoding
  const needsGeocoding = projects.filter(p =>
    (p.lat === null || p.lng === null) &&
    p.address &&
    p.address.trim() !== ''
  )

  const alreadyGeocoded = projects.filter(p =>
    p.lat !== null && p.lng !== null
  )

  console.log(`Already geocoded: ${alreadyGeocoded.length}`)
  console.log(`Need geocoding: ${needsGeocoding.length}`)

  if (needsGeocoding.length === 0) {
    console.log('\nAll projects already have coordinates!')
    return
  }

  console.log('\n--- Geocoding ---')
  console.log('(1 request per second to respect Nominatim rate limits)\n')

  let geocoded = 0
  let failed = 0

  for (let i = 0; i < needsGeocoding.length; i++) {
    const project = needsGeocoding[i]
    const fullAddress = project.city
      ? `${project.address}, ${project.city}`
      : project.address

    process.stdout.write(`[${i + 1}/${needsGeocoding.length}] ${project.code}: `)

    const coords = await geocodeAddress(fullAddress)

    if (coords) {
      // Update project with coordinates
      const { error } = await supabase
        .from('projects')
        .update({ lat: coords.lat, lng: coords.lng })
        .eq('id', project.id)

      if (error) {
        console.log(`DB error: ${error.message}`)
        failed++
      } else {
        console.log(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`)
        geocoded++
      }
    } else {
      console.log('NOT FOUND')
      failed++
    }

    // Rate limit: 1 request per second
    if (i < needsGeocoding.length - 1) {
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  console.log('\n--- Summary ---')
  console.log(`  Geocoded: ${geocoded}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Total with coords: ${alreadyGeocoded.length + geocoded}`)

  console.log('\n Done')
}

main().catch(console.error)
