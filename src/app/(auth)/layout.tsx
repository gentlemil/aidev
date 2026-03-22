import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"

export const metadata: Metadata = {
  title: {
    default: "Auth",
    template: "%s | aidev",
  },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      {/* Minimal top bar */}
      <header className="flex h-14 items-center border-b border-stone-200 bg-white px-6">
        <Link href="/">
          <Image src="/assets/aidev.png" alt="aidev" width={84} height={25} priority />
        </Link>
      </header>

      {/* Centered card area */}
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}
