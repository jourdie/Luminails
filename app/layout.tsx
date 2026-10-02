import type { Metadata } from 'next';
import '../styles.css';

export const metadata: Metadata = {
  title: 'Luminails - Nail supply, dirapikan',
  description: 'Nail supply untuk salon, nail artist, studio kecantikan, dan reseller.',
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <head>
        <link rel="icon" href="/favicon.svg" />
      </head>
      <body>{children}</body>
    </html>
  );
}
