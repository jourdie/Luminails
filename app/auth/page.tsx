import { AuthForm } from '../../components/auth-form';

export const metadata = { title: 'Masuk B2B - Luminails' };
export const dynamic = 'force-dynamic';

export default function AuthPage() {
  return <AuthForm supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''} supabasePublishableKey={process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''} />;
}
