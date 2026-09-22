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

- `app/` â€” App Router Next.js.
- `components/storefront.tsx` â€” UI customer-facing, filter, cart draft, dan entry point B2B.
- `lib/catalog.ts` â€” query server-side katalog dengan fallback demo.
- `lib/supabase/` â€” typed server client foundation.
- `supabase/migrations/` â€” migration versioned untuk catalog projection dan akun B2B dasar.
- `supabase/seed.sql` â€” seed development yang diberi label, bukan data production.
- `tests/next_browser_check.py` â€” smoke test Playwright untuk desktop dan mobile.

## Google SSO

Halaman `/auth` sudah menyediakan tombol Google dan email magic link. Di Supabase Dashboard:

1. Buka Authentication â†’ Providers â†’ Google, lalu aktifkan provider.
2. Buat OAuth Client ID di Google Cloud dengan callback URI `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Tambahkan URL aplikasi ke Supabase Authentication â†’ URL Configuration, misalnya `http://localhost:3000/auth/callback` dan URL production Vercel.

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

Notifikasi order admin akan memakai Meta WhatsApp Cloud API melalui server-side webhook setelah flow checkout production aktif. Kredensial berikut tidak boleh diletakkan di browser:

- `WHATSAPP_CLOUD_API_TOKEN`
- `WHATSAPP_CLOUD_PHONE_NUMBER_ID`
- `WHATSAPP_ADMIN_TO`
- `WHATSAPP_WEBHOOK_SECRET`

Payload notifikasi yang disiapkan: nomor order, total, status order, status pembayaran, dan status fulfillment. Pengiriman ke nomor admin baru boleh diaktifkan setelah nomor tujuan dan payload dikonfirmasi.
