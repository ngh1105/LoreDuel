# Environment Configuration

## Environment Files

| File | Purpose | Git tracked? |
|------|---------|-------------|
| `.env.local.example` | Template with placeholder values | ✅ Yes |
| `.env.local` | Local development overrides | ❌ No (.gitignore) |
| `.env.preview` | Preview/staging deployment | ❌ No |
| `.env.production` | Production deployment | ❌ No |

## Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_GENLAYER_RPC_URL` | GenLayer RPC endpoint | `https://studio.genlayer.com/api` |
| `NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS` | Deployed contract address | `0xc0A81f3411B644e97E28C5E207cDA042FcA605d1` |
| `NEXT_PUBLIC_GENLAYER_NETWORK` | Target network name | `studionet` |
| `API_WRITE_TOKEN` | Bearer token for write APIs (`/api/profile`, `/api/runs`) | `super-secret-token` |
| `ANALYTICS_INGEST_TOKEN` | Bearer token for analytics ingestion/read API (`/api/events`) | `super-secret-token` |
| `LOREDUEL_STORE_FILE` | File path for persistent server store | `.data/server-store.json` |
| `ENABLE_POSTGRES` | Enable Postgres backend (`true` to activate) | `false` |
| `DATABASE_URL` | Postgres connection string (enables DB backend) | `postgres://postgres:postgres@localhost:5432/loreduel` |

## Network Targets

| Environment | Network | RPC |
|------------|---------|-----|
| Local dev | `localnet` | `http://localhost:4000` |
| Preview | `studionet` | `https://studio.genlayer.com/api` |
| Staging | `testnetAsimov` | GenLayer testnet endpoint |
| Production | `testnetBradbury` | GenLayer mainnet endpoint |

## Security Rules

1. **Never commit `.env.local`** — it is gitignored.
2. **All `NEXT_PUBLIC_` variables are client-exposed** — never put secrets in them.
3. **Contract addresses are public** — they are on-chain and non-sensitive.
4. **RPC URLs are public** — they are needed by the client to connect.
5. **No server-side secrets exist yet** — if added, use `GENLAYER_` prefix (no `NEXT_PUBLIC_`).
