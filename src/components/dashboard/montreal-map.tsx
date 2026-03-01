'use client'

import { useEffect, useState } from 'react'
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

function MapContent({ projects, employees }: MontrealMapProps) {
  const icons = useCustomIcons()

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

  if (!icons) {
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
      {projects.map((project) => (
        <Marker
          key={`project-${project.id}`}
          position={[project.lat, project.lng]}
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
      {employees.map((employee) => (
        <Marker
          key={`employee-${employee.id}`}
          position={[employee.lat, employee.lng]}
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

  const hasData = projects.length > 0 || employees.length > 0

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
                <span>{t('projects_label', { count: projects.length })}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span>{t('employees_label', { count: employees.length })}</span>
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
