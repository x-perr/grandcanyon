'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MapPin, Loader2 } from 'lucide-react'
import type { ProjectMapPin, EmployeeMapPin } from '@/app/(protected)/dashboard/actions'
import type { Icon } from 'leaflet'

interface MontrealMapProps {
  projects: ProjectMapPin[]
  employees: EmployeeMapPin[]
}

// Montreal center and bounds
const MONTREAL_CENTER: [number, number] = [45.5017, -73.5673]
const DEFAULT_ZOOM = 11

// Geocoding cache to avoid repeated API calls
const geocodeCache = new Map<string, { lat: number; lng: number } | null>()

// Geocode an address using OpenStreetMap Nominatim
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  // Check cache first
  if (geocodeCache.has(address)) {
    return geocodeCache.get(address) ?? null
  }

  try {
    // Add Montreal/Quebec context for better results
    const searchAddress = `${address}, Quebec, Canada`
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddress)}&limit=1`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'GrandCanyonApp/1.0'
      }
    })

    if (!response.ok) {
      geocodeCache.set(address, null)
      return null
    }

    const data = await response.json()

    if (data && data.length > 0) {
      const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
      geocodeCache.set(address, result)
      return result
    }

    geocodeCache.set(address, null)
    return null
  } catch {
    geocodeCache.set(address, null)
    return null
  }
}

// Dynamically import the map to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false, loading: () => <MapLoading /> }
)

const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
)

const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
)

const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
)

function MapLoading() {
  return (
    <div className="h-[400px] w-full rounded-lg bg-muted flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

// Custom marker icons - use useState + useEffect for proper client-side initialization
function useCustomIcons() {
  const [icons, setIcons] = useState<{ projectIcon: Icon; employeeIcon: Icon } | null>(null)

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require('leaflet')

    const projectIcon = new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    })

    const employeeIcon = new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    })

    setIcons({ projectIcon, employeeIcon })
  }, [])

  return icons
}

// Type for pins with resolved coordinates
type ResolvedProjectPin = ProjectMapPin & { resolvedLat: number; resolvedLng: number }
type ResolvedEmployeePin = EmployeeMapPin & { resolvedLat: number; resolvedLng: number }

function MapContent({ projects, employees }: MontrealMapProps) {
  const icons = useCustomIcons()
  const [resolvedProjects, setResolvedProjects] = useState<ResolvedProjectPin[]>([])
  const [resolvedEmployees, setResolvedEmployees] = useState<ResolvedEmployeePin[]>([])
  const [isGeocoding, setIsGeocoding] = useState(true)
  const geocodingDone = useRef(false)

  // Geocode pins that don't have coordinates
  const geocodePins = useCallback(async () => {
    if (geocodingDone.current) return
    geocodingDone.current = true

    const resolvedP: ResolvedProjectPin[] = []
    const resolvedE: ResolvedEmployeePin[] = []

    // Process projects
    for (const project of projects) {
      if (project.lat !== null && project.lng !== null) {
        resolvedP.push({ ...project, resolvedLat: project.lat, resolvedLng: project.lng })
      } else if (project.address) {
        const coords = await geocodeAddress(project.address)
        if (coords) {
          resolvedP.push({ ...project, resolvedLat: coords.lat, resolvedLng: coords.lng })
        }
        // Small delay to respect Nominatim rate limits
        await new Promise(r => setTimeout(r, 200))
      }
    }

    // Process employees
    for (const employee of employees) {
      if (employee.lat !== null && employee.lng !== null) {
        resolvedE.push({ ...employee, resolvedLat: employee.lat, resolvedLng: employee.lng })
      } else if (employee.address) {
        const coords = await geocodeAddress(employee.address)
        if (coords) {
          resolvedE.push({ ...employee, resolvedLat: coords.lat, resolvedLng: coords.lng })
        }
        await new Promise(r => setTimeout(r, 200))
      }
    }

    setResolvedProjects(resolvedP)
    setResolvedEmployees(resolvedE)
    setIsGeocoding(false)
  }, [projects, employees])

  // Add Leaflet CSS on client side
  useEffect(() => {
    const linkId = 'leaflet-css'
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link')
      link.id = linkId
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
      link.crossOrigin = ''
      document.head.appendChild(link)
    }
  }, [])

  // Geocode addresses on mount
  useEffect(() => {
    geocodePins()
  }, [geocodePins])

  if (!icons || isGeocoding) {
    return <MapLoading />
  }

  return (
    <MapContainer
      center={MONTREAL_CENTER}
      zoom={DEFAULT_ZOOM}
      style={{ height: '400px', width: '100%', borderRadius: '0.5rem' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Project markers (blue) */}
      {resolvedProjects.map((project) => (
        <Marker
          key={`project-${project.id}`}
          position={[project.resolvedLat, project.resolvedLng]}
          icon={icons.projectIcon}
        >
          <Popup>
            <div className="min-w-[150px]">
              <p className="font-semibold text-blue-700">{project.code}</p>
              <p className="text-sm">{project.name}</p>
              <p className="text-xs text-muted-foreground">{project.clientName}</p>
              {project.address && (
                <p className="text-xs text-muted-foreground mt-1">{project.address}</p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Employee markers (green) */}
      {resolvedEmployees.map((employee) => (
        <Marker
          key={`employee-${employee.id}`}
          position={[employee.resolvedLat, employee.resolvedLng]}
          icon={icons.employeeIcon}
        >
          <Popup>
            <div className="min-w-[120px]">
              <p className="font-semibold text-green-700">{employee.name}</p>
              {employee.address && (
                <p className="text-xs text-muted-foreground">{employee.address}</p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

export function MontrealMap({ projects, employees }: MontrealMapProps) {
  const t = useTranslations('dashboard.cards')

  // Has data if any project/employee has coordinates or an address
  const hasData = projects.length > 0 || employees.length > 0

  // Count items that can potentially be shown (have coords or address)
  const projectCount = projects.filter(p => p.lat !== null || p.address !== null).length
  const employeeCount = employees.filter(e => e.lat !== null || e.address !== null).length

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{t('map_title')}</CardTitle>
        <MapPin className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {hasData ? (
          <>
            <div className="flex gap-4 mb-3 text-xs">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <span>{t('projects_label', { count: projectCount })}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span>{t('employees_label', { count: employeeCount })}</span>
              </div>
            </div>
            <MapContent projects={projects} employees={employees} />
          </>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            <p>{t('no_locations')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
