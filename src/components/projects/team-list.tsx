'use client'

import { useState } from 'react'
import { User, MoreHorizontal, Pencil, Trash2, Plus, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { Badge } from '@/components/ui/badge'
import { TeamMemberDialog } from './team-member-dialog'
import { removeTeamMemberAction } from '@/app/(protected)/projects/[id]/team/actions'

interface Member {
  id: string
  is_active: boolean | null
  created_at: string | null
  user: {
    id: string
    first_name: string
    last_name: string
    email: string
  } | null
  billing_role: {
    id: string
    name: string
    rate: number
  } | null
}

interface BillingRole {
  id: string
  name: string
  rate: number
}

interface UserOption {
  id: string
  first_name: string
  last_name: string
  email: string
}

interface TeamListProps {
  projectId: string
  members: Member[]
  billingRoles: BillingRole[]
  availableUsers: UserOption[]
  canEdit: boolean
}

export function TeamList({
  projectId,
  members,
  billingRoles,
  availableUsers,
  canEdit,
}: TeamListProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const memberToDelete = members.find((m) => m.id === deleteId)

  // Filter out users who are already members
  const memberUserIds = new Set(members.map((m) => m.user?.id).filter(Boolean))
  const usersNotInTeam = availableUsers.filter((u) => !memberUserIds.has(u.id))

  const handleEdit = (member: Member) => {
    setEditingMember(member)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setEditingMember(null)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      const result = await removeTeamMemberAction(projectId, deleteId)
      if (result?.error) {
        console.error(result.error)
      }
    } catch {
      console.error('Failed to remove team member')
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Team Members ({members.length})</h3>
        {canEdit && usersNotInTeam.length > 0 && (
          <Button size="sm" onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Member
          </Button>
        )}
      </div>

      {/* Member List */}
      {members.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <User className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">No team members assigned</p>
            {canEdit && usersNotInTeam.length > 0 && (
              <Button size="sm" variant="outline" className="mt-4" onClick={handleAdd}>
                <Plus className="mr-2 h-4 w-4" />
                Add First Member
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {members.map((member) => (
            <Card key={member.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {member.user?.first_name} {member.user?.last_name}
                      </span>
                      {!member.is_active && (
                        <Badge variant="secondary" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{member.user?.email}</p>
                    {member.billing_role && (
                      <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                        <DollarSign className="h-3.5 w-3.5" />
                        {member.billing_role.name} @ {formatCurrency(member.billing_role.rate)}/hr
                      </div>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(member)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Change Role
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteId(member.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Member Dialog */}
      <TeamMemberDialog
        projectId={projectId}
        member={editingMember}
        billingRoles={billingRoles}
        availableUsers={usersNotInTeam}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {memberToDelete?.user?.first_name}{' '}
              {memberToDelete?.user?.last_name} from this project?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
