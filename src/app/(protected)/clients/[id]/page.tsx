import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Pencil,
  FolderOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { ContactList } from '@/components/clients/contact-list'
import { getClient } from '../actions'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { provinces } from '@/lib/validations/client'
import type { Enums } from '@/types/database'

type ProjectStatus = Enums<'project_status'>

interface ClientProject {
  id: string
  code: string
  name: string
  status: ProjectStatus
}

interface ClientDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const { id } = await params
  const [client, permissions] = await Promise.all([getClient(id), getUserPermissions()])

  if (!client) {
    notFound()
  }

  const canEdit = hasPermission(permissions, 'clients.edit')

  const getProvinceName = (code: string | null) => {
    if (!code) return null
    return provinces.find((p) => p.value === code)?.label ?? code
  }

  const formatAddress = (prefix: 'postal' | 'billing') => {
    const line1 = prefix === 'postal' ? client.postal_address_line1 : client.billing_address_line1
    const line2 = prefix === 'postal' ? client.postal_address_line2 : client.billing_address_line2
    const city = prefix === 'postal' ? client.postal_city : client.billing_city
    const province = prefix === 'postal' ? client.postal_province : client.billing_province
    const postalCode = prefix === 'postal' ? client.postal_code : client.billing_postal_code

    if (!line1 && !city) return null

    const parts = [line1, line2, city && province ? `${city}, ${province}` : city || province, postalCode].filter(
      Boolean
    )

    return parts.join('\n')
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/clients">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-semibold text-muted-foreground">
                {client.code}
              </span>
            </div>
            <h1 className="text-2xl font-bold">{client.name}</h1>
            {client.short_name !== client.name && (
              <p className="text-muted-foreground">{client.short_name}</p>
            )}
          </div>
        </div>
        {canEdit && (
          <Button asChild>
            <Link href={`/clients/${client.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Client
            </Link>
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="contacts">
            Contacts ({client.contacts?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="projects">
            Projects ({client.projects?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {client.general_email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`mailto:${client.general_email}`}
                      className="text-primary hover:underline"
                    >
                      {client.general_email}
                    </a>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${client.phone}`} className="hover:underline">
                      {client.phone}
                    </a>
                  </div>
                )}
                {client.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={client.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {client.website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
                {!client.general_email && !client.phone && !client.website && (
                  <p className="text-sm text-muted-foreground">No contact information</p>
                )}
              </CardContent>
            </Card>

            {/* Tax Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Tax Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span>GST (5%)</span>
                  <Badge variant={client.charges_gst ? 'default' : 'secondary'}>
                    {client.charges_gst ? 'Charged' : 'Not Charged'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>QST (9.975%)</span>
                  <Badge variant={client.charges_qst ? 'default' : 'secondary'}>
                    {client.charges_qst ? 'Charged' : 'Not Charged'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-muted-foreground">Next Project #</span>
                  <span className="font-mono">{client.next_project_number ?? 1}</span>
                </div>
              </CardContent>
            </Card>

            {/* Postal Address */}
            <Card>
              <CardHeader>
                <CardTitle>Postal Address</CardTitle>
              </CardHeader>
              <CardContent>
                {formatAddress('postal') ? (
                  <div className="flex gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    <address className="not-italic whitespace-pre-line">
                      {formatAddress('postal')}
                    </address>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No address</p>
                )}
              </CardContent>
            </Card>

            {/* Billing Address */}
            <Card>
              <CardHeader>
                <CardTitle>Billing Address</CardTitle>
                {client.billing_email && (
                  <CardDescription>
                    <a
                      href={`mailto:${client.billing_email}`}
                      className="text-primary hover:underline"
                    >
                      {client.billing_email}
                    </a>
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {formatAddress('billing') ? (
                  <div className="flex gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    <address className="not-italic whitespace-pre-line">
                      {formatAddress('billing')}
                    </address>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Same as postal address</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Notes */}
          {client.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{client.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts">
          <ContactList
            clientId={client.id}
            contacts={client.contacts ?? []}
            canEdit={canEdit}
          />
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Projects ({client.projects?.length ?? 0})</h3>
              {canEdit && (
                <Button size="sm" asChild>
                  <Link href={`/projects/new?client=${client.id}`}>
                    <FolderOpen className="mr-2 h-4 w-4" />
                    New Project
                  </Link>
                </Button>
              )}
            </div>

            {client.projects?.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">No projects yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {(client.projects as ClientProject[] | undefined)?.map((project) => (
                  <Card key={project.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{project.code}</span>
                          <StatusBadge status={project.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">{project.name}</p>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/projects/${project.id}`}>View</Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
