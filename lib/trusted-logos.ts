import { createClient } from './supabase/server';

export type TrustedLogo = {
  id: string;
  name: string;
  imageUrl: string;
  altText: string | null;
  sortOrder: number;
};

export async function getPublicTrustedLogos(): Promise<TrustedLogo[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('commerce_trusted_logos')
    .select('id, name, image_url, alt_text, sort_order')
    .eq('is_active', true)
    .order('sort_order')
    .order('name');
  if (error || !data) return [];
  return (data as Array<{ id: string; name: string; image_url: string; alt_text: string | null; sort_order: number }>).map((item) => ({
    id: item.id,
    name: item.name,
    imageUrl: item.image_url,
    altText: item.alt_text,
    sortOrder: Number(item.sort_order),
  }));
}