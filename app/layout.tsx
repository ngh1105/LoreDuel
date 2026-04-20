import type { Metadata } from 'next'
import { Cormorant_Garamond, Space_Grotesk } from 'next/font/google'
import './globals.css'

const display = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
})

const body = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '700'],
})

export const metadata: Metadata = {
  title: 'LoreDuel - Narrative Tactics on GenLayer',
  description:
    'A solo campaign vertical slice where you read the room, choose a stance, and survive three escalating verdict chambers powered by GenLayer intelligent contracts.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#050813" />
      </head>
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  )
}
