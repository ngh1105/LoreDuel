# LoreDuel Production Readiness

Last updated: 2026-04-08

This document tracks readiness relative to current code. LoreDuel is now at a solid MVP state, not full production.

## Current Stage

- Product stage: MVP (playable vertical slice with backend-lite APIs).
- Primary mode: Solo campaign (3 battles) with optional wallet/live adjudication.
- Persistence mode: File-backed server store by default (`.data/server-store.json`).
- Optional scale mode: Postgres backend when `ENABLE_POSTGRES=true` and `DATABASE_URL` is configured.

## Implemented Now (Done)

### Gameplay and UX

- 3-battle campaign with structured combat state, status effects, stances, and chronicle history.
- First-run tutorial banner and settings panel (animation, sound, high contrast).
- Offline banner, storage corruption warning, retry turn flow, and empty states.

### Wallet and Live Contract

- Wallet connect/reconnect/account-change handling.
- Wrong-network detection with explicit user-facing warning.
- Live verdict path with automatic fallback to local judge on failure.
- Tx explorer links and recent live transaction history panel.

### Data and Backend API

- API routes:
  - `GET/PUT /api/profile/:wallet`
  - `GET/POST /api/runs`
  - `GET/POST /api/events`
  - `GET /api/health`
  - `GET /api/metrics` (Prometheus format)
- Validation for profile/run/event payloads.
- Rate limiting for write endpoints.
- Request tracing header (`x-request-id`) in proxy.
- File persistence for API data with process-restart durability.
- Repository layer with Postgres support and safe fallback to file backend.

### Observability and Quality

- Client analytics buffered locally and shipped server-side (`/api/events`).
- Health endpoint with config checks and backend mode.
- Prometheus metrics endpoint for uptime and record counts.
- CI gates: lint, typecheck, unit tests, build, e2e.
- Automated coverage:
  - game logic tests
  - storage tests
  - genlayer adapter integration tests
  - server validation/rate-limit/store tests
  - Playwright UI and API integration tests

### Security Baseline

- Security headers configured in Next.js.
- Optional bearer-token auth for write APIs and analytics ingestion.
- Env guidance for separating public vs server-only settings.

## Remaining for Full Production (Not Done)

### Product and Content

- Expanded content pipeline (more scenes, enemies, progression depth).
- Localization and moderation workflow for generated text.
- Clear KPI instrumentation and dashboarded retention funnel.

### Platform and Reliability

- Mandatory managed Postgres in production (not fallback mode).
- Backups, restore verification, and data retention policy.
- Queueing or async worker for analytics/event fan-out at scale.
- Alerting and SLOs (error rate, latency, fallback rate).

### Security and Compliance

- Threat model sign-off for hybrid local/on-chain architecture.
- Contract audit and adversarial prompt review.
- Secrets rotation policy and access-control audit.
- Abuse controls beyond basic rate limiting (wallet spam heuristics, anomaly detection).

### Release and Operations

- Staging environment parity and release promotion policy.
- Incident ownership/on-call schedule.
- Runbooks validated in drill exercises.
- Rollback and migration playbook for Postgres-enabled deployments.

## Recommended Next Milestones

1. Production DB rollout: enable Postgres in staging, run migrations, validate failover and backup/restore.
2. Observability hardening: add alert rules and a dashboard for health, fallback rate, API error budget.
3. Security hardening: complete threat model and contract audit before public growth push.
4. Content expansion: externalized balance/content operations and localization readiness.
