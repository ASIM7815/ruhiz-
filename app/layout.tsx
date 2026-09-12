import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ruhiz - Real People. Brighter Tomorrows.',
  description: 'A safe and supportive community where you can share your thoughts, photos, videos, and experiences — without judgment. Real people. Real conversations. A kinder tomorrow.',
  keywords: 'mental health, support community, safe space, emotional wellbeing, peer support',
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
