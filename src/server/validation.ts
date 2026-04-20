import type { ProfileRecord, RunRecord } from './types'

const WALLET_REGEX = /^0x[a-fA-F0-9]{40}$/

export function isWalletAddress(value: string): boolean {
  return WALLET_REGEX.test(value)
}

export function normalizeWallet(value: string): string {
  return value.toLowerCase()
}

export function validateProfilePayload(payload: unknown): payload is Omit<ProfileRecord, 'wallet' | 'updatedAt'> {
  if (!payload || typeof payload !== 'object') return false
  const data = payload as Record<string, unknown>
  return (
    typeof data.runsCompleted === 'number' &&
    data.runsCompleted >= 0 &&
    typeof data.wins === 'number' &&
    data.wins >= 0 &&
    typeof data.losses === 'number' &&
    data.losses >= 0 &&
    typeof data.favoriteMoveId === 'string' &&
    Array.isArray(data.unlockedScenes) &&
    Array.isArray(data.unlockedEnemies)
  )
}

export function validateRunPayload(payload: unknown): payload is Omit<RunRecord, 'id' | 'startedAt'> {
  if (!payload || typeof payload !== 'object') return false
  const data = payload as Record<string, unknown>
  return (
    typeof data.wallet === 'string' &&
    isWalletAddress(data.wallet) &&
    Array.isArray(data.battlesWon) &&
    (data.result === 'win' || data.result === 'loss' || data.result === 'in_progress') &&
    (typeof data.summary === 'undefined' || typeof data.summary === 'string') &&
    (typeof data.completedAt === 'undefined' || typeof data.completedAt === 'string')
  )
}
