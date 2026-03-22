import Link from "next/link"
import Image from "next/image"
import { Bot, FileSearch, Sparkles, Zap, Shield, BarChart2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Navigation */}
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-8">
          <Link href="/" className="flex items-center">
            <Image src="/assets/aidev.png" alt="aidev" width={100} height={30} priority />
          </Link>
          <nav className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-500 text-white"
              asChild
            >
              <Link href="/register">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-stone-900 via-stone-800 to-slate-900 py-24 text-white">
        {/* Background decoration — warm gold glows */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-amber-500/15 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-yellow-400/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-4xl px-4 text-center lg:px-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm text-amber-300">
            <Sparkles className="h-3.5 w-3.5" />
            AI-powered document intelligence
          </div>

          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Your platform for
            <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
              {" "}
              intelligent agents
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-stone-300">
            Analyze documents, extract data, generate reports, and automate complex workflows with
            a growing suite of AI agents — all in one place.
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="bg-amber-600 hover:bg-amber-500 text-white"
              asChild
            >
              <Link href="/register">Start for free</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-stone-600 bg-transparent text-white hover:bg-stone-800 hover:text-white"
              asChild
            >
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Everything you need to automate intelligence
            </h2>
            <p className="mt-3 text-muted-foreground">
              Built on a modular architecture — add new agents as your needs grow.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-stone-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-stone-100 bg-stone-50 py-20">
        <div className="mx-auto max-w-2xl px-4 text-center lg:px-8">
          <h2 className="mb-4 text-3xl font-bold tracking-tight">Ready to get started?</h2>
          <p className="mb-8 text-muted-foreground">
            Create your free account and explore the agent library.
          </p>
          <Button size="lg" className="bg-amber-600 hover:bg-amber-500 text-white" asChild>
            <Link href="/register">Create your account</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 lg:px-8">
          <Image src="/assets/aidev.png" alt="aidev" width={72} height={22} />
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} aidev. Built with Next.js, Auth.js & Prisma.
          </p>
        </div>
      </footer>
    </div>
  )
}

const features = [
  {
    title: "Document Analysis",
    description:
      "Extract insights, summaries, and structured data from any document format with AI.",
    icon: FileSearch,
  },
  {
    title: "Agent Library",
    description:
      "Choose from a growing collection of purpose-built AI agents for every workflow.",
    icon: Bot,
  },
  {
    title: "Fast & Reliable",
    description:
      "Built on modern infrastructure with Next.js App Router for instant server responses.",
    icon: Zap,
  },
  {
    title: "Secure by Default",
    description:
      "Auth.js authentication, hashed passwords, and protected routes keep your data safe.",
    icon: Shield,
  },
  {
    title: "Analytics Ready",
    description:
      "Track agent usage, document processing, and team activity in one dashboard.",
    icon: BarChart2,
  },
  {
    title: "Extensible Platform",
    description:
      "Clean modular architecture makes it easy to add new agents and integrations.",
    icon: Sparkles,
  },
]
