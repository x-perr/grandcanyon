# Grand Canyon - Manual Testing Guide

## Pre-Testing Setup

Before running tests, ensure you have:

1. **Three test users** with different roles:
   - Admin user (full access)
   - Project Manager user (approve timesheets/expenses)
   - Employee user (basic entry)

2. **Sample data**:
   - At least 2 clients
   - At least 3 projects (different statuses)
   - Users assigned to projects with billing roles

---

## Module Testing Checklists

### 1. Authentication

| Test | Expected Result | Pass |
|------|-----------------|------|
| Login with valid credentials | Dashboard loads | [ ] |
| Login with invalid credentials | Error message shown | [ ] |
| Logout | Redirects to login page | [ ] |
| Access protected route without auth | Redirects to login | [ ] |
| Session persists on refresh | Still logged in | [ ] |

### 2. Clients Module

| Test | Expected Result | Pass |
|------|-----------------|------|
| View client list | Shows all non-deleted clients | [ ] |
| Search clients by name | Filters list correctly | [ ] |
| Create new client | Client appears in list | [ ] |
| Edit existing client | Changes saved | [ ] |
| View client details | Shows tabs (Details, Contacts, Projects) | [ ] |
| Add client contact | Contact appears in list | [ ] |
| Edit client contact | Changes saved | [ ] |
| Delete client contact | Contact removed | [ ] |
| Tax settings (GST/QST) | Settings saved and affect invoices | [ ] |

### 3. Projects Module

| Test | Expected Result | Pass |
|------|-----------------|------|
| View project list | Shows projects | [ ] |
| Filter by status | Correct filtering | [ ] |
| Filter by client | Shows only client's projects | [ ] |
| Create project | Auto-generates code (CLIENT-001) | [ ] |
| Edit project details | Changes saved | [ ] |
| View project detail tabs | Details, Team, Tasks, Billing Roles | [ ] |
| Add team member | Member with billing role appears | [ ] |
| Remove team member | Member removed from project | [ ] |
| Add project task | Task with auto-code (T001) | [ ] |
| Edit project task | Changes saved | [ ] |
| Delete project task | Task removed | [ ] |
| Add billing role | Role with rate appears | [ ] |
| Edit billing role | Rate changes saved | [ ] |
| Delete billing role | Role removed | [ ] |

### 4. Timesheets Module

| Test | Expected Result | Pass |
|------|-----------------|------|
| View timesheet list | Shows own timesheets | [ ] |
| Navigate to current week | Week picker shows current week | [ ] |
| Navigate to previous week | Correct week loads | [ ] |
| Navigate to next week | Correct week loads | [ ] |
| Add time entry | Entry row appears | [ ] |
| Select project | Dropdown works | [ ] |
| Select task (optional) | Only project's tasks shown | [ ] |
| Select billing role | Only assigned roles shown | [ ] |
| Enter hours (Mon-Sun) | Numbers saved | [ ] |
| Edit existing entry | Changes saved | [ ] |
| Delete entry | Entry removed | [ ] |
| Copy from previous week | Entries duplicated | [ ] |
| Submit timesheet | Status changes to "Submitted" | [ ] |
| Cannot edit submitted | Inputs disabled | [ ] |

**Manager Testing:**

| Test | Expected Result | Pass |
|------|-----------------|------|
| View pending approvals | Shows team's submitted timesheets | [ ] |
| Approve timesheet | Status changes to "Approved" | [ ] |
| Reject timesheet | Status resets to "Draft" | [ ] |
| Cannot approve own | Button disabled/hidden | [ ] |

### 5. Invoices Module

| Test | Expected Result | Pass |
|------|-----------------|------|
| View invoice list | Shows invoices | [ ] |
| Filter by status | Correct filtering | [ ] |
| Filter by client | Shows only client's invoices | [ ] |
| Filter by year | Shows correct date range | [ ] |
| Summary cards | Correct totals displayed | [ ] |
| Create invoice - Select client | Project dropdown filters | [ ] |
| Create invoice - Select project | Shows uninvoiced approved entries | [ ] |
| Select entries to invoice | Checkboxes work | [ ] |
| Add manual line item | Line appears | [ ] |
| Tax calculation (GST/QST) | Correct amounts calculated | [ ] |
| Review step | Totals correct | [ ] |
| Create invoice | Invoice appears in list as "Draft" | [ ] |
| View invoice details | All info displayed | [ ] |
| Edit draft invoice | Changes saved | [ ] |
| Download PDF | PDF downloads | [ ] |
| Send invoice | Status changes to "Sent" | [ ] |
| Send locks timesheets | Timesheet status = "Locked" | [ ] |
| Mark as paid | Status changes to "Paid" | [ ] |
| Cancel invoice | Status changes to "Void" | [ ] |
| Delete draft | Invoice removed | [ ] |

