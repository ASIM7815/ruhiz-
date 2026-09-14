import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ruhiz - Real People. Brighter Tomorrows.',
  description: 'A safe and supportive community where you can share your thoughts, photos, videos, and experiences — without judgment. Real people. Real conversations. A kinder tomorrow.',
  keywords: 'mental health, support community, safe space, emotional wellbeing, peer support',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'Ruhiz - Real People. Brighter Tomorrows.',
    description: 'A safe and supportive community for mental health and emotional wellbeing.',
    siteName: 'Ruhiz',
    images: ['/images/ruhizlogo-.png'],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ruhiz - Real People. Brighter Tomorrows.',
    description: 'A safe and supportive community for mental health and emotional wellbeing.',
    images: ['/images/ruhizlogo-.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link 
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
