'use client'

import { useActionState, useRef, useState, useTransition } from 'react'
import { Loader2, Upload, Trash2, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { provinces } from '@/lib/validations/client'
import {
  updateCompanySettings,
  uploadLogo,
  deleteLogo,
  type CompanyInfo,
} from '@/app/(protected)/admin/actions'

interface CompanySettingsFormProps {
  settings: CompanyInfo
}

type FormState = { error?: string } | void

export function CompanySettingsForm({ settings }: CompanySettingsFormProps) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    async (_, formData) => {
      const result = await updateCompanySettings(formData)
      if (result.error) {
        return result
      }
      toast.success('Settings saved successfully')
      return undefined
    },
    undefined
  )

  const [logoUrl, setLogoUrl] = useState<string | null>(settings.logoUrl ?? null)
  const [isUploadingLogo, startUploadTransition] = useTransition()
  const [isDeletingLogo, startDeleteTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    startUploadTransition(async () => {
      const formData = new FormData()
      formData.append('logo', file)
      const result = await uploadLogo(formData)
      if (result.error) {
        toast.error(result.error)
      } else if (result.logoUrl) {
        setLogoUrl(result.logoUrl)
        toast.success('Logo uploaded successfully')
      }
    })

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDeleteLogo = () => {
    startDeleteTransition(async () => {
      const result = await deleteLogo()
      if (result.error) {
        toast.error(result.error)
      } else {
        setLogoUrl(null)
        toast.success('Logo removed')
      }
    })
  }

  return (
    <form action={formAction} className="space-y-6">
      {/* Error display */}
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Information
          </CardTitle>
          <CardDescription>
            This information appears on invoices and other documents
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Company Name *</Label>
            <Input
              id="name"
              name="name"
              placeholder="Company Name Inc."
              defaultValue={settings.name}
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              name="address"
              placeholder="123 Main Street"
              defaultValue={settings.address ?? ''}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              name="city"
              placeholder="Montreal"
              defaultValue={settings.city ?? ''}
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="province">Province</Label>
            <Select name="province" defaultValue={settings.province ?? ''}>
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
            <Label htmlFor="postalCode">Postal Code</Label>
            <Input
              id="postalCode"
              name="postalCode"
              placeholder="H2X 1Y1"
              defaultValue={settings.postalCode ?? ''}
              className="uppercase"
              maxLength={20}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="514-555-1234"
              defaultValue={settings.phone ?? ''}
              maxLength={20}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="info@company.com"
              defaultValue={settings.email ?? ''}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tax Numbers */}
      <Card>
        <CardHeader>
          <CardTitle>Tax Registration Numbers</CardTitle>
          <CardDescription>
            These numbers appear in the footer of invoices
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="gstNumber">GST/TPS Number</Label>
            <Input
              id="gstNumber"
              name="gstNumber"
              placeholder="123456789 RT0001"
              defaultValue={settings.gstNumber ?? ''}
              maxLength={30}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qstNumber">QST/TVQ Number</Label>
            <Input
              id="qstNumber"
              name="qstNumber"
              placeholder="1234567890 TQ0001"
              defaultValue={settings.qstNumber ?? ''}
              maxLength={30}
            />
          </div>
        </CardContent>
      </Card>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle>Company Logo</CardTitle>
          <CardDescription>
            Logo appears on invoice PDFs. Upload PNG, JPG, or SVG (max 2MB).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6">
            {/* Logo preview */}
            <div className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed bg-muted/50">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Company logo"
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                <Building2 className="h-10 w-10 text-muted-foreground/50" />
              )}
            </div>

            {/* Upload controls */}
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={isUploadingLogo}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingLogo}
                >
                  {isUploadingLogo ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {logoUrl ? 'Replace' : 'Upload'} Logo
                </Button>
                {logoUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteLogo}
                    disabled={isDeletingLogo}
                    className="text-destructive hover:text-destructive"
                  >
                    {isDeletingLogo ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Recommended: Square logo, minimum 200x200 pixels
              </p>
            </div>
          </div>

          {/* Hidden input to pass logoUrl with form */}
          <input type="hidden" name="logoUrl" value={logoUrl ?? ''} />
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </form>
  )
}
