'use client'

import { useTranslations } from 'next-intl'
import { X, Clock, User, Globe, Monitor, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AuditLogWithUser } from '@/app/(protected)/admin/actions'
import type { Json } from '@/types/database'

interface AuditLogDetailProps {
  log: AuditLogWithUser
  onClose: () => void
}

export function AuditLogDetail({ log, onClose }: AuditLogDetailProps) {
  const t = useTranslations('admin')

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleString()
  }

  const getUserName = () => {
    if (!log.user) return t('logs.system_user')
    return `${log.user.first_name} ${log.user.last_name} (${log.user.email})`
  }

  const renderJsonValue = (value: Json | null | undefined) => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground italic">null</span>
    }
    if (typeof value === 'object') {
      return (
        <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-60">
          {JSON.stringify(value, null, 2)}
        </pre>
      )
    }
    return <span>{String(value)}</span>
  }

  const getChangedFields = () => {
    const oldValues = (log.old_values as Record<string, unknown>) || {}
    const newValues = (log.new_values as Record<string, unknown>) || {}
    const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)])

    const changes: { field: string; old: unknown; new: unknown }[] = []
    for (const key of allKeys) {
      const oldVal = oldValues[key]
      const newVal = newValues[key]
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({ field: key, old: oldVal, new: newVal })
      }
    }
    return changes
  }

  const changes = getChangedFields()

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('logs.detail.title')}
            <Badge variant="outline" className="ml-2">
              {t(`logs.actions.${log.action}` as any) || log.action}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Metadata */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                {t('logs.detail.metadata')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('logs.table.time')}:</span>
                <span>{formatDate(log.created_at)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('logs.table.user')}:</span>
                <span>{getUserName()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('logs.table.ip')}:</span>
                <span>{log.ip_address ?? '-'}</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <Monitor className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-muted-foreground">User Agent:</span>
                <span className="text-xs break-all">{log.user_agent ?? '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t('logs.table.entity')}:</span>
                <span>
                  {t(`logs.entities.${log.entity_type}` as any) || log.entity_type}
                  {log.entity_id && (
                    <span className="text-muted-foreground ml-1">
                      ({log.entity_id})
                    </span>
                  )}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Changes */}
          {changes.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  {t('logs.detail.changes')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {changes.map((change) => (
                    <div key={change.field} className="border-b pb-3 last:border-0 last:pb-0">
                      <div className="font-medium text-sm mb-2">{change.field}</div>
                      <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-start">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">
                            {t('logs.detail.previous')}
                          </div>
                          <div className="text-sm">
                            {change.old === undefined || change.old === null ? (
                              <span className="text-muted-foreground italic">-</span>
                            ) : typeof change.old === 'object' ? (
                              <pre className="text-xs bg-red-50 dark:bg-red-950/30 p-2 rounded text-red-700 dark:text-red-300 overflow-auto">
                                {JSON.stringify(change.old, null, 2)}
                              </pre>
                            ) : (
                              <span className="text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded">
                                {String(change.old)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center pt-5">
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">
                            {t('logs.detail.new')}
                          </div>
                          <div className="text-sm">
                            {change.new === undefined || change.new === null ? (
                              <span className="text-muted-foreground italic">-</span>
                            ) : typeof change.new === 'object' ? (
                              <pre className="text-xs bg-green-50 dark:bg-green-950/30 p-2 rounded text-green-700 dark:text-green-300 overflow-auto">
                                {JSON.stringify(change.new, null, 2)}
                              </pre>
                            ) : (
                              <span className="text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded">
                                {String(change.new)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Raw values (if no diff or for debugging) */}
          {changes.length === 0 && (log.old_values || log.new_values) && (
            <div className="grid grid-cols-2 gap-4">
              {log.old_values && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">
                      {t('logs.detail.previous')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderJsonValue(log.old_values)}
                  </CardContent>
                </Card>
              )}
              {log.new_values && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">
                      {t('logs.detail.new')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderJsonValue(log.new_values)}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
