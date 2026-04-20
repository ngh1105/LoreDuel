import type { RunState, PlayerProfile, Stance, StatusId } from './game'

const validStances: Stance[] = ['bulwark', 'trickster', 'eclipse']
const validStatusIds: StatusId[] = ['guarded', 'burning', 'shaken', 'focused']

export function validateRunState(data: unknown): data is RunState {
  if (!data || typeof data !== 'object') return false
  const run = data as Record<string, unknown>

  if (typeof run.started !== 'boolean') return false
  if (typeof run.completed !== 'boolean') return false
  if (typeof run.currentBattleIndex !== 'number') return false
  if (run.currentBattleIndex < 0 || run.currentBattleIndex > 10) return false
  if (!Array.isArray(run.battlesWon)) return false
  if (!Array.isArray(run.chronicle)) return false

  if (run.activeBattle !== null) {
    if (!validateBattleState(run.activeBattle)) return false
  }

  return true
}

export function validateBattleState(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const battle = data as Record<string, unknown>

  if (typeof battle.battleId !== 'string') return false
  if (typeof battle.round !== 'number' || battle.round < 1 || battle.round > 100) return false
  if (typeof battle.playerResolve !== 'number' || battle.playerResolve < 0 || battle.playerResolve > 50) return false
  if (typeof battle.rivalResolve !== 'number' || battle.rivalResolve < 0 || battle.rivalResolve > 50) return false
  if (typeof battle.tension !== 'number' || battle.tension < 0 || battle.tension > 100) return false
  if (typeof battle.playerStance !== 'string' || !validStances.includes(battle.playerStance as Stance)) return false
  if (typeof battle.rivalStance !== 'string' || !validStances.includes(battle.rivalStance as Stance)) return false
  if (!Array.isArray(battle.playerStatuses)) return false
  if (!Array.isArray(battle.rivalStatuses)) return false

  for (const status of battle.playerStatuses as Array<Record<string, unknown>>) {
    if (!validateStatusEffect(status)) return false
  }
  for (const status of battle.rivalStatuses as Array<Record<string, unknown>>) {
    if (!validateStatusEffect(status)) return false
  }

  return true
}

function validateStatusEffect(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const status = data as Record<string, unknown>

  if (typeof status.id !== 'string' || !validStatusIds.includes(status.id as StatusId)) return false
  if (typeof status.duration !== 'number' || status.duration < 0 || status.duration > 10) return false
  if (status.source !== 'player' && status.source !== 'rival') return false

  return true
}

export function validateProfile(data: unknown): data is PlayerProfile {
  if (!data || typeof data !== 'object') return false
  const profile = data as Record<string, unknown>

  if (typeof profile.runsCompleted !== 'number' || profile.runsCompleted < 0) return false
  if (typeof profile.wins !== 'number' || profile.wins < 0) return false
  if (typeof profile.losses !== 'number' || profile.losses < 0) return false
  if (typeof profile.favoriteMoveId !== 'string') return false
  if (!Array.isArray(profile.unlockedScenes)) return false
  if (!Array.isArray(profile.unlockedEnemies)) return false

  return true
}

export function sanitizeString(input: string, maxLength = 500): string {
  return input.slice(0, maxLength).replace(/[<>]/g, '')
}
