# E-Commerce Profitability Tracker — Setup Guide

## Prerequisites
- Node.js 18+
- PostgreSQL database
- Anthropic API key (Claude)

## Quick Start

### 1. Environment Variables
Copy `.env.example` to `.env.local` and fill in all required values:

```bash
cp .env.example .env.local
```

Required:
- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_SECRET` — Random secret (generate with `openssl rand -base64 32`)
- `ANTHROPIC_API_KEY` — From console.anthropic.com

Optional (for integrations):
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — For Google sign-in
- `GOOGLE_SHEETS_CLIENT_ID` / `GOOGLE_SHEETS_CLIENT_SECRET` — For Sheets export

### 2. Database Setup
```bash
# Create the database
createdb ecom_profitability

# Apply the migration
psql ecom_profitability < prisma/migrations/0001_init/migration.sql

# Or use Prisma CLI (for subsequent changes):
npx prisma migrate deploy
```

### 3. Generate Prisma Client
```bash
npx prisma generate
```

### 4. Install & Run
```bash
npm install
npm run dev
```

App runs at http://localhost:3000

---

## Integration Setup

### Shopify
1. In Shopify Admin → Apps → Develop Apps → Create private app
2. Enable Orders read/write permissions
3. Copy Admin API Access Token to integrations page
4. Add webhook URL to Shopify: `https://your-domain.com/api/shopify/webhook` (orders/create)

### Facebook Ads
1. Create a Facebook App at developers.facebook.com
2. Add Marketing API product
3. Generate a System User access token
4. Find your Ad Account ID in Ads Manager (the numeric ID)
5. Enter both in the integrations page, then click "Sync 30 days"

### Google Sheets
1. Create a project in Google Cloud Console
2. Enable the Google Sheets API
3. Create OAuth credentials (Web Application type)
4. Add `http://localhost:3000/api/sheets/callback` as an authorized redirect URI
5. Paste Client ID and Secret into `.env.local`
6. In the integrations page, enter the Spreadsheet ID and click "Authorize Google"

---

## Architecture

```
app/
├── (auth)/signin|signup     — Authentication pages
├── (dashboard)/             — Protected app shell
│   ├── dashboard/           — Main overview with stats + recent orders
│   ├── orders/              — Full order list with expand/collapse
│   ├── analytics/           — Charts with 30-day trends
│   ├── integrations/        — Connect Shopify, Facebook, Sheets
│   └── settings/            — Business config, product costs, AI notes
├── api/
│   ├── auth/                — NextAuth + registration
│   ├── businesses/          — CRUD for business config
│   ├── orders/              — Order listing + per-order re-analysis
│   ├── shopify/webhook      — Live order ingestion
│   ├── shopify/sync         — Historical order import
│   ├── facebook/sync        — Pull ad spend data
│   ├── sheets/              — Export + Google OAuth
│   └── dashboard/           — Aggregated stats endpoint
lib/
├── prisma.ts    — Database client (Prisma v7 + pg adapter)
├── auth.ts      — NextAuth config
├── claude.ts    — AI order analysis
├── shopify.ts   — Shopify API helpers
├── facebook.ts  — Meta Marketing API helpers
└── sheets.ts    — Google Sheets API helpers
```

## AI Order Analysis Flow
1. Order arrives via webhook or manual sync
2. Full Shopify order JSON + business config (costs, rules, AI notes) → Claude
3. Claude returns structured JSON with cost/profit breakdown
4. Results stored in DB, displayed immediately in dashboard

## Business Logic Summary
- **2nd-unit discount**: `(mainUnits - 1) × discountAmount` where mainUnits = deals + cool deals + bottles only
- **Quantity discount** (10%/15%): applies to deals only, overrides by section discount
- **Section discount** (10%/15%): applies to everything, mutually exclusive with quantity discount
- **50 ILS coupon**: stacks with quantity discount
- **Gift capsules**: tagged `__upcartRewardProduct` or price=₪0 with "הפתעה" in name = 0 to customer, costs business
