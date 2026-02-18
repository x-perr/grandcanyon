import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock } from 'lucide-react'

export default function TimesheetsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Timesheets</h1>
        <p className="text-muted-foreground">
          Track and submit your weekly hours
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Coming Soon
          </CardTitle>
          <CardDescription>
            This feature is under development
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The timesheets module will be available in the next release. You&apos;ll be able to
            enter daily hours, submit timesheets for approval, and track time across projects.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
