# Grand Canyon - Production Deployment Guide

**Date**: 2026-02-24
**Session**: 20

---

## Pre-Deployment Checklist

### 1. Run E2E Test Suite (Verified: 91 tests)

```powershell
# From grandcanyon-app directory
cd "c:\Users\imxpe\xperr lifeos\grandcanyon-app"

# Start dev server (if not already running)
npm run dev

# In another terminal, run all tests
npx playwright test

# View detailed report
npx playwright show-report
```

**Expected Results**:
- Auth: 5 tests
- Timesheets: 5 tests
- Invoices: 5 tests
- Clients: 12 tests
- Projects: 16 tests
- Expenses: 14 tests
- Admin: 14 tests
- Reports: 9 tests
- Dashboard: 5 tests
- i18n: 6 tests
- **Total: 91 tests**

---

### 2. Get Resend API Key

1. Go to https://resend.com/api-keys
2. Create a new API key (or use existing)
3. Add to `.env.local`:
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxx
   ```

---

### 3. Create company-assets Storage Bucket

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/hketgkfoabolfkcrjedn
2. Navigate to **Storage** in the sidebar
3. Click **New bucket**
4. Configure:
   - **Name**: `company-assets`
   - **Public bucket**: ✅ Yes (for logo access)
   - **File size limit**: 2MB
   - **Allowed MIME types**: `image/png, image/jpeg, image/svg+xml`
5. Click **Create bucket**

---

### 4. Deploy to Vercel

#### Option A: Via Vercel CLI

```powershell
# Install Vercel CLI if not installed
npm i -g vercel

# Deploy
cd "c:\Users\imxpe\xperr lifeos\grandcanyon-app"
vercel
```

#### Option B: Via Vercel Dashboard

1. Go to https://vercel.com/new
2. Import the `x-perr/grandcanyon` repository
3. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

#### Environment Variables for Vercel

Set these in Project → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://hketgkfoabolfkcrjedn.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` (from .env.local) |
| `RESEND_API_KEY` | `re_xxxxxxxxxxxx` (from Resend) |

---

### 5. Send Password Reset Emails

After deployment, send password resets to all 30 employees:

```powershell
cd "c:\Users\imxpe\xperr lifeos\grandcanyon-app\scripts\migration"

# First, do a dry run
node 5-send-password-resets.js --dry-run

# Then send for real
node 5-send-password-resets.js
```

**Required Environment Variables** (add to migration script folder):

```bash
# .env file in scripts/migration/
SUPABASE_URL=https://hketgkfoabolfkcrjedn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-from-dashboard>
APP_URL=https://your-vercel-app.vercel.app
```

---

## Post-Deployment Verification

1. **Login Test**: Visit production URL → Login with `dev@xperr.win`
2. **Language Toggle**: Switch between French/English
3. **Invoice PDF**: Generate and download a PDF
4. **Email Test**: Send a test invoice email

---

## DNS Configuration (Optional)

If using a custom domain:

1. In Vercel: Project → Settings → Domains
2. Add your domain (e.g., `app.grandcanyon.com`)
3. Configure DNS:
   - Type: CNAME
   - Name: `app`
   - Value: `cname.vercel-dns.com`

---

## Rollback Procedure

If issues occur after deployment:

```powershell
# Revert to previous deployment in Vercel Dashboard
# Or via CLI:
vercel rollback
```

---

## Support Contacts

- **Supabase Dashboard**: https://supabase.com/dashboard/project/hketgkfoabolfkcrjedn
- **Vercel Dashboard**: https://vercel.com
- **Resend Dashboard**: https://resend.com

---

*Generated: Session 20 - Production Deployment*
