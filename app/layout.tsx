import type { Metadata } from 'next'
import { Rubik } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const rubik = Rubik({
  subsets: ['latin', 'hebrew'],
  variable: '--font-rubik',
})

export const metadata: Metadata = {
  title: 'מנהל רווחיות | E-Commerce Profitability',
  description: 'מערכת מעקב רווחיות לחנויות אי-קומרס',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} dark`}>
      <body className="min-h-screen bg-gray-950 font-[family-name:var(--font-rubik)] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
