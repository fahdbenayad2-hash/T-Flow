# Supabase order storage rollout

This rollout keeps Google Sheets working throughout the migration. Deployments
default to `ORDER_STORAGE_MODE=sheets`, so applying the code and SQL migration
does not switch production traffic.

## 1. Apply the database migration

Run [`db/migrations/002_saas_orders.sql`](../db/migrations/002_saas_orders.sql)
in the Supabase SQL editor after `001_init.sql`.

The migration:

- creates `stores`, `store_members`, `orders`, `store_integrations`, and
  `order_sync_runs`;
- adds store/order references to the existing operational tables;
- enables store-scoped RLS;
- creates a `main` store and copies existing global roles into its membership
  table when an admin already exists.

It does not remove or modify Google Sheets orders.

## 2. Deploy in Sheets mode

Keep these server environment variables:

```dotenv
ORDER_STORAGE_MODE=sheets
DEFAULT_STORE_SLUG=main
```

Open **Settings → Order storage**, then use **Check**. The panel should show the
current Sheets count and zero (or the previous imported count) in Supabase.

## 3. Run the idempotent import

Use **Import to Supabase** from the same admin-only settings panel.

The importer:

- reads through the existing authenticated Apps Script endpoint;
- filters the same ghost rows as the live orders page;
- upserts by `(store_id, source, source_order_id)`;
- preserves `sheet_row` for compatibility with the current UI;
- records counts and failures in `order_sync_runs`;
- never deletes a Sheets row.

Running it more than once updates existing records instead of duplicating them.

Verify:

```sql
select count(*) from public.orders where deleted_at is null;

select status, count(*)
from public.orders
where deleted_at is null
group by status
order by status;

select *
from public.order_sync_runs
order by started_at desc
limit 5;
```

## 4. Shadow writes

After the first verified import, set:

```dotenv
ORDER_STORAGE_MODE=shadow
```

Reads and user-visible writes still use Google Sheets. Every fresh Sheets
snapshot is reconciled to Supabase, which captures orders added directly by an
external storefront as well as out-of-band edits and deletes. Successful
updates, bulk updates, and deletes made inside T-Flow are also mirrored
immediately on a best-effort basis. Shadow failures are logged, but never block
the primary Sheets read or an operation that already succeeded in Sheets.

Run the import again after the shadow observation period as a final explicit
verification before cutover.

## 5. Cut over to Supabase

After counts and sampled orders match, set:

```dotenv
ORDER_STORAGE_MODE=supabase
```

Orders are then read and mutated in Supabase. Existing UI routes keep working
because imported records retain the original `sheet_row` and stable
`source_order_id`.

Until the external storefront writes directly to Supabase, each fresh orders
read also checks Sheets for previously unseen orders and inserts only those new
records. Existing Supabase rows are never overwritten or deleted by this intake
bridge. Dashboard updates and deletes use Supabase as the primary write and
mirror to Sheets on a best-effort basis so the Sheet remains a usable rollback
copy.

## Rollback

Set `ORDER_STORAGE_MODE=sheets` and redeploy. No database rollback or data
deletion is required.

Do not delete the Sheets source until a later export/synchronization phase has
been completed and verified.
