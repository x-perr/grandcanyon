'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Users,
  MoreHorizontal,
  Pencil,
  Key,
  UserCheck,
  UserX,
  Mail,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import type { UserWithRole } from '@/app/(protected)/admin/actions'
import { toggleUserActive, sendPasswordReset } from '@/app/(protected)/admin/actions'

interface UserListProps {
  users: UserWithRole[]
  roles: { id: string; name: string; description: string | null }[]
  totalCount: number
  currentPage: number
  pageSize: number
  searchQuery: string
  selectedRole?: string
  showInactive: boolean
}

export function UserList({
  users,
  roles,
  totalCount,
  currentPage,
  pageSize,
  searchQuery,
  selectedRole,
  showInactive,
}: UserListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(searchQuery)
  const [actionUser, setActionUser] = useState<UserWithRole | null>(null)
  const [actionType, setActionType] = useState<'toggle' | 'reset' | null>(null)
  const [isActioning, setIsActioning] = useState(false)

  const totalPages = Math.ceil(totalCount / pageSize)

  const updateSearch = (value: string) => {
    setSearch(value)

    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('search', value)
      } else {
        params.delete('search')
      }
      params.delete('page')
      startTransition(() => {
        router.push(`/admin/users?${params.toString()}`)
      })
    }, 300)

    return () => clearTimeout(timeout)
  }

  const updateRole = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set('role', value)
    } else {
      params.delete('role')
    }
    params.delete('page')
    startTransition(() => {
      router.push(`/admin/users?${params.toString()}`)
    })
  }

  const toggleInactive = (checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    if (checked) {
      params.set('inactive', 'true')
    } else {
      params.delete('inactive')
    }
    params.delete('page')
    startTransition(() => {
      router.push(`/admin/users?${params.toString()}`)
    })
  }

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    startTransition(() => {
      router.push(`/admin/users?${params.toString()}`)
    })
  }

  const handleToggleActive = async () => {
    if (!actionUser) return
    setIsActioning(true)
    try {
      const result = await toggleUserActive(actionUser.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(
          result.is_active
            ? t('users.activated_success')
            : t('users.deactivated_success')
        )
      }
    } catch {
      toast.error(t('users.toggle_error'))
    } finally {
      setIsActioning(false)
      setActionUser(null)
      setActionType(null)
    }
  }

  const handleSendPasswordReset = async () => {
    if (!actionUser) return
    setIsActioning(true)
    try {
      const result = await sendPasswordReset(actionUser.email)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('users.password_reset_sent', { email: actionUser.email }))
      }
    } catch {
      toast.error(t('users.password_reset_error'))
    } finally {
      setIsActioning(false)
      setActionUser(null)
      setActionType(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <SearchInput
            placeholder={t('users.search_placeholder')}
            value={search}
            onChange={updateSearch}
            className="w-full sm:w-64"
          />
          <Select value={selectedRole ?? 'all'} onValueChange={updateRole}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder={t('users.filter_role')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('users.all_roles')}</SelectItem>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={toggleInactive}
            />
            <label
              htmlFor="show-inactive"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {t('users.show_inactive')}
            </label>
          </div>
        </div>
      </div>

      {/* Table */}
      {users.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">{t('users.no_users')}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {searchQuery ? t('users.search_empty') : t('users.no_users_message')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tCommon('labels.name')}</TableHead>
                <TableHead className="hidden md:table-cell">{tCommon('labels.email')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('users.role')}</TableHead>
                <TableHead>{tCommon('labels.status')}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow
                  key={user.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/users/${user.id}`)}
                >
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {user.first_name} {user.last_name}
                      </div>
                      <div className="text-sm text-muted-foreground md:hidden">
                        {user.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {user.email}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {user.role?.name ?? '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? 'default' : 'secondary'}>
                      {user.is_active ? tCommon('status.active') : tCommon('status.inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">{tCommon('labels.actions')}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/users/${user.id}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {tCommon('actions.edit')}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setActionUser(user)
                            setActionType('reset')
                          }}
                        >
                          <Key className="mr-2 h-4 w-4" />
                          {t('users.send_password_reset')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setActionUser(user)
                            setActionType('toggle')
                          }}
                        >
                          {user.is_active ? (
                            <>
                              <UserX className="mr-2 h-4 w-4" />
                              {t('users.deactivate')}
                            </>
                          ) : (
                            <>
                              <UserCheck className="mr-2 h-4 w-4" />
                              {t('users.activate')}
                            </>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {tCommon('pagination.showing', {
              start: (currentPage - 1) * pageSize + 1,
              end: Math.min(currentPage * pageSize, totalCount),
              total: totalCount,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1 || isPending}
            >
              {tCommon('actions.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages || isPending}
            >
              {tCommon('actions.next')}
            </Button>
          </div>
        </div>
      )}

      {/* Toggle Active Dialog */}
      <Dialog open={actionType === 'toggle'} onOpenChange={() => setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionUser?.is_active ? t('users.deactivate_title') : t('users.activate_title')}
            </DialogTitle>
            <DialogDescription>
              {actionUser?.is_active
                ? t('users.deactivate_message', {
                    name: `${actionUser?.first_name} ${actionUser?.last_name}`,
                  })
                : t('users.activate_message', {
                    name: `${actionUser?.first_name} ${actionUser?.last_name}`,
                  })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)} disabled={isActioning}>
              {tCommon('actions.cancel')}
            </Button>
            <Button
              variant={actionUser?.is_active ? 'destructive' : 'default'}
              onClick={handleToggleActive}
              disabled={isActioning}
            >
              {isActioning
                ? tCommon('actions.loading')
                : actionUser?.is_active
                  ? t('users.deactivate')
                  : t('users.activate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={actionType === 'reset'} onOpenChange={() => setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.password_reset_title')}</DialogTitle>
            <DialogDescription>
              {t('users.password_reset_message', { email: actionUser?.email ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)} disabled={isActioning}>
              {tCommon('actions.cancel')}
            </Button>
            <Button onClick={handleSendPasswordReset} disabled={isActioning}>
              <Mail className="mr-2 h-4 w-4" />
              {isActioning ? tCommon('actions.loading') : t('users.send_email')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
