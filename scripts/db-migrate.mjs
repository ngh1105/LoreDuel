import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import pg from 'pg'

const { Client } = pg

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL is required for db:migrate')
    process.exit(1)
  }

  const migrationsDir = resolve(process.cwd(), 'db', 'migrations')
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()

  const client = new Client({ connectionString: databaseUrl })
  await client.connect()

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    for (const file of files) {
      const existing = await client.query('SELECT id FROM schema_migrations WHERE id = $1', [file])
      if (existing.rowCount && existing.rowCount > 0) {
        continue
      }

      const sql = readFileSync(join(migrationsDir, file), 'utf-8')
      console.log(`Applying migration ${file}`)
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file])
      await client.query('COMMIT')
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }

  console.log('Migrations complete')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
