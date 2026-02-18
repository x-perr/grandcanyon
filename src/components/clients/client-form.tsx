'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { provinces } from '@/lib/validations/client'
import { createClientAction, updateClientAction } from '@/app/(protected)/clients/actions'
import type { Tables } from '@/types/database'

type Client = Tables<'clients'>

interface ClientFormProps {
  client?: Client | null
  mode: 'create' | 'edit'
}

type FormState = { error?: string } | void

export function ClientForm({ client, mode }: ClientFormProps) {
  const action = mode === 'create'
    ? createClientAction
    : updateClientAction.bind(null, client?.id ?? '')

  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    async (_, formData) => {
      const result = await action(formData)
      return result
    },
    undefined
  )

  return (
    <form action={formAction} className="space-y-6">
      {/* Back link */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={client ? `/clients/${client.id}` : '/clients'}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to {client ? 'Client' : 'Clients'}
          </Link>
        </Button>
      </div>

      {/* Error display */}
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Client identification and contact details</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="code">Client Code *</Label>
            <Input
              id="code"
              name="code"
              placeholder="ACME"
              defaultValue={client?.code ?? ''}
              className="uppercase"
              required
              maxLength={10}
            />
            <p className="text-xs text-muted-foreground">2-10 uppercase letters/numbers</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="short_name">Short Name *</Label>
            <Input
              id="short_name"
              name="short_name"
              placeholder="Acme"
              defaultValue={client?.short_name ?? ''}
              required
              maxLength={50}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              name="name"
              placeholder="Acme Corporation Inc."
              defaultValue={client?.name ?? ''}
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="general_email">Email</Label>
            <Input
              id="general_email"
              name="general_email"
              type="email"
              placeholder="contact@acme.com"
              defaultValue={client?.general_email ?? ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="514-555-1234"
              defaultValue={client?.phone ?? ''}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              name="website"
              type="url"
              placeholder="https://www.acme.com"
              defaultValue={client?.website ?? ''}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tax Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Tax Settings</CardTitle>
          <CardDescription>Configure tax charging for this client</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="charges_gst"
              name="charges_gst"
              defaultChecked={client?.charges_gst ?? true}
            />
            <Label htmlFor="charges_gst" className="cursor-pointer">
              Charge GST (5%)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="charges_qst"
              name="charges_qst"
              defaultChecked={client?.charges_qst ?? true}
            />
            <Label htmlFor="charges_qst" className="cursor-pointer">
              Charge QST (9.975%)
            </Label>
          </div>
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="next_project_number">Next Project Number</Label>
            <Input
              id="next_project_number"
              name="next_project_number"
              type="number"
              min={1}
              defaultValue={client?.next_project_number ?? 1}
            />
          </div>
        </CardContent>
      </Card>

      {/* Postal Address */}
      <Card>
        <CardHeader>
          <CardTitle>Postal Address</CardTitle>
          <CardDescription>Main mailing address</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="postal_address_line1">Address Line 1</Label>
            <Input
              id="postal_address_line1"
              name="postal_address_line1"
              placeholder="123 Main Street"
              defaultValue={client?.postal_address_line1 ?? ''}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="postal_address_line2">Address Line 2</Label>
            <Input
              id="postal_address_line2"
              name="postal_address_line2"
              placeholder="Suite 100"
              defaultValue={client?.postal_address_line2 ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postal_city">City</Label>
            <Input
              id="postal_city"
              name="postal_city"
              placeholder="Montreal"
              defaultValue={client?.postal_city ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postal_province">Province</Label>
            <Select name="postal_province" defaultValue={client?.postal_province ?? ''}>
              <SelectTrigger>
                <SelectValue placeholder="Select province" />
              </SelectTrigger>
              <SelectContent>
                {provinces.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="postal_code">Postal Code</Label>
            <Input
              id="postal_code"
              name="postal_code"
              placeholder="H2X 1Y1"
              defaultValue={client?.postal_code ?? ''}
              className="uppercase"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postal_country">Country</Label>
            <Input
              id="postal_country"
              name="postal_country"
              defaultValue={client?.postal_country ?? 'Canada'}
            />
          </div>
        </CardContent>
      </Card>

      {/* Billing Address */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Address</CardTitle>
          <CardDescription>Address for invoices (leave empty to use postal address)</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="billing_address_line1">Address Line 1</Label>
            <Input
              id="billing_address_line1"
              name="billing_address_line1"
              placeholder="Same as postal if empty"
              defaultValue={client?.billing_address_line1 ?? ''}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="billing_address_line2">Address Line 2</Label>
            <Input
              id="billing_address_line2"
              name="billing_address_line2"
              defaultValue={client?.billing_address_line2 ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing_city">City</Label>
            <Input
              id="billing_city"
              name="billing_city"
              defaultValue={client?.billing_city ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing_province">Province</Label>
            <Select name="billing_province" defaultValue={client?.billing_province ?? ''}>
              <SelectTrigger>
                <SelectValue placeholder="Select province" />
              </SelectTrigger>
              <SelectContent>
                {provinces.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing_postal_code">Postal Code</Label>
            <Input
              id="billing_postal_code"
              name="billing_postal_code"
              className="uppercase"
              defaultValue={client?.billing_postal_code ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing_email">Billing Email</Label>
            <Input
              id="billing_email"
              name="billing_email"
              type="email"
              placeholder="billing@acme.com"
              defaultValue={client?.billing_email ?? ''}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>Internal notes about this client</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            id="notes"
            name="notes"
            rows={4}
            placeholder="Any special instructions or notes..."
            defaultValue={client?.notes ?? ''}
          />
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" asChild>
          <Link href={client ? `/clients/${client.id}` : '/clients'}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === 'create' ? 'Create Client' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
