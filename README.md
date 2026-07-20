# T-Flow

Arabic RTL order management system for cash-on-delivery e-commerce sellers.

![License: MIT](https://img.shields.io/badge/License-MIT-green)
![Stack: TanStack Start](https://img.shields.io/badge/Stack-TanStack%20Start%20+%20Supabase-red)

## Overview

T-Flow is built for Algerian and MENA-region e-commerce sellers who operate cash-on-delivery businesses via Google Sheets. It reads your existing Sheets-based order data through a Google Apps Script proxy, adds a full management interface on top — orders, customers, call center, delivery tracking, analytics, and team permissions — and persists audit logs and user roles in Supabase (PostgreSQL with RLS).

The goal: keep sellers in their familiar Sheets workflow while giving them a real operations dashboard without migrating away from what already works.

## Screenshots

> Add screenshots here. Recommended views:
> - `dashboard.png` — KPIs, status distribution chart, recent orders
> - `orders.png` — orders table with bulk actions and status badges
> - `call-center.png` — agent queue with call cards and outcomes
> - `landing.png` — public landing page with hero section

## Features

### Operations

| Feature | Details |
|---------|---------|
| **Order management** | Search, filter, sort, bulk status update, duplicate detection by phone+date+product, Excel/CSV export |
| **Customer profiles** | Auto-aggregation by phone number, order history, spend totals, cancellation rates, blacklist toggle |
| **Call center** | Agent queue with call cards, outcome tracking (answered / no\_answer / postponed), follow-up scheduling |
| **Delivery tracking** | Home delivery vs stop desk breakdown, per-wilaya analysis |
| **Notifications** | Supabase Realtime on `audit_log` table, 60s polling fallback, pending +48h alerts, duplicate detection |

### Analytics

| Feature | Details |
|---------|---------|
| **Dashboard** | KPI cards (orders, revenue, confirmation rate), status distribution bar chart, recent orders |
| **Products** | Product-level revenue, color/size breakdown, performance ranking |
| **Earnings** | Financial metrics by product, wilaya, and date with Recharts visualizations |
| **Reports** | Top customers, status summaries, full workbook export (SheetJS/xlsx) |

### Access Control

| Feature | Details |
|---------|---------|
| **RBAC** | Three roles: `admin`, `confirmation_agent`, `shipping_manager` |
| **User management** | Admin-only server-side user creation via Supabase `service_role` key, role assignment, deletion |
| **RLS** | Deny-by-default Supabase policies, `has_role()` security definer function, per-table access rules |

### UX

| Feature | Details |
|---------|---------|
| **Full Arabic RTL** | Right-to-left layout, Arabic fonts (Tajawal for text, JetBrains Mono for numbers) |
| **Dark mode** | Toggle via `next-themes`, CSS custom properties with design tokens |
| **Mobile** | Bottom navigation with glassmorphism, responsive grid layouts |
| **Landing page** | Marketing homepage at `/`, features overview, how-it-works, CTA |
| **Intro animation** | Full-screen branded loader with logo reveal and speed lines, plays once per browser session |
| **Page transitions** | Framer Motion fade/stagger animations on route changes |

## Tech Stack

| Layer | Technology | Why this choice |
|-------|-----------|-----------------|
| Framework | TanStack Start (React 19, Vite 7) | Server-side rendering + server functions for API calls without a separate backend, file-based routing |
| Styling | Tailwind CSS v4 | Utility-first, design tokens via CSS custom properties, dark mode via `.dark` class |
| State | TanStack Query | Server state caching (45s stale time), cache invalidation on mutations, refetch-on-focus |
| Auth | Supabase Auth | Managed auth with row-level security, `signInWithPassword` on client, session from cookies on server |
| Database | Supabase (PostgreSQL) | RLS policies enforce access at the DB level, `has_role()` function for role checks |
| Data proxy | Google Apps Script | Reads/writes Google Sheets, avoids Sheets API quota limits, lets sellers keep their existing workflow |
| Charts | Recharts | React-native charting, used on dashboard, products, earnings, and delivery pages |
| Export | SheetJS (xlsx) | Client-side Excel generation for orders, reports, and customer data |
| Animations | Framer Motion | Page transitions, staggered lists, sidebar animation |
| Components | Radix UI + shadcn/ui | Unstyled primitives with Tailwind, used for dialogs, selects, tabs, tooltips, checkboxes |

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Browser                                                 │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  React SPA (TanStack Start)                         │ │
│  │  ┌──────────┐  ┌──────────────┐  ┌───────────────┐ │ │
│  │  │ Auth     │  │ Server Fns   │  │ Realtime      │ │ │
│  │  │ (client) │  │ (SSR/SSG)    │  │ (Supabase WS) │ │ │
│  │  └────┬─────┘  └──────┬───────┘  └───────┬───────┘ │ │
│  └───────┼───────────────┼───────────────────┼─────────┘
│          │               │                   │
└──────────┼───────────────┼───────────────────┘
           │               │
           ▼               ▼
    ┌──────────────┐  ┌───────────────┐
    │  Supabase    │  │  Google Apps  │
    │  (Auth,      │  │  Script       │
    │   PostgreSQL, │  │  (proxy)      │
    │   RLS,       │  │       │       │
    │   Realtime)  │  │       ▼       │
    └──────────────┘  │  Google Sheets │
                      │  (source of    │
                      │   truth)       │
                      └───────────────┘
```

**Data flow:**

1. Google Sheets is the **source of truth** for orders. Sellers continue updating it directly or through existing workflows.
2. A Google Apps Script web app exposes `GET` and `POST` endpoints that read/write the Sheets data.
3. TanStack Start server functions call the Apps Script proxy to fetch orders (with a 45-second in-memory cache) and post updates. This keeps the API key and proxy URL server-side only.
4. Supabase handles **authentication, user roles, audit logs, call logs, and customer notes** — everything that needs persistence beyond what Sheets provides.
5. The browser hydrates with the server-rendered HTML, then takes over with client-side routing and TanStack Query for cache management.

> **Honest note:** This is a pragmatic architecture for small-scale COD sellers who already run on Google Sheets. For larger operations, migrating order storage to Supabase directly would remove the Sheets proxy dependency and improve write reliability.

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A Google Sheet with order data + a deployed Google Apps Script web app

### Setup

```bash
npm install
```

Create `.env` in the project root:

```env
# Supabase (client-side — used by the browser)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Supabase (server-side — used by TanStack Start server functions)
APP_SUPABASE_URL=https://your-project-ref.supabase.co
APP_SUPABASE_ANON_KEY=your-anon-key
APP_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Apps Script proxy URL
VITE_APP_SCRIPT_URL=https://script.google.com/macros/s/AKfyc.../exec
```

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL, exposed to the client bundle |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key, safe to expose to the client |
| `APP_SUPABASE_URL` | Same URL, but read server-side only (not bundled into client code) |
| `APP_SUPABASE_ANON_KEY` | Same anon key, server-side only |
| `APP_SUPABASE_SERVICE_ROLE_KEY` | **Secret.** Used server-side for admin operations (create/delete users). Never exposed to the client. |
| `VITE_APP_SCRIPT_URL` | Google Apps Script web app URL. This is the data proxy endpoint. |

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Authenticated users are redirected to `/dashboard`; visitors see the landing page.

### Database

Run `db/migrations/001_init.sql` in the Supabase SQL Editor. This creates all tables, RLS policies, and triggers. It is safe to re-run (uses `IF NOT EXISTS` and `drop policy if exists`).

## Roles & Permissions

| Role | Access |
|------|--------|
| `admin` | Full access to all pages + user management + settings + earnings/reports |
| `confirmation_agent` | Orders, Customers, Call Center, Bulk Edit |
| `shipping_manager` | Orders, Delivery |

The first user with a configured Supabase email is auto-assigned the `admin` role via the `handle_new_user()` database trigger. All subsequent users must be created by an admin through the Users management page (server-side via `service_role`).

### Demo Mode

When `APP_SUPABASE_URL` is set to `https://your-project-ref.supabase.co` (the placeholder), the app runs in demo mode: auth is bypassed, a mock admin user is returned, and all Supabase calls are skipped.

## Database Schema

| Table | Purpose |
|-------|---------|
| `profiles` | User metadata (id, full\_name, created\_at), auto-created on signup via trigger |
| `user_roles` | Role assignments (user\_id + role), unique constraint on (user\_id, role) |
| `order_assignments` | Tracks which agent is assigned to which order, unique on (order\_id, store) |
| `audit_log` | Full change history for orders (old\_value → new\_value), indexed by order\_id and created\_at |
| `customer_notes` | Per-customer notes and blacklist flag, keyed by phone number |
| `call_logs` | Call center records with outcome (answered/no\_answer/postponed), follow-up scheduling, indexed by agent and order |

**Security helpers:**

- `has_role(uuid, app_role)` — security definer function, used in RLS policies to check role membership
- `handle_new_user()` — trigger on `auth.users` insert, creates a profile row and assigns `admin` to the configured default email

**RLS policies** are deny-by-default. Each table has explicit `SELECT`/`INSERT`/`UPDATE`/`DELETE` policies scoped by role and ownership.

## Project Structure

```
src/
  components/
    ui/                  # shadcn/ui primitives (Button, Card, Dialog, Select, Tabs, etc.)
    landing/             # Landing page
      landing-page.tsx   # Marketing homepage (hero, features, how-it-works, CTA)
      dashboard-preview.tsx  # Decorative dashboard mockup for hero section
    sidebar.tsx          # Desktop navigation with role-filtered nav items
    bottom-nav.tsx       # Mobile navigation with active icon badges
    header.tsx           # Top bar with notification bell
    notification-bell.tsx    # Notifications dropdown (Realtime + polling)
    empty-state.tsx      # Reusable empty/error/loading states (5 variants)
    page-transition.tsx  # Framer Motion: FadeIn, StaggerContainer, StaggerItem, ScaleIn
    role-guard.tsx       # RoleGate (renders or redirects) + RoleHide (hides if role matches)
    app-loader.tsx       # Full-screen intro animation (once per session via sessionStorage)
  hooks/
    useRole.tsx          # RoleProvider context + useRole() hook + role labels/colors
    useNotifications.ts  # Supabase Realtime subscription + 60s polling fallback
  lib/
    queries.ts           # TanStack Query hooks: useOrders, useUpdateOrder, useBulkUpdateOrders, useAuditLog
    types.ts             # TypeScript types: Order, Customer, CallLog, AuditEntry, AppRole, Notification
    utils.ts             # cn(), formatCurrency (DZD), generateOrderId (FS-{hash}), STATUS_MAP, STATUS_OPTIONS
  routes/
    index.tsx            # Landing page (client-side session check → redirect if logged in)
    auth.tsx             # Login page (Supabase signInWithPassword)
    _authenticated/      # Protected layout (session gate + RoleProvider)
      route.tsx          # Layout wrapper: sidebar + header + bottom nav + page transitions
      dashboard.tsx      # KPI cards, status distribution chart, recent orders
      orders.tsx         # Orders table with search/filter/bulk actions/export
      orders.$row.tsx    # Order detail with edit, audit log, conflict detection
      customers.tsx      # Customer aggregation by phone
      customers.$phone.tsx   # Customer profile with full order history
      call-center.tsx    # Agent queue with call cards and outcome tracking
      products.tsx       # Product-level analytics and revenue breakdown
      earnings.tsx       # Financial metrics by product/wilaya/date
      delivery.tsx       # Home delivery vs stop desk per-wilaya analysis
      reports.tsx        # Top customers, status summaries, Excel export
      settings.tsx       # Apps Script URL config, connection test, cache management
      users.tsx          # User CRUD, role assignment (admin only, server-side)
  server/
    orders.ts            # getOrders (GET + 45s cache), updateOrder (POST + audit log), getAuditLog, invalidateOrdersCache
    users.ts             # listUsers, createUser, addUserRole, removeUserRole, deleteUser (all via service_role)
    auth.ts              # fetchUser, fetchUserRoles, signIn (server-side Supabase client)
  styles/
    app.css              # Design tokens, brand variables, intro animation keyframes, reduced-motion handling
  utils/
    supabase-client.ts   # Browser Supabase client (anon key)
    supabase-server.ts   # Server Supabase client (service_role key)
```

## Google Sheets Schema

T-Flow expects your Google Sheet to have these columns (Arabic headers):

| Column | Description | Type |
|--------|-------------|------|
| الاسم | Customer name | string |
| الهاتف | Phone number | string |
| الولاية | Wilaya (province) | string |
| البلدية | Municipality | string |
| العنوان | Address | string |
| الملاحظات | Notes | string |
| المنتج | Product name | string |
| اللون | Color | string |
| المقاس | Size | string |
| السعر | Price | number |
| الكمية | Quantity | number |
| نوع التوصيل | Delivery type | string |
| التاريخ | Date/time | string |
| الحالة | Status | string |

**Status values** (mapped to color-coded badges):

| Status | Meaning |
|--------|---------|
| `جاري التجهيز` | Being prepared |
| `قيد المعالجة` | Processing |
| `مؤكد` | Confirmed |
| `مشحون` | Shipped |
| `تم التسليم` | Delivered |
| `ملغي` | Cancelled |
| `ما جاوبش` | No answer |

**Order IDs** are generated client-side as `FS-{hash}` using a deterministic hash of `phone + date + product`, ensuring the same order always gets the same ID across sessions.

## Roadmap

### Near-term (hardening what exists)

| Priority | Item | Notes |
|----------|------|-------|
| High | Migrate order storage to Supabase | Remove Google Sheets proxy dependency. Orders table with proper columns, types, and constraints. Enables real-time subscriptions on order changes. |
| High | Automated tests | Unit tests for `generateOrderId`, `formatCurrency`, `STATUS_MAP`. Integration tests for server functions. Component tests for key flows (login, order update, bulk edit). |
| High | Error boundaries | React error boundaries on each route, server function error handling with typed responses, user-facing error messages instead of toast dumps. |
| Medium | CI/CD pipeline | GitHub Actions: lint → typecheck → test → build. Auto-deploy to Vercel/Cloudflare on merge to main. |
| Medium | Environment validation | Runtime checks that all required env vars are set and non-placeholder on server start. |
| Medium | Audit log improvements | Capture the actor's email/name in audit entries, add diff view to order detail page. |
| Low | Rate limiting on server functions | Prevent abuse of the Apps Script proxy and Supabase admin APIs. |

### Mid-term (product growth)

| Priority | Item | Notes |
|----------|------|-------|
| High | Shipping provider integration | Webhook/API integration with Yalidine, ZR Express, etc. for automatic status updates and tracking. |
| High | WhatsApp/SMS notifications | Send order status updates to customers via WhatsApp Business API or local SMS gateways. |
| Medium | Multi-store support | Allow a single admin to manage multiple stores/sellers, each with their own order data and team. |
| Medium | Webhook support | Outbound webhooks for order events (status change, new order) to integrate with external tools. |
| Medium | Bulk import from CSV | Import orders from CSV files for sellers transitioning from spreadsheets. |
| Low | Customer communication log | Track all customer touchpoints (calls, messages, status changes) in a unified timeline. |

### Long-term (scale/vision)

| Priority | Item | Notes |
|----------|------|-------|
| High | SaaS platform | Multi-tenant architecture, self-service signup, subscription management, isolated data per seller. |
| Medium | Billing/subscription layer | Stripe/local payment integration for tiered plans (free tier, pro, enterprise). |
| Medium | Analytics & forecasting | Sales trend prediction, demand forecasting, seasonal analysis using historical order data. |
| Low | Mobile app | React Native or Capacitor wrapper for native Android/iOS experience. |
| Low | API for third-party integrations | REST/GraphQL API for sellers to build custom integrations or connect to other business tools. |

## Contributing

This project is not currently open to external contributions. If you're interested in collaborating, reach out via [GitHub Issues](https://github.com/fahdbenayad2-hash/T-Flow/issues).

## License

MIT
