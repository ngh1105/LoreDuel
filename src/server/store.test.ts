import { existsSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { appendAnalytics, appendRun, getProfile, listAnalytics, listRuns, upsertProfile } from './store'
import { __getStoreFilePathForTests, __reloadStoreFromDiskForTests, __resetStoreForTests } from './store'

describe('server store persistence', () => {
  beforeEach(() => {
    process.env.LOREDUEL_STORE_FILE = 'E:/genlayer-auto/loreduel/.data/test-store.json'
    const file = __getStoreFilePathForTests()
    const folder = dirname(file)
    if (existsSync(folder)) {
      rmSync(folder, { recursive: true, force: true })
    }
    __resetStoreForTests()
  })

  it('persists profile and run records across reload', () => {
    upsertProfile({
      wallet: '0x1234567890abcdef1234567890abcdef12345678',
      runsCompleted: 1,
      wins: 1,
      losses: 0,
      favoriteMoveId: 'glass-oath',
      unlockedScenes: ['velis-atrium'],
      unlockedEnemies: ['choir-knight'],
      updatedAt: new Date().toISOString(),
    })

    appendRun({
      id: 'run-1',
      wallet: '0x1234567890abcdef1234567890abcdef12345678',
      startedAt: new Date().toISOString(),
      battlesWon: ['battle-1'],
      result: 'win',
      summary: 'test run',
    })

    __reloadStoreFromDiskForTests()

    const profile = getProfile('0x1234567890abcdef1234567890abcdef12345678')
    const runs = listRuns('0x1234567890abcdef1234567890abcdef12345678')

    expect(profile).not.toBeNull()
    expect(profile?.wins).toBe(1)
    expect(runs).toHaveLength(1)
    expect(runs[0]?.result).toBe('win')
  })

  it('persists analytics events and respects list limit', () => {
    appendAnalytics({
      id: 'evt-1',
      type: 'demo_start',
      payload: {},
      timestamp: new Date().toISOString(),
    })
    appendAnalytics({
      id: 'evt-2',
      type: 'battle_start',
      payload: { battleId: 'battle-1' },
      timestamp: new Date().toISOString(),
    })

    __reloadStoreFromDiskForTests()
    const events = listAnalytics(1)
    expect(events).toHaveLength(1)
    expect(events[0]?.id).toBe('evt-2')
  })
})
