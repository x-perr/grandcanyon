'use client'

import { useTranslations } from 'next-intl'
import { Check, X, Info } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import type { RoleWithPermissions } from '@/app/(protected)/admin/actions'

interface RolePermissionsMatrixProps {
  roles: RoleWithPermissions[]
  permissionsByCategory: Record<string, { id: string; code: string; description: string | null }[]>
}

export function RolePermissionsMatrix({
  roles,
  permissionsByCategory,
}: RolePermissionsMatrixProps) {
  const t = useTranslations('admin')

  // Build a map of role -> permission codes for quick lookup
  const rolePermissionMap = new Map<string, Set<string>>()
  for (const role of roles) {
    rolePermissionMap.set(
      role.id,
      new Set(role.permissions.map((p) => p.code))
    )
  }

  const hasPermission = (roleId: string, permissionCode: string): boolean => {
    return rolePermissionMap.get(roleId)?.has(permissionCode) ?? false
  }

  const categories = Object.keys(permissionsByCategory).sort()

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Legend */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('roles.legend')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded bg-green-100 dark:bg-green-900">
                  <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm">{t('roles.has_permission')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded bg-muted">
                  <X className="h-3 w-3 text-muted-foreground/50" />
                </div>
                <span className="text-sm">{t('roles.no_permission')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Permissions Matrix by Category */}
        {categories.map((category) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="outline" className="text-sm font-normal">
                  {category}
                </Badge>
              </CardTitle>
              <CardDescription>
                {t('roles.category_permissions', { count: permissionsByCategory[category].length })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">{t('roles.permission')}</TableHead>
                      {roles.map((role) => (
                        <TableHead key={role.id} className="text-center min-w-[100px]">
                          {role.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {permissionsByCategory[category].map((permission) => (
                      <TableRow key={permission.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {permission.code}
                            </code>
                            {permission.description && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">{permission.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        {roles.map((role) => (
                          <TableCell key={role.id} className="text-center">
                            {hasPermission(role.id, permission.code) ? (
                              <div className="flex justify-center">
                                <div className="flex h-6 w-6 items-center justify-center rounded bg-green-100 dark:bg-green-900">
                                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-center">
                                <div className="flex h-6 w-6 items-center justify-center rounded bg-muted">
                                  <X className="h-4 w-4 text-muted-foreground/30" />
                                </div>
                              </div>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Role Summary Cards */}
        <Card>
          <CardHeader>
            <CardTitle>{t('roles.summary')}</CardTitle>
            <CardDescription>{t('roles.summary_description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="rounded-lg border p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{role.name}</h3>
                    <Badge variant="secondary">
                      {role.permissions.length} {t('roles.permissions')}
                    </Badge>
                  </div>
                  {role.description && (
                    <p className="text-sm text-muted-foreground">
                      {role.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
