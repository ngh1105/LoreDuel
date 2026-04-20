# LoreDuel Operational Runbooks

Last updated: 2026-04-08

These runbooks match the current MVP architecture:

- Frontend: Next.js App Router
- Live turn source: GenLayer intelligent contract
- API data store: file-backed store by default, Postgres when explicitly enabled

## Runbook 1: Contract Redeploy

When:

- Contract logic changes or a new contract address is required.

Steps:

1. Update contract source at `contracts/lore_duel.py`.
2. Deploy with your approved GenLayer deploy process.
3. Update environment values:
   - `NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS`
   - `NEXT_PUBLIC_GENLAYER_RPC_URL` (if changed)
   - `NEXT_PUBLIC_GENLAYER_NETWORK` (if changed)
4. Update `deployment/studionet-latest.json` with new metadata.
5. Run smoke checks:
   - `npm run smoke:read`
   - `npm run smoke:write`
6. Verify `/api/health` and one end-to-end turn in UI.

Rollback:

- Restore previous contract env values and redeploy frontend config.

## Runbook 2: RPC Outage / Live Verdict Failures

Symptoms:

- Status note indicates fallback resolution.
- Increased `fallback_used` events in analytics.

Immediate response:

1. Confirm RPC status externally.
2. Keep app online: fallback mode should preserve gameplay.
3. Monitor `/api/metrics` and `/api/events` for spike patterns.
4. Communicate degraded live mode status.

Recovery:

- Once RPC stabilizes, live turns resume automatically.

## Runbook 3: Wallet Connectivity / Network Mismatch

Symptoms:

- Users cannot connect wallet.
- UI warns about wrong network.

Checks:

1. Confirm browser wallet provider exists (`window.ethereum`).
2. Confirm expected chain in env (`NEXT_PUBLIC_GENLAYER_NETWORK`).
3. Reconnect wallet after chain switch.

Expected behavior:

- Wrong-network state blocks live submit and remains playable in local fallback.

## Runbook 4: API Store Issues

### 4A. File store mode (MVP default)

Symptoms:

- Missing or corrupted `.data/server-store.json`.

Actions:

1. Stop service.
2. Backup current `.data/server-store.json` if present.
3. Restore from backup or allow app to regenerate empty store.
4. Restart and verify `/api/health` and `/api/metrics`.

### 4B. Postgres mode

Symptoms:

- DB connection errors, migration mismatch, high query latency.

Actions:

1. Check `ENABLE_POSTGRES=true` and `DATABASE_URL` correctness.
2. Run migrations: `npm run db:migrate`.
3. Verify database connectivity from app runtime.
4. If DB is unstable, disable Postgres (`ENABLE_POSTGRES=false`) and restart to use file fallback.

## Runbook 5: Invalid Verdict Output

Symptoms:

- Live turns accepted but parsed verdict rejected.
- Frequent fallback despite wallet/live path being active.

Actions:

1. Inspect recent verdict payload structure.
2. Validate required fields and bounds expected by `src/lib/genlayer.ts`.
3. Patch prompt/contract output schema as needed.
4. Re-run smoke checks and one full campaign pass.

## Runbook 6: Release Validation

Pre-release checklist:

1. `npm run lint`
2. `npx tsc --noEmit`
3. `npm test`
4. `npm run test:e2e`
5. `npm run build`
6. Validate `/api/health` and `/api/metrics` on deployed environment.

Post-release checks:

- Start-demo flow works.
- One cast turn works.
- API endpoints return expected status codes.

## Incident Template

```text
Incident: [short title]
Severity: P1 / P2 / P3
Detected: [timestamp + timezone]
Impact: [user-visible impact]
Root cause: [confirmed cause]
Actions taken:
1. ...
2. ...
Resolution: [what restored service]
Follow-up: [prevention items]
```
