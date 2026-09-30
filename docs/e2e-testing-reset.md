# E2E test reset

Use this only against the Supabase test project.

## Apply migrations

```powershell
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --linked
npx supabase migration list --linked
```

The migration list must show every file in `supabase/migrations/` as applied.

## Clean business data

Open Supabase Dashboard → SQL Editor for the test project and run:

```text
supabase/clean-test-data.sql
```

The reset preserves the admin membership and system configuration, but removes
catalog, packages, promotions, inventory, customers, orders, loyalty activity,
notifications, and audit history. It does not delete `auth.users`.

## Verify the Worker build

```powershell
npx vinext check
npm run typecheck
npm run build:vinext
npm run deploy:vinext
```

After deployment, verify the Worker environment contains the Supabase URL,
publishable key, service-role key, and the application URL. Keep the service
role key server-side only.
