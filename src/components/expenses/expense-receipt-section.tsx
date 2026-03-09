'use client'

import { useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Trash2, FileImage, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
import { uploadExpenseReceipt, deleteExpenseReceipt } from '@/app/(protected)/expenses/actions'
import { toast } from 'sonner'
import type { useTranslations } from 'next-intl'

interface ExpenseReceiptSectionProps {
  entryId: string
  receiptUrl: string | null
  onReceiptUrlChange: (url: string | null) => void
  t: ReturnType<typeof useTranslations<'expenses'>>
}

export function ExpenseReceiptSection({
  entryId,
  receiptUrl,
  onReceiptUrlChange,
  t,
}: ExpenseReceiptSectionProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, startUpload] = useTransition()
  const [isDeleting, startDelete] = useTransition()

  const handleReceiptSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      toast.error(t('receipt.invalid_file_type'))
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('receipt.file_too_large'))
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    startUpload(async () => {
      const result = await uploadExpenseReceipt(entryId, formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        onReceiptUrlChange(result.url ?? null)
        toast.success(t('receipt.upload_success'))
        router.refresh()
      }
    })

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleReceiptDelete = () => {
    startDelete(async () => {
      const result = await deleteExpenseReceipt(entryId)
      if (result.error) {
        toast.error(result.error)
      } else {
        onReceiptUrlChange(null)
        toast.success(t('receipt.delete_success'))
        router.refresh()
      }
    })
  }

  return (
    <div className="grid gap-2">
      <Label>{t('receipt.image')}</Label>
      <div className="flex items-start gap-4">
        {receiptUrl ? (
          <div className="relative">
            <img
              src={receiptUrl}
              alt="Receipt"
              className="h-24 w-auto rounded-lg border object-cover"
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
                  <AlertDialogTitle>{t('receipt.delete_confirm_title')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('receipt.delete_confirm_message')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('entry.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReceiptDelete}>
                    {t('receipt.delete_confirm')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <div className="flex h-24 w-32 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25">
            <FileImage className="h-6 w-6 text-muted-foreground/50" />
          </div>
        )}

        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={handleReceiptSelect}
            disabled={isUploading}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {receiptUrl ? t('receipt.replace_image') : t('receipt.upload_image')}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t('receipt.file_requirements')}
          </p>
        </div>
      </div>
    </div>
  )
}
