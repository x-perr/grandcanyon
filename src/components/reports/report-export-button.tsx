'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateCSV, downloadCSV, type ColumnDefinition } from '@/lib/csv'
import { useTranslations } from 'next-intl'

interface ReportExportButtonProps<T extends Record<string, unknown>> {
  data: T[]
  columns: ColumnDefinition<T>[]
  filename: string
  disabled?: boolean
}

export function ReportExportButton<T extends Record<string, unknown>>({
  data,
  columns,
  filename,
  disabled = false,
}: ReportExportButtonProps<T>) {
  const t = useTranslations('reports.export')

  const handleExport = () => {
    if (data.length === 0) return

    const csvContent = generateCSV(data, columns)
    const date = new Date().toISOString().split('T')[0]
    downloadCSV(csvContent, `${filename}-${date}.csv`)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={disabled || data.length === 0}
    >
      <Download className="mr-2 h-4 w-4" />
      {t('csv')}
    </Button>
  )
}
