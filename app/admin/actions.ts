'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase/server';
import { formatOrderStatusNotification, sendWhatsAppTextTo } from '../../lib/whatsapp';
import type { CatalogProductType, CatalogStockStatus } from '../../lib/admin';

export type AdminActionState = { ok: boolean; message: string };

const CATALOG_PRODUCT_TYPES: CatalogProductType[] = ['GEL_POLISH', 'PREP', 'TOOL', 'ACCESSORY', 'LAMP', 'OTHER'];
const CATALOG_STOCK_STATUSES: CatalogStockStatus[] = ['in_stock', 'low_stock', 'out_of_stock', 'preorder'];

const ADMIN_PERMISSION_KEYS = ['catalog', 'orders', 'notifications', 'pricing', 'promotions', 'packages', 'inventory', 'settings'] as const;
export type AdminPermission = typeof ADMIN_PERMISSION_KEYS[number];

function permissionsFromForm(formData: FormData) {
  const orders = formData.get('permission_orders') === 'on';
  const brands = formData.get('permission_brands') === 'on';
  const packages = formData.get('permission_packages') === 'on';
  return {
    catalog: formData.get('permission_catalog') === 'on',
    orders,
    notifications: orders,
    pricing: formData.get('permission_pricing') === 'on',
    promotions: formData.get('permission_promotions') === 'on',
    packages: brands && packages,
    inventory: formData.get('permission_inventory') === 'on',
    settings: formData.get('permission_settings') === 'on',
  };
}
async function requireAdmin(requiredPermission: AdminPermission) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return { ok: false as const, message: 'Isi env Supabase untuk menyimpan perubahan admin.' };
  }
  const supabase = await createClient();
  const { data: membership, error } = await supabase.from('admin_memberships').select('role, is_active, permissions').maybeSingle();
  const permissions = membership?.permissions && typeof membership.permissions === 'object' ? membership.permissions as Record<string, unknown> : {};
  const allowed = membership?.role === 'owner' || permissions[requiredPermission] === true;
  if (error || !membership?.is_active || !allowed) return { ok: false as const, message: 'Akun ini belum memiliki permission admin yang diperlukan.' };
  return { ok: true as const, supabase };
}
async function requireAnyAdmin(requiredPermissions: AdminPermission[]) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return { ok: false as const, message: 'Isi env Supabase untuk menyimpan perubahan admin.' };
  }
  const supabase = await createClient();
  const { data: membership, error } = await supabase.from('admin_memberships').select('role, is_active, permissions').maybeSingle();
  const permissions = membership?.permissions && typeof membership.permissions === 'object' ? membership.permissions as Record<string, unknown> : {};
  const allowed = membership?.role === 'owner' || requiredPermissions.some((permission) => permissions[permission] === true);
  if (error || !membership?.is_active || !allowed) return { ok: false as const, message: 'Akun ini belum memiliki permission admin yang diperlukan.' };
  return { ok: true as const, supabase };
}
export async function upsertAdminMembership(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? 'support');
  if (!email || !email.includes('@')) return { ok: false, message: 'Masukkan email Google yang sudah terdaftar di Supabase Auth.' };
  if (!['catalog_manager', 'orders_manager', 'support'].includes(role)) return { ok: false, message: 'Role admin tidak valid.' };
  const access = await requireOwner();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc('upsert_admin_membership_by_email', { p_email: email, p_role: role, p_permissions: permissionsFromForm(formData) });
  if (error) return { ok: false, message: error.message.includes('No Supabase') ? 'Email belum pernah login dengan Google di aplikasi.' : 'Admin belum tersimpan. Periksa email dan koneksi Supabase.' };
  revalidatePath('/admin');
  return { ok: true, message: 'Akses admin berhasil disimpan.' };
}

export async function setAdminMembershipStatus(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const userId = String(formData.get('user_id') ?? '');
  const isActive = formData.get('is_active') === 'true';
  if (!userId) return { ok: false, message: 'Admin tidak ditemukan.' };
  const access = await requireOwner();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc('set_admin_membership_status', { p_user_id: userId, p_is_active: isActive });
  if (error) return { ok: false, message: 'Status admin belum dapat diperbarui.' };
  revalidatePath('/admin');
  return { ok: true, message: isActive ? 'Akses admin diaktifkan.' : 'Akses admin dinonaktifkan.' };
}
export async function updateCatalogProduct(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const productId = String(formData.get('product_id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim();
  const isPublished = formData.get('is_published') === 'on';
  if (!productId || !name || !category) return { ok: false, message: 'Nama dan kategori wajib diisi.' };

  const access = await requireAdmin('catalog');
  if (!access.ok) return access;

  const { error } = await access.supabase.from('catalog_products').update({ name, category, is_published: isPublished }).eq('id', productId);
  if (error) return { ok: false, message: 'Produk belum tersimpan. Periksa koneksi Supabase.' };
  revalidatePath('/');
  revalidatePath('/admin');
  return { ok: true, message: 'Produk berhasil diperbarui.' };
}

export async function createCatalogProduct(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const rawSlug = String(formData.get('slug') ?? '').trim();
  const brand = String(formData.get('brand') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim();
  const slug = slugFromText(rawSlug || name);
  if (!slug || !brand || !name || !category) return { ok: false, message: 'Nama produk, brand, dan kategori wajib diisi. Slug boleh dikosongkan.' };
  const access = await requireAdmin('catalog');
  if (!access.ok) return access;
  const { error } = await access.supabase.from('catalog_products').insert({ slug, brand, name, category, short_description: String(formData.get('short_description') ?? '').trim() || null, is_published: formData.get('is_published') === 'on', sort_order: integerOrZero(formData.get('sort_order')) });
  if (error) return { ok: false, message: 'Produk belum dibuat. Pastikan slug belum dipakai.' };
  revalidatePath('/');
  revalidatePath('/admin');
  return { ok: true, message: 'Produk baru berhasil dibuat.' };
}

function inferCatalogProductType(categoryLabel: string): CatalogProductType {
  const normalized = categoryLabel.toLowerCase();
  if (normalized.includes('accessor')) return 'ACCESSORY';
  if (normalized.includes('tool')) return 'TOOL';
  if (normalized.includes('prep')) return 'PREP';
  if (normalized.includes('lamp')) return 'LAMP';
  if (normalized.includes('color') || normalized.includes('essential') || normalized.includes('gel') || normalized.includes('polish')) return 'GEL_POLISH';
  return 'OTHER';
}

function imageExtension(type: string) {
  return type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
}

function getCatalogImageFile(formData: FormData) {
  const entry = formData.get('image_file');
  if (!entry || typeof entry === 'string' || typeof entry.size !== 'number' || entry.size === 0) return { file: null, invalid: false };
  const file = entry as File;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 6 * 1024 * 1024) return { file: null, invalid: true };
  return { file, invalid: false };
}

async function uploadCatalogImage(supabase: Awaited<ReturnType<typeof createClient>>, productId: string, file: File): Promise<{ url: string; path: string } | { error: string }> {
  const imagePath = 'skus/' + productId + '/' + crypto.randomUUID() + '.' + imageExtension(file.type);
  const { error } = await supabase.storage.from('catalog-images').upload(imagePath, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
  if (error) return { error: 'Foto SKU belum dapat diupload. Gunakan JPG, PNG, atau WEBP maksimal 6 MB.' };
  return { url: supabase.storage.from('catalog-images').getPublicUrl(imagePath).data.publicUrl, path: imagePath };
}

function catalogStoragePath(url: string | null) {
  if (!url) return null;
  const marker = '/storage/v1/object/public/catalog-images/';
  const index = url.indexOf(marker);
  return index >= 0 ? decodeURIComponent(url.slice(index + marker.length)) : null;
}

async function removeCatalogImage(supabase: Awaited<ReturnType<typeof createClient>>, url: string | null) {
  const path = catalogStoragePath(url);
  if (path) await supabase.storage.from('catalog-images').remove([path]);
}

function getPackageImageFiles(formData: FormData) {
  const files = formData.getAll('package_images').filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length > 5) return 'too_many' as const;
  if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 6 * 1024 * 1024)) return 'invalid' as const;
  return files;
}

