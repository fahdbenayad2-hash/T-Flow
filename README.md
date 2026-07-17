# T-Flow

Arabic RTL order management system for e-commerce stores, built with TanStack Start, Supabase, and Google Apps Script.

## Features

- **Dashboard** — KPIs, status distribution, recent orders
- **Orders** — Search, filter, sort, bulk status update, duplicate detection, Excel/CSV export
- **Customers** — Auto-aggregation by phone, stats (orders, revenue, cancellations, no-answer)
- **Call Center** — Agent queue, call cards with outcomes, daily stats
- **Products** — Product-level analytics, revenue breakdown, color/size tracking
- **Earnings** — Financial metrics by product, wilaya, and date
- **Delivery** — Home delivery vs stop desk, per-wilaya analysis
- **Reports** — Performance metrics, top customers, full Excel export
- **Settings** — Apps Script config, connection test, cache management
- **Notifications** — Real-time via Supabase Realtime, pending +48h alerts, duplicate detection
- **Dark mode** — Toggle with OKLCH color tokens
- **Mobile** — Bottom nav, responsive layout
- **RTL** — Full Arabic right-to-left layout

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | TanStack Start (React 19, Vite 7) |
| Styling | Tailwind CSS v4, OKLCH tokens |
| State | TanStack Query, react-hot-toast |
| Auth | Supabase Auth (client-side) |
| Database | Supabase (PostgreSQL + RLS) |
| Proxy | Google Apps Script → Google Sheets |
| Animations | Framer Motion |
| Export | SheetJS (xlsx) |
| Fonts | Tajawal (Arabic), JetBrains Mono (numbers) |

## Getting Started

```bash
npm install
```

Create `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
APP_SUPABASE_URL=https://your-project.supabase.co
APP_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_SCRIPT_URL=https://script.google.com/macros/s/.../exec
```

Run the dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Database Setup

Run `db/migrations/001_init.sql` in the Supabase SQL Editor. This creates:

- `audit_log` — tracks all order changes
- `user_roles` — role-based access (admin, manager, agent)
- `profiles` — user metadata
- `notifications` — notification queue
- `settings` — key-value config store
- `blacklisted_phones` — blocked phone numbers

Includes `has_role()` security definer function and `handle_new_user()` trigger that auto-assigns admin to the first user.

## Authentication

- First user with a configured Supabase email is auto-assigned `admin` role
- Login via `signInWithPassword` (client-side Supabase)
- Server reads session from cookies
- Demo mode activates when Supabase env vars are placeholders

## Project Structure

```
src/
  components/       # Shared UI components
    ui/             # shadcn/ui primitives
    sidebar.tsx     # Desktop navigation
    bottom-nav.tsx  # Mobile navigation
    header.tsx      # Top bar with notifications
    empty-state.tsx # Reusable empty/error states
    page-transition.tsx # Framer Motion wrappers
  hooks/            # Custom React hooks
  lib/              # Queries, types, utilities
  routes/           # TanStack Router file-based routes
    auth.tsx        # Login page
    _authenticated/ # Protected layout + pages
      dashboard.tsx
      orders.tsx
      orders.$row.tsx
      customers.tsx
      customers.$phone.tsx
      call-center.tsx
      products.tsx
      earnings.tsx
      delivery.tsx
      reports.tsx
      settings.tsx
  server/           # Server functions (proxy, auth)
  styles/           # Global CSS with design tokens
  utils/            # Supabase client/server factories
```

## Google Sheets Schema

Expected columns (Arabic):

| Column | Description |
|--------|-------------|
| الاسم | Customer name |
| الهاتف | Phone number |
| الولاية | Wilaya (province) |
| البلدية | Municipality |
| العنوان | Address |
| الملاحظات | Notes |
| المنتج | Product name |
| اللون | Color |
| المقاس | Size |
| السعر | Price |
| الكمية | Quantity |
| نوع التوصيل | Delivery type |
| التاريخ | Date/time |
| الحالة | Status |

Status values: `جاري التجهيز`, `قيد المعالجة`, `مؤكد`, `مشحون`, `تم التسليم`, `ملغي`, `ما جاوبش`

## License

MIT
