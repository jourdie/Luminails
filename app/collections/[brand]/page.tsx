import { redirect } from 'next/navigation';

export default async function CollectionBrandRedirect({ params }: { params: Promise<{ brand: string }> }) {
  redirect('/catalog/brand/' + (await params).brand);
}