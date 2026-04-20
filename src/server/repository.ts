import { appendAnalytics, appendRun, getProfile, getStoreStats, listAnalytics, listRuns, upsertProfile } from './store'
import type { AnalyticsRecord, ProfileRecord, RunRecord } from './types'
import { isPostgresConfigured, pgQuery } from './pg'

export type DataStats = {
  backend: 'postgres' | 'file'
  profiles: number
  runs: number
  analytics: number
}

let postgresTemporarilyDisabled = false
let postgresDisableLogged = false

function shouldUsePostgres(): boolean {
  const explicitlyEnabled = process.env.ENABLE_POSTGRES === 'true'
  return explicitlyEnabled && isPostgresConfigured() && !postgresTemporarilyDisabled
}

function handlePostgresFailure(context: string, error: unknown): void {
  postgresTemporarilyDisabled = true
  if (!postgresDisableLogged) {
    postgresDisableLogged = true
    console.error(`[Repository] ${context} failed, switching to file backend for this process:`, error)
  }
}

export async function getProfileRecord(wallet: string): Promise<ProfileRecord | null> {
  if (!shouldUsePostgres()) {
    return getProfile(wallet)
  }

  try {
    const result = await pgQuery<{ data: ProfileRecord }>(
      'SELECT data FROM profiles WHERE wallet = $1 LIMIT 1',
      [wallet],
    )
    return result.rows[0]?.data ?? null
  } catch (error) {
    handlePostgresFailure('Postgres getProfile', error)
    return getProfile(wallet)
  }
}

export async function upsertProfileRecord(profile: ProfileRecord): Promise<ProfileRecord> {
  if (!shouldUsePostgres()) {
    return upsertProfile(profile)
  }

  try {
    await pgQuery(
      `
      INSERT INTO profiles (wallet, data, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (wallet)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      `,
      [profile.wallet, JSON.stringify(profile)],
    )
    return profile
  } catch (error) {
    handlePostgresFailure('Postgres upsertProfile', error)
    return upsertProfile(profile)
  }
}

export async function appendRunRecord(run: RunRecord): Promise<RunRecord> {
  if (!shouldUsePostgres()) {
    return appendRun(run)
  }

  try {
    await pgQuery(
      `
      INSERT INTO runs (id, wallet, data, started_at)
      VALUES ($1, $2, $3::jsonb, NOW())
      `,
      [run.id, run.wallet, JSON.stringify(run)],
    )
    return run
  } catch (error) {
    handlePostgresFailure('Postgres appendRun', error)
    return appendRun(run)
  }
}

export async function listRunsForWallet(wallet: string): Promise<RunRecord[]> {
  if (!shouldUsePostgres()) {
    return listRuns(wallet)
  }

  try {
    const result = await pgQuery<{ data: RunRecord }>(
      `
      SELECT data
      FROM runs
      WHERE wallet = $1
      ORDER BY started_at DESC
      LIMIT 200
      `,
      [wallet],
    )
    return result.rows.map((row: { data: RunRecord }) => row.data)
  } catch (error) {
    handlePostgresFailure('Postgres listRuns', error)
    return listRuns(wallet)
  }
}

export async function appendAnalyticsRecord(event: AnalyticsRecord): Promise<AnalyticsRecord> {
  if (!shouldUsePostgres()) {
    return appendAnalytics(event)
  }

  try {
    await pgQuery(
      `
      INSERT INTO analytics_events (id, wallet, type, payload, occurred_at, request_id)
      VALUES ($1, $2, $3, $4::jsonb, NOW(), $5)
      `,
      [event.id, event.wallet ?? null, event.type, JSON.stringify(event.payload), event.requestId ?? null],
    )
    return event
  } catch (error) {
    handlePostgresFailure('Postgres appendAnalytics', error)
    return appendAnalytics(event)
  }
}

export async function listAnalyticsRecords(limit = 100): Promise<AnalyticsRecord[]> {
  if (!shouldUsePostgres()) {
    return listAnalytics(limit)
  }

  try {
    const safeLimit = Math.max(1, Math.min(limit, 500))
    const result = await pgQuery<{
      id: string
      wallet: string | null
      type: string
      payload: Record<string, unknown>
      occurred_at: string
      request_id: string | null
    }>(
      `
      SELECT id, wallet, type, payload, occurred_at, request_id
      FROM analytics_events
      ORDER BY occurred_at DESC
      LIMIT $1
      `,
      [safeLimit],
    )

    return result.rows.map((row: {
      id: string
      wallet: string | null
      type: string
      payload: Record<string, unknown>
      occurred_at: string
      request_id: string | null
    }) => ({
      id: row.id,
      wallet: row.wallet ?? undefined,
      type: row.type,
      payload: row.payload ?? {},
      timestamp: row.occurred_at,
      requestId: row.request_id ?? undefined,
    }))
  } catch (error) {
    handlePostgresFailure('Postgres listAnalytics', error)
    return listAnalytics(limit)
  }
}

export async function getDataStats(): Promise<DataStats> {
  if (!shouldUsePostgres()) {
    const local = getStoreStats()
    return {
      backend: 'file',
      profiles: local.profiles,
      runs: local.runs,
      analytics: local.analytics,
    }
  }

  try {
    const [profiles, runs, analytics] = await Promise.all([
      pgQuery<{ count: string }>('SELECT COUNT(*)::text AS count FROM profiles'),
      pgQuery<{ count: string }>('SELECT COUNT(*)::text AS count FROM runs'),
      pgQuery<{ count: string }>('SELECT COUNT(*)::text AS count FROM analytics_events'),
    ])

    return {
      backend: 'postgres',
      profiles: Number.parseInt(profiles.rows[0]?.count ?? '0', 10),
      runs: Number.parseInt(runs.rows[0]?.count ?? '0', 10),
      analytics: Number.parseInt(analytics.rows[0]?.count ?? '0', 10),
    }
  } catch (error) {
    handlePostgresFailure('Postgres stats', error)
    const local = getStoreStats()
    return {
      backend: 'file',
      profiles: local.profiles,
      runs: local.runs,
      analytics: local.analytics,
    }
  }
}
