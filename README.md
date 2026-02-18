# Grand Canyon

Modern timesheet and invoicing system for construction businesses.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript (strict) |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth |
| UI | shadcn/ui + Tailwind CSS |
| PDF | @react-pdf/renderer |
| Hosting | Vercel + Supabase |

## Features

- [x] **Authentication** - Role-based access control (Admin, Manager, Employee)
- [x] **Clients** - Client management with contacts
- [x] **Projects** - Project tracking with team, tasks, billing roles
- [x] **Timesheets** - Weekly timesheet entry with approval workflow
- [ ] **Invoicing** - Invoice generation with PDF export (Phase 4)
- [ ] **Reports** - TODO (Phase 5)

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Supabase account

### Environment Variables

Create `.env.local` with:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

<!-- TODO: Document all required env vars -->

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

<!-- TODO: Document Supabase project setup -->
<!-- TODO: Document migration steps -->

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Login, password reset
│   ├── (protected)/         # Authenticated routes
│   │   ├── dashboard/
│   │   ├── clients/
│   │   ├── projects/
│   │   ├── timesheets/
│   │   └── invoices/
│   └── api/                 # API routes (PDF generation, etc.)
│
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── layout/              # App shell, navigation
│   ├── clients/             # Client-specific components
│   ├── projects/            # Project-specific components
│   ├── timesheets/          # Timesheet-specific components
│   └── invoices/            # Invoice-specific components
│
├── lib/
│   ├── auth.ts              # Auth utilities
│   ├── date.ts              # Date/week utilities
│   ├── supabase/            # Supabase client setup
│   └── validations/         # Zod schemas
│
└── types/
    └── database.ts          # Generated Supabase types
```

## Development

### Code Style

- TypeScript strict mode (no `any`)
- ESLint + Prettier
- Server Actions for mutations
- Zod for validation

### Key Patterns

<!-- TODO: Document server action patterns -->
<!-- TODO: Document permission checking -->
<!-- TODO: Document form handling with useActionState -->

## Deployment

<!-- TODO: Document Vercel deployment steps -->
<!-- TODO: Document Supabase production setup -->

## Documentation

See `xperr-ops/docs/xperr/reference/grand-canyon/` for:
- `FEATURES.md` - Legacy feature inventory
- `DATABASE_LEGACY.md` - Legacy schema
- `DATABASE_NEW.md` - New PostgreSQL schema
- `REWRITE_PLAN.md` - Project plan

## License

Proprietary - Grand Canyon Construction
