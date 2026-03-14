'use client'

import { useTranslations } from 'next-intl'
import { GraduationCap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  EmployeeClassification,
  EmployeeRateOverride,
  CcqTrade,
} from '@/types/billing'

interface ClassificationSectionProps {
  trade: CcqTrade | null
  currentClassification: EmployeeClassification | null
  classificationHistory: EmployeeClassification[]
  rateOverrides: EmployeeRateOverride[]
}

export function ClassificationSection({
  trade,
  currentClassification,
  classificationHistory,
  rateOverrides,
}: ClassificationSectionProps) {
  const t = useTranslations('admin')

  const tradeName = trade
    ? trade.name_en || trade.name_fr || trade.code
    : '-'

  const currentLevel = currentClassification?.classification
    ? currentClassification.classification.name_en ||
      currentClassification.classification.name_fr
    : '-'

  const currentLevelCode = currentClassification?.classification?.level ?? '-'

  return (
    <div className="space-y-4">
      {/* Current Classification Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            {t('billing.classificationTitle')}
          </CardTitle>
          <CardDescription>
            {t('billing.classificationDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">
                {t('billing.currentTrade')}
              </p>
              <p className="font-medium">{tradeName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('billing.currentLevel')}
              </p>
              <div className="flex items-center gap-2">
                <p className="font-medium">{currentLevel}</p>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  {currentLevelCode}
                </code>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('billing.ccqHours')}
              </p>
              <p className="font-medium">
                {currentClassification?.ccq_hours_accumulated ?? 0}h
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Classification History */}
      {classificationHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('billing.classificationHistory')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('billing.level')}</TableHead>
                  <TableHead>{t('billing.effectiveFrom')}</TableHead>
                  <TableHead>{t('billing.effectiveTo')}</TableHead>
                  <TableHead className="text-right">
                    {t('billing.ccqHours')}
                  </TableHead>
                  <TableHead>{t('billing.notes')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classificationHistory.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {entry.classification?.name_en ||
                            entry.classification?.name_fr ||
                            '-'}
                        </span>
                        {!entry.effective_to && (
                          <Badge variant="default" className="text-[10px]">
                            {t('billing.current')}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{entry.effective_from}</TableCell>
                    <TableCell>{entry.effective_to ?? '-'}</TableCell>
                    <TableCell className="text-right">
                      {entry.ccq_hours_accumulated}h
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {entry.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Active Rate Overrides */}
      {rateOverrides.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('billing.rateOverrides')}
            </CardTitle>
            <CardDescription>
              {t('billing.rateOverridesDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">
                    {t('billing.hourlyRate')}
                  </TableHead>
                  <TableHead>{t('billing.reason')}</TableHead>
                  <TableHead>{t('billing.effectiveFrom')}</TableHead>
                  <TableHead>{t('billing.effectiveTo')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rateOverrides.map((override) => (
                  <TableRow key={override.id}>
                    <TableCell className="text-right font-mono">
                      ${override.hourly_rate.toFixed(2)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {override.reason || '-'}
                    </TableCell>
                    <TableCell>{override.effective_from}</TableCell>
                    <TableCell>{override.effective_to ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
