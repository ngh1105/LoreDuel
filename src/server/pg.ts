import { Pool, type QueryResultRow } from 'pg'

const globalPg = globalThis as typeof globalThis & { __loreduelPgPool?: Pool }

export function isPostgresConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

function getPool(): Pool {
  if (!globalPg.__loreduelPgPool) {
    globalPg.__loreduelPgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    })
  }
  return globalPg.__loreduelPgPool
}

export async function pgQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  return getPool().query<T>(text, values)
}
