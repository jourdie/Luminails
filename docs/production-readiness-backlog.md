# Production Readiness Backlog

Checklist sebelum aplikasi dipakai production dan sebelum integrasi penuh dengan third-party provider.

## P0 — wajib sebelum transaksi nyata

- [ ] Finalisasi order state machine: `draft`, `submitted`, `pending_payment`, `paid`, `failed`, `expired`, `cancelled`, `fulfilled`, `refunded`.
- [ ] Integrasikan payment gateway dalam mode sandbox terlebih dahulu.
- [ ] Buat payment webhook yang tervalidasi signature-nya.
- [ ] Tambahkan idempotency untuk order creation, payment webhook, point earning, point redemption, dan stock deduction.
- [ ] Pastikan satu order hanya berisi satu brand.
- [ ] Validasi server-side untuk harga, promo, stok, points, reward, dan add-on.
- [ ] Pastikan potongan points dan pengurangan stok terjadi atomik di database.
- [ ] Buat mekanisme rollback jika pembayaran gagal atau expired.
- [ ] Uji checkout end-to-end dengan data realistis di staging.

## P0 — notifikasi otomatis

- [x] Buat tabel `notification_outbox` dengan status `pending`, `processing`, `sent`, dan `failed`.
- [x] Simpan event notifikasi dalam transaksi order/payment yang sama.
- [x] Tambahkan idempotency key agar retry tidak mengirim pesan ganda.
- [ ] Gunakan Cloudflare Queue/Worker untuk pengiriman asynchronous.
- [ ] Tambahkan exponential retry dan dead-letter handling.
- [ ] Simpan provider message ID, response error, jumlah percobaan, dan waktu pengiriman.
- [ ] Tambahkan halaman/log notifikasi di admin dengan aksi resend.
- [ ] Kirim alert Discord untuk error aplikasi, payment, WhatsApp, email, dan queue.

## P1 — credential dan provider

### WhatsApp Cloud API

- [ ] `WHATSAPP_CLOUD_API_TOKEN`
- [ ] `WHATSAPP_CLOUD_PHONE_NUMBER_ID`
- [ ] `WHATSAPP_ADMIN_TO` atau daftar penerima admin
- [ ] Template message WhatsApp yang sudah disetujui
- [ ] Daftar event yang dikirim ke admin dan customer
- [ ] Test delivery status dan error response

### Email

- [ ] Pilih provider awal: Resend atau Brevo
- [ ] API key disimpan sebagai Cloudflare secret
- [ ] Domain/subdomain pengirim diverifikasi
- [ ] SPF/DKIM dikonfigurasi
- [ ] Daftar email penerima internal
- [ ] Template order baru, payment sukses, payment gagal, dan fulfillment

### Discord

- [ ] Buat channel khusus server alert
- [ ] Buat Discord webhook URL
- [ ] Simpan sebagai `DISCORD_WEBHOOK_URL`
- [ ] Pisahkan channel alert production dan staging jika diperlukan
- [ ] Pastikan log tidak memuat token, password, atau data sensitif customer

## P1 — staging dan production

- [ ] Buat Worker Cloudflare terpisah untuk staging dan production.
- [ ] Gunakan Supabase project/database terpisah untuk staging dan production.
- [ ] Pisahkan semua environment variable dan secret.
- [ ] Gunakan payment sandbox di staging dan live credential di production.
- [ ] Buat seed data staging untuk brand, SKU, package, reward, stok, dan customer.
- [ ] Siapkan prosedur deployment, rollback, dan migrasi database.
- [ ] Tetapkan custom domain production setelah smoke test berhasil.

## P1 — reliability dan keamanan

- [ ] Review RLS seluruh tabel customer, order, loyalty, reward, dan admin.
- [ ] Pastikan service-role key hanya digunakan server-side.
- [ ] Validasi webhook signature dan replay protection.
- [ ] Tambahkan rate limit pada auth, checkout, webhook, dan endpoint notification.
- [ ] Buat backup database dan prosedur restore.
- [ ] Tambahkan health check untuk Worker dan database.
- [ ] Aktifkan monitoring Cloudflare Worker, Supabase, payment, queue, dan provider.
- [ ] Uji timeout, provider down, database error, duplicate request, dan partial failure.

## P1 — customer experience

- [ ] Tampilkan status order dan status payment yang jelas kepada customer.
- [ ] Tampilkan halaman payment expired/failed dengan tombol retry.
- [ ] Tampilkan konfirmasi order dan nomor order setelah submit.
- [ ] Kirim email/WhatsApp confirmation kepada customer.
- [ ] Pastikan cart tidak mengirim notifikasi internal sebelum order benar-benar dibuat.
- [ ] Pastikan halaman account menampilkan points, reward, dan order terbaru secara konsisten.
- [ ] Finalisasi mobile responsive, loading state, empty state, dan error state.

## P2 — performance Cloudflare

- [ ] Review cache strategy untuk halaman publik dan data katalog.
- [ ] Konfigurasi image optimization dan ukuran gambar yang konsisten.
- [ ] Uji SSR, static assets, dan request ke Supabase dari region berbeda.
- [ ] Pantau CPU time, request limit, queue backlog, dan response time.
- [ ] Uji dengan data katalog dan order yang mendekati kondisi nyata.

## Urutan kerja yang disarankan

1. Selesaikan order state machine dan idempotency.
2. Selesaikan payment sandbox dan payment webhook.
3. Buat notification outbox, queue, retry, dan Discord alert.
4. Siapkan staging Cloudflare + Supabase dan jalankan E2E test.
5. Integrasikan WhatsApp dan email provider.
6. Jalankan UAT tim dengan data realistis.
7. Baru aktifkan credential production dan gunakan custom domain.

