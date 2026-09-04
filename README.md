# Trackfolio

The operating system for a job search. Version-controlled resumes, an application pipeline that never forgets what you sent, and AI that refuses to lie on your behalf.

This is the production app behind the ResumeOps prototype: a protected master resume, a branch per company, live LaTeX compile, immutable submission snapshots, an action queue, interview prep grounded in what the company actually received, and conversion analytics that label small samples.

## Stack

- **Next.js 16** (App Router) + React 19
- **tRPC** + TanStack Query
- **Drizzle ORM** on **Neon Postgres**
- **Auth.js** (GitHub, Google, email magic links)
- **Vercel Blob** for compiled PDFs
- **Upstash Redis** for rate limits
- **Vercel** for hosting, with a daily cron for follow-up reminders

## Local setup

```bash
pnpm install
cp .env.example .env.local
# Fill DATABASE_URL, AUTH_SECRET, and at least one auth provider.
pnpm db:push
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in, then:

1. Paste a LaTeX resume in **Resume Lab** and save a version.
2. Create a branch before tailoring. Master stays locked.
3. Add an application and **capture a snapshot** so the exact document is frozen.
4. Use **Analyze** against a job description. Missing terms are gaps, not instructions to invent skills.
5. **Action Center** ranks follow-ups, stale apps, and upcoming interviews.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Local server |
| `pnpm build` / `pnpm start` | Production build |
| `pnpm verify` | Typecheck + lint + unit tests |
| `pnpm test:e2e` | Playwright against the landing flow |
| `pnpm db:push` | Sync schema (dev) |
| `pnpm db:generate` / `pnpm db:migrate` | SQL migrations |

## Git / CI / CD

Work on a branch. Open a pull request into `main`. Do not push product work straight to production.

```
feature branch  →  pull request  →  CI + Vercel preview  →  merge to main  →  Vercel production
```

| Gate | What it does |
| --- | --- |
| **CI / Verify** | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` on every PR and on `main` |
| **CI / E2E (public)** | Playwright landing / sign-in / logged-out redirects. Runs only when the `DATABASE_URL` Actions secret is set. Does **not** run authenticated or journey specs (those insert users into Postgres; local and production still share Neon) |
| **CodeQL** | Weekly + PR security scan |
| **Dependabot** | Weekly npm and GitHub Actions PRs |
| **Vercel Git** | Preview deploy on the PR, production deploy on merge to `main` (`https://trackfolio-bay.vercel.app`) |
| **CD** | Manual **Run workflow** (and optional auto-deploy after CI if you set repo variable `CD_ON_CI=true` plus `VERCEL_TOKEN`). Leave auto-CD off while Vercel Git is already shipping production |

Protect `main` so **Verify** must pass before merge: GitHub → Settings → Branches → add rule.

E2E secret (optional): repo **Settings → Secrets and variables → Actions** → `DATABASE_URL` (a Neon branch, not production, if you can). `AUTH_SECRET` and OAuth keys are optional; CI fills dummies so `/sign-in` still shows all providers.

## Deploy on Vercel

1. Create a Neon project and copy the pooled `DATABASE_URL`.
2. Import the repo into Vercel. Set every variable from `.env.example` that you use.
3. Generate `AUTH_SECRET` (`openssl rand -base64 32`) and `CRON_SECRET`.
4. Set `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the production domain.
5. Add GitHub / Google OAuth callback `{AUTH_URL}/api/auth/callback/{provider}`.
6. Run `pnpm db:push` (or generate and apply migrations) against production.
7. Optional: Vercel Blob, Upstash Redis, OpenAI or Anthropic
   (`ANTHROPIC_WORKSPACE_ID` if the Anthropic key is identity-linked), Resend.

The daily cron at `/api/cron/reminders` (13:00 UTC) writes in-app follow-up notifications. It is a no-op without `CRON_SECRET`.

## Product principles

- **Snapshots are copies, not references.** Deleting a version never rewrites what a company received.
- **Master is protected.** Tailor on a branch.
- **Deterministic analysis first.** Health scores and keyword match do not call a model.
- **AI stays grounded.** Gaps are reported. Fabricated employers, technologies, and metrics are refused.
- **Export everything.** JSON backup and per-application ZIP packages keep the system portable.
