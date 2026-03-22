# AgentHub — AI Agents Platform MVP

A full-stack foundation for a multi-agent AI platform built with Next.js 14 App Router, Auth.js v5, Prisma, and shadcn/ui.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Auth | Auth.js v5 (credentials + JWT) |
| ORM | Prisma |
| Database | SQLite (local) / PostgreSQL-ready |
| Validation | Zod |
| Forms | React Hook Form + @hookform/resolvers |
| Toasts | Sonner |
| Icons | Lucide React |
| Password hashing | bcryptjs |

## Features

- **Landing page** — hero, features grid, CTA
- **Auth** — register, login, logout with Zod validation, friendly error messages, toast notifications
- **Route protection** — Auth.js v5 middleware (edge-safe, no DB on edge)
- **App shell** — responsive sidebar (dark) + topbar, mobile hamburger
- **Dashboard** — stats cards, agent library preview, documents placeholder
- **Agents page** — renders all agents from the typed registry
- **Documents page** — placeholder with planned-feature cards
- **Settings page** — displays live user data from DB (name, email, verified, timestamps)
- **Typed agent registry** — ready to add real agent execution

## Project Structure

```
src/
├── app/
│   ├── (auth)/            # /login, /register — centered layout
│   ├── (dashboard)/       # /dashboard, /agents, /documents, /settings — app shell
│   ├── api/auth/          # Auth.js route handler
│   ├── layout.tsx         # Root layout (font, Toaster)
│   └── page.tsx           # Landing page
├── components/
│   ├── agents/            # AgentCard
│   ├── auth/              # LoginForm, RegisterForm
│   ├── layout/            # AppShell, Sidebar, Topbar, PageContainer
│   └── ui/                # shadcn/ui components
├── features/
│   ├── agents/            # agent-registry.ts (typed agent definitions)
│   ├── auth/              # Server actions (login, register, logout)
│   └── documents/         # Placeholder for future document workflows
├── lib/
│   ├── ai/                # Reserved for AI SDK integration
│   ├── auth.config.ts     # Edge-safe auth config (used by middleware)
│   ├── auth.ts            # Full auth config with PrismaAdapter
│   ├── current-user.ts    # getCurrentUser(), getCurrentUserFull(), requireUser()
│   ├── db.ts              # Prisma client singleton
│   └── utils.ts           # cn(), getInitials(), getFullName()
├── middleware.ts           # Route protection (edge runtime)
├── schemas/
│   └── auth.ts            # Zod schemas for sign-in and registration
└── types/
    └── next-auth.d.ts     # Session/JWT type augmentation
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
# Edit .env — the defaults work for local development
```

Generate a strong `AUTH_SECRET` for production:
```bash
openssl rand -base64 32
```

### 3. Set up the database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to SQLite
npm run db:push

# Seed the admin user
npm run db:seed
```

Or run everything at once:
```bash
npm run setup
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Seed credentials

| Field | Value |
|---|---|
| Email | `admin@admin` |
| Password | `Test123!` |

## Adding a New Agent

1. Add a definition to `src/features/agents/agent-registry.ts`:

```typescript
{
  id: "my-agent",
  name: "My Agent",
  description: "What this agent does.",
  slug: "my-agent",
  status: "available",     // or "coming_soon" | "beta"
  category: "Documents",
  icon: "FileSearch",      // lucide-react icon name
}
```

2. Create a feature module at `src/features/agents/my-agent/`.
3. Implement the AI runner in `src/lib/ai/` using the Anthropic SDK or other AI client.
4. Add a route at `src/app/(dashboard)/agents/my-agent/page.tsx`.

## Migrating to PostgreSQL

1. In `prisma/schema.prisma`, change:
   ```prisma
   datasource db {
     provider = "postgresql"   // was "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
2. Update `DATABASE_URL` in `.env` to your PostgreSQL connection string.
3. Run `npm run db:migrate` to apply migrations.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to DB (no migration) |
| `npm run db:migrate` | Create and apply migration |
| `npm run db:seed` | Seed admin user |
| `npm run db:studio` | Open Prisma Studio |
| `npm run setup` | install + generate + push + seed |
