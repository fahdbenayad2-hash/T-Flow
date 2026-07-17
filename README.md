# T-Flow — إدارة الطلبات

تطبيق إدارة الطلبات للمتجر الإلكتروني **T-Flow** — مبني بـ TanStack Start + Supabase.

## المميزات

- **لوحة تحكم** — KPIs حية (طلبات اليوم، نسبة التأكيد، نسبة التسليم، معلقة +48 ساعة)
- **جدول الطلبات** — فلاتر (حالة، ولاية، منتج، وكيل) + بحث + تعديل عبر Drawer + تصدير Excel/CSV
- **_bulk actions** — تحديث جماعي مع progress indicator
- **كشف التكرار** — طلبات مكررة (هاتف مكرر < 7 أيام)
- **العملاء** — تجميع تلقائي بالهاتف + إحصائيات + blacklist
- **مركز المكالمات** — طابور الوكيل + بطاقات مكالمات (ردّ/ما ردّش/مؤجّل) + تذكيرات
- **الإشعارات** — طلب معلق +48 ساعة، مكالمة مؤجلة، طلب مكرر
- **RTL عربي كامل** + **Dark mode** + **Mobile responsive**

## التقنيات

| الطبقة | التقنية |
|--------|---------|
| Framework | TanStack Start (Vite + SSR) |
| Routing | TanStack Router (file-based) |
| UI | React 19 + shadcn/ui + Tailwind CSS v4 |
| State | TanStack Query (react-query) |
| Auth + DB | Supabase (Auth + PostgreSQL + RLS) |
| Server | TanStack Server Functions (`createServerFn`) |
| بيانات الطلبات | Google Apps Script → Google Sheets |

## التشغيل المحلي

### 1. تثبيت الاعتماديات

```bash
git clone https://github.com/fahdbenayad2-hash/T-Flow.git
cd T-Flow
npm install
```

### 2. تكوين متغيرات البيئة

```bash
cp .env.example .env
```

املأ `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
APP_SUPABASE_URL=https://your-project.supabase.co
APP_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
DEFAULT_ADMIN_EMAIL=fahdbenayad2@gmail.com
```

### 3. إعداد قاعدة البيانات

1. افتح Supabase Dashboard → **SQL Editor**
2. انسخ محتوى `db/migrations/001_init.sql` والصقو
3. اضغط **Run**

### 4. إنشاء حساب المدير

1. Supabase Dashboard → **Authentication** → **Users** → **Add user**
2. حط الإيميل المحدد في `DEFAULT_ADMIN_EMAIL`
3. اضغط **Create user**

### 5. تشغيل التطبيق

```bash
npm run dev
```

التطبيق يفتح على `http://localhost:3000`

## هيكل المشروع

```
src/
  routes/
    __root.tsx                     — RTL shell + خطوط + providers
    index.tsx                      — Redirect إلى /auth أو /dashboard
    auth.tsx                       — صفحة تسجيل الدخول
    _authenticated/
      route.tsx                    — Auth gate + Sidebar + Header
      dashboard.tsx                — KPIs + تنبيهات + نشاط
      orders.tsx                   — جدول الطلبات
      orders.$row.tsx              — تفاصيل + تعديل + سجل تدقيق
      customers.tsx                — عملاء + إحصائيات
      customers.$phone.tsx         — ملف العميل
      call-center.tsx              — طابور الوكيل
  server/
    auth.ts                        — Server functions للـ Auth
    orders.ts                      — Proxy للـ Apps Script + cache + audit
  components/                      — UI components (shadcn/ui)
  hooks/                           — useRole, useNotifications
  lib/                             — types, utils, queries
  styles/app.css                   — Design system (OKLCH + dark mode)
db/
  migrations/001_init.sql          — Supabase migration كاملة
```

## الصلاحيات

| الدور | الصلاحيات |
|-------|-----------|
| **Admin** | كل شيء |
| **Confirmation Agent** | Dashboard + Orders (مسندة له) + Call Center + Customers (قراءة) |
| **Shipping Manager** | Orders (فقط تغيير الحالة من مؤكد إلى مشحون/مسلّم) |

## هيكل قاعدة البيانات

- `profiles` — ملفات المستخدمين
- `user_roles` — أدوار المستخدمين (admin, confirmation_agent, shipping_manager)
- `order_assignments` — تعيين الطلبات للوكلاء
- `audit_log` — سجل التعديلات
- `customer_notes` — ملاحظات + blacklist العملاء
- `call_logs` — سجل المكالمات

RLS مفعّل على كل جدول مع policies حسب الدور.

## خارج النطاق (مرحلة قادمة)

- الأرباح/التحليلات المالية
- المنتجات/المخزون
- صفحة الإعدادات
- تكامل شركات التوصيل
