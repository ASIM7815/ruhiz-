import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'DUEL — Challenge A Better You',
    template: '%s · DUEL',
  },
  description:
    'DUEL is the social platform for personal challenges. Create, discover, join and complete challenges like 30 Days Coding, 21 Days Fitness or 7 Days No Social Media — track daily progress, build streaks and win against yesterday’s you.',
  keywords:
    'challenges, habit builder, streaks, self improvement, 30 day challenge, fitness challenge, coding challenge, digital detox, personal growth, accountability',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', type: 'image/png', sizes: '64x64' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'DUEL — Challenge A Better You',
    description:
      'Create, join and complete personal challenges. Daily check-ins, streaks and a community that holds you to it.',
    siteName: 'DUEL',
    images: ['/images/duel-logo.png'],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DUEL — Challenge A Better You',
    description: 'Create, join and complete personal challenges. Streaks, check-ins and trophies included.',
    images: ['/images/duel-logo.png'],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
