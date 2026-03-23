<div align="center">
  <a href="https://www.aidevs.pl/">
    <img src="public/assets/ai_devs_4.svg" alt="AI_devs 4" />
  </a>
</div>

# AgentHub — AI Agents Platform

A full-stack platform for building and running AI agents, built with Next.js App Router, Auth.js v5, Prisma, and shadcn/ui. Built as part of the AI_devs course (S01).

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
| AI Providers | OpenAI, OpenRouter, LM Studio (local) |
| Icons | Lucide React |

## Agents

### People Tagger (`/agents/people`) — S01E01

Fetches a CSV of people from the hub, filters by criteria (gender, city, age range), tags job descriptions with LLM, and submits matching results.

**Flow:** Fetch CSV → Filter → Tag jobs with LLM → Submit to hub

**Tools used:** OpenAI Chat Completions API (structured output / JSON schema)

---

### Find Him (`/agents/find-him`) — S01E02

Multi-step function-calling agent that locates a suspect near a nuclear power plant, retrieves their access level, and submits findings to the hub.

**Flow:** Get power plants → Get suspect locations → Calculate distances (Haversine) → Check access level → Submit

**Tools (function calling):**
- `get_power_plants` — fetches plant list (city, code, power) from hub
- `get_survivor_locations` — fetches lat/lng history for a given person
- `calculate_distance` — server-side Haversine calculation (deterministic, no LLM guessing)
- `check_access_level` — fetches access level by name + birth year
- `submit_answer` — submits final answer to hub

## Project Structure

```
src/
├── app/
│   ├── (auth)/                    # /login, /register
│   ├── (dashboard)/               # /dashboard, /agents, /settings
│   │   └── agents/
│   │       ├── people/            # People Tagger UI
│   │       └── find-him/          # Find Him UI
│   ├── api/tasks/
│   │   ├── people/stream/         # SSE stream for People Tagger
│   │   └── find-him/              # GET (power plants) + POST + stream
│   └── api/auth/
├── configs/
│   ├── people.config.ts           # URLs, model, filter params for S01E01
│   └── find-him.config.ts         # URLs, max iterations for S01E02
├── features/
│   ├── agents/
│   │   └── agent-registry.ts      # Typed agent definitions
│   ├── auth/                      # Server actions (login, register, logout)
│   └── ai-devs/
│       ├── hub.ts                 # submitAnswer() — shared across tasks
│       └── tasks/
│           ├── people/            # types, filter, tagger agent
│           └── find-him/          # types, consts, tools, agent
├── lib/
│   ├── ai-models.ts               # AIProviders enum, PROVIDER_API, AVAILABLE_MODELS
│   ├── csv.ts                     # Generic parseCSV<T>() with quoted-field support
│   ├── auth.ts / auth.config.ts   # Auth.js setup
│   ├── current-user.ts            # getCurrentUser(), requireUser()
│   ├── db.ts                      # Prisma client singleton
│   └── utils.ts                   # cn(), getInitials()
├── middleware.ts                   # Route protection (edge runtime)
├── schemas/auth.ts                 # Zod schemas
└── types/
    ├── llm.types.ts                # LlmStats, RunStatus, LogEntry, etc.
    └── next-auth.d.ts
```

## AI Provider Support

All agents support switching provider and model from the UI:

| Provider | Env var | Notes |
|---|---|---|
| OpenRouter | `OPENROUTER_API_KEY` | Default. Supports all models via `provider/model` format |
| OpenAI | `OPENAI_API_KEY` | Strips `openai/` prefix automatically |
| LM Studio | — | No auth, local `http://localhost:1234` |

Model IDs are defined in `src/lib/ai-models.ts` per provider.

## Config Files

Each agent has a dedicated config file in `src/configs/` that controls task-specific parameters (filter criteria, model defaults, hub URLs, iteration limits). These files are **gitignored** so you can tweak them freely without affecting others.

Example templates are committed and serve as the starting point:

| Template | Copy to | Agent |
|---|---|---|
| `people.config.example.ts` | `people.config.ts` | People Tagger |
| `find-him.config.example.ts` | `find-him.config.ts` | Find Him |

```bash
cp src/configs/people.config.example.ts src/configs/people.config.ts
cp src/configs/find-him.config.example.ts src/configs/find-him.config.ts
```

> URLs that include `AI_DEVS_KEY` are built dynamically via getters — the key is read from `.env.local` at runtime, never hardcoded.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment

```bash
cp .env.example .env.local
```

Required variables:

```env
AUTH_SECRET=          # openssl rand -base64 32
AI_DEVS_KEY=          # your AI_devs hub key
AI_DEVS_VERIFY_URL=https://hub.ag3nts.org/verify
OPENROUTER_API_KEY=   # or OPENAI_API_KEY
```

### 3. Set up the database

```bash
npm run setup          # install + generate + push schema + seed
```

Or step by step:
```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### 4. Start dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Seed credentials:** `admin@admin` / `Test123!`

## Adding a New Agent

1. Add entry to `src/features/agents/agent-registry.ts`
2. Create config in `src/configs/<name>.config.ts`
3. Create feature module in `src/features/ai-devs/tasks/<name>/`
4. Add page at `src/app/(dashboard)/agents/<name>/page.tsx`
5. Add API route at `src/app/api/tasks/<name>/stream/route.ts`

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

## Migrating to PostgreSQL

1. In `prisma/schema.prisma` change provider to `"postgresql"`
2. Update `DATABASE_URL` in `.env.local`
3. Run `npm run db:migrate`
