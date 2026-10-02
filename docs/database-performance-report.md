# Database performance tuning report

Tanggal audit: 2026-10-02

## Ringkasan

Tuning diterapkan pada dua lapisan:

1. Query aplikasi tidak lagi mengambil seluruh katalog untuk halaman detail SKU.
2. Database diberi indeks untuk pola `WHERE`, `JOIN`, `ORDER BY`, dan pencarian substring yang benar-benar dipakai aplikasi.

Migration yang berisi indeks:

`supabase/migrations/20261002130000_query_performance_indexes.sql`

Benchmark SQL yang bisa dijalankan di Supabase:

`docs/database-performance-benchmark.sql`

## Perubahan yang dilakukan

| Area | Sebelum | Sesudah |
|---|---|---|
| Detail `/catalog/[sku]` | Memanggil `getCatalogProducts()` dan membaca sampai 1.000 SKU, lalu mencari SKU di JavaScript | Query langsung berdasarkan SKU, maksimal 1 baris |
| Link SKU ke package | Membaca sampai 200 package published walaupun hanya sebagian yang terkait | Ambil link berdasarkan SKU, lalu ambil hanya package ID yang ditemukan |
| Pencarian admin SKU | `ilike '%term%'` tanpa indeks trigram | `pg_trgm` GIN index pada SKU, nama, kategori, series, dan warna |
| Filter brand admin | Relasi parent tidak punya indeks khusus untuk brand | Indeks `catalog_products(brand, id)` |
| Public catalog ordering | Mengandalkan indeks join/filter lama untuk sorting `sort_order` | Partial index khusus SKU aktif dan product published |
| Package link lookup | Index utama package-first, tetapi storefront mencari SKU-first | Reverse index pada `sku_id, package_id` |
| Recent records admin | Beberapa tabel diurutkan `created_at desc` tanpa index ordering khusus | Index ordering untuk inventory, customer, rewards, ledger, redemptions, dan audit |
| Recommendation visibility | Baris yang sudah expired baru dibuang di JavaScript setelah `limit` | Filter waktu dilakukan di database sebelum `limit` |

## Benchmark yang benar-benar terukur di workspace

Environment lokal tidak memiliki `NEXT_PUBLIC_SUPABASE_URL`, publishable key, atau `DATABASE_URL`, dan Supabase CLI lokal tidak sedang terhubung ke database. Karena itu angka latency SQL produksi tidak saya palsukan.

Yang terukur:

| Check | Hasil |
|---|---:|
| TypeScript check | 1,64 detik |
| Next production build | 7,58 detik |
| Detail SKU rows read by application | maksimal 1.000 -> maksimal 1 |
| Package catalog rows loaded for one SKU lookup | maksimal 200 -> hanya package yang terhubung |

Angka latency database sebelum/sesudah harus diambil dari `EXPLAIN (ANALYZE, BUFFERS)` pada database production karena bergantung pada jumlah row, cache PostgreSQL, RLS policy, dan beban saat pengukuran. Jalankan seluruh isi `docs/database-performance-benchmark.sql` sebelum dan sesudah migration, lalu bandingkan:

- `Execution Time`
- `Buffers: shared hit/read`
- `Seq Scan` versus `Index Scan`/`Bitmap Index Scan`
- `Rows Removed by Filter`
- `mean_exec_time` dan `calls` dari `pg_stat_statements`

## Target hasil setelah migration

Target teknisnya adalah:

- pencarian SKU berpindah dari sequential scan ke bitmap/index scan;
- page pertama admin hanya mengambil 10 row, bukan seluruh katalog;
- lookup package link menggunakan index SKU-first;
- query public package/catalog memakai partial index dan tidak mengurutkan seluruh tabel;
- latency aktual dicatat dari execution plan, bukan estimasi.

Migration indeks menambah sedikit biaya pada `INSERT`/`UPDATE` katalog dan SKU karena index harus dipelihara. Trade-off ini disengaja: workload aplikasi lebih dominan read dan sebelumnya CPU Worker terbebani oleh query read yang terlalu lebar.
