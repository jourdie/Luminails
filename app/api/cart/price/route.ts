import { NextResponse } from 'next/server';
import { getPackageBySlugFromDatabase } from '../../../../lib/packages-server';
import { selectQuantityPrice } from '../../../../lib/packages';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug')?.trim();
  const quantity = Math.max(1, Math.min(100, Number(url.searchParams.get('quantity') ?? 1) || 1));
  if (!slug || slug.length > 120 || !/^[a-z0-9][a-z0-9-]*$/i.test(slug)) return NextResponse.json({ message: 'Package tidak ditemukan.' }, { status: 400 });

  let item;
  try {
    item = await getPackageBySlugFromDatabase(slug);
  } catch {
    return NextResponse.json({ message: 'Harga package sedang tidak tersedia.' }, { status: 503 });
  }
  if (!item) return NextResponse.json({ message: 'Package tidak ditemukan.' }, { status: 404 });

  const unitPrice = item.pricingModel === 'quantity_range' ? (selectQuantityPrice(item.quantityPrices, quantity) ?? item.price) : item.price;
  return NextResponse.json({ unitPrice, priceLabel: item.pricingModel === 'quantity_range' ? 'Harga per botol' : (item.priceLabel ?? 'Harga package') });
}
