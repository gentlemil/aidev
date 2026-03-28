<div align="center">
  <a href="https://www.aidevs.pl/">
    <img src="public/assets/ai_devs_4.svg" alt="AI_devs 4" />
  </a>
</div>

# AgentHub — AI Agents Platform

A full-stack platform for building and running AI agents, built with Next.js App Router, Auth.js v5, Prisma, and shadcn/ui. Built as part of the AI_devs course (S01).

## Tech Stack

| Layer        | Technology                            |
| ------------ | ------------------------------------- |
| Framework    | Next.js 14 (App Router)               |
| Language     | TypeScript                            |
| Styling      | Tailwind CSS + shadcn/ui              |
| Auth         | Auth.js v5 (credentials + JWT)        |
| ORM          | Prisma                                |
| Database     | SQLite (local) / PostgreSQL-ready     |
| Validation   | Zod                                   |
| Forms        | React Hook Form + @hookform/resolvers |
| AI Providers | OpenAI, OpenRouter, LM Studio (local) |
| Icons        | Lucide React                          |

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

---

### Pipeline (`/agents/pipeline`) — combine od S01E01 and S01E02

Two-stage orchestrated pipeline: Stage 1 runs the People Tagger and submits suspects to the hub (with retry on partial results). Stage 2 takes the suspects list and runs Find Him to locate the closest one to a nuclear power plant.

**Flow:** Stage 1 (tag + submit) → Stage 2 (locate + submit)

**Pattern:** Sequential agent orchestration with shared state between stages.

---

### Evaluation Agent (`/agents/evaluation`) — S03E01

Downloads ~10k sensor readings from the hub, detects anomalies via type/range validation and LLM-based operator note analysis, then submits a list of anomalous reading IDs.

**Flow:** Fetch readings → Validate types/ranges → LLM analysis of operator notes → Submit anomaly IDs

**Pattern:** Bulk data processing with hybrid rule-based + LLM validation.

---

### Firmware Agent (`/agents/firmware`) — S03E02

Connects to a virtual Linux machine via a shell API, debugs a broken cooling system firmware (edits config files, removes lock file, runs binary), and submits the ECCS confirmation code to the hub.

**Flow:** Edit settings.ini → Remove lock file → Run cooler.bin → Extract ECCS code → Submit

**Tools (function calling):**

- `execute_command` — runs shell commands on the remote VM (ls, cat, cd, editline, rm, find, etc.)
- `submit_answer` — submits the extracted ECCS code to the hub

**Pattern:** Stateful agentic loop with prompt caching, sliding context window, ban/reboot detection.

---

### Reactor Agent (`/agents/reactor`) — S03E03

Navigates a robot through a 7×5 grid, avoiding vertically moving blocks, to reach the goal at column 7 and retrieve the flag.

**Flow:** Start game → Move right/wait per turn → Detect game end → Extract flag

**Tools (function calling):**

- `send_command` — sends `right` / `left` / `wait` / `start` / `reset` to the hub; internally runs `analyzeBoard()` which simulates one step of block movement and returns `availableMoves` (pre-computed safe moves) alongside the raw board state

**Pattern:** Reactive agentic loop with deterministic pre-processing — board analysis computed server-side so the LLM only picks from a safe move list rather than simulating block physics.

## Project Structure

