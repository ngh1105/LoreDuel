# LoreDuel (MVP)

LoreDuel is a Next.js App Router game prototype: a solo 3-battle campaign with optional wallet-backed live adjudication on GenLayer.

Project status: **MVP complete** (playable vertical slice), not full production.

## MVP Features

- 3-battle campaign flow (tutorial -> midgame -> boss)
- Stance/status combat model with turn memory and chronicle log
- Demo mode (no wallet required)
- Optional wallet mode for live verdict relay
- Automatic fallback to local verdict logic if chain/RPC fails
- Local persistence (run/profile/settings)
- Minimal backend APIs for profile/runs/events/health/metrics
- E2E + unit/integration test coverage

## Tech Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Framer Motion
- Playwright + Vitest
- Optional Postgres (`pg`) for server persistence

## Quick Start

```bash
npm install
npm run dev
```

Open: [http://localhost:3000](http://localhost:3000)

## Scripts

- `npm run dev` - start development server
- `npm run build` - production build
- `npm run start` - run built app
- `npm run lint` - eslint
- `npm run test` - unit/integration tests (vitest)
- `npm run test:e2e` - Playwright end-to-end tests
- `npm run db:migrate` - apply Postgres schema migrations
- `npm run smoke:read` - read smoke test for GenLayer contract
- `npm run smoke:write` - write smoke test for GenLayer contract

## Environment

Create `.env.local` (optional for MVP demo, required for live mode/hardening):

```bash
# Live GenLayer (optional)
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_GENLAYER_NETWORK=studionet

# API protection (recommended outside local dev)
API_WRITE_TOKEN=replace-with-strong-token
ANALYTICS_INGEST_TOKEN=replace-with-strong-token

# Postgres mode (optional)
ENABLE_POSTGRES=true
DATABASE_URL=postgres://...
```

### Persistence modes

- Default: file store at `.data/server-store.json`
- Optional: Postgres when `ENABLE_POSTGRES=true` and `DATABASE_URL` is set

## API Surface

- `GET/PUT /api/profile/:wallet`
- `GET/POST /api/runs`
- `GET/POST /api/events`
- `GET /api/health`
- `GET /api/metrics` (Prometheus format)

## Folder Structure

```text
app/
  api/                      # route handlers
  layout.tsx
  page.tsx

src/
  components/
    LoreDuelApp.tsx         # compatibility export
    loreduel/
      LoreDuelApp.tsx       # main UI container
      constants.ts          # UI constants/types
  lib/
    game.ts                 # core game loop/state
    genlayer.ts             # chain adapter + fallback
    storage.ts              # client persistence
    analytics.ts
    tx-history.ts
  server/
    repository.ts           # file/pg repository layer
    store.ts
    rate-limit.ts
    validation.ts
  styles/
    loreduel.css
```

## Testing Checklist (MVP)

```bash
npm run lint
npx tsc --noEmit
npm run test
npm run test:e2e
```

## Production Gap (intentionally out of MVP)

- mandatory managed Postgres + backup/restore drills
- alerting/SLO/on-call/runbooks
- security hardening (threat model, contract audit, abuse controls)
- deeper content pipeline + localization

Details: see [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md).