async function addPackageImages(supabase: Awaited<ReturnType<typeof createClient>>, packageId: string, files: File[]) {
  if (!files.length) return null;
  const { count, error: countError } = await supabase.from('commerce_package_images').select('id', { count: 'exact', head: true }).eq('package_id', packageId);
  if (countError || (count ?? 0) + files.length > 5) return 'Satu package maksimal memiliki 5 foto.';
  const uploadedPaths: string[] = [];
  for (const [index, file] of files.entries()) {
    const imagePath = 'packages/' + packageId + '/' + crypto.randomUUID() + '.' + imageExtension(file.type);
    const { error: uploadError } = await supabase.storage.from('package-images').upload(imagePath, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
    if (uploadError) {
      if (uploadedPaths.length) await supabase.storage.from('package-images').remove(uploadedPaths);
      return 'Foto package belum dapat diupload. Pastikan migration package images sudah dijalankan.';
    }
    uploadedPaths.push(imagePath);
    const imageUrl = supabase.storage.from('package-images').getPublicUrl(imagePath).data.publicUrl;
    const { error: insertError } = await supabase.from('commerce_package_images').insert({ package_id: packageId, image_url: imageUrl, alt_text: 'Foto package', sort_order: (count ?? 0) + index });
    if (insertError) {
      await supabase.storage.from('package-images').remove(uploadedPaths);
      return 'Foto package sudah diupload tetapi belum tercatat. Pastikan migration package images sudah dijalankan.';
    }
  }
  return null;
}

function packageStoragePath(url: string) {
  const marker = '/storage/v1/object/public/package-images/';
  const index = url.indexOf(marker);
  return index >= 0 ? decodeURIComponent(url.slice(index + marker.length)) : null;
}
async function rollbackCreatedPackage(supabase: Awaited<ReturnType<typeof createClient>>, packageId: string) {
  const { data: images } = await supabase.from('commerce_package_images').select('image_url').eq('package_id', packageId);
  const { error } = await supabase.from('commerce_packages').delete().eq('id', packageId);
  if (error) return false;
  const paths = (images ?? []).map((image) => packageStoragePath(image.image_url)).filter((path): path is string => Boolean(path));
  if (paths.length) await supabase.storage.from('package-images').remove(paths);
  return true;
}
export async function createCatalogCategory(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const name = String(formData.get('name') ?? '').trim();
  const slug = slugFromText(String(formData.get('slug') ?? '').trim() || name);
  const sortOrder = integerOrZero(formData.get('sort_order'));
  if (!name || !slug) return { ok: false, message: 'Nama kategori wajib diisi.' };
  const access = await requireAdmin('catalog');
  if (!access.ok) return access;
  const { error } = await access.supabase.from('catalog_categories').insert({ name, slug, sort_order: sortOrder, is_active: true });
  if (error) return { ok: false, message: error.code === '23505' ? 'Nama atau slug kategori sudah digunakan.' : 'Kategori belum dapat dibuat.' };
  revalidatePath('/admin');
  return { ok: true, message: 'Kategori berhasil ditambahkan.' };
}

export async function archiveCatalogCategory(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const id = String(formData.get('category_id') ?? '').trim();
  if (!id) return { ok: false, message: 'Kategori tidak ditemukan.' };
  const access = await requireAdmin('catalog');
  if (!access.ok) return access;
  const { count } = await access.supabase.from('catalog_skus').select('id', { count: 'exact', head: true }).eq('category_id', id);
  if ((count ?? 0) > 0) return { ok: false, message: 'Kategori masih dipakai SKU. Pindahkan SKU terlebih dahulu.' };
  const { error } = await access.supabase.from('catalog_categories').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { ok: false, message: 'Kategori belum dapat diarsipkan.' };
  revalidatePath('/admin');
  return { ok: true, message: 'Kategori diarsipkan.' };
}
async function findOrCreateCatalogProduct(supabase: Awaited<ReturnType<typeof createClient>>, brandName: string, categoryLabel: string, categoryId: string) {
  const findExisting = () => supabase.from('catalog_products').select('id').eq('brand', brandName).eq('category', categoryLabel).limit(1).maybeSingle();
  const existing = await findExisting();
  if (existing.error) return { error: 'Produk induk SKU belum dapat dicek. Periksa koneksi database.' } as const;
  if (existing.data) return { id: existing.data.id } as const;
  const slug = slugFromText(brandName + '-' + categoryLabel);
  const { data: created, error: productError } = await supabase.from('catalog_products').insert({ slug, brand: brandName, name: brandName + ' ' + categoryLabel, category: categoryLabel, category_id: categoryId || null, short_description: 'Catalog parent untuk SKU ' + brandName + '.', is_published: true, sort_order: 0 }).select('id').single();
  if (created) return { id: created.id } as const;
  // Dua submit bersamaan dapat sama-sama lolos lookup awal. Pakai parent yang berhasil dibuat submit pertama.
  const concurrent = await findExisting();
  if (concurrent.data) return { id: concurrent.data.id } as const;
  return { error: productError ? 'Produk induk SKU belum bisa dibuat. Periksa kombinasi brand dan kategori.' : 'Produk induk SKU belum bisa dibuat.' } as const;
}
export async function createCatalogSku(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  try {
    return await createCatalogSkuInternal(previous, formData);
  } catch (error) {
    console.error('createCatalogSku failed', error);
    return { ok: false, message: 'SKU belum dapat dibuat. Periksa data Tools dan coba lagi.' };
  }
}
async function createCatalogSkuInternal(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  let productId = String(formData.get('product_id') ?? '').trim();
  const brandId = String(formData.get('brand_id') ?? '').trim();
  const sku = String(formData.get('sku') ?? '').trim().toUpperCase();
  const name = String(formData.get('name') ?? '').trim();
  const categoryId = String(formData.get('category_id') ?? '').trim();
  const categoryLabelInput = String(formData.get('category_label') ?? '').trim();
  const series = String(formData.get('series') ?? '').trim() || null;
  const color = String(formData.get('color') ?? '').trim() || null;
  const referencePrice = moneyInteger(formData.get('public_reference_price_idr'));
  const catalogImage = getCatalogImageFile(formData);
  if (catalogImage.invalid) return { ok: false, message: 'Foto SKU harus JPG, PNG, atau WEBP dengan ukuran maksimal 6 MB.' };
  const imageFile = catalogImage.file;
  let imageUrl: string | null = null;
  let productType = String(formData.get('product_type') ?? '').trim() as CatalogProductType;
  const countsTowardBottleMoq = formData.get('counts_toward_bottle_moq') === 'on';
  const stockStatus = String(formData.get('stock_status') ?? 'in_stock') as CatalogStockStatus;
  const stockQuantity = Math.max(0, integerOrZero(formData.get('stock_quantity')));
  const isActive = formData.has('is_active') ? formData.get('is_active') === 'on' : true;
  if ((!productId && !brandId) || !/^[A-Z0-9._-]{2,60}$/.test(sku)) return { ok: false, message: 'Pilih brand dan isi SKU code dengan huruf kapital, angka, titik, strip, atau underscore.' };
  if (!name) return { ok: false, message: 'Nama SKU wajib diisi.' };
  if (!categoryId && !categoryLabelInput) return { ok: false, message: 'Pilih satu kategori SKU.' };

  if (!CATALOG_STOCK_STATUSES.includes(stockStatus)) return { ok: false, message: 'Status stok tidak valid.' };

  const access = await requireAnyAdmin(['catalog', 'packages']);
  if (!access.ok) return access;
  const { data: duplicateSku, error: duplicateSkuError } = await access.supabase.from('catalog_skus').select('id').eq('sku', sku).maybeSingle();
  if (duplicateSkuError) return { ok: false, message: 'SKU belum dapat divalidasi. Periksa koneksi database.' };
  if (duplicateSku) return { ok: false, message: 'SKU code sudah digunakan. Gunakan SKU code lain.' };
  let categoryLabel = categoryLabelInput;
  if (categoryId) {
    const { data: category } = await access.supabase.from('catalog_categories').select('id, name').eq('id', categoryId).maybeSingle();
    if (!category) return { ok: false, message: 'Kategori SKU tidak ditemukan atau sudah diarsipkan.' };
    categoryLabel = category.name;
  }
  if (!productType) productType = inferCatalogProductType(categoryLabel);
  if (!CATALOG_PRODUCT_TYPES.includes(productType)) return { ok: false, message: 'Kategori belum dapat dipetakan ke tipe produk. Pilih kategori yang valid.' };
  if (productType === 'GEL_POLISH' && !color) return { ok: false, message: 'Gel polish wajib memiliki satu color/shade per SKU.' };

  if (!productId) {
    const { data: brand } = await access.supabase.from('catalog_brands').select('id, name').eq('id', brandId).maybeSingle();
    if (!brand) return { ok: false, message: 'Brand tidak ditemukan. Buat brand terlebih dahulu di Brand Register.' };
    const parent = await findOrCreateCatalogProduct(access.supabase, brand.name, categoryLabel, categoryId);
    if ('error' in parent) return { ok: false, message: parent.error ?? 'Produk induk SKU belum bisa dibuat.' };
    productId = parent.id;
  }

  if (imageFile) {
    const uploaded = await uploadCatalogImage(access.supabase, productId, imageFile);
    const uploadedUrl = 'url' in uploaded ? String(uploaded.url ?? '') : '';
    if (!uploadedUrl) return { ok: false, message: 'Foto belum dapat diupload.' };
    imageUrl = uploadedUrl;
  }

  const { error } = await access.supabase.from('catalog_skus').insert({ product_id: productId, sku, name, category_id: categoryId || null, category_label: categoryLabel, series, color, public_reference_price_idr: referencePrice, shade_code: null, tone: 'tone-clear', badge: String(formData.get('badge') ?? '').trim() || null, image_url: imageUrl, product_type: productType, counts_toward_bottle_moq: countsTowardBottleMoq, stock_status: stockStatus, stock_quantity: stockQuantity, is_active: isActive, sort_order: integerOrZero(formData.get('sort_order')) });
  if (error) {
    if (imageUrl) await removeCatalogImage(access.supabase, imageUrl);
    return { ok: false, message: error.code === '23505' ? 'SKU code sudah digunakan. Gunakan SKU code lain.' : 'SKU belum dibuat. Periksa parent brand, kategori, dan koneksi database.' };
  }
  revalidatePath('/'); revalidatePath('/admin');
  return { ok: true, message: 'SKU baru berhasil dibuat.' };
}
export async function updateCatalogSku(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const skuId = String(formData.get('sku_id') ?? '').trim();
  const sku = String(formData.get('sku') ?? '').trim().toUpperCase();
  const name = String(formData.get('name') ?? '').trim();
  const categoryId = String(formData.get('category_id') ?? '').trim();
  const categoryLabelInput = String(formData.get('category_label') ?? '').trim();
  const series = String(formData.get('series') ?? '').trim() || null;
  const color = String(formData.get('color') ?? '').trim() || null;
  const referencePrice = moneyInteger(formData.get('public_reference_price_idr'));
  const catalogImage = getCatalogImageFile(formData);
  if (catalogImage.invalid) return { ok: false, message: 'Foto SKU harus JPG, PNG, atau WEBP dengan ukuran maksimal 6 MB.' };
  const imageFile = catalogImage.file;
  const currentImageUrl = String(formData.get('current_image_url') ?? '').trim() || null;
  let imageUrl: string | null = currentImageUrl;
  let productType = String(formData.get('product_type') ?? '').trim() as CatalogProductType;
  const countsTowardBottleMoq = formData.get('counts_toward_bottle_moq') === 'on';
  const stockStatus = String(formData.get('stock_status') ?? 'in_stock') as CatalogStockStatus;
  const stockQuantity = Math.max(0, integerOrZero(formData.get('stock_quantity')));
  const isActive = formData.has('is_active') ? formData.get('is_active') === 'on' : true;
  if (!skuId) return { ok: false, message: 'SKU ID tidak ditemukan.' };
  if (!/^[A-Z0-9._-]{2,60}$/.test(sku)) return { ok: false, message: 'SKU code tidak valid.' };
  if (!name) return { ok: false, message: 'Nama SKU wajib diisi.' };
  if (!categoryId && !categoryLabelInput) return { ok: false, message: 'Pilih satu kategori SKU.' };

  if (!CATALOG_STOCK_STATUSES.includes(stockStatus)) return { ok: false, message: 'Status stok tidak valid.' };

  const access = await requireAnyAdmin(['catalog', 'packages']);
  if (!access.ok) return access;
  let categoryLabel = categoryLabelInput;
  if (categoryId) {
    const { data: category } = await access.supabase.from('catalog_categories').select('id, name').eq('id', categoryId).maybeSingle();
    if (!category) return { ok: false, message: 'Kategori SKU tidak ditemukan atau sudah diarsipkan.' };
    categoryLabel = category.name;
  }
  if (!productType) productType = inferCatalogProductType(categoryLabel);
  if (!CATALOG_PRODUCT_TYPES.includes(productType)) return { ok: false, message: 'Kategori belum dapat dipetakan ke tipe produk. Pilih kategori yang valid.' };
  if (productType === 'GEL_POLISH' && !color) return { ok: false, message: 'Gel polish wajib memiliki satu color/shade per SKU.' };
  if (imageFile) {
    const uploaded = await uploadCatalogImage(access.supabase, skuId, imageFile);
    const uploadedUrl = 'url' in uploaded ? String(uploaded.url ?? '') : '';
    if (!uploadedUrl) return { ok: false, message: 'Foto belum dapat diupload.' };
    imageUrl = uploadedUrl;
  }
  const { error } = await access.supabase.from('catalog_skus').update({ sku, name, category_id: categoryId || null, category_label: categoryLabel, series, color, public_reference_price_idr: referencePrice, badge: String(formData.get('badge') ?? '').trim() || null, image_url: imageUrl, product_type: productType, counts_toward_bottle_moq: countsTowardBottleMoq, stock_status: stockStatus, stock_quantity: stockQuantity, is_active: isActive, sort_order: integerOrZero(formData.get('sort_order')), updated_at: new Date().toISOString() }).eq('id', skuId);
  if (error) {
    if (imageFile) await removeCatalogImage(access.supabase, imageUrl);
    return { ok: false, message: error.code === '23505' ? 'SKU code sudah digunakan SKU lain.' : 'SKU belum diperbarui. Periksa data dan koneksi database.' };
  }
  if (imageFile && currentImageUrl && currentImageUrl !== imageUrl) await removeCatalogImage(access.supabase, currentImageUrl);
  revalidatePath('/'); revalidatePath('/admin'); revalidatePath('/packages'); revalidatePath('/brands');
  return { ok: true, message: 'SKU berhasil diperbarui.' };
}
export async function deleteCatalogSku(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const skuId = String(formData.get('sku_id') ?? '').trim();
  if (!skuId) return { ok: false, message: 'SKU ID tidak ditemukan.' };
  const access = await requireAnyAdmin(['catalog', 'packages']);
  if (!access.ok) return access;
  const { data: sku } = await access.supabase.from('catalog_skus').select('sku, name, product_id, image_url').eq('id', skuId).maybeSingle();
  if (!sku) return { ok: false, message: 'SKU tidak ditemukan atau sudah dihapus.' };
  const [{ count: packageCount }, { count: allowedCount }, { count: stockCount }, { count: orderCount }] = await Promise.all([
    access.supabase.from('commerce_package_items').select('id', { count: 'exact', head: true }).eq('sku_id', skuId),
    access.supabase.from('commerce_package_allowed_skus').select('package_id', { count: 'exact', head: true }).eq('sku_id', skuId),
    access.supabase.from('inventory_stock').select('id', { count: 'exact', head: true }).eq('sku_id', skuId),
    access.supabase.from('commerce_order_items').select('id', { count: 'exact', head: true }).eq('sku_id', skuId),
  ]);
  if ((packageCount ?? 0) > 0 || (allowedCount ?? 0) > 0) return { ok: false, message: 'SKU ' + sku.sku + ' masih dipakai package. Hapus dari package atau nonaktifkan SKU.' };
  if ((stockCount ?? 0) > 0) return { ok: false, message: 'SKU ' + sku.sku + ' masih memiliki record inventory. Hapus stock record dahulu atau nonaktifkan SKU.' };
  if ((orderCount ?? 0) > 0) return { ok: false, message: 'SKU ' + sku.sku + ' sudah tercatat pada transaksi. Nonaktifkan SKU agar histori order tetap aman.' };
  const { error } = await access.supabase.from('catalog_skus').delete().eq('id', skuId);
  if (error) return { ok: false, message: 'SKU belum dapat dihapus: ' + error.message };
  if (sku.product_id) {
    const { count: remainingSkuCount } = await access.supabase.from('catalog_skus').select('id', { count: 'exact', head: true }).eq('product_id', sku.product_id);
    if ((remainingSkuCount ?? 0) === 0) await access.supabase.from('catalog_products').delete().eq('id', sku.product_id);
  }
  revalidatePath('/'); revalidatePath('/admin'); revalidatePath('/packages'); revalidatePath('/catalog');
  return { ok: true, message: 'SKU ' + sku.sku + ' berhasil dihapus.' };
}
export async function updatePricingTier(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const tierId = String(formData.get('tier_id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const minimumSpend = requiredMoneyInteger(formData.get('minimum_lifetime_spend_idr'));
  const minimumOrders = Number(formData.get('minimum_paid_order_count') ?? 0);
  const customerRole = String(formData.get('customer_role') ?? 'all');
  const isActive = formData.get('is_active') === 'on';

  if (!tierId || !name || !['all', 'home_studio', 'salon', 'distributor', 'vip'].includes(customerRole) || !Number.isInteger(minimumSpend) || minimumSpend < 0 || !Number.isInteger(minimumOrders) || minimumOrders < 0) {
    return { ok: false, message: 'Nama, threshold belanja, dan jumlah order harus diisi dengan benar.' };
  }

  const access = await requireAdmin('pricing');
  if (!access.ok) return access;

  const { error } = await access.supabase.from('pricing_tiers').update({
    name,
    minimum_lifetime_spend_idr: minimumSpend,
    minimum_paid_order_count: minimumOrders,
    customer_role: customerRole,
    is_active: isActive,
  }).eq('id', tierId);
  if (error) return { ok: false, message: 'Aturan pricing belum tersimpan. Periksa koneksi Supabase.' };
  revalidatePath('/');
  revalidatePath('/admin');
  return { ok: true, message: 'Aturan pricing berhasil diperbarui.' };
}

export async function createPricingTier(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  const name = String(formData.get('name') ?? '').trim();
  const customerRole = String(formData.get('customer_role') ?? 'all');
  const minimumSpend = requiredMoneyInteger(formData.get('minimum_lifetime_spend_idr'));
  const minimumOrders = Number(formData.get('minimum_paid_order_count') ?? 0);
  if (!/^[A-Z0-9_]{2,30}$/.test(code) || !name || !['all', 'home_studio', 'salon', 'distributor', 'vip'].includes(customerRole) || minimumSpend < 0 || !Number.isInteger(minimumOrders) || minimumOrders < 0) return { ok: false, message: 'Code, nama, role, threshold, dan minimum paid order wajib valid.' };
  const access = await requireAdmin('pricing');
  if (!access.ok) return access;
  const { error } = await access.supabase.from('pricing_tiers').insert({ code, name, customer_role: customerRole, minimum_lifetime_spend_idr: minimumSpend, minimum_paid_order_count: minimumOrders, price_visibility: code === 'STANDARD' ? 'standard' : 'premium_b2b', is_active: true });
  if (error) return { ok: false, message: 'B2B Tier belum dibuat. Pastikan code belum digunakan dan migration terbaru sudah dijalankan.' };
  revalidatePath('/admin');
  revalidatePath('/');
  return { ok: true, message: 'B2B Tier berhasil dibuat.' };
}

export async function deletePricingTier(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const tierId = String(formData.get('tier_id') ?? '').trim();
  if (!tierId) return { ok: false, message: 'Tier ID tidak ditemukan.' };
  const access = await requireAdmin('pricing');
  if (!access.ok) return access;
  const { data: tier } = await access.supabase.from('pricing_tiers').select('id, code, name').eq('id', tierId).maybeSingle();
  if (!tier) return { ok: false, message: 'B2B Tier tidak ditemukan.' };
  if (tier.code === 'STANDARD') return { ok: false, message: 'Tier STANDARD adalah tier dasar dan tidak dapat dihapus. Nonaktifkan jika diperlukan.' };
  const [{ count: priceCount }, { count: customerCount }, { count: promoCount }] = await Promise.all([
    access.supabase.from('commerce_package_prices').select('id', { count: 'exact', head: true }).eq('pricing_tier_id', tierId),
    access.supabase.from('customer_profiles').select('id', { count: 'exact', head: true }).eq('pricing_tier_id', tierId),
    access.supabase.from('promotion_pricing_tiers').select('promotion_id', { count: 'exact', head: true }).eq('pricing_tier_id', tierId),
  ]);
  if ((priceCount ?? 0) > 0 || (customerCount ?? 0) > 0 || (promoCount ?? 0) > 0) return { ok: false, message: 'Tier masih dipakai oleh harga package, customer, atau promo. Nonaktifkan tier agar histori tetap aman.' };
  const { error } = await access.supabase.from('pricing_tiers').delete().eq('id', tierId);
  if (error) return { ok: false, message: 'B2B Tier belum dapat dihapus karena masih memiliki dependency.' };
  revalidatePath('/admin'); revalidatePath('/');
  return { ok: true, message: `Tier ${tier.name} berhasil dihapus.` };
}export async function markNotificationRead(notificationId: string): Promise<AdminActionState> {
  const access = await requireAdmin('notifications');
  if (!access.ok) return access;
  const { error } = await access.supabase.from('admin_notifications').update({ read_at: new Date().toISOString() }).eq('id', notificationId);
  if (error) return { ok: false, message: 'Notifikasi belum dapat ditandai terbaca.' };
  revalidatePath('/admin');
  return { ok: true, message: 'Notifikasi ditandai terbaca.' };
}

export async function updatePromotion(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const promotionId = String(formData.get('promotion_id') ?? '');
  const values = parsePromotionForm(formData);
  if (!promotionId) return { ok: false, message: 'Promotion ID tidak ditemukan.' };
  if (!values.ok) return { ok: false, message: values.message ?? 'Field promo tidak valid.' };

  const access = await requireAdmin('promotions');
  if (!access.ok) return access;

  const { error } = await access.supabase.from('commerce_promotions').update(values.data).eq('id', promotionId);
  if (error) return { ok: false, message: 'Promo belum tersimpan. Periksa field dan koneksi Supabase.' };
  const eligibilityError = await syncEligibleCustomers(access.supabase, promotionId, values.eligibleCustomerIds);
  if (eligibilityError) return { ok: false, message: eligibilityError };
  revalidatePath('/admin');
  revalidatePath('/');
  return { ok: true, message: 'Promo berhasil diperbarui.' };
}

export async function deletePromotion(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const promotionId = String(formData.get('promotion_id') ?? '').trim();
  if (!promotionId) return { ok: false, message: 'Promotion ID tidak ditemukan.' };
  const access = await requireAdmin('promotions');
  if (!access.ok) return access;
  const { data: promotion } = await access.supabase.from('commerce_promotions').select('id, code, usage_count').eq('id', promotionId).maybeSingle();
  if (!promotion) return { ok: false, message: 'Promo tidak ditemukan atau sudah dihapus.' };
  if ((promotion.usage_count ?? 0) > 0) return { ok: false, message: 'Promo sudah pernah dipakai. Nonaktifkan promo agar histori transaksi tetap aman.' };
  const { error } = await access.supabase.from('commerce_promotions').delete().eq('id', promotionId);
  if (error) return { ok: false, message: 'Promo belum dapat dihapus karena masih memiliki dependency.' };
  revalidatePath('/admin'); revalidatePath('/');
  return { ok: true, message: `Promo ${promotion.code} berhasil dihapus.` };
}export async function createPromotion(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const values = parsePromotionForm(formData);
  if (!values.ok) return { ok: false, message: values.message ?? 'Field promo tidak valid.' };

  const access = await requireAdmin('promotions');
  if (!access.ok) return access;

  const { data, error } = await access.supabase.from('commerce_promotions').insert(values.data).select('id').single();
  if (error || !data) return { ok: false, message: 'Promo belum dibuat. Periksa code dan field wajib.' };
  const eligibilityError = await syncEligibleCustomers(access.supabase, data.id, values.eligibleCustomerIds);
  if (eligibilityError) return { ok: false, message: eligibilityError };
  revalidatePath('/admin');
  revalidatePath('/');
  return { ok: true, message: 'Promo baru berhasil dibuat.' };
}

function parsePromotionForm(formData: FormData) {
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  const name = String(formData.get('name') ?? '').trim();
  const promotionType = String(formData.get('promotion_type') ?? '');
  const audienceType = String(formData.get('audience_type') ?? 'all');
  const discountType = String(formData.get('discount_type') ?? 'percentage');
  const discountValue = Number(formData.get('discount_value') ?? 0);
  const bundlePrice = moneyInteger(formData.get('bundle_price_idr'));
  const minimumOrder = requiredMoneyInteger(formData.get('minimum_order_amount_idr'));
  const minimumQuantity = integerOrZero(formData.get('minimum_item_quantity'));
  const repeatOrderCount = integerOrZero(formData.get('repeat_order_min_count'));
  const usageLimit = optionalInteger(formData.get('usage_limit'));
  const usagePerCustomer = optionalInteger(formData.get('usage_limit_per_customer'));
  const startsAt = parseDateTime(String(formData.get('starts_at') ?? ''));
  const endsAt = parseDateTime(String(formData.get('ends_at') ?? ''));
  const eligibleCustomerIds = String(formData.get('eligible_customer_ids') ?? '').split(',').map((value) => value.trim()).filter(Boolean);

  const validTypes = ['new_user', 'repeat_order', 'bundle', 'seasonal', 'custom_voucher'];
  const validAudiences = ['all', 'new_user', 'repeat_customer', 'pricing_tier', 'custom_customer'];
  const validDiscounts = ['percentage', 'fixed_amount', 'fixed_price', 'free_shipping'];
  if (!/^[A-Z0-9_-]{3,40}$/.test(code) || !name || !validTypes.includes(promotionType) || !validAudiences.includes(audienceType) || !validDiscounts.includes(discountType)) return { ok: false as const, message: 'Code, nama, tipe promo, audience, dan tipe diskon wajib valid.' };
  if (!Number.isFinite(discountValue) || discountValue < 0 || (discountType === 'percentage' && discountValue > 100)) return { ok: false as const, message: 'Nilai diskon tidak valid.' };
  if (promotionType === 'bundle' && bundlePrice === null) return { ok: false as const, message: 'Bundle wajib memiliki harga paket.' };
  if (endsAt && startsAt && endsAt <= startsAt) return { ok: false as const, message: 'Tanggal berakhir harus setelah tanggal mulai.' };
  if (eligibleCustomerIds.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) return { ok: false as const, message: 'Eligible customer harus berupa UUID Supabase, dipisahkan dengan koma.' };

  return {
    ok: true as const,
    data: {
      code,
      name,
      promotion_type: promotionType,
      audience_type: audienceType,
      discount_type: discountType,
      discount_value: discountValue,
      bundle_price_idr: bundlePrice,
      minimum_order_amount_idr: minimumOrder,
      minimum_item_quantity: minimumQuantity,
      repeat_order_min_count: repeatOrderCount,
      voucher_code: String(formData.get('voucher_code') ?? '').trim().toUpperCase() || null,
      usage_limit: usageLimit,
      usage_limit_per_customer: usagePerCustomer,
      starts_at: startsAt ?? new Date().toISOString(),
      ends_at: endsAt,
      status: String(formData.get('status') ?? 'draft'),
      is_stackable: formData.get('is_stackable') === 'on',
      is_active: formData.get('is_active') === 'on',
    },
    eligibleCustomerIds,
  };
}

function slugFromText(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
function integerOrZero(value: FormDataEntryValue | null) {
  const parsed = Number(value ?? 0);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : -1;
}

function optionalInteger(value: FormDataEntryValue | null) {
  if (value === null || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function moneyInteger(value: FormDataEntryValue | null) {
  if (value === null || String(value).trim() === '') return null;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function requiredMoneyInteger(value: FormDataEntryValue | null) {
  return moneyInteger(value) ?? -1;
}

function parseDateTime(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

async function syncEligibleCustomers(supabase: Awaited<ReturnType<typeof createClient>>, promotionId: string, customerIds: string[]) {
  const { error: deleteError } = await supabase.from('promotion_eligible_customers').delete().eq('promotion_id', promotionId);
  if (deleteError) return 'Eligible customer belum tersimpan.';
  if (customerIds.length === 0) return null;
  const { error: insertError } = await supabase.from('promotion_eligible_customers').insert(customerIds.map((customerId) => ({ promotion_id: promotionId, customer_id: customerId })));
  return insertError ? 'Sebagian eligible customer belum tersimpan.' : null;
}async function requireOwner() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return { ok: false as const, message: 'Isi env Supabase untuk menyimpan perubahan admin.' };
  }
  const supabase = await createClient();
  const { data: membership, error } = await supabase.from('admin_memberships').select('role, is_active').maybeSingle();
  if (error || !membership?.is_active || membership.role !== 'owner') return { ok: false as const, message: 'Hanya super admin/owner yang dapat mengatur akses admin.' };
  return { ok: true as const, supabase };
}
function getTrustedLogoImageFile(formData: FormData) {
  const entry = formData.get('image_file');
  if (!entry || typeof entry === 'string' || typeof entry.size !== 'number' || entry.size === 0) return { file: null, invalid: false };
  const file = entry as File;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 6 * 1024 * 1024) return { file: null, invalid: true };
  return { file, invalid: false };
}

async function uploadTrustedLogoImage(supabase: Awaited<ReturnType<typeof createClient>>, file: File) {
  const path = 'trusted-logos/' + crypto.randomUUID() + '.' + (file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg');
  const { error } = await supabase.storage.from('catalog-images').upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
  if (error) return { error: 'Logo belum dapat diupload. Gunakan JPG, PNG, atau WEBP maksimal 6 MB.' };
  return { url: supabase.storage.from('catalog-images').getPublicUrl(path).data.publicUrl };
}

export async function createTrustedLogo(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const name = String(formData.get('name') ?? '').trim();
  const altText = String(formData.get('alt_text') ?? '').trim() || null;
  const sortOrder = integerOrZero(formData.get('sort_order'));
  const imageUrlInput = String(formData.get('image_url') ?? '').trim();
  if (!name) return { ok: false, message: 'Nama customer wajib diisi.' };
  const access = await requireAdmin('settings');
  if (!access.ok) return access;
  const selected = getTrustedLogoImageFile(formData);
  if (selected.invalid) return { ok: false, message: 'Format logo tidak didukung atau ukurannya lebih dari 6 MB.' };
  let imageUrl = imageUrlInput;
  if (selected.file) {
    const uploaded = await uploadTrustedLogoImage(access.supabase, selected.file);
    const uploadedUrl = 'url' in uploaded ? String(uploaded.url ?? '') : '';
    if (!uploadedUrl) return { ok: false, message: 'Logo belum dapat diupload.' };
    imageUrl = uploadedUrl;
  }
  if (!imageUrl) return { ok: false, message: 'Upload logo atau masukkan URL logo.' };
  const { error } = await (access.supabase as any).from('commerce_trusted_logos').insert({ name, image_url: imageUrl, alt_text: altText, sort_order: sortOrder, is_active: formData.get('is_active') !== 'off' });
  if (error) return { ok: false, message: 'Logo customer belum tersimpan. Pastikan migration Trusted by sudah dijalankan.' };
  revalidatePath('/'); revalidatePath('/admin');
  return { ok: true, message: 'Logo customer berhasil ditambahkan.' };
}

export async function updateTrustedLogo(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const id = String(formData.get('logo_id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const altText = String(formData.get('alt_text') ?? '').trim() || null;
  const sortOrder = integerOrZero(formData.get('sort_order'));
  if (!id || !name) return { ok: false, message: 'Logo customer tidak lengkap.' };
  const access = await requireAdmin('settings');
  if (!access.ok) return access;
  const selected = getTrustedLogoImageFile(formData);
  if (selected.invalid) return { ok: false, message: 'Format logo tidak didukung atau ukurannya lebih dari 6 MB.' };
  let imageUrl = String(formData.get('current_image_url') ?? '').trim();
  if (selected.file) {
    const uploaded = await uploadTrustedLogoImage(access.supabase, selected.file);
    const uploadedUrl = 'url' in uploaded ? String(uploaded.url ?? '') : '';
    if (!uploadedUrl) return { ok: false, message: 'Logo belum dapat diupload.' };
    imageUrl = uploadedUrl;
  }
  const { error } = await (access.supabase as any).from('commerce_trusted_logos').update({ name, image_url: imageUrl, alt_text: altText, sort_order: sortOrder, is_active: formData.get('is_active') === 'on', updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { ok: false, message: 'Logo customer belum diperbarui.' };
  revalidatePath('/'); revalidatePath('/admin');
  return { ok: true, message: 'Logo customer berhasil diperbarui.' };
}

export async function deleteTrustedLogo(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const id = String(formData.get('logo_id') ?? '').trim();
  if (!id) return { ok: false, message: 'Logo customer tidak ditemukan.' };
  const access = await requireAdmin('settings');
  if (!access.ok) return access;
  const { error } = await (access.supabase as any).from('commerce_trusted_logos').delete().eq('id', id);
  if (error) return { ok: false, message: 'Logo customer belum dapat dihapus.' };
  revalidatePath('/'); revalidatePath('/admin');
  return { ok: true, message: 'Logo customer berhasil dihapus.' };
}
export async function createBrand(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  const name = String(formData.get('name') ?? '').trim();
  const visualTone = String(formData.get('visual_tone') ?? 'clay');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !name || !['clay', 'ivory', 'plum', 'champagne'].includes(visualTone)) return { ok: false, message: 'Slug, nama, dan tone brand wajib valid.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const { error } = await access.supabase.from('catalog_brands').insert({ slug, name, tagline: String(formData.get('tagline') ?? '').trim() || null, description: String(formData.get('description') ?? '').trim() || null, visual_tone: visualTone, is_published: formData.get('is_published') === 'on', sort_order: integerOrZero(formData.get('sort_order')) });
  if (error) return { ok: false, message: 'Brand belum dibuat. Pastikan slug belum dipakai.' };
  revalidatePath('/admin'); revalidatePath('/brands'); revalidatePath('/packages');
  return { ok: true, message: 'Brand berhasil dibuat.' };
}
export async function updateBrand(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const brandId = String(formData.get('brand_id') ?? '').trim();
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  const name = String(formData.get('name') ?? '').trim();
  const visualTone = String(formData.get('visual_tone') ?? 'clay');
  if (!brandId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !name || !['clay', 'ivory', 'plum', 'champagne'].includes(visualTone)) return { ok: false, message: 'Slug, nama, dan tone brand wajib valid.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const { error } = await access.supabase.from('catalog_brands').update({ slug, name, tagline: String(formData.get('tagline') ?? '').trim() || null, description: String(formData.get('description') ?? '').trim() || null, visual_tone: visualTone, is_published: formData.get('is_published') === 'on', sort_order: integerOrZero(formData.get('sort_order')) }).eq('id', brandId);
  if (error) return { ok: false, message: 'Brand belum diperbarui. Pastikan slug belum dipakai.' };
  revalidatePath('/admin'); revalidatePath('/brands'); revalidatePath('/packages');
  return { ok: true, message: 'Brand berhasil diperbarui.' };
}

export async function deleteBrand(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const brandId = String(formData.get('brand_id') ?? '').trim();
  if (!brandId) return { ok: false, message: 'Brand ID tidak ditemukan.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const { data: brand } = await access.supabase.from('catalog_brands').select('id, name').eq('id', brandId).maybeSingle();
  if (!brand) return { ok: false, message: 'Brand tidak ditemukan atau sudah dihapus.' };
  const { count: packageCount } = await access.supabase.from('commerce_packages').select('id', { count: 'exact', head: true }).eq('brand_id', brandId);
  if ((packageCount ?? 0) > 0) return { ok: false, message: 'Brand masih dipakai package. Hapus package terlebih dahulu.' };
  const { data: products } = await access.supabase.from('catalog_products').select('id').eq('brand', brand.name);
  const productIds = (products ?? []).map((product) => product.id).filter((id): id is string => Boolean(id));
  if (productIds.length) {
    const { count: skuCount } = await access.supabase.from('catalog_skus').select('id', { count: 'exact', head: true }).in('product_id', productIds);
    if ((skuCount ?? 0) > 0) return { ok: false, message: 'Brand masih memiliki SKU aktif/tersimpan. Hapus SKU terlebih dahulu.' };
    const { error: productError } = await access.supabase.from('catalog_products').delete().in('id', productIds);
    if (productError) return { ok: false, message: 'Data induk catalog brand belum dapat dibersihkan.' };
  }
  const { error } = await access.supabase.from('catalog_brands').delete().eq('id', brandId);
  if (error) return { ok: false, message: 'Brand belum dapat dihapus: ' + error.message };
  revalidatePath('/admin'); revalidatePath('/brands'); revalidatePath('/packages'); revalidatePath('/catalog');
  return { ok: true, message: 'Brand ' + brand.name + ' berhasil dihapus.' };
}
function parsePackageTierPrices(tiers: { id: string; code: string }[], formData: FormData) {
  const basePrice = formData.get('price_idr');
  const prices: Array<{ tierId: string; tierCode: string; value: number }> = [];
  for (const [index, tier] of tiers.entries()) {
    const raw = formData.get('package_price_' + tier.id);
    const value = raw !== null && String(raw).trim() !== '' ? moneyInteger(raw) : index === 0 ? moneyInteger(basePrice) : null;
    if (value === null || value < 0) return { error: 'Harga bundling untuk tier ' + tier.code + ' wajib diisi dengan angka yang valid.' } as const;
    prices.push({ tierId: tier.id, tierCode: tier.code, value });
  }
  return { prices } as const;
}

async function syncPackagePrices(supabase: Awaited<ReturnType<typeof createClient>>, packageId: string, formData: FormData) {
  const { data: tiers, error: tierError } = await supabase.from('pricing_tiers').select('id, code').eq('is_active', true).order('sort_order');
  if (tierError) return 'B2B Tier belum dapat dibaca.';
  if (!tiers?.length) return 'Belum ada B2B Tier aktif. Buat minimal satu tier terlebih dahulu.';
  const parsed = parsePackageTierPrices(tiers, formData);
  if ('error' in parsed) return parsed.error;
  const now = new Date().toISOString();
  for (const price of parsed.prices) {
    const tier = tiers.find((entry) => entry.id === price.tierId);
    if (!tier) return 'B2B Tier tidak ditemukan.';
    const { error: archiveError } = await supabase.from('commerce_package_prices').update({ is_active: false, effective_until: now }).eq('package_id', packageId).eq('pricing_tier_id', tier.id).eq('is_active', true);
    if (archiveError) return 'Harga tier lama belum dapat diarsipkan.';
    const { error: insertError } = await supabase.from('commerce_package_prices').insert({ package_id: packageId, pricing_tier_id: tier.id, unit_price_idr: price.value, effective_from: now, is_active: true });
    if (insertError) return 'Harga package untuk tier ' + tier.code + ' belum tersimpan.';
  }
  return null;
}

export async function createInventoryStock(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const locationId = String(formData.get('location_id') ?? '');
  const skuId = String(formData.get('sku_id') ?? '');
  const onHand = integerOrZero(formData.get('on_hand_quantity'));
  const reserved = integerOrZero(formData.get('reserved_quantity'));
  const reorder = integerOrZero(formData.get('reorder_point'));
  if (!locationId || !skuId || onHand < 0 || reserved < 0 || reorder < 0 || reserved > onHand) return { ok: false, message: 'Lokasi, SKU, dan quantity inventory wajib valid.' };
  const access = await requireAdmin('inventory');
  if (!access.ok) return access;
  const { data, error } = await access.supabase.from('inventory_stock').insert({ location_id: locationId, sku_id: skuId, on_hand_quantity: onHand, reserved_quantity: reserved, reorder_point: reorder }).select('id').single();
  if (error || !data) return { ok: false, message: 'Stock belum dibuat. Pastikan lokasi dan SKU belum memiliki baris stock.' };
  if (onHand > 0) {
    const { data: authData } = await access.supabase.auth.getUser();
    await access.supabase.from('inventory_movements').insert({ location_id: locationId, sku_id: skuId, movement_type: 'receiving', quantity_delta: onHand, reason: 'Initial stock', created_by: authData.user?.id ?? null });
  }
  revalidatePath('/admin');
  return { ok: true, message: 'Stock berhasil ditambahkan.' };
}

export async function updateInventoryStock(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const id = String(formData.get('stock_id') ?? '');
  const onHand = integerOrZero(formData.get('on_hand_quantity'));
  const reserved = integerOrZero(formData.get('reserved_quantity'));
  const reorder = integerOrZero(formData.get('reorder_point'));
  const reason = String(formData.get('reason') ?? '').trim();
  if (!id || onHand < 0 || reserved < 0 || reorder < 0 || reserved > onHand || !reason) return { ok: false, message: 'Quantity dan alasan adjustment wajib diisi.' };
  const access = await requireAdmin('inventory');
  if (!access.ok) return access;
  const { error } = await (access.supabase as any).rpc('adjust_inventory_stock', { p_stock_id: id, p_on_hand_quantity: onHand, p_reserved_quantity: reserved, p_reorder_point: reorder, p_reason: reason });
  if (error) return { ok: false, message: error.message.includes('Invalid') ? 'Quantity inventory tidak valid.' : 'Stock belum diperbarui.' };
  revalidatePath('/admin');
  return { ok: true, message: 'Stock berhasil diperbarui dan movement tercatat.' };
}

export async function deleteInventoryStock(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const id = String(formData.get('stock_id') ?? '');
  if (!id) return { ok: false, message: 'Stock ID tidak ditemukan.' };
  const access = await requireAdmin('inventory');
  if (!access.ok) return access;
  const { data: stockRow } = await access.supabase.from('inventory_stock').select('location_id, sku_id').eq('id', id).maybeSingle();
  if (!stockRow) return { ok: false, message: 'Stock record tidak ditemukan atau sudah dihapus.' };
  const { count: movementCount } = await access.supabase.from('inventory_movements').select('id', { count: 'exact', head: true }).eq('location_id', stockRow.location_id).eq('sku_id', stockRow.sku_id);
  if ((movementCount ?? 0) > 0) return { ok: false, message: 'Stock tidak dapat dihapus karena sudah memiliki riwayat movement. Nol-kan atau nonaktifkan lewat adjustment.' };
  const { error } = await access.supabase.from('inventory_stock').delete().eq('id', id);
  if (error) return { ok: false, message: 'Stock belum dihapus. Pastikan belum dipakai pada movement atau order.' };
  revalidatePath('/admin');
  return { ok: true, message: 'Stock berhasil dihapus.' };
}

export async function updateWhatsappSettings(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const phone = String(formData.get('phone') ?? '').replace(/\D/g, '');
  const message = String(formData.get('message') ?? '').trim();
  if (!/^\d{8,15}$/.test(phone) || message.length < 5 || message.length > 240) return { ok: false, message: 'Nomor WhatsApp atau pesan belum valid.' };
  const access = await requireAdmin('settings');
  if (!access.ok) return access;
  const { data: authData } = await access.supabase.auth.getUser();
  const { error } = await access.supabase.from('commerce_store_settings').upsert({ key: 'whatsapp', value: { phone, message }, is_public: true, updated_by: authData.user?.id ?? null, updated_at: new Date().toISOString() });
  if (error) return { ok: false, message: 'Pengaturan WhatsApp belum tersimpan.' };
  revalidatePath('/admin'); revalidatePath('/');
  return { ok: true, message: 'Pengaturan WhatsApp berhasil diperbarui.' };
}

function parsePackageQuantityPrices(formData: FormData) {
  const minimums = formData.getAll('quantity_price_min');
  const maximums = formData.getAll('quantity_price_max');
  const prices = formData.getAll('quantity_price_idr');
  const rows: Array<{ minimum_quantity: number; maximum_quantity: number | null; unit_price_idr: number; sort_order: number }> = [];
  for (let index = 0; index < minimums.length; index += 1) {
    const minimum = integerOrZero(minimums[index]);
    const maximumRaw = String(maximums[index] ?? '').trim();
    const maximum = maximumRaw ? integerOrZero(maximums[index]) : null;
    const price = moneyInteger(prices[index] ?? null);
    if (minimum < 1 || (maximum !== null && maximum < minimum) || price === null) return { error: 'Setiap range wajib memiliki minimum, maksimum yang valid, dan harga per botol.' } as const;
    rows.push({ minimum_quantity: minimum, maximum_quantity: maximum, unit_price_idr: price, sort_order: index });
  }
  rows.sort((a, b) => a.minimum_quantity - b.minimum_quantity);
  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1];
    if (rows[index].minimum_quantity <= (previous.maximum_quantity ?? Number.MAX_SAFE_INTEGER)) return { error: 'Range quantity tidak boleh overlap.' } as const;
  }
  if (rows.some((row, index) => row.maximum_quantity === null && index !== rows.length - 1)) return { error: 'Range tanpa maksimum hanya boleh menjadi baris terakhir.' } as const;
  return { rows } as const;
}

async function syncPackageQuantityPrices(supabase: Awaited<ReturnType<typeof createClient>>, packageId: string, formData: FormData) {
  const parsed = parsePackageQuantityPrices(formData);
  if ('error' in parsed) return parsed.error;
  const { error: deleteError } = await supabase.from('commerce_package_quantity_prices').delete().eq('package_id', packageId);
  if (deleteError) return 'Quantity pricing lama belum dapat diperbarui.';
  if (!parsed.rows.length) return 'Tambahkan minimal satu range quantity pricing.';
  const { error } = await supabase.from('commerce_package_quantity_prices').insert(parsed.rows.map((row) => ({ package_id: packageId, ...row })));
  return error ? 'Quantity pricing belum dapat disimpan. Periksa range yang dibuat.' : null;
}
function parsePackageForm(formData: FormData) {
  const brandId = String(formData.get('brand_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const slugInput = String(formData.get('slug') ?? '').trim().toLowerCase();
  const slug = slugInput || slugFromText(title);
  const audience = String(formData.get('audience') ?? '');
  const packageTypeId = String(formData.get('package_type_id') ?? '').trim() || null;
  const description = String(formData.get('description') ?? '').trim();
  const pricingModel = String(formData.get('pricing_model') ?? 'tier');
  const quantityPrices = parsePackageQuantityPrices(formData);
  const firstTierPrice = Array.from(formData.entries()).find(([key, value]) => key.startsWith('package_price_') && String(value).trim() !== '')?.[1] ?? null;
  const basePriceValue = formData.get('price_idr');
  const quantityRows = ('rows' in quantityPrices ? quantityPrices.rows : []) ?? [];
  const price = pricingModel === 'quantity_range' ? (quantityRows[0]?.unit_price_idr ?? -1) : requiredMoneyInteger(basePriceValue !== null && String(basePriceValue).trim() !== '' ? basePriceValue : firstTierPrice);
  const compareAtValue = String(formData.get('compare_at_price_idr') ?? '').trim();
  const compareAt = compareAtValue ? moneyInteger(formData.get('compare_at_price_idr')) : null;
  const visualTone = String(formData.get('visual_tone') ?? 'clay');
  const status = String(formData.get('status') ?? 'draft');
  const selectionMode = String(formData.get('selection_mode') ?? 'fixed');
  const selectionCapacityValue = String(formData.get('selection_capacity') ?? '').trim();
  const selectionCapacity = selectionCapacityValue ? integerOrZero(formData.get('selection_capacity')) : null;
  const selectionMinimumValue = String(formData.get('selection_minimum') ?? '').trim();
  const selectionMinimum = selectionMinimumValue ? integerOrZero(formData.get('selection_minimum')) : null;
  const selectionMaximumValue = String(formData.get('selection_maximum') ?? '').trim();
  const selectionMaximum = selectionMaximumValue ? integerOrZero(formData.get('selection_maximum')) : null;
  const minimumQuantity = Math.max(1, integerOrZero(formData.get('minimum_quantity')) || 1);
  const pointsEarningMode = String(formData.get('points_earning_mode') ?? 'normal');
  const pointsMultiplier = Number(formData.get('points_multiplier') ?? 1);
  if (!['tier', 'quantity_range'].includes(pricingModel)) return { ok: false as const, message: 'Model harga package belum valid.' };
  if (pricingModel === 'quantity_range' && 'error' in quantityPrices) return { ok: false as const, message: quantityPrices.error ?? 'Quantity pricing belum valid.' };
  if (pricingModel === 'quantity_range' && quantityRows.length === 0) return { ok: false as const, message: 'Tambahkan minimal satu range quantity pricing.' };
  if (!brandId) return { ok: false as const, message: 'Pilih brand package terlebih dahulu.' };
  if (!title) return { ok: false as const, message: 'Nama package wajib diisi.' };
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { ok: false as const, message: 'Slug URL tidak valid. Gunakan huruf kecil, angka, dan tanda hubung.' };
  if (!packageTypeId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(audience)) return { ok: false as const, message: 'Pilih tipe package yang valid.' };
  if (!description) return { ok: false as const, message: 'Deskripsi package wajib diisi.' };
  if (price < 0) return { ok: false as const, message: 'Harga package wajib diisi dengan angka yang valid.' };
  if (compareAtValue && compareAt === null) return { ok: false as const, message: 'Harga normal market retail tidak valid.' };
  if (compareAt !== null && compareAt < price) return { ok: false as const, message: 'Harga normal market retail tidak boleh lebih kecil dari harga package.' };
  if (!['clay', 'ivory', 'plum'].includes(visualTone)) return { ok: false as const, message: 'Tone package belum valid.' };
  if (!['draft', 'published', 'archived'].includes(status)) return { ok: false as const, message: 'Status package belum valid.' };
  if (!['fixed', 'free_pick'].includes(selectionMode)) return { ok: false as const, message: 'Model isi package belum valid.' };
  if (selectionMode === 'fixed' && pricingModel !== 'tier') return { ok: false as const, message: 'Fixed package memakai satu harga per package, bukan quantity range.' };
  if (selectionMode === 'free_pick' && pricingModel === 'tier' && (!selectionCapacity || selectionCapacity < 1)) return { ok: false as const, message: 'Free-pick package tier wajib memiliki kapasitas exact.' };
  if (selectionMode === 'free_pick' && pricingModel === 'quantity_range' && (!selectionMinimum || selectionMinimum < 1 || (selectionMaximum !== null && selectionMaximum < selectionMinimum))) return { ok: false as const, message: 'Quantity pricing free-pick wajib memiliki minimum dan maksimum yang valid.' };
  if (selectionMode === 'fixed' && (selectionCapacity !== null || selectionMinimum !== null || selectionMaximum !== null)) return { ok: false as const, message: 'Fixed package tidak memakai kapasitas pilihan.' };
  if (!['normal', 'reduced', 'none'].includes(pointsEarningMode) || pointsMultiplier <= 0) return { ok: false as const, message: 'Aturan earning points package belum valid.' };
  return { ok: true as const, data: { brand_id: brandId, package_type_id: packageTypeId, slug, title, audience, description, long_description: String(formData.get('long_description') ?? '').trim() || null, price_idr: price, compare_at_price_idr: compareAt, badge: String(formData.get('badge') ?? '').trim() || null, visual_tone: visualTone, delivery_note: String(formData.get('delivery_note') ?? '').trim() || null, selection_mode: selectionMode, selection_capacity: selectionMode === 'free_pick' && pricingModel === 'tier' ? selectionCapacity : null, selection_minimum: selectionMode === 'free_pick' && pricingModel === 'quantity_range' ? selectionMinimum : null, selection_maximum: selectionMode === 'free_pick' && pricingModel === 'quantity_range' ? selectionMaximum : null, pricing_model: pricingModel, starts_at: String(formData.get('starts_at') ?? '').trim() || null, ends_at: String(formData.get('ends_at') ?? '').trim() || null, minimum_quantity: minimumQuantity, minimum_subtotal_idr: 0, stackable: formData.get('stackable') === 'on', points_earning_mode: pointsEarningMode, points_multiplier: pointsMultiplier, allow_reward_redemption: formData.get('allow_reward_redemption') !== 'off', status, sort_order: integerOrZero(formData.get('sort_order')) } };
}

function parseFixedPackageItems(formData: FormData) {
  const skuIds = Array.from(new Set(formData.getAll('sku_ids').map((value) => String(value).trim()).filter(Boolean)));
  return skuIds.map((skuId, index) => ({ skuId, quantity: integerOrZero(formData.get('fixed_quantity_' + skuId)), sortOrder: index })).filter((item) => item.quantity > 0);
}

async function syncPackageAllowedSkus(supabase: Awaited<ReturnType<typeof createClient>>, packageId: string, skuIds: string[]) {
  const uniqueSkuIds = Array.from(new Set(skuIds.filter(Boolean)));
  if (!uniqueSkuIds.length) return 'Free-pick package harus memiliki minimal satu SKU yang diizinkan.';
  const { data: activeSkus, error: skuError } = await supabase.from('catalog_skus').select('id').in('id', uniqueSkuIds).eq('is_active', true);
  if (skuError || !activeSkus || activeSkus.length !== uniqueSkuIds.length) return 'Sebagian SKU free-pick tidak ditemukan atau nonaktif.';
  const { error: deleteError } = await supabase.from('commerce_package_allowed_skus').delete().eq('package_id', packageId);
  if (deleteError) return 'Daftar SKU free-pick lama belum dapat diperbarui.';
  const { error: insertError } = await supabase.from('commerce_package_allowed_skus').insert(uniqueSkuIds.map((skuId, index) => ({ package_id: packageId, sku_id: skuId, sort_order: index })));
  return insertError ? 'Daftar SKU free-pick belum dapat disimpan.' : null;
}

export async function createPackage(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const values = parsePackageForm(formData);
  if (!values.ok) return values;
  const packageImageFiles = getPackageImageFiles(formData);
  if (packageImageFiles === 'invalid') return { ok: false, message: 'Foto package harus JPG, PNG, atau WEBP dengan ukuran maksimal 6 MB.' };
  if (packageImageFiles === 'too_many') return { ok: false, message: 'Foto package maksimal 5 file.' };
  if (values.data.status === 'published' && packageImageFiles.length < 3) return { ok: false, message: 'Package Published wajib memiliki minimal 3 foto package (maksimal 5).' };
  const fixedItems = parseFixedPackageItems(formData);
  const skuIds = fixedItems.map((item) => item.skuId);
  const allowedSkuIds = Array.from(new Set(formData.getAll('allowed_sku_ids').map((value) => String(value).trim()).filter(Boolean)));
  if (values.data.selection_mode === 'fixed' && values.data.status === 'published' && skuIds.length === 0) return { ok: false, message: 'Fixed package Published wajib memiliki minimal satu SKU dengan quantity minimal 1.' };
  if (values.data.selection_mode === 'fixed' && skuIds.length !== fixedItems.length) return { ok: false, message: 'Setiap SKU fixed package harus memiliki quantity minimal 1.' };
  if (values.data.selection_mode === 'free_pick' && allowedSkuIds.length === 0) return { ok: false, message: 'Free-pick package wajib memiliki minimal satu SKU yang boleh dipilih customer.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const { data: createdPackage, error } = await (access.supabase as any).from('commerce_packages').insert(values.data).select('id, brand_id, status, selection_mode').single();
  if (error || !createdPackage) return { ok: false, message: 'Package belum dibuat. Pastikan brand, slug, dan model isi benar.' };
  const rollback = async (message: string): Promise<AdminActionState> => {
    await rollbackCreatedPackage(access.supabase, createdPackage.id);
    return { ok: false, message };
  };
  const priceError = values.data.pricing_model === 'quantity_range' ? await syncPackageQuantityPrices(access.supabase, createdPackage.id, formData) : null;
  if (priceError) return rollback(priceError ?? 'Harga package belum dapat disimpan.');
  const imageError = await addPackageImages(access.supabase, createdPackage.id, packageImageFiles);
  if (imageError) return rollback(imageError);
  if (values.data.selection_mode === 'free_pick') {
    const allowedError = await syncPackageAllowedSkus(access.supabase, createdPackage.id, allowedSkuIds);
    if (allowedError) return rollback(allowedError);
  } else if (skuIds.length > 0) {
    const { data: selectedSkus, error: skuError } = await access.supabase.from('catalog_skus').select('id, name').in('id', skuIds).eq('is_active', true);
    if (skuError || !selectedSkus || selectedSkus.length !== skuIds.length) return rollback('Sebagian SKU fixed package tidak ditemukan atau belum aktif.');
    const { error: itemError } = await access.supabase.from('commerce_package_items').insert(selectedSkus.map((sku) => { const item = fixedItems.find((entry) => entry.skuId === sku.id); return { package_id: createdPackage.id, sku_id: sku.id, item_name_snapshot: sku.name, quantity: item?.quantity ?? 1, sort_order: item?.sortOrder ?? 0 }; }));
    if (itemError) return rollback('Isi fixed SKU dan quantity belum tersimpan, package dibatalkan.');
  }
  if (createdPackage.status === 'published') {
    const { error: brandError } = await access.supabase.from('catalog_brands').update({ is_published: true }).eq('id', createdPackage.brand_id);
    if (brandError) return rollback('Brand belum bisa ditampilkan ke customer, package dibatalkan.');
  }
  revalidatePath('/admin'); revalidatePath('/packages'); revalidatePath('/brands');
  return { ok: true, message: 'Package berhasil dibuat.' };
}

export async function updatePackageImages(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const packageId = String(formData.get('package_id') ?? '').trim();
  const files = getPackageImageFiles(formData);
  if (!packageId) return { ok: false, message: 'Package ID tidak ditemukan.' };
  if (files === 'invalid') return { ok: false, message: 'Foto package harus JPG, PNG, atau WEBP dengan ukuran maksimal 6 MB.' };
  if (files === 'too_many') return { ok: false, message: 'Foto package maksimal 5 file.' };
  if (!files.length) return { ok: false, message: 'Pilih minimal satu foto package.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const { count: existingCount } = await access.supabase.from('commerce_package_images').select('id', { count: 'exact', head: true }).eq('package_id', packageId);
  if ((existingCount ?? 0) + files.length < 3) return { ok: false, message: 'Package membutuhkan minimal 3 foto. Upload foto sampai jumlahnya 3-5.' };
  const errorMessage = await addPackageImages(access.supabase, packageId, files);
  if (errorMessage) return { ok: false, message: errorMessage };
  revalidatePath('/admin'); revalidatePath('/packages'); revalidatePath('/brands');
  return { ok: true, message: 'Foto package berhasil ditambahkan.' };
}

export async function deletePackageImage(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const imageId = String(formData.get('package_image_id') ?? '').trim();
  if (!imageId) return { ok: false, message: 'Foto package tidak ditemukan.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const { data: image } = await access.supabase.from('commerce_package_images').select('package_id, image_url').eq('id', imageId).maybeSingle();
  if (!image) return { ok: false, message: 'Foto package tidak ditemukan.' };
  const { data: packageRow } = await access.supabase.from('commerce_packages').select('status').eq('id', image.package_id).maybeSingle();
  const { count: imageCount } = await access.supabase.from('commerce_package_images').select('id', { count: 'exact', head: true }).eq('package_id', image.package_id);
  if (packageRow?.status === 'published' && (imageCount ?? 0) <= 3) return { ok: false, message: 'Package Published wajib menyisakan minimal 3 foto.' };
  const { error } = await access.supabase.from('commerce_package_images').delete().eq('id', imageId);
  if (error) return { ok: false, message: 'Foto package belum dapat dihapus.' };
  const path = image?.image_url ? packageStoragePath(image.image_url) : null;
  if (path) await access.supabase.storage.from('package-images').remove([path]);
  revalidatePath('/admin'); revalidatePath('/packages'); revalidatePath('/brands');
  return { ok: true, message: 'Foto package berhasil dihapus.' };
}

export async function updatePackage(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const id = String(formData.get('package_id') ?? '');
  const values = parsePackageForm(formData);
  if (!id) return { ok: false, message: 'Package ID tidak ditemukan.' };
  if (!values.ok) return values;
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  if (values.data.status === 'published') {
    const { count: imageCount } = await access.supabase.from('commerce_package_images').select('id', { count: 'exact', head: true }).eq('package_id', id);
    if ((imageCount ?? 0) < 3) return { ok: false, message: 'Package Published wajib memiliki minimal 3 foto package. Upload foto terlebih dahulu.' };
  }
  const { error } = await (access.supabase as any).from('commerce_packages').update(values.data).eq('id', id);
  if (error) return { ok: false, message: 'Package belum diperbarui.' };
  const priceError = values.data.pricing_model === 'quantity_range' ? await syncPackageQuantityPrices(access.supabase, id, formData) : null;
  if (priceError) return { ok: false, message: priceError ?? 'Harga package belum dapat disimpan.' };
  if (values.data.status === 'published') {
    const { error: brandError } = await access.supabase.from('catalog_brands').update({ is_published: true }).eq('id', values.data.brand_id);
    if (brandError) return { ok: false, message: 'Package tersimpan, tetapi brand belum bisa ditampilkan ke customer.' };
  }
  revalidatePath('/admin'); revalidatePath('/packages'); revalidatePath('/brands');
  return { ok: true, message: 'Package berhasil diperbarui.' };
}

export async function updatePackageAllowedSkus(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const packageId = String(formData.get('package_id') ?? '').trim();
  const selectionMode = String(formData.get('selection_mode') ?? 'fixed');
  const skuIds = Array.from(new Set(formData.getAll('allowed_sku_ids').map((value) => String(value).trim()).filter(Boolean)));
  if (!packageId || selectionMode !== 'free_pick') return { ok: false, message: 'Daftar SKU hanya dapat diubah untuk free-pick package.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const errorMessage = await syncPackageAllowedSkus(access.supabase, packageId, skuIds);
  if (errorMessage) return { ok: false, message: errorMessage };
  revalidatePath('/admin'); revalidatePath('/packages'); revalidatePath('/brands');
  return { ok: true, message: 'Daftar SKU free-pick berhasil diperbarui.' };
}

export async function deletePackage(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const id = String(formData.get('package_id') ?? '');
  if (!id) return { ok: false, message: 'Package ID tidak ditemukan.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const { data: packageRow, error: packageLookupError } = await access.supabase.from('commerce_packages').select('title, status').eq('id', id).maybeSingle();
  if (packageLookupError) return { ok: false, message: `Package tidak bisa diperiksa: ${packageLookupError.message}` };
  if (!packageRow) return { ok: false, message: 'Package tidak ditemukan atau sudah dihapus.' };
  const { count: orderCount } = await access.supabase.from('commerce_order_items').select('id', { count: 'exact', head: true }).eq('package_id', id);
  if ((orderCount ?? 0) > 0) return { ok: false, message: 'Package tidak dapat dihapus karena sudah tercatat pada transaksi. Archive package saja.' };
  const { error } = await access.supabase.from('commerce_packages').delete().eq('id', id);
  if (error) return { ok: false, message: `Package belum dihapus: ${error.message}` };
  revalidatePath('/admin'); revalidatePath('/packages'); revalidatePath('/brands');
  return { ok: true, message: 'Package berhasil dihapus.' };
}
export async function addPackageItem(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const packageId = String(formData.get('package_id') ?? '');
  const skuId = String(formData.get('sku_id') ?? '');
  const quantity = integerOrZero(formData.get('quantity'));
  if (!packageId || !skuId || quantity < 1) return { ok: false, message: 'SKU dan quantity item wajib valid.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const { data: sku } = await access.supabase.from('catalog_skus').select('name').eq('id', skuId).maybeSingle();
  if (!sku) return { ok: false, message: 'SKU tidak ditemukan.' };
  const { error } = await access.supabase.from('commerce_package_items').insert({ package_id: packageId, sku_id: skuId, item_name_snapshot: sku.name, item_note: String(formData.get('item_note') ?? '').trim() || null, quantity, sort_order: integerOrZero(formData.get('sort_order')) });
  if (error) return { ok: false, message: 'Item belum ditambahkan. SKU mungkin sudah ada di package.' };
  revalidatePath('/admin'); revalidatePath('/packages'); revalidatePath('/brands');
  return { ok: true, message: 'Item package berhasil ditambahkan.' };
}

export async function deletePackageItem(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const id = String(formData.get('package_item_id') ?? '');
  if (!id) return { ok: false, message: 'Package item ID tidak ditemukan.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const { error } = await access.supabase.from('commerce_package_items').delete().eq('id', id);
  if (error) return { ok: false, message: 'Item package belum dapat dihapus.' };
  revalidatePath('/admin'); revalidatePath('/packages'); revalidatePath('/brands');
  return { ok: true, message: 'Item package berhasil dihapus.' };
}
export async function updatePackageItem(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const id = String(formData.get('package_item_id') ?? '').trim();
  const quantity = integerOrZero(formData.get('quantity'));
  const itemNote = String(formData.get('item_note') ?? '').trim() || null;
  if (!id || quantity < 1) return { ok: false, message: 'Quantity item harus minimal 1.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const { error } = await access.supabase.from('commerce_package_items').update({ quantity, item_note: itemNote }).eq('id', id);
  if (error) return { ok: false, message: 'Quantity item package belum diperbarui.' };
  revalidatePath('/admin'); revalidatePath('/packages'); revalidatePath('/brands');
  return { ok: true, message: 'Quantity item package berhasil diperbarui.' };
}

export async function updateOrderTracking(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const orderId = String(formData.get('order_id') ?? '').trim();
  const provider = String(formData.get('provider') ?? '').trim();
  const trackingNumber = String(formData.get('tracking_number') ?? '').trim();
  const trackingUrl = String(formData.get('tracking_url') ?? '').trim() || null;
  const status = String(formData.get('shipment_status') ?? 'in_transit');
  if (!orderId || !provider || !trackingNumber) return { ok: false, message: 'Provider dan nomor tracking wajib diisi.' };
  const access = await requireAdmin('orders');
  if (!access.ok) return access;
  const { error } = await (access.supabase as any).rpc('set_order_tracking', { p_order_id: orderId, p_provider: provider, p_tracking_number: trackingNumber, p_tracking_url: trackingUrl, p_status: status });
  if (error) return { ok: false, message: 'Tracking belum tersimpan. Pastikan shipment order sudah dibuat.' };
  const { data: order } = await (access.supabase as any).from('commerce_orders').select('id, customer_id, contact_phone, status, payment_status, fulfillment_status, total_idr').eq('id', orderId).maybeSingle();
  let whatsappMessage = '';
  if (order?.customer_id) {
    const [{ data: profile }, { data: shipment }] = await Promise.all([
      (access.supabase as any).from('customer_profiles').select('business_name, whatsapp, phone').eq('id', order.customer_id).maybeSingle(),
      (access.supabase as any).from('commerce_shipments').select('provider_code, tracking_number, tracking_url, status').eq('order_id', orderId).maybeSingle(),
    ]);
    const recipient = order.contact_phone || profile?.whatsapp || profile?.phone;
    if (recipient) {
      const notification = await sendWhatsAppTextTo(recipient, formatOrderStatusNotification(order, shipment ?? undefined));
      whatsappMessage = notification.ok ? ' WhatsApp customer terkirim.' : notification.skipped ? ' WhatsApp belum dikirim: nomor/config belum tersedia.' : ' Tracking tersimpan, tetapi WhatsApp customer gagal dikirim.';
    } else {
      whatsappMessage = ' WhatsApp belum dikirim karena nomor customer belum tersedia.';
    }
  }
  revalidatePath('/admin');
  revalidatePath('/account/orders');
  return { ok: true, message: 'Tracking order berhasil diperbarui.' + whatsappMessage };
}
export async function savePackageType(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const id = String(formData.get('package_type_id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const slug = (String(formData.get('slug') ?? '').trim() || slugFromText(name)).toLowerCase();
  const description = String(formData.get('description') ?? '').trim() || null;
  const sortOrder = integerOrZero(formData.get('sort_order'));
  const isActive = formData.get('is_active') !== 'off';
  if (!name || !slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { ok: false, message: 'Nama dan slug tipe package wajib valid.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const db = access.supabase as any;
  const response = id ? await db.from('commerce_package_types').update({ name, slug, description, sort_order: sortOrder, is_active: isActive }).eq('id', id) : await db.from('commerce_package_types').insert({ name, slug, description, sort_order: sortOrder, is_active: true });
  if (response.error) return { ok: false, message: response.error.code === '23505' ? 'Slug tipe package sudah digunakan.' : 'Tipe package belum tersimpan.' };
  revalidatePath('/admin'); revalidatePath('/packages'); revalidatePath('/brands');
  return { ok: true, message: id ? 'Tipe package berhasil diperbarui.' : 'Tipe package berhasil dibuat.' };
}

export async function deletePackageType(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const id = String(formData.get('package_type_id') ?? '').trim();
  if (!id) return { ok: false, message: 'Tipe package tidak ditemukan.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const db = access.supabase as any;
  const { data: type } = await db.from('commerce_package_types').select('name').eq('id', id).maybeSingle();
  if (!type) return { ok: false, message: 'Tipe package tidak ditemukan atau sudah dihapus.' };
  const { count } = await db.from('commerce_packages').select('id', { count: 'exact', head: true }).eq('package_type_id', id);
  if ((count ?? 0) > 0) return { ok: false, message: 'Tipe masih dipakai package. Hapus atau pindahkan package terlebih dahulu.' };
  const { error } = await db.from('commerce_package_types').delete().eq('id', id);
  if (error) return { ok: false, message: 'Tipe package belum dapat dihapus: ' + error.message };
  revalidatePath('/admin'); revalidatePath('/packages');
  return { ok: true, message: 'Tipe ' + type.name + ' berhasil dihapus.' };
}
export async function savePackageEligibility(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const packageId = String(formData.get('package_id') ?? '').trim();
  const tierId = String(formData.get('customer_tier_id') ?? '').trim() || null;
  const brandId = String(formData.get('brand_id') ?? '').trim() || null;
  const skuId = String(formData.get('sku_id') ?? '').trim() || null;
  const customerId = String(formData.get('customer_id') ?? '').trim() || null;
  const minimumQuantity = Math.max(1, integerOrZero(formData.get('minimum_quantity')) || 1);
  const minimumOrderValue = moneyInteger(formData.get('minimum_order_value_idr')) ?? 0;
  if (!packageId || (!tierId && !brandId && !skuId && !customerId)) return { ok: false, message: 'Pilih minimal satu target eligibility: tier, customer, brand, atau SKU.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const { error } = await (access.supabase as any).from('commerce_package_eligibility').insert({ package_id: packageId, customer_tier_id: tierId, customer_id: customerId, brand_id: brandId, sku_id: skuId, minimum_quantity: minimumQuantity, minimum_order_value_idr: minimumOrderValue });
  if (error) return { ok: false, message: 'Rule eligibility belum tersimpan.' };
  revalidatePath('/admin'); revalidatePath('/packages'); return { ok: true, message: 'Rule eligibility ditambahkan.' };
}

export async function deletePackageEligibility(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const id = String(formData.get('eligibility_id') ?? '').trim();
  if (!id) return { ok: false, message: 'Rule eligibility tidak ditemukan.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const { error } = await (access.supabase as any).from('commerce_package_eligibility').delete().eq('id', id);
  if (error) return { ok: false, message: 'Rule eligibility belum dapat dihapus.' };
  revalidatePath('/admin'); revalidatePath('/packages'); return { ok: true, message: 'Rule eligibility dihapus.' };
}

export async function savePackageBenefit(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const packageId = String(formData.get('package_id') ?? '').trim();
  const rewardSkuId = String(formData.get('reward_sku_id') ?? '').trim();
  const tierId = String(formData.get('customer_tier_id') ?? '').trim() || null;
  const quantity = Math.max(1, integerOrZero(formData.get('quantity')) || 1);
  const variantRule = String(formData.get('variant_rule') ?? 'admin_selected');
  const allowedSkuIds = Array.from(new Set(formData.getAll('allowed_sku_ids').map((value) => String(value).trim()).filter(Boolean)));
  if (!packageId || !rewardSkuId || !['admin_selected', 'customer_selected'].includes(variantRule)) return { ok: false, message: 'SKU benefit, package, dan variant rule wajib valid.' };
  if (variantRule === 'customer_selected' && allowedSkuIds.length === 0) return { ok: false, message: 'Customer-selected benefit wajib memiliki minimal satu SKU yang boleh dipilih.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const db = access.supabase as any;
  const { data: benefit, error } = await db.from('commerce_package_benefits').insert({ package_id: packageId, customer_tier_id: tierId, reward_sku_id: rewardSkuId, quantity, variant_rule: variantRule, notes: String(formData.get('notes') ?? '').trim() || null }).select('id').single();
  if (error || !benefit) return { ok: false, message: 'Benefit package belum tersimpan.' };
  if (variantRule === 'customer_selected') {
    const { data: activeSkus, error: skuError } = await db.from('catalog_skus').select('id').in('id', allowedSkuIds).eq('is_active', true);
    if (skuError || !activeSkus || activeSkus.length !== allowedSkuIds.length) {
      await db.from('commerce_package_benefits').delete().eq('id', benefit.id);
      return { ok: false, message: 'Sebagian SKU benefit tidak ditemukan atau nonaktif.' };
    }
    const { error: allowedError } = await db.from('commerce_package_benefit_allowed_skus').insert(allowedSkuIds.map((skuId, index) => ({ benefit_id: benefit.id, sku_id: skuId, sort_order: index })));
    if (allowedError) {
      await db.from('commerce_package_benefits').delete().eq('id', benefit.id);
      return { ok: false, message: 'Whitelist SKU benefit belum tersimpan.' };
    }
  }
  revalidatePath('/admin'); revalidatePath('/packages'); return { ok: true, message: 'Benefit package ditambahkan.' };
}


export async function savePackageTierBenefit(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const packageId = String(formData.get('package_id') ?? '').trim();
  const benefitId = String(formData.get('benefit_id') ?? '').trim();
  const pricingTierId = String(formData.get('pricing_tier_id') ?? '').trim();
  const quantity = integerOrZero(formData.get('quantity'));
  const label = String(formData.get('label') ?? '').trim() || null;
  const variantRule = String(formData.get('variant_rule') ?? 'customer_selected');
  const fixedSkuId = String(formData.get('fixed_sku_id') ?? '').trim() || null;
  const allowedSkuIds = Array.from(new Set(formData.getAll('allowed_sku_ids').map((value) => String(value).trim()).filter(Boolean)));
  if (!packageId || !pricingTierId || quantity < 1 || !['admin_selected', 'customer_selected'].includes(variantRule)) return { ok: false, message: 'Package, tier B2B, mode variasi, dan jumlah item gratis wajib diisi dengan benar.' };
  if (variantRule === 'admin_selected' && !fixedSkuId) return { ok: false, message: 'Pilih SKU tetap yang ditentukan admin.' };
  if (variantRule === 'customer_selected' && allowedSkuIds.length === 0) return { ok: false, message: 'Pilih minimal satu SKU yang boleh dipilih customer.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const db = access.supabase as any;
  const skuIdsToValidate = variantRule === 'admin_selected' ? [fixedSkuId as string] : allowedSkuIds;
  const { data: activeSkus, error: skuError } = await db.from('catalog_skus').select('id').in('id', skuIdsToValidate).eq('is_active', true);
  if (skuError || !activeSkus || activeSkus.length !== skuIdsToValidate.length) return { ok: false, message: 'SKU benefit tidak ditemukan atau nonaktif.' };
  let savedId = benefitId;
  const payload = { package_id: packageId, pricing_tier_id: pricingTierId, benefit_type: 'free_items', quantity, label, variant_rule: variantRule, fixed_sku_id: variantRule === 'admin_selected' ? fixedSkuId : null, updated_at: new Date().toISOString() };
  if (benefitId) {
    const { data, error } = await db.from('commerce_package_tier_benefits').update(payload).eq('id', benefitId).select('id').maybeSingle();
    if (error || !data) return { ok: false, message: 'Benefit B2B belum dapat diperbarui. Pastikan satu benefit saja untuk setiap tier pada package.' };
    await db.from('commerce_package_tier_benefit_skus').delete().eq('benefit_id', benefitId);
  } else {
    const { data, error } = await db.from('commerce_package_tier_benefits').insert(payload).select('id').single();
    if (error || !data) return { ok: false, message: 'Benefit B2B belum tersimpan. Tier ini mungkin sudah memiliki benefit pada package.' };
    savedId = data.id;
  }
  if (variantRule === 'customer_selected') {
    const { error: allowedError } = await db.from('commerce_package_tier_benefit_skus').insert(allowedSkuIds.map((skuId, index) => ({ benefit_id: savedId, sku_id: skuId, sort_order: index })));
    if (allowedError) return { ok: false, message: 'Daftar SKU benefit belum tersimpan.' };
  }
  revalidatePath('/admin'); revalidatePath('/packages'); return { ok: true, message: benefitId ? 'Benefit B2B diperbarui.' : 'Benefit B2B ditambahkan.' };
}

export async function deletePackageTierBenefit(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const id = String(formData.get('benefit_id') ?? '').trim();
  if (!id) return { ok: false, message: 'Benefit B2B tidak ditemukan.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const { error } = await (access.supabase as any).from('commerce_package_tier_benefits').delete().eq('id', id);
  if (error) return { ok: false, message: 'Benefit B2B belum dapat dihapus.' };
  revalidatePath('/admin'); revalidatePath('/packages'); return { ok: true, message: 'Benefit B2B dihapus.' };
}

export async function deletePackageBenefit(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const id = String(formData.get('benefit_id') ?? '').trim();
  if (!id) return { ok: false, message: 'Benefit package tidak ditemukan.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const { error } = await (access.supabase as any).from('commerce_package_benefits').delete().eq('id', id);
  if (error) return { ok: false, message: 'Benefit package belum dapat dihapus.' };
  revalidatePath('/admin'); revalidatePath('/packages'); return { ok: true, message: 'Benefit package dihapus.' };
}

export async function createRecommendation(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const targetType = String(formData.get('target_type') ?? 'package');
  const packageId = String(formData.get('package_id') ?? '').trim() || null;
  const skuId = String(formData.get('sku_id') ?? '').trim() || null;
  const placement = String(formData.get('placement') ?? 'package_detail');
  const priority = Math.max(0, integerOrZero(formData.get('priority')));
  const startsAt = String(formData.get('starts_at') ?? '').trim() || null;
  const endsAt = String(formData.get('ends_at') ?? '').trim() || null;
  if (!['package', 'sku'].includes(targetType) || (targetType === 'package' && !packageId) || (targetType === 'sku' && !skuId)) return { ok: false, message: 'Pilih satu target rekomendasi.' };
  if (!['package_detail', 'home', 'packages'].includes(placement)) return { ok: false, message: 'Placement rekomendasi tidak valid.' };
  if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) return { ok: false, message: 'Tanggal selesai harus setelah tanggal mulai.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const { error } = await (access.supabase as any).from('commerce_recommendations').insert({ placement, package_id: targetType === 'package' ? packageId : null, sku_id: targetType === 'sku' ? skuId : null, priority, is_active: formData.get('is_active') === 'on', starts_at: startsAt, ends_at: endsAt });
  if (error) return { ok: false, message: error.code === '23505' ? 'Target ini sudah ada di placement tersebut.' : 'Rekomendasi belum dapat disimpan.' };
  revalidatePath('/admin'); revalidatePath('/'); revalidatePath('/packages');
  return { ok: true, message: 'Rekomendasi berhasil ditambahkan.' };
}

export async function updateRecommendation(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const id = String(formData.get('id') ?? '').trim();
  const targetType = String(formData.get('target_type') ?? 'package');
  const packageId = String(formData.get('package_id') ?? '').trim() || null;
  const skuId = String(formData.get('sku_id') ?? '').trim() || null;
  const placement = String(formData.get('placement') ?? 'package_detail');
  const priority = Math.max(0, integerOrZero(formData.get('priority')));
  const startsAt = String(formData.get('starts_at') ?? '').trim() || null;
  const endsAt = String(formData.get('ends_at') ?? '').trim() || null;
  if (!id || !['package', 'sku'].includes(targetType) || (targetType === 'package' && !packageId) || (targetType === 'sku' && !skuId)) return { ok: false, message: 'Data rekomendasi belum lengkap.' };
  if (!['package_detail', 'home', 'packages'].includes(placement)) return { ok: false, message: 'Placement rekomendasi tidak valid.' };
  if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) return { ok: false, message: 'Tanggal selesai harus setelah tanggal mulai.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const { error } = await (access.supabase as any).from('commerce_recommendations').update({ placement, package_id: targetType === 'package' ? packageId : null, sku_id: targetType === 'sku' ? skuId : null, priority, is_active: formData.get('is_active') === 'on', starts_at: startsAt, ends_at: endsAt, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { ok: false, message: error.code === '23505' ? 'Target ini sudah ada di placement tersebut.' : 'Rekomendasi belum dapat diubah.' };
  revalidatePath('/admin'); revalidatePath('/'); revalidatePath('/packages');
  return { ok: true, message: 'Rekomendasi berhasil diperbarui.' };
}

export async function deleteRecommendation(previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { ok: false, message: 'Rekomendasi tidak ditemukan.' };
  const access = await requireAdmin('packages');
  if (!access.ok) return access;
  const { error } = await (access.supabase as any).from('commerce_recommendations').delete().eq('id', id);
  if (error) return { ok: false, message: 'Rekomendasi belum dapat dihapus.' };
  revalidatePath('/admin'); revalidatePath('/'); revalidatePath('/packages');
  return { ok: true, message: 'Rekomendasi dihapus.' };
}