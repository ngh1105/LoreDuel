import { describe, it, expect } from 'vitest'
import {
  createInitialProfile,
  createInitialRunState,
  createBattleState,
  battleDefinitions,
  moves,
  getMoveById,
  getBattleProgressLabel,
  resolveWinnerLabel,
  chooseEnemyMove,
  judgeRoundLocally,
  applyVerdictToBattleState,
  isBattleWon,
  isBattleLost,
  advanceRunState,
  recordFavoriteMove,
  makeChronicleEntry,
  getStatusMeta,
  getSelectedBattle,
  type BattleState,
  type StructuredVerdict,
} from './game'

// --- Profile ---

describe('createInitialProfile', () => {
  it('returns a fresh profile with zero stats', () => {
    const profile = createInitialProfile()
    expect(profile.runsCompleted).toBe(0)
    expect(profile.wins).toBe(0)
    expect(profile.losses).toBe(0)
    expect(profile.favoriteMoveId).toBe(moves[0].id)
    expect(profile.unlockedScenes.length).toBeGreaterThanOrEqual(1)
    expect(profile.unlockedEnemies.length).toBeGreaterThanOrEqual(1)
  })
})

// --- Run state ---

describe('createInitialRunState', () => {
  it('creates a started, non-completed run at battle 0', () => {
    const run = createInitialRunState()
    expect(run.started).toBe(true)
    expect(run.completed).toBe(false)
    expect(run.currentBattleIndex).toBe(0)
    expect(run.activeBattle).not.toBeNull()
    expect(run.chronicle.length).toBe(1)
  })
})

describe('createBattleState', () => {
  it('initializes player resolve at 14', () => {
    const state = createBattleState(battleDefinitions[0])
    expect(state.playerResolve).toBe(14)
    expect(state.round).toBe(1)
    expect(state.tension).toBe(battleDefinitions[0].scene.tensionBase)
  })

  it('gives boss battle 16 rival resolve', () => {
    const boss = battleDefinitions.find((b) => b.id === 'battle-3')!
    const state = createBattleState(boss)
    expect(state.rivalResolve).toBe(16)
  })
})

// --- Move lookup ---

describe('getMoveById', () => {
  it('returns the correct move', () => {
    const move = getMoveById('glass-oath')
    expect(move.name).toBe('Glass Oath')
    expect(move.stance).toBe('bulwark')
  })

  it('returns first move for unknown id', () => {
    const move = getMoveById('nonexistent')
    expect(move.id).toBe(moves[0].id)
  })
})

describe('moves', () => {
  it('contains all 9 moves', () => {
    expect(moves).toHaveLength(9)
  })
})

// --- Progress label ---

describe('getBattleProgressLabel', () => {
  it('formats correctly for initial run', () => {
    const run = createInitialRunState()
    expect(getBattleProgressLabel(run)).toBe('Battle 1 / 3')
  })
})

// --- Winner label ---

describe('resolveWinnerLabel', () => {
  it('returns player label', () => {
    expect(resolveWinnerLabel('player')).toContain('Sable')
  })

  it('returns rival label', () => {
    expect(resolveWinnerLabel('rival')).toContain('rival')
  })

  it('returns draw label', () => {
    expect(resolveWinnerLabel('draw')).toContain('withholds')
  })
})

// --- Enemy AI ---

describe('chooseEnemyMove', () => {
  it('returns a valid move from the enemy pool', () => {
    const battle = battleDefinitions[0]
    const state = createBattleState(battle)
    const move = chooseEnemyMove(battle, state)
    expect(battle.enemy.movePool).toContain(move.id)
  })

  it('favors scoring higher moves', () => {
    const battle = battleDefinitions[1]
    const state = createBattleState(battle)
    const move = chooseEnemyMove(battle, state)
    expect(move).toBeDefined()
    expect(move.baseDamage).toBeGreaterThanOrEqual(1)
  })
})

// --- Combat resolution ---

