import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Receipt } from 'lucide-react'

export default function ExpensesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
        <p className="text-muted-foreground">
          Submit and track expense reports
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Coming Soon
          </CardTitle>
          <CardDescription>
            This feature is under development
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The expenses module will be available in the next release. You&apos;ll be able to
            submit expense reports, attach receipts, and track reimbursements.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
