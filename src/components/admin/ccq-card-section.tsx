'use client'

import { useState, useRef, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Upload, Trash2, FileImage, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { uploadCcqCard, deleteCcqCard, updateCcqCardInfo } from '@/app/(protected)/admin/actions'

interface CcqCardSectionProps {
  userId: string
  ccqCardNumber: string | null
  ccqCardExpiry: string | null
  ccqCardUrl: string | null
}

export function CcqCardSection({
  userId,
  ccqCardNumber,
  ccqCardExpiry,
  ccqCardUrl,
}: CcqCardSectionProps) {
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isUploading, startUpload] = useTransition()
  const [isDeleting, startDelete] = useTransition()
  const [isSaving, startSave] = useTransition()

  const [cardNumber, setCardNumber] = useState(ccqCardNumber ?? '')
  const [expiryDate, setExpiryDate] = useState(ccqCardExpiry ?? '')
  const [previewUrl, setPreviewUrl] = useState(ccqCardUrl)

  // Calculate status
  const getStatus = () => {
    if (!previewUrl) return 'missing'
    if (!expiryDate) return 'valid'
    const expiry = new Date(expiryDate)
    const today = new Date()
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntilExpiry < 0) return 'expired'
    if (daysUntilExpiry <= 30) return 'expiring_soon'
    return 'valid'
  }

  const status = getStatus()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      toast.error(t('ccq_card.invalid_file_type'))
      return
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('ccq_card.file_too_large'))
      return
    }

    // Upload
    const formData = new FormData()
    formData.append('file', file)

    startUpload(async () => {
      const result = await uploadCcqCard(userId, formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        setPreviewUrl(result.url ?? null)
        toast.success(t('ccq_card.upload_success'))
      }
    })

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDelete = () => {
    startDelete(async () => {
      const result = await deleteCcqCard(userId)
      if (result.error) {
        toast.error(result.error)
      } else {
        setPreviewUrl(null)
        toast.success(t('ccq_card.delete_success'))
      }
    })
  }

  const handleSaveInfo = () => {
    startSave(async () => {
      const result = await updateCcqCardInfo(userId, {
        cardNumber: cardNumber || null,
        expiryDate: expiryDate || null,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('ccq_card.info_saved'))
      }
    })
  }

  const StatusBadge = () => {
    switch (status) {
      case 'valid':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="mr-1 h-3 w-3" />
            {t('ccq_card.status_valid')}
          </Badge>
        )
      case 'expiring_soon':
        return (
          <Badge variant="default" className="bg-yellow-500">
            <Clock className="mr-1 h-3 w-3" />
            {t('ccq_card.status_expiring')}
          </Badge>
        )
      case 'expired':
        return (
          <Badge variant="destructive">
            <AlertCircle className="mr-1 h-3 w-3" />
            {t('ccq_card.status_expired')}
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary">
            <FileImage className="mr-1 h-3 w-3" />
            {t('ccq_card.status_missing')}
          </Badge>
        )
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('ccq_card.title')}</CardTitle>
            <CardDescription>{t('ccq_card.description')}</CardDescription>
          </div>
          <StatusBadge />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Card Image */}
        <div className="space-y-2">
          <Label>{t('ccq_card.card_image')}</Label>
          <div className="flex items-start gap-4">
            {previewUrl ? (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="CCQ Card"
                  className="h-32 w-auto rounded-lg border object-cover"
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -right-2 -top-2 h-6 w-6"
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('ccq_card.delete_confirm_title')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('ccq_card.delete_confirm_message')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{tCommon('actions.cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>
                        {t('ccq_card.delete_confirm')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : (
              <div className="flex h-32 w-48 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25">
                <FileImage className="h-8 w-8 text-muted-foreground/50" />
              </div>
            )}

            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {previewUrl ? t('ccq_card.replace_image') : t('ccq_card.upload_image')}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t('ccq_card.file_requirements')}
              </p>
            </div>
          </div>
        </div>

        {/* Card Details */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ccq_card_number">{t('ccq_card.card_number')}</Label>
            <Input
              id="ccq_card_number"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              placeholder={t('ccq_card.card_number_placeholder')}
              maxLength={20}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ccq_card_expiry">{t('ccq_card.expiry_date')}</Label>
            <Input
              id="ccq_card_expiry"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>
        </div>

        {/* Save Info Button */}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={handleSaveInfo}
            disabled={isSaving}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('ccq_card.save_info')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
