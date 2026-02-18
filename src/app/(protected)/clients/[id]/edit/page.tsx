import { notFound, redirect } from 'next/navigation'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { getClient } from '../../actions'
import { ClientForm } from '@/components/clients/client-form'

interface EditClientPageProps {
  params: Promise<{ id: string }>
}

export default async function EditClientPage({ params }: EditClientPageProps) {
  const { id } = await params
  const permissions = await getUserPermissions()

  if (!hasPermission(permissions, 'clients.edit')) {
    redirect('/clients')
  }

  const client = await getClient(id)

  if (!client) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Client</h1>
        <p className="text-muted-foreground">Update client information for {client.name}</p>
      </div>

      <ClientForm client={client} mode="edit" />
    </div>
  )
}