```
src/
├── app/
│   ├── (auth)/                    # /login, /register
│   ├── (dashboard)/               # /dashboard, /agents, /settings
│   │   └── agents/
│   │       ├── people/            # People Tagger UI
│   │       ├── find-him/          # Find Him UI
│   │       ├── pipeline/          # Pipeline UI
│   │       ├── evaluation/        # Evaluation Agent UI
│   │       ├── firmware/          # Firmware Agent UI
│   │       └── reactor/           # Reactor Agent UI
│   ├── api/tasks/
│   │   ├── people/stream/         # SSE stream
│   │   ├── find-him/stream/       # SSE stream
│   │   ├── pipeline/stream/       # SSE stream
│   │   ├── evaluation/            # POST (non-streaming)
│   │   ├── firmware/stream/       # SSE stream
│   │   └── reactor/stream/        # SSE stream
│   └── api/auth/
├── configs/
│   ├── people.config.ts           # S01E01 — filter params, model
│   ├── find-him.config.ts         # S01E02 — max iterations
│   ├── pipeline.config.ts         # S01E01 & SO1E02 — stage config
│   ├── evaluation.config.ts       # S03E01 — thresholds, model
│   ├── firmware.config.ts         # S03E02 — VM URL, binary path
│   └── reactor.config.ts          # S03E03 — model, max iterations
├── features/
│   ├── agents/
│   │   └── agent-registry.ts      # Typed agent definitions
│   ├── auth/                      # Server actions (login, register, logout)
│   └── ai-devs/
│       ├── hub.ts                 # submitAnswer() — shared across tasks
│       └── tasks/
│           ├── people/            # types, filter, tagger agent
│           ├── find-him/          # types, consts, tools, agent
│           ├── pipeline/          # orchestrator, stage1/stage2 agents
│           ├── evaluation/        # types, validators, agent
│           ├── firmware/          # types, events, tools, agent
│           └── reactor/           # types, events, tools, agent
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

| Provider   | Env var              | Notes                                                    |
| ---------- | -------------------- | -------------------------------------------------------- |
| OpenRouter | `OPENROUTER_API_KEY` | Default. Supports all models via `provider/model` format |
| OpenAI     | `OPENAI_API_KEY`     | Strips `openai/` prefix automatically                    |
| LM Studio  | —                    | No auth, local `http://localhost:1234`                   |

Model IDs are defined in `src/lib/ai-models.ts` per provider.

## Config Files

Each agent has a dedicated config file in `src/configs/` that controls task-specific parameters (filter criteria, model defaults, hub URLs, iteration limits). These files are **gitignored** so you can tweak them freely without affecting others.

Example templates are committed and serve as the starting point:

| Template                       | Copy to                | Agent            |
| ------------------------------ | ---------------------- | ---------------- |
| `people.config.example.ts`     | `people.config.ts`     | People Tagger    |
| `find-him.config.example.ts`   | `find-him.config.ts`   | Find Him         |
| `pipeline.config.example.ts`   | `pipeline.config.ts`   | Pipeline         |
| `evaluation.config.example.ts` | `evaluation.config.ts` | Evaluation Agent |
| `firmware.config.example.ts`   | `firmware.config.ts`   | Firmware Agent   |
| `reactor.config.example.ts`    | `reactor.config.ts`    | Reactor Agent    |

```bash
cp src/configs/people.config.example.ts src/configs/people.config.ts
cp src/configs/find-him.config.example.ts src/configs/find-him.config.ts
cp src/configs/pipeline.config.example.ts src/configs/pipeline.config.ts
cp src/configs/evaluation.config.example.ts src/configs/evaluation.config.ts
cp src/configs/firmware.config.example.ts src/configs/firmware.config.ts
cp src/configs/reactor.config.example.ts src/configs/reactor.config.ts
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

| Script                | Description                      |
| --------------------- | -------------------------------- |
| `npm run dev`         | Start dev server                 |
| `npm run build`       | Production build                 |
| `npm run lint`        | ESLint                           |
| `npm run format`      | Prettier                         |
| `npm run db:generate` | Generate Prisma client           |
| `npm run db:push`     | Push schema to DB (no migration) |
| `npm run db:migrate`  | Create and apply migration       |
| `npm run db:seed`     | Seed admin user                  |
| `npm run db:studio`   | Open Prisma Studio               |
| `npm run setup`       | install + generate + push + seed |

## Migrating to PostgreSQL

1. In `prisma/schema.prisma` change provider to `"postgresql"`
2. Update `DATABASE_URL` in `.env.local`
3. Run `npm run db:migrate`
