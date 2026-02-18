import { redirect } from 'next/navigation'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { ClientForm } from '@/components/clients/client-form'

export default async function NewClientPage() {
  const permissions = await getUserPermissions()

  if (!hasPermission(permissions, 'clients.edit')) {
    redirect('/clients')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Client</h1>
        <p className="text-muted-foreground">Add a new client to your system</p>
      </div>

      <ClientForm mode="create" />
    </div>
  )
}
