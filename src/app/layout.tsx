import type { Metadata } from 'next'
import { Nunito } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/AuthContext'
import { ToastProvider } from '@/lib/toast'
import { ConfirmProvider } from '@/lib/confirm'
import RouteGuard from '@/components/RouteGuard'
import Script from 'next/script'

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
      </head>
      <body className={nunito.className}>
        {/* 2. PayHere Script */}
        <Script src="https://www.payhere.lk/lib/payhere.js" strategy="beforeInteractive" />
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>
              <RouteGuard>
                <div className="min-h-screen bg-gray-100 flex justify-center">
                  <main className="mobile-container w-full shadow-2xl">
                    {children}
                  </main>
                </div>
              </RouteGuard>
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