### 6. Expenses Module

| Test | Expected Result | Pass |
|------|-----------------|------|
| View expense list | Shows own expenses | [ ] |
| Navigate by week | Week navigation works | [ ] |
| Add expense entry | Entry dialog opens | [ ] |
| Select expense type | Types dropdown works | [ ] |
| Select project | Projects dropdown works | [ ] |
| Enter quantity, unit price | Numbers saved | [ ] |
| Tax calculation | Auto-calculates with GST/QST | [ ] |
| Mark as billable | Billable flag saved | [ ] |
| Edit expense entry | Changes saved | [ ] |
| Delete expense entry | Entry removed | [ ] |
| Submit for approval | Status changes to "Submitted" | [ ] |
| Copy from previous week | Entries duplicated | [ ] |

**Manager Testing:**

| Test | Expected Result | Pass |
|------|-----------------|------|
| View pending expense approvals | Shows team's submitted expenses | [ ] |
| Approve expense | Status changes to "Approved" | [ ] |
| Reject expense | Status resets to "Draft" | [ ] |

### 7. Reports Module

| Test | Expected Result | Pass |
|------|-----------------|------|
| Timesheet report filters | Date range, project, user filters work | [ ] |
| Timesheet report data | Hours totals correct | [ ] |
| Export timesheet CSV | File downloads | [ ] |
| Invoice report filters | Date range, client, status work | [ ] |
| Invoice aging buckets | 0-30, 31-60, 61-90, 90+ days correct | [ ] |
| Export invoice CSV | File downloads | [ ] |
| Profitability report | Project P&L data correct | [ ] |
| Export profitability CSV | File downloads | [ ] |

### 8. Dashboard

| Test | Expected Result | Pass |
|------|-----------------|------|
| Open timesheets count | Correct number | [ ] |
| Total hours (current period) | Correct sum | [ ] |
| Outstanding invoices amount | Correct total | [ ] |
| Active projects count | Correct number | [ ] |
| Recent activity feed | Shows recent timesheets/expenses/invoices | [ ] |

---

## Cross-Browser Testing

Test critical flows in:

| Browser | Login | Timesheet Entry | Invoice PDF | Pass |
|---------|-------|-----------------|-------------|------|
| Chrome (latest) | [ ] | [ ] | [ ] | [ ] |
| Firefox (latest) | [ ] | [ ] | [ ] | [ ] |
| Safari (latest) | [ ] | [ ] | [ ] | [ ] |
| Edge (latest) | [ ] | [ ] | [ ] | [ ] |

---

## Mobile Responsiveness

Test on mobile viewport (375px wide):

| Page | Readable | Usable | Pass |
|------|----------|--------|------|
| Login page | [ ] | [ ] | [ ] |
| Dashboard | [ ] | [ ] | [ ] |
| Client list | [ ] | [ ] | [ ] |
| Project detail | [ ] | [ ] | [ ] |
| Timesheet entry (week view) | [ ] | [ ] | [ ] |
| Invoice detail | [ ] | [ ] | [ ] |

---

## Performance Checks

| Check | Target | Pass |
|-------|--------|------|
| Dashboard load time | < 3 seconds | [ ] |
| Report generation | < 5 seconds | [ ] |
| PDF generation | < 10 seconds | [ ] |
| No console errors | 0 errors | [ ] |
| No memory leaks | Stable memory | [ ] |

---

## Security Checks

| Check | Expected Result | Pass |
|-------|-----------------|------|
| Cannot access other user's timesheets via URL | 403 or redirect | [ ] |
| Cannot modify approved timesheets via API | Error response | [ ] |
| Permission checks on all mutations | Unauthorized blocked | [ ] |
| No sensitive data in client-side code | API keys hidden | [ ] |
| RLS policies enforced | Cannot see other org data | [ ] |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA Tester | | | |
| Business Owner | | | |