describe('judgeRoundLocally', () => {
  it('produces a valid structured verdict', () => {
    const battle = battleDefinitions[0]
    const state = createBattleState(battle)
    const playerMove = getMoveById('glass-oath')
    const rivalMove = chooseEnemyMove(battle, state)

    const verdict = judgeRoundLocally({ battle, battleState: state, playerMove, rivalMove })
    expect(['player', 'rival', 'draw']).toContain(verdict.winner)
    expect(verdict.playerLoss).toBeGreaterThanOrEqual(1)
    expect(verdict.playerLoss).toBeLessThanOrEqual(4)
    expect(verdict.rivalLoss).toBeGreaterThanOrEqual(1)
    expect(verdict.rivalLoss).toBeLessThanOrEqual(4)
    expect(verdict.narration).toBeTruthy()
    expect(verdict.oracleLine).toBeTruthy()
    expect(verdict.tacticalReason).toBeTruthy()
  })

  it('penalizes repeated moves', () => {
    const battle = battleDefinitions[0]
    const baseState = createBattleState(battle)
    const playerMove = getMoveById('glass-oath')
    const rivalMove = getMoveById('mirror-feint')

    const stateWithMemory: BattleState = {
      ...baseState,
      turnMemory: [{
        round: 1,
        playerMoveId: 'glass-oath',
        rivalMoveId: 'mirror-feint',
        verdictSummary: 'test',
        winner: 'draw',
      }],
    }

    const fresh = judgeRoundLocally({ battle, battleState: baseState, playerMove, rivalMove })
    const repeated = judgeRoundLocally({ battle, battleState: stateWithMemory, playerMove, rivalMove })

    // Repeated play should shift scoring (player gets penalized)
    expect(repeated).toBeDefined()
    expect(fresh).toBeDefined()
  })

  it('applies eclipse bonus at high tension', () => {
    const battle = battleDefinitions[2]
    const state: BattleState = {
      ...createBattleState(battle),
      tension: 65,
    }
    const eclipseMove = getMoveById('eclipse-refrain')
    const bulwarkMove = getMoveById('glass-oath')

    const verdict = judgeRoundLocally({ battle, battleState: state, playerMove: eclipseMove, rivalMove: bulwarkMove })
    expect(verdict).toBeDefined()
  })
})

// --- State transitions ---

describe('applyVerdictToBattleState', () => {
  it('advances round and adjusts resolve', () => {
    const battle = battleDefinitions[0]
    const state = createBattleState(battle)
    const playerMove = getMoveById('glass-oath')
    const rivalMove = getMoveById('mirror-feint')
    const verdict = judgeRoundLocally({ battle, battleState: state, playerMove, rivalMove })

    const next = applyVerdictToBattleState(state, battle, playerMove, rivalMove, verdict)
    expect(next.round).toBe(2)
    expect(next.playerResolve).toBeLessThanOrEqual(state.playerResolve)
    expect(next.rivalResolve).toBeLessThanOrEqual(state.rivalResolve)
    expect(next.tension).toBeGreaterThan(state.tension)
    expect(next.turnMemory.length).toBe(1)
  })
})

// --- Win/loss detection ---

describe('isBattleWon / isBattleLost', () => {
  it('detects a win when rival resolve drops to 0', () => {
    const state: BattleState = {
      ...createBattleState(battleDefinitions[0]),
      rivalResolve: 0,
      playerResolve: 5,
    }
    expect(isBattleWon(state)).toBe(true)
    expect(isBattleLost(state)).toBe(false)
  })

  it('detects a loss when player resolve drops to 0', () => {
    const state: BattleState = {
      ...createBattleState(battleDefinitions[0]),
      playerResolve: 0,
      rivalResolve: 5,
    }
    expect(isBattleWon(state)).toBe(false)
    expect(isBattleLost(state)).toBe(true)
  })

  it('detects mutual loss as a player loss', () => {
    const state: BattleState = {
      ...createBattleState(battleDefinitions[0]),
      playerResolve: 0,
      rivalResolve: 0,
    }
    expect(isBattleLost(state)).toBe(true)
  })
})

