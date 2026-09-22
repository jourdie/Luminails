# Luminails Commerce

Fondasi storefront B2B Luminails dengan Next.js, TypeScript, dan Supabase.

## Stack dan hosting yang disarankan

- Next.js App Router + React + TypeScript untuk storefront, auth callback, dan back office.
- Supabase untuk PostgreSQL, Auth, Row Level Security, dan nanti Realtime/Storage.
- Vercel untuk hosting Next.js karena terhubung langsung ke GitHub dan mendukung environment variables per environment.
- Payment gateway dan kurir akan dipasang sebagai adapter server-side setelah provider dipilih; secret tidak pernah dikirim ke browser.

## Jalankan lokal

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Buka `http://localhost:3000`.

Tanpa env Supabase, homepage memakai katalog demo yang sama dengan prototype awal. Saat `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` diisi, server page akan membaca katalog aktif dari Supabase. Secret service role belum dipakai di storefront dan tidak boleh diletakkan di browser.

## Struktur penting

- `app/` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â App Router Next.js.
- `components/storefront.tsx` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â UI customer-facing, filter, cart draft, dan entry point B2B.
- `lib/catalog.ts` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â query server-side katalog dengan fallback demo.
- `lib/supabase/` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â typed server client foundation.
- `supabase/migrations/` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â migration versioned untuk catalog projection dan akun B2B dasar.
- `supabase/seed.sql` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â seed development yang diberi label, bukan data production.
- `tests/next_browser_check.py` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â smoke test Playwright untuk desktop dan mobile.

## Google SSO

Halaman `/auth` sudah menyediakan tombol Google dan email magic link. Di Supabase Dashboard:

1. Buka Authentication ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Providers ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Google, lalu aktifkan provider.
2. Buat OAuth Client ID di Google Cloud dengan callback URI `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Tambahkan URL aplikasi ke Supabase Authentication ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ URL Configuration, misalnya `http://localhost:3000/auth/callback` dan URL production Vercel.

Callback aplikasi akan membuat atau memperbarui `customer_profiles`. Akses `/admin` tetap ditentukan oleh tabel `admin_memberships`, bukan metadata user.

## Database workflow

Supabase CLI sudah diinisialisasi. Untuk local database penuh dibutuhkan Docker Desktop:

```powershell
npx supabase start
npx supabase db reset
```

Saat sudah tersedia project Supabase remote, isi `.env.local` dengan URL dan publishable key project tersebut. Jangan commit `.env.local`, service role key, atau credentials Midtrans.

## Scope yang sudah diimplementasikan

- Homepage dan katalog Luminails.
- Search, filter, sorting, responsive menu.
- Cart draft dan login B2B modal.
- Next.js production build.
- Supabase customer-safe catalog projection.
- RLS default-deny untuk tabel exposed.
- B2B account/membership foundation.
- `/auth` Google SSO dan magic-link login untuk user biasa dan staff.
- `/admin` workspace untuk produk, transaksi, notifikasi, dan pricing tier.
- Threshold `B2B_PREMIUM` disimpan di `pricing_tiers` dan bisa diedit owner dari menu Pricing B2B; seed development saat ini Rp5.000.000 + 3 order paid dan harus dikonfirmasi sebelum production.

## Project skills

Skill yang dikunci di `skills-lock.json`: `find-skills`, `frontend-design`, `vercel-react-best-practices`, `web-design-guidelines`, `webapp-testing`, `supabase`, dan `supabase-postgres-best-practices`.

## Scope berikutnya dari PRD

1. Hubungkan schema ke Operations yang sebenarnya sebelum menambah order/inventory ledger.
2. Implementasikan customer auth magic link/Google dengan middleware cookie refresh.
3. Tambahkan pricing tier server-side dan order snapshot/idempotency.
4. Tambahkan Operations allocation lokal/dropship dan quote versioning.
5. Integrasikan Midtrans Sandbox melalui adapter dan verified webhook.

## WhatsApp

Storefront menyediakan floating bubble WhatsApp. Isi `NEXT_PUBLIC_WHATSAPP_NUMBER` dengan format internasional tanpa tanda `+`, misalnya `62812xxxxxxx`; bubble baru tampil setelah nomor diisi.

Notifikasi order admin sekarang memakai Meta WhatsApp Cloud API melalui endpoint /api/webhooks/order setelah event INSERT pada commerce_orders. Kredensial berikut tidak boleh diletakkan di browser:

- `WHATSAPP_CLOUD_API_TOKEN`
- `WHATSAPP_CLOUD_PHONE_NUMBER_ID`
- `WHATSAPP_ADMIN_TO`
- `WHATSAPP_WEBHOOK_SECRET`

Payload lengkap mencakup nomor order, customer/account ID, channel, total, status order, pembayaran, fulfillment, waktu order, dan item produk. Di Supabase Dashboard buat Database Webhook untuk public.commerce_orders event INSERT ke https://<domain-vercel>/api/webhooks/order, lalu tambahkan header x-whatsapp-webhook-secret dengan nilai yang sama seperti WHATSAPP_WEBHOOK_SECRET. SUPABASE_SERVICE_ROLE_KEY dipakai server-side untuk membaca item order.

## Promotion engine

Back office → Promosi mendukung:

- New user promo: audience user baru, first-order rule, minimum order, quota.
- Recurring repeat promo: minimum jumlah paid order, quota per customer, dan stackable rule.
- Bundling package: bundle item akan disimpan di promotion_bundle_items dengan harga paket.
- Seasonal promo: campaign tanggal seperti 9.9, 10.10 dengan start/end time dan status.
- Custom special voucher: voucher code dan daftar customer eligible melalui UUID customer_profiles.

Schema promotion disimpan di migration `20260922150000_promotions_backoffice.sql`. Promo sample hanya development data dari `supabase/seed.sql`; aturan production harus dikonfirmasi sebelum migration/seed remote dijalankan.