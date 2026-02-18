# Grand Canyon

Modern timesheet and invoicing system for construction businesses.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth |
| UI | shadcn/ui + Tailwind CSS v4 |
| PDF | @react-pdf/renderer |
| Hosting | Vercel + Supabase Cloud |

## Features

- [x] **Authentication** - Role-based access control (Admin, Manager, Employee)
- [x] **Clients** - Client management with contacts & tax settings
- [x] **Projects** - Project tracking with team, tasks, billing roles
- [x] **Timesheets** - Weekly timesheet entry with approval workflow
- [x] **Invoices** - Invoice generation with PDF export
- [x] **Expenses** - Weekly expense reports with approval workflow
- [x] **Reports** - Timesheet, invoice, and profitability reports with CSV export
- [x] **Dashboard** - Real-time metrics and activity overview

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- pnpm (recommended) or npm
- Supabase account (free tier works)

### Environment Variables

Create `.env.local` with:

```env
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Supabase Service Role (Optional - for admin operations)
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (from Settings > API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key (safe for client) |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Admin key for server-side operations |

### Installation

```bash
# Clone repo
git clone https://github.com/x-perr/grandcanyon.git
cd grandcanyon

# Install dependencies
pnpm install

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

### Database Setup

#### Option A: Fresh Setup (New Supabase Project)

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the schema from `docs/DATABASE_NEW.md`
3. Copy project URL and anon key to `.env.local`
4. Create initial admin user:
   - Go to Authentication > Users > Add user
   - After creation, run this SQL to grant admin role:
   ```sql
   UPDATE profiles
   SET role_id = (SELECT id FROM roles WHERE name = 'admin')
   WHERE email = 'your-admin@email.com';
   ```

#### Option B: Migration from Legacy MySQL

See [docs/MIGRATION.md](docs/MIGRATION.md) for step-by-step data migration guide.

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Login, password reset
│   ├── (protected)/         # Authenticated routes
│   │   ├── dashboard/       # Main dashboard
│   │   ├── clients/         # Client management
│   │   ├── projects/        # Project management
│   │   ├── timesheets/      # Timesheet entry
│   │   ├── invoices/        # Invoice generation
│   │   ├── expenses/        # Expense reports
│   │   └── reports/         # Reporting module
│   └── api/                 # API routes (PDF generation)
│
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── layout/              # App shell, navigation
│   └── [module]/            # Module-specific components
│
├── lib/
│   ├── auth.ts              # Auth utilities & permissions
│   ├── date.ts              # Date/week utilities
│   ├── tax.ts               # Quebec tax calculations (GST/QST)
│   ├── csv.ts               # CSV export utilities
│   ├── supabase/            # Supabase client setup
│   └── validations/         # Zod schemas
│
└── types/
    └── database.ts          # Generated Supabase types
```

## Development

### Code Style

- TypeScript strict mode (no `any`)
- ESLint + Next.js recommended rules
- Server Actions for all mutations
- Zod for input validation

### Key Patterns

#### Server Actions

All data mutations use Next.js Server Actions with permission checks:

```typescript
'use server'

export async function updateClient(id: string, data: FormData) {
  // 1. Verify authentication
  const user = await requireAuth()

  // 2. Check permissions
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'clients.update')) {
    return { error: 'Unauthorized' }
  }

  // 3. Validate input
  const validation = clientSchema.safeParse(data)
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message }
  }

  // 4. Perform operation
  const supabase = await createClient()
  const { error } = await supabase.from('clients').update(...)

  // 5. Revalidate and return
  revalidatePath('/clients')
  return { success: true }
}
```

#### Permission System

Three roles with granular permissions:
- **Admin**: Full system access
- **Project Manager**: Manage projects, approve timesheets/expenses
- **Employee**: Enter timesheets and expenses

#### Quebec Tax Calculation

Uses compound taxation (QST calculated on GST-inclusive amount):
```typescript
// GST: 5% of subtotal
// QST: 9.975% of (subtotal + GST)
const taxes = calculateTaxes(subtotal, chargesGst, chargesQst)
```

### Regenerate Database Types

After Supabase schema changes:
```bash
npx supabase gen types typescript --project-id hketgkfoabolfkcrjedn > src/types/database.ts
```

## Deployment

### Vercel Deployment

1. **Connect Repository**
   - Go to [vercel.com](https://vercel.com) and import the GitHub repository
   - Vercel auto-detects Next.js

2. **Set Environment Variables**
   - In Vercel project settings, add:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY` (if using admin features)

3. **Deploy**
   - Push to main branch triggers automatic deployment
   - Preview deployments for pull requests

### Supabase Production Checklist

- [ ] Enable Row Level Security on all tables
- [ ] Configure email templates (Auth > Templates)
- [ ] Set up database backups (Settings > Database)
- [ ] Configure custom domain (optional)
- [ ] Review and update RLS policies for production

## Testing

See [docs/TESTING.md](docs/TESTING.md) for the complete manual testing checklist.

## Documentation

Additional documentation in `xperr-ops/docs/xperr/reference/grand-canyon/`:

| Document | Description |
|----------|-------------|
| `FEATURES.md` | Legacy feature inventory (8 modules) |
| `DATABASE_LEGACY.md` | Legacy MySQL schema (21 tables) |
| `DATABASE_NEW.md` | New PostgreSQL schema (20 tables) |
| `REWRITE_PLAN.md` | Project plan and session history |

## License

Proprietary - Grand Canyon Construction
