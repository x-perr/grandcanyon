'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, Receipt, FileText, CheckCircle, XCircle, Send, CreditCard } from 'lucide-react'
import type { ActivityItem } from '@/app/(protected)/dashboard/actions'

interface RecentActivityProps {
  activities: ActivityItem[]
}

export function RecentActivity({ activities }: RecentActivityProps) {
  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest updates from your team</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No recent activity to display.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest updates from your team</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-4">
            <div className="mt-1">
              {getActivityIcon(activity)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium">{activity.userName}</span>
                {' '}
                <span className="text-muted-foreground">{getActionVerb(activity.action)}</span>
                {' '}
                <span className="font-medium">{activity.entityLabel}</span>
              </p>
              <p className="text-xs text-muted-foreground">{activity.relativeTime}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function getActivityIcon(activity: ActivityItem) {
  const baseClasses = 'h-8 w-8 rounded-full flex items-center justify-center'

  switch (activity.action) {
    case 'submitted':
      return (
        <div className={`${baseClasses} bg-blue-100 dark:bg-blue-900`}>
          {activity.type === 'timesheet' && <Clock className="h-4 w-4 text-blue-600" />}
          {activity.type === 'expense' && <Receipt className="h-4 w-4 text-blue-600" />}
          {activity.type === 'invoice' && <FileText className="h-4 w-4 text-blue-600" />}
        </div>
      )
    case 'approved':
      return (
        <div className={`${baseClasses} bg-green-100 dark:bg-green-900`}>
          <CheckCircle className="h-4 w-4 text-green-600" />
        </div>
      )
    case 'rejected':
      return (
        <div className={`${baseClasses} bg-red-100 dark:bg-red-900`}>
          <XCircle className="h-4 w-4 text-red-600" />
        </div>
      )
    case 'sent':
      return (
        <div className={`${baseClasses} bg-yellow-100 dark:bg-yellow-900`}>
          <Send className="h-4 w-4 text-yellow-600" />
        </div>
      )
    case 'paid':
      return (
        <div className={`${baseClasses} bg-green-100 dark:bg-green-900`}>
          <CreditCard className="h-4 w-4 text-green-600" />
        </div>
      )
    default:
      return (
        <div className={`${baseClasses} bg-gray-100 dark:bg-gray-800`}>
          <FileText className="h-4 w-4 text-gray-600" />
        </div>
      )
  }
}

function getActionVerb(action: ActivityItem['action']): string {
  switch (action) {
    case 'submitted':
      return 'submitted'
    case 'approved':
      return 'approved'
    case 'rejected':
      return 'rejected'
    case 'sent':
      return 'sent'
    case 'paid':
      return 'marked as paid'
    default:
      return 'updated'
  }
}
