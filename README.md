# Grand Canyon

Construction timesheet and invoicing system.

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict)
- **Database**: PostgreSQL via Supabase
- **Auth**: Supabase Auth
- **UI**: Tailwind CSS + shadcn/ui
- **Hosting**: Vercel + Supabase

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/x-perr/grandcanyon.git
cd grandcanyon
npm install
```

### 2. Set up environment

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
├── components/          # React components
├── lib/
│   └── supabase/       # Supabase client setup
└── middleware.ts       # Auth middleware
```

## Features

- [ ] Authentication (login/logout)
- [ ] User management
- [ ] Client management
- [ ] Project management
- [ ] Timesheet entry & approval
- [ ] Invoice generation & PDF
- [ ] Reports

## Documentation

See `xperr-ops/docs/xperr/reference/grand-canyon/` for:
- `FEATURES.md` - Legacy feature inventory
- `DATABASE_LEGACY.md` - Legacy schema
- `DATABASE_NEW.md` - New PostgreSQL schema
- `REWRITE_PLAN.md` - Project plan
