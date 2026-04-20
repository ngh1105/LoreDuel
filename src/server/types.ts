export type ProfileRecord = {
  wallet: string
  runsCompleted: number
  wins: number
  losses: number
  favoriteMoveId: string
  unlockedScenes: string[]
  unlockedEnemies: string[]
  updatedAt: string
}

export type RunRecord = {
  id: string
  wallet: string
  startedAt: string
  completedAt?: string
  battlesWon: string[]
  result: 'win' | 'loss' | 'in_progress'
  summary?: string
}

export type AnalyticsRecord = {
  id: string
  wallet?: string
  type: string
  payload: Record<string, unknown>
  timestamp: string
  requestId?: string
}
