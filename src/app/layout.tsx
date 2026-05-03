import type { Metadata } from 'next'
import { Nunito } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/AuthContext'
import RouteGuard from '@/components/RouteGuard'
import Script from 'next/script' // 1. Script component  import 

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  weight: ['400', '500', '600', '700', '800', '900'],
})

export const metadata: Metadata = {
  title: 'Campus Canteen',
  description: 'Trincomalee Campus Canteen Management System',
}

export const viewport = {
  themeColor: '#F4A11B',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
      <head>
        {/* 2. PayHere Script  */}
        <script src="https://www.payhere.lk/lib/payhere.js" async></script>
      </head>
      <body className={nunito.className}>
        <AuthProvider>
          <RouteGuard>
            <div className="min-h-screen bg-gray-100 flex justify-center">
              <main className="mobile-container w-full shadow-2xl">
                {children}
              </main>
            </div>
          </RouteGuard>
        </AuthProvider>
      </body>
    </html>
  )
}
