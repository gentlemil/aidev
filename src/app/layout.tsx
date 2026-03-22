import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Providers } from "@/components/providers"
import { ThemedToaster } from "@/components/themed-toaster"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: {
    default: "aidev",
    template: "%s | aidev",
  },
  description: "AI agents platform for document analysis and intelligent automation.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
          <ThemedToaster />
        </Providers>
      </body>
    </html>
  )
}
