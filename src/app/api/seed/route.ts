import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMonday } from '@/lib/date'

export async function POST() {
  const supabase = await createClient()

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. Get or create test client
    let client
    const { data: existingClient } = await supabase
      .from('clients')
      .select()
      .eq('code', 'ACME')
      .single()

    if (existingClient) {
      client = existingClient
    } else {
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          code: 'ACME',
          name: 'Acme Corporation',
          short_name: 'Acme',
          billing_address_line1: '456 Client Street',
          billing_city: 'Montreal',
          billing_province: 'QC',
          billing_postal_code: 'H3Z 2Y2',
          billing_email: 'billing@acme.com',
          charges_gst: true,
          charges_qst: true,
        })
        .select()
        .single()
      if (clientError) throw clientError
      client = newClient
    }

    // 2. Get or create test project
    let project
    const { data: existingProject } = await supabase
      .from('projects')
      .select()
      .eq('code', 'ACME-001')
      .single()

    if (existingProject) {
      project = existingProject
    } else {
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          client_id: client.id,
          code: 'ACME-001',
          name: 'Phase 1 - Foundation',
          status: 'active',
          billing_type: 'hourly',
          hourly_rate: 150.0,
          start_date: '2026-01-01',
        })
        .select()
        .single()
      if (projectError) throw projectError
      project = newProject
    }

    // 3. Get or create billing role
    let billingRole
    const { data: existingRole } = await supabase
      .from('project_billing_roles')
      .select()
      .eq('project_id', project.id)
      .eq('name', 'Senior Developer')
      .single()

    if (existingRole) {
      billingRole = existingRole
    } else {
      const { data: newRole, error: brError } = await supabase
        .from('project_billing_roles')
        .insert({
          project_id: project.id,
          name: 'Senior Developer',
          rate: 150.0,
        })
        .select()
        .single()
      if (brError) throw brError
      billingRole = newRole
    }

    // 4. Add user to project team if not already
    const { data: existingMember } = await supabase
      .from('project_members')
      .select()
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single()

    if (!existingMember) {
      const { error: teamError } = await supabase.from('project_members').insert({
        project_id: project.id,
        user_id: user.id,
        billing_role_id: billingRole.id,
      })
      if (teamError) throw teamError
    }

    // 5. Get or create task
    let task
    const { data: existingTask } = await supabase
      .from('project_tasks')
      .select()
      .eq('project_id', project.id)
      .eq('code', 'T001')
      .single()

    if (existingTask) {
      task = existingTask
    } else {
      const { data: newTask, error: taskError } = await supabase
        .from('project_tasks')
        .insert({
          project_id: project.id,
          code: 'T001',
          name: 'Development Work',
        })
        .select()
        .single()
      if (taskError) throw taskError
      task = newTask
    }

    // 6. Create timesheet for last week if none exists
    const lastWeekMonday = getMonday(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    const weekStart = lastWeekMonday.toISOString().split('T')[0]
    const weekEnd = new Date(lastWeekMonday.getTime() + 6 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    let timesheet
    const { data: existingTimesheet } = await supabase
      .from('timesheets')
      .select()
      .eq('user_id', user.id)
      .eq('week_start', weekStart)
      .single()

    if (existingTimesheet) {
      timesheet = existingTimesheet
    } else {
      const { data: newTimesheet, error: tsError } = await supabase
        .from('timesheets')
        .insert({
          user_id: user.id,
          week_start: weekStart,
          week_end: weekEnd,
          status: 'approved',
          submitted_at: new Date().toISOString(),
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .select()
        .single()
      if (tsError) throw tsError
      timesheet = newTimesheet
    }

    // 7. Create timesheet entries if none exist
    const { data: existingEntries } = await supabase
      .from('timesheet_entries')
      .select()
      .eq('timesheet_id', timesheet.id)

    if (!existingEntries || existingEntries.length === 0) {
      const entries = []
      for (let i = 0; i < 5; i++) {
        const hours = [0, 0, 0, 0, 0, 0, 0]
        hours[i] = 8

        entries.push({
          timesheet_id: timesheet.id,
          project_id: project.id,
          task_id: task.id,
          billing_role_id: billingRole.id,
          hours,
          is_billable: true,
        })
      }

      const { error: entryError } = await supabase.from('timesheet_entries').insert(entries)
      if (entryError) throw entryError
    }

    return NextResponse.json({
      success: true,
      message: 'Test data ready',
      data: {
        client: { id: client.id, name: client.name },
        project: { id: project.id, name: project.name },
        timesheet: { id: timesheet.id, week: weekStart, status: timesheet.status },
        instruction: 'Go to /invoices/new to create an invoice',
      },
    })
  } catch (error) {
    console.error('Seed error:', error)
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : JSON.stringify(error)
    return NextResponse.json({ error: 'Failed to seed data', details: errorMessage }, { status: 500 })
  }
}
