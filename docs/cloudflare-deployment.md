# Deploy Luminails ke Cloudflare Workers

Project ini sudah disiapkan untuk dua mode:

- `next dev` / `next build` untuk development dan fallback Node.js.
- `vinext` + Cloudflare Workers untuk production edge deployment.

Cloudflare Workers dipakai, bukan Cloudflare Pages static, karena aplikasi memiliki App Router, middleware/proxy, API route webhook WhatsApp, Supabase SSR, dan halaman admin dinamis.

## 1. Prasyarat

Siapkan:

- akun Cloudflare;
- domain yang dikelola di Cloudflare jika ingin memakai custom domain;
- project Supabase production;
- Google OAuth Client untuk Google SSO;
- repository GitHub `jourdie/Luminails`.

Install dependencies dan cek kompatibilitas dari root project:

```powershell
npm install
npx vinext check
```

## 2. Buat project Workers

Login melalui Wrangler:

```powershell
npx wrangler login
```

Build dan preview lokal dalam runtime Cloudflare:

```powershell
npm run build:vinext
npm run start:vinext
```

Jika preview berhasil, project dapat dideploy dengan:

```powershell
npm run deploy:vinext
```

Nama Worker berasal dari `wrangler.jsonc`, yaitu `luminails-commerce`. Jika nama tersebut sudah dipakai di akun Cloudflare, ubah field `name` menjadi nama unik.

## 3. Masukkan environment variables

Jangan commit `.env.local`, token Cloudflare, service role key, atau token WhatsApp ke GitHub. Simpan variable publik dan secret di Cloudflare Worker.

Variable yang diperlukan:

```text
NEXT_PUBLIC_APP_URL=https://domain-production-anda
NEXT_PUBLIC_SUPABASE_URL=https://project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
APP_TIMEZONE=Asia/Jakarta
NEXT_PUBLIC_WHATSAPP_NUMBER=6289501086888
NEXT_PUBLIC_WHATSAPP_MESSAGE=Halo Luminails, saya mau konsultasi produk dan order.
WHATSAPP_CLOUD_API_VERSION=v23.0
WHATSAPP_CLOUD_API_TOKEN=...
WHATSAPP_CLOUD_PHONE_NUMBER_ID=...
WHATSAPP_ADMIN_TO=6289501086888
WHATSAPP_WEBHOOK_SECRET=...
```

Untuk variable non-secret, bisa diisi pada dashboard Worker atau file `.dev.vars` lokal. Untuk secret production gunakan Wrangler:

```powershell
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put WHATSAPP_CLOUD_API_TOKEN
npx wrangler secret put WHATSAPP_CLOUD_PHONE_NUMBER_ID
npx wrangler secret put WHATSAPP_WEBHOOK_SECRET
```

Saat diminta, paste nilainya satu per satu. Jangan menaruh nilai secret pada `wrangler.jsonc`.

## 4. Supabase production

Jalankan migration ke project Supabase production sesuai workflow tim. Setelah itu isi environment variables di Worker.

Pada Supabase Authentication → URL Configuration:

- Site URL: `https://domain-production-anda`
- Redirect URL: `https://domain-production-anda/auth/callback`

Pada Google Cloud OAuth Client, callback provider tetap memakai URL Supabase:

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

Untuk notifikasi order, buat Database Webhook pada `public.commerce_orders`, event `INSERT`, ke:

```text
https://domain-production-anda/api/webhooks/order
```

Tambahkan header:

```text
x-whatsapp-webhook-secret: <nilai WHATSAPP_WEBHOOK_SECRET>
```

## 5. Custom domain

Di Cloudflare Dashboard:

1. Buka Workers & Pages.
2. Pilih Worker `luminails-commerce`.
3. Buka Settings → Domains & Routes.
4. Tambahkan custom domain.
5. Set `NEXT_PUBLIC_APP_URL` ke domain tersebut dan deploy ulang.

## 6. Deployment otomatis dari GitHub

Pilihan paling sederhana untuk tahap awal adalah deploy manual dengan `npm run deploy:vinext` setelah setiap merge ke `main`.

Untuk CI/CD, buat GitHub Actions yang menjalankan:

```powershell
npm ci
npm run typecheck
npm run build:vinext
npm run deploy:vinext
```

Tambahkan `CLOUDFLARE_API_TOKEN` dan `CLOUDFLARE_ACCOUNT_ID` sebagai GitHub Actions Secrets. Token minimal membutuhkan permission Workers Scripts Edit dan permission yang diperlukan untuk resource yang digunakan.

## 7. Checklist sebelum production

- [ ] `npx vinext check` tidak memiliki issue blocker.
- [ ] `npm run typecheck` lulus.
- [ ] `npm run build:vinext` lulus.
- [ ] Preview `npm run start:vinext` dapat dibuka.
- [ ] Supabase URL, publishable key, dan service role sudah benar.
- [ ] Google SSO redirect URL sudah ditambahkan.
- [ ] Migration dan RLS sudah dijalankan di Supabase production.
- [ ] WhatsApp webhook memakai secret yang sama.
- [ ] Webhook tidak diuji dengan mengirim order palsu ke production.
- [ ] Domain production sudah digunakan pada `NEXT_PUBLIC_APP_URL`.

## Troubleshooting

Jika deploy gagal karena dependency Node.js, jalankan ulang `npx vinext check` dan lihat import yang tidak kompatibel. Jangan mengganti `npm run build` biasa; build Node.js dan build Cloudflare memang memakai script berbeda.

Jika OAuth kembali ke localhost, periksa `NEXT_PUBLIC_APP_URL`, Supabase Redirect URLs, dan konfigurasi Google OAuth.

Jika webhook WhatsApp mendapat `401`, pastikan header `x-whatsapp-webhook-secret` sama persis dengan secret Worker.