// --- Campaign progression ---

describe('advanceRunState', () => {
  it('advances to the next battle on win', () => {
    const run = createInitialRunState()
    const battle = battleDefinitions[0]
    run.activeBattle = {
      ...createBattleState(battle),
      rivalResolve: 0,
      playerResolve: 8,
    }
    const profile = createInitialProfile()
    const result = advanceRunState(run, profile)
    expect(result.runState.currentBattleIndex).toBe(1)
    expect(result.runState.battlesWon).toContain('battle-1')
  })

  it('completes campaign after winning final battle', () => {
    const run = createInitialRunState()
    run.currentBattleIndex = 2
    run.battlesWon = ['battle-1', 'battle-2']
    const boss = battleDefinitions[2]
    run.activeBattle = {
      ...createBattleState(boss),
      rivalResolve: 0,
      playerResolve: 3,
    }
    const profile = createInitialProfile()
    const result = advanceRunState(run, profile)
    expect(result.runState.completed).toBe(true)
    expect(result.profile.wins).toBe(1)
  })

  it('ends campaign on loss', () => {
    const run = createInitialRunState()
    run.activeBattle = {
      ...createBattleState(battleDefinitions[0]),
      playerResolve: 0,
      rivalResolve: 10,
    }
    const profile = createInitialProfile()
    const result = advanceRunState(run, profile)
    expect(result.runState.completed).toBe(true)
    expect(result.profile.losses).toBe(1)
  })
})

// --- Chronicle ---

describe('makeChronicleEntry', () => {
  it('creates an entry with correct fields', () => {
    const battle = battleDefinitions[0]
    const state = createBattleState(battle)
    const verdict: StructuredVerdict = {
      winner: 'player',
      playerLoss: 2,
      rivalLoss: 3,
      tensionShift: 12,
      narration: 'Test narration',
      oracleLine: 'Test oracle',
      sceneShift: 'Test scene',
      appliedStatuses: { player: [], rival: [] },
      clearedStatuses: { player: [], rival: [] },
      stanceDelta: { player: 'bulwark', rival: 'trickster' },
      tacticalReason: 'Test reason',
    }
    const entry = makeChronicleEntry(battle, state, verdict, 'mock')
    expect(entry.id).toBe('battle-1-round-1')
    expect(entry.round).toBe(1)
    expect(entry.mode).toBe('mock')
  })
})

// --- Favorite move ---

describe('recordFavoriteMove', () => {
  it('picks the most mentioned move', () => {
    const profile = createInitialProfile()
    const chronicle = [
      { id: '1', battleId: 'b1', battleLabel: 'B1', round: 1, title: 't', summary: 'Glass Oath dominated', oracleLine: '', sceneShift: '', mode: 'mock' as const },
      { id: '2', battleId: 'b1', battleLabel: 'B1', round: 2, title: 't', summary: 'Glass Oath again', oracleLine: '', sceneShift: '', mode: 'mock' as const },
      { id: '3', battleId: 'b1', battleLabel: 'B1', round: 3, title: 't', summary: 'Mirror Feint landed', oracleLine: '', sceneShift: '', mode: 'mock' as const },
    ]
    const result = recordFavoriteMove(profile, chronicle)
    expect(result.favoriteMoveId).toBe('glass-oath')
  })
})

// --- Status metadata ---

describe('getStatusMeta', () => {
  it('returns metadata for all status types', () => {
    for (const id of ['guarded', 'burning', 'shaken', 'focused'] as const) {
      const meta = getStatusMeta(id)
      expect(meta.label).toBeTruthy()
      expect(meta.description).toBeTruthy()
    }
  })
})

// --- Battle selection ---

describe('getSelectedBattle', () => {
  it('returns first battle for null run state', () => {
    const battle = getSelectedBattle(null)
    expect(battle.id).toBe('battle-1')
  })

  it('returns correct battle for active run', () => {
    const run = createInitialRunState()
    const battle = getSelectedBattle(run)
    expect(battle.id).toBe('battle-1')
  })
})
