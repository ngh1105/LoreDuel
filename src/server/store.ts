import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import type { AnalyticsRecord, ProfileRecord, RunRecord } from './types'

type ServerStore = {
  profiles: Map<string, ProfileRecord>
  runs: Map<string, RunRecord[]>
  analytics: AnalyticsRecord[]
  loadedFromDisk: boolean
}

const globalStore = globalThis as typeof globalThis & { __loreduelStore?: ServerStore }

type StorePayload = {
  profiles: ProfileRecord[]
  runs: Record<string, RunRecord[]>
  analytics: AnalyticsRecord[]
}

function getStoreFilePath(): string {
  const custom = process.env.LOREDUEL_STORE_FILE?.trim()
  if (custom) {
    return resolve(/*turbopackIgnore: true*/ custom)
  }
  return join(/*turbopackIgnore: true*/ process.cwd(), '.data', 'server-store.json')
}

function createStore(): ServerStore {
  return {
    profiles: new Map(),
    runs: new Map(),
    analytics: [],
    loadedFromDisk: false,
  }
}

function toPayload(store: ServerStore): StorePayload {
  return {
    profiles: Array.from(store.profiles.values()),
    runs: Object.fromEntries(store.runs.entries()),
    analytics: store.analytics,
  }
}

function loadFromDisk(store: ServerStore): void {
  if (store.loadedFromDisk) return
  const file = getStoreFilePath()
  store.loadedFromDisk = true

  if (!existsSync(/*turbopackIgnore: true*/ file)) {
    return
  }

  try {
    const raw = readFileSync(/*turbopackIgnore: true*/ file, 'utf-8')
    const parsed = JSON.parse(raw) as StorePayload

    if (Array.isArray(parsed.profiles)) {
      for (const profile of parsed.profiles) {
        store.profiles.set(profile.wallet, profile)
      }
    }

    if (parsed.runs && typeof parsed.runs === 'object') {
      for (const [wallet, records] of Object.entries(parsed.runs)) {
        if (Array.isArray(records)) {
          store.runs.set(wallet, records)
        }
      }
    }

    if (Array.isArray(parsed.analytics)) {
      store.analytics = parsed.analytics
    }
  } catch (error) {
    console.error('[ServerStore] Failed to load store file:', error)
  }
}

function persist(store: ServerStore): void {
  const file = getStoreFilePath()
  const folder = dirname(/*turbopackIgnore: true*/ file)
  const tmp = `${file}.tmp`

  try {
    mkdirSync(/*turbopackIgnore: true*/ folder, { recursive: true })
    writeFileSync(/*turbopackIgnore: true*/ tmp, JSON.stringify(toPayload(store), null, 2), 'utf-8')
    renameSync(/*turbopackIgnore: true*/ tmp, /*turbopackIgnore: true*/ file)
  } catch (error) {
    console.error('[ServerStore] Failed to persist store:', error)
  }
}

export function __resetStoreForTests(): void {
  globalStore.__loreduelStore = createStore()
}

export function __getStoreFilePathForTests(): string {
  return getStoreFilePath()
}

export function __reloadStoreFromDiskForTests(): void {
  const store = getStore()
  store.profiles.clear()
  store.runs.clear()
  store.analytics = []
  store.loadedFromDisk = false
  loadFromDisk(store)
}

function withStore<T>(operation: (store: ServerStore) => T): T {
  const store = getStore()
  loadFromDisk(store)
  const result = operation(store)
  persist(store)
  return result
}

function withStoreReadonly<T>(operation: (store: ServerStore) => T): T {
  const store = getStore()
  loadFromDisk(store)
  return operation(store)
}

function getStore(): ServerStore {
  if (!globalStore.__loreduelStore) {
    globalStore.__loreduelStore = createStore()
  }
  
  return globalStore.__loreduelStore
}

export function upsertProfile(profile: ProfileRecord): ProfileRecord {
  return withStore((store) => {
    store.profiles.set(profile.wallet, profile)
    return profile
  })
}

export function getProfile(wallet: string): ProfileRecord | null {
  return withStoreReadonly((store) => store.profiles.get(wallet) ?? null)
}

export function appendRun(run: RunRecord): RunRecord {
  return withStore((store) => {
    const current = store.runs.get(run.wallet) ?? []
    current.unshift(run)
    store.runs.set(run.wallet, current.slice(0, 200))
    return run
  })
}

export function listRuns(wallet: string): RunRecord[] {
  return withStoreReadonly((store) => store.runs.get(wallet) ?? [])
}

export function appendAnalytics(event: AnalyticsRecord): AnalyticsRecord {
  return withStore((store) => {
    store.analytics.unshift(event)
    if (store.analytics.length > 1000) {
      store.analytics.length = 1000
    }
    return event
  })
}

export function listAnalytics(limit = 100): AnalyticsRecord[] {
  return withStoreReadonly((store) => store.analytics.slice(0, Math.max(1, Math.min(limit, 500))))
}

export function getStoreStats(): { profiles: number; runs: number; analytics: number } {
  return withStoreReadonly((store) => {
    let runCount = 0
    for (const records of store.runs.values()) {
      runCount += records.length
    }
    return {
      profiles: store.profiles.size,
      runs: runCount,
      analytics: store.analytics.length,
    }
  })
}
