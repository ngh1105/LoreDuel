import rawGameConfig from './game-config.v1.json'

export type Stance = 'bulwark' | 'trickster' | 'eclipse'
export type StatusId = 'guarded' | 'burning' | 'shaken' | 'focused'
export type VerdictMode = 'mock' | 'live' | 'fallback'

export type Duelist = {
  name: string
  title: string
  trait: string
}

export type StatusEffect = {
  id: StatusId
  label: string
  description: string
  duration: number
  source: 'player' | 'rival'
}

export type MoveDefinition = {
  id: string
  name: string
  incantation: string
  summary: string
  stance: Stance
  baseDamage: number
  selfDamage?: number
  focusGain?: number
  appliesStatus?: StatusId
  clearsStatus?: StatusId
  counters?: Stance[]
  comboFrom?: StatusId
}

export type SceneDefinition = {
  id: string
  name: string
  detail: string
  modifier: string
  favoredStance: Stance
  tensionBase: number
}

export type EnemyArchetype = {
  id: string
  duelist: Duelist
  description: string
  preferredStances: Stance[]
  movePool: string[]
  openingStatus?: StatusId
}

export type BattleDefinition = {
  id: string
  label: string
  chapter: string
  tutorialHint: string
  scene: SceneDefinition
  enemy: EnemyArchetype
}

export type TurnMemory = {
  round: number
  playerMoveId: string
  rivalMoveId: string
  verdictSummary: string
  winner: 'player' | 'rival' | 'draw'
}

export type BattleState = {
  battleId: string
  round: number
  playerResolve: number
  rivalResolve: number
  playerStance: Stance
  rivalStance: Stance
  tension: number
  playerStatuses: StatusEffect[]
  rivalStatuses: StatusEffect[]
  turnMemory: TurnMemory[]
  selectedMoveId: string
  lastVerdict?: StructuredVerdict
}

export type ChronicleEntry = {
  id: string
  battleId: string
  battleLabel: string
  round: number
  title: string
  summary: string
  oracleLine: string
  sceneShift: string
  mode: VerdictMode
  txHash?: `0x${string}`
}

export type RunState = {
  started: boolean
  completed: boolean
  currentBattleIndex: number
  battlesWon: string[]
  activeBattle: BattleState | null
  chronicle: ChronicleEntry[]
  campaignSummary?: string
}

export type PlayerProfile = {
  runsCompleted: number
  wins: number
  losses: number
  favoriteMoveId: string
  unlockedScenes: string[]
  unlockedEnemies: string[]
}

export type StructuredVerdict = {
  winner: 'player' | 'rival' | 'draw'
  playerLoss: number
  rivalLoss: number
  tensionShift: number
  narration: string
  oracleLine: string
  sceneShift: string
  appliedStatuses: {
    player: StatusId[]
    rival: StatusId[]
  }
  clearedStatuses: {
    player: StatusId[]
    rival: StatusId[]
  }
  stanceDelta: {
    player: Stance
    rival: Stance
  }
  tacticalReason: string
}

export type JudgeInput = {
  battle: BattleDefinition
  battleState: BattleState
  playerMove: MoveDefinition
  rivalMove: MoveDefinition
}

type GameConfigShape = {
  version: number
  duelists: Record<'player', Duelist>
  scenes: SceneDefinition[]
  enemyArchetypes: EnemyArchetype[]
  moves: MoveDefinition[]
  battleDefinitions: Array<Omit<BattleDefinition, 'scene' | 'enemy'> & { sceneId: string; enemyId: string }>
  initialChronicle: ChronicleEntry
}

const config = rawGameConfig as GameConfigShape

export const GAME_CONFIG_VERSION = config.version

export const duelists = config.duelists
const scenes: SceneDefinition[] = config.scenes
const enemyArchetypes: EnemyArchetype[] = config.enemyArchetypes
export const moves: MoveDefinition[] = config.moves

const sceneById = new Map(scenes.map((scene) => [scene.id, scene]))
const enemyById = new Map(enemyArchetypes.map((enemy) => [enemy.id, enemy]))

export const battleDefinitions: BattleDefinition[] = config.battleDefinitions.map((battle) => {
  const scene = sceneById.get(battle.sceneId)
  const enemy = enemyById.get(battle.enemyId)
  if (!scene || !enemy) {
    throw new Error(`Invalid game config: unresolved scene/enemy for battle ${battle.id}`)
  }
  return {
    id: battle.id,
    label: battle.label,
    chapter: battle.chapter,
    tutorialHint: battle.tutorialHint,
    scene,
    enemy,
  }
})

export const initialChronicle: ChronicleEntry = config.initialChronicle

// --- Balance Constants ---
const INITIAL_PLAYER_RESOLVE = 14
const DEFAULT_RIVAL_RESOLVE = 13
const BOSS_RIVAL_RESOLVE = 16
const BOSS_BATTLE_ID = 'battle-3'

const STANCE_ADVANTAGE_SCORE = 2
const STANCE_DISADVANTAGE_SCORE = -1
const COMBO_SCORE_BONUS = 2
const SCENE_STANCE_BONUS = 1
const REPETITION_PENALTY = 1

const TENSION_ECLIPSE_THRESHOLD = 60
const ECLIPSE_TENSION_BONUS = 2
const DOMINANT_WIN_GAP = 2

const BASE_TENSION_SHIFT = 10
const MIN_TENSION_SHIFT = 8
const MAX_TENSION_SHIFT = 18
const LATE_ROUND_THRESHOLD = 3
const LATE_ROUND_BONUS = 1

const MIN_LOSS = 1
const MAX_LOSS = 4
const MAX_TURN_MEMORY = 4
const MAX_TENSION = 100
const DEFAULT_STATUS_DURATION = 2

export function createInitialProfile(): PlayerProfile {
  return {
    runsCompleted: 0,
    wins: 0,
    losses: 0,
    favoriteMoveId: moves[0].id,
    unlockedScenes: [battleDefinitions[0].scene.id],
    unlockedEnemies: [battleDefinitions[0].enemy.id],
  }
}

export function createInitialRunState(): RunState {
  const battle = battleDefinitions[0]
  return {
    started: true,
    completed: false,
    currentBattleIndex: 0,
    battlesWon: [],
    activeBattle: createBattleState(battle),
    chronicle: [initialChronicle],
  }
}

export function createBattleState(battle: BattleDefinition): BattleState {
  return {
    battleId: battle.id,
    round: 1,
    playerResolve: INITIAL_PLAYER_RESOLVE,
    rivalResolve: battle.id === BOSS_BATTLE_ID ? BOSS_RIVAL_RESOLVE : DEFAULT_RIVAL_RESOLVE,
    playerStance: 'bulwark',
    rivalStance: battle.enemy.preferredStances[0],
    tension: battle.scene.tensionBase,
    playerStatuses: [],
    rivalStatuses: battle.enemy.openingStatus
      ? [makeStatus(battle.enemy.openingStatus, 'rival', DEFAULT_STATUS_DURATION)]
      : [],
    turnMemory: [],
    selectedMoveId: moves[0].id,
  }
}

export function getBattleById(id: string) {
  return battleDefinitions.find((battle) => battle.id === id) ?? battleDefinitions[0]
}

export function getMoveById(id: string) {
  return moves.find((move) => move.id === id) ?? moves[0]
}



export function getBattleProgressLabel(runState: RunState) {
  return `Battle ${Math.min(runState.currentBattleIndex + 1, battleDefinitions.length)} / ${battleDefinitions.length}`
}

export function resolveWinnerLabel(winner: StructuredVerdict['winner']) {
  if (winner === 'player') {
    return 'Sable seizes momentum'
  }

  if (winner === 'rival') {
    return 'The rival steals the chamber'
  }

  return 'The chamber withholds certainty'
}

export function chooseEnemyMove(
  battle: BattleDefinition,
  battleState: BattleState,
): MoveDefinition {
  const enemyMoves = battle.enemy.movePool.map(getMoveById)
  const favoredStance =
    battle.enemy.preferredStances[(battleState.round - 1) % battle.enemy.preferredStances.length]
  const playerLastMove = battleState.turnMemory[0]?.playerMoveId

  const scoredMoves = enemyMoves.map((move) => {
    let score = move.baseDamage

    if (move.stance === favoredStance) {
      score += STANCE_ADVANTAGE_SCORE
    }

    if (move.comboFrom && battleState.rivalStatuses.some((status) => status.id === move.comboFrom)) {
      score += COMBO_SCORE_BONUS
    }

    if (playerLastMove && getMoveById(playerLastMove).stance === 'bulwark' && move.counters?.includes('bulwark')) {
      score += STANCE_ADVANTAGE_SCORE
    }

    if (battle.scene.favoredStance === move.stance) {
      score += SCENE_STANCE_BONUS
    }

    return { move, score }
  })

  scoredMoves.sort((left, right) => right.score - left.score)
  return scoredMoves[0]?.move ?? enemyMoves[0]
}

export function judgeRoundLocally(input: JudgeInput): StructuredVerdict {
  const { battle, battleState, playerMove, rivalMove } = input

  const playerStart = applyStartOfTurnEffects(battleState.playerStatuses)
  const rivalStart = applyStartOfTurnEffects(battleState.rivalStatuses)

  let playerScore = playerMove.baseDamage + stanceModifier(playerMove.stance, rivalMove.stance)
  let rivalScore = rivalMove.baseDamage + stanceModifier(rivalMove.stance, playerMove.stance)

  if (battle.scene.favoredStance === playerMove.stance) {
    playerScore += SCENE_STANCE_BONUS
  }
  if (battle.scene.favoredStance === rivalMove.stance) {
    rivalScore += SCENE_STANCE_BONUS
  }

  playerScore += comboModifier(playerMove, battleState.playerStatuses)
  rivalScore += comboModifier(rivalMove, battleState.rivalStatuses)

  playerScore += statusModifier(battleState.playerStatuses, battleState.rivalStatuses)
  rivalScore += statusModifier(battleState.rivalStatuses, battleState.playerStatuses)

  if (battleState.turnMemory[0]?.playerMoveId === playerMove.id) {
    playerScore -= REPETITION_PENALTY
  }
  if (battleState.turnMemory[0]?.rivalMoveId === rivalMove.id) {
    rivalScore -= REPETITION_PENALTY
  }

  if (battleState.tension >= TENSION_ECLIPSE_THRESHOLD && playerMove.stance === 'eclipse') {
    playerScore += ECLIPSE_TENSION_BONUS
  }
  if (battleState.tension >= TENSION_ECLIPSE_THRESHOLD && rivalMove.stance === 'eclipse') {
    rivalScore += ECLIPSE_TENSION_BONUS
  }

  const gap = playerScore - rivalScore
  const playerLoss = clampLoss(
    rivalMove.baseDamage +
      playerStart.damage +
      (gap <= -DOMINANT_WIN_GAP ? 1 : 0) +
      (playerMove.selfDamage ?? 0),
  )
  const rivalLoss = clampLoss(
    playerMove.baseDamage +
      rivalStart.damage +
      (gap >= DOMINANT_WIN_GAP ? 1 : 0) +
      (rivalMove.selfDamage ?? 0),
  )

  const appliedStatuses = {
    player: collectAppliedStatuses(rivalMove, gap < 0),
    rival: collectAppliedStatuses(playerMove, gap > 0),
  }
  const clearedStatuses = {
    player: collectClearedStatuses(playerMove),
    rival: collectClearedStatuses(rivalMove),
  }

  const winner: StructuredVerdict['winner'] =
    gap >= DOMINANT_WIN_GAP ? 'player' : gap <= -DOMINANT_WIN_GAP ? 'rival' : 'draw'

  return {
    winner,
    playerLoss,
    rivalLoss,
    tensionShift: Math.max(MIN_TENSION_SHIFT, Math.min(MAX_TENSION_SHIFT, BASE_TENSION_SHIFT + Math.abs(gap) + (battleState.round > LATE_ROUND_THRESHOLD ? LATE_ROUND_BONUS : 0))),
    narration: buildNarration(battle, playerMove, rivalMove, winner),
    oracleLine: buildOracleLine(playerMove, rivalMove, winner),
    sceneShift: buildSceneShift(battle.scene, winner),
    appliedStatuses,
    clearedStatuses,
    stanceDelta: {
      player: playerMove.stance,
      rival: rivalMove.stance,
    },
    tacticalReason: buildTacticalReason(playerMove, rivalMove, battleState, winner),
  }
}

export function applyVerdictToBattleState(
  battleState: BattleState,
  battle: BattleDefinition,
  playerMove: MoveDefinition,
  rivalMove: MoveDefinition,
  verdict: StructuredVerdict,
): BattleState {
  const playerStatuses = nextStatuses(
    battleState.playerStatuses,
    verdict.appliedStatuses.player,
    verdict.clearedStatuses.player,
    'player',
  )
  const rivalStatuses = nextStatuses(
    battleState.rivalStatuses,
    verdict.appliedStatuses.rival,
    verdict.clearedStatuses.rival,
    'rival',
  )

  const turnMemory: TurnMemory[] = [
    {
      round: battleState.round,
      playerMoveId: playerMove.id,
      rivalMoveId: rivalMove.id,
      verdictSummary: verdict.tacticalReason,
      winner: verdict.winner,
    },
    ...battleState.turnMemory,
  ].slice(0, MAX_TURN_MEMORY)

  return {
    ...battleState,
    round: battleState.round + 1,
    playerResolve: Math.max(0, battleState.playerResolve - verdict.playerLoss),
    rivalResolve: Math.max(0, battleState.rivalResolve - verdict.rivalLoss),
    playerStance: verdict.stanceDelta.player,
    rivalStance: verdict.stanceDelta.rival,
    tension: Math.min(MAX_TENSION, battleState.tension + verdict.tensionShift),
    playerStatuses,
    rivalStatuses,
    turnMemory,
    lastVerdict: verdict,
    selectedMoveId: playerMove.id,
  }
}

export function isBattleWon(battleState: BattleState) {
  return battleState.rivalResolve <= 0 && battleState.playerResolve > 0
}

export function isBattleLost(battleState: BattleState) {
  return battleState.playerResolve <= 0
}

export function advanceRunState(
  runState: RunState,
  profile: PlayerProfile,
): { runState: RunState; profile: PlayerProfile } {
  if (!runState.activeBattle) {
    return { runState, profile }
  }

  const currentBattle = getBattleById(runState.activeBattle.battleId)
  const won = isBattleWon(runState.activeBattle)

  if (!won) {
    return {
      runState: {
        ...runState,
        completed: true,
        campaignSummary: `${currentBattle.enemy.duelist.name} broke the archive run before the final verse could settle.`,
      },
      profile: {
        ...profile,
        runsCompleted: profile.runsCompleted + 1,
        losses: profile.losses + 1,
      },
    }
  }

  const nextBattleIndex = runState.currentBattleIndex + 1
  const nextUnlockedScenes = Array.from(
    new Set([...profile.unlockedScenes, currentBattle.scene.id]),
  )
  const nextUnlockedEnemies = Array.from(
    new Set([...profile.unlockedEnemies, currentBattle.enemy.id]),
  )

  if (nextBattleIndex >= battleDefinitions.length) {
    return {
      runState: {
        ...runState,
        activeBattle: null,
        completed: true,
        battlesWon: [...runState.battlesWon, currentBattle.id],
        campaignSummary:
          'Sable leaves the Starless Well with the archive intact, having survived all three verdict chambers.',
      },
      profile: {
        ...profile,
        runsCompleted: profile.runsCompleted + 1,
        wins: profile.wins + 1,
        unlockedScenes: nextUnlockedScenes,
        unlockedEnemies: nextUnlockedEnemies,
      },
    }
  }

  const nextBattle = battleDefinitions[nextBattleIndex]
  return {
    runState: {
      ...runState,
      currentBattleIndex: nextBattleIndex,
      battlesWon: [...runState.battlesWon, currentBattle.id],
      activeBattle: createBattleState(nextBattle),
    },
    profile: {
      ...profile,
      unlockedScenes: Array.from(new Set([...nextUnlockedScenes, nextBattle.scene.id])),
      unlockedEnemies: Array.from(new Set([...nextUnlockedEnemies, nextBattle.enemy.id])),
    },
  }
}

export function recordFavoriteMove(
  profile: PlayerProfile,
  chronicle: ChronicleEntry[],
): PlayerProfile {
  const counts = new Map<string, number>()
  for (const entry of chronicle) {
    const foundMove = moves.find((move) => entry.summary.includes(move.name))
    if (foundMove) {
      counts.set(foundMove.id, (counts.get(foundMove.id) ?? 0) + 1)
    }
  }

  const favoriteMoveId =
    Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ??
    profile.favoriteMoveId

  return {
    ...profile,
    favoriteMoveId,
  }
}

export function makeChronicleEntry(
  battle: BattleDefinition,
  battleState: BattleState,
  verdict: StructuredVerdict,
  mode: VerdictMode,
  txHash?: `0x${string}`,
): ChronicleEntry {
  return {
    id: `${battle.id}-round-${battleState.round}`,
    battleId: battle.id,
    battleLabel: battle.label,
    round: battleState.round,
    title: `${resolveWinnerLabel(verdict.winner)} in ${battle.scene.name}`,
    summary: verdict.narration,
    oracleLine: verdict.oracleLine,
    sceneShift: verdict.sceneShift,
    mode,
    txHash,
  }
}

export function getStatusMeta(statusId: StatusId) {
  return statusCatalog[statusId]
}

export function getSelectedBattle(runState: RunState | null) {
  if (!runState?.activeBattle) {
    return battleDefinitions[0]
  }
  return getBattleById(runState.activeBattle.battleId)
}



const statusCatalog: Record<StatusId, Omit<StatusEffect, 'duration' | 'source'>> = {
  guarded: {
    id: 'guarded',
    label: 'Guarded',
    description: 'Reduces incoming pressure and empowers bulwark combos.',
  },
  burning: {
    id: 'burning',
    label: 'Burning',
    description: 'Adds extra chip pressure at the start of the next turn.',
  },
  shaken: {
    id: 'shaken',
    label: 'Shaken',
    description: 'Makes rigid stances easier to counter.',
  },
  focused: {
    id: 'focused',
    label: 'Focused',
    description: 'Improves combo payoffs and precise finishers.',
  },
}

function makeStatus(id: StatusId, source: 'player' | 'rival', duration: number): StatusEffect {
  return {
    ...statusCatalog[id],
    source,
    duration,
  }
}

function applyStartOfTurnEffects(statuses: StatusEffect[]) {
  let damage = 0
  for (const status of statuses) {
    if (status.id === 'burning') {
      damage += 1
    }
  }
  return { damage }
}

function statusModifier(activeStatuses: StatusEffect[], opposingStatuses: StatusEffect[]) {
  let modifier = 0
  if (activeStatuses.some((status) => status.id === 'focused')) {
    modifier += 1
  }
  if (opposingStatuses.some((status) => status.id === 'shaken')) {
    modifier += 1
  }
  if (activeStatuses.some((status) => status.id === 'guarded')) {
    modifier += 1
  }
  return modifier
}

function comboModifier(move: MoveDefinition, statuses: StatusEffect[]) {
  return move.comboFrom && statuses.some((status) => status.id === move.comboFrom) ? COMBO_SCORE_BONUS : 0
}

const STANCE_BEATS: Record<Stance, Stance> = {
  bulwark: 'trickster',
  trickster: 'eclipse',
  eclipse: 'bulwark',
}

function stanceModifier(active: Stance, opposing: Stance) {
  if (STANCE_BEATS[active] === opposing) {
    return STANCE_ADVANTAGE_SCORE
  }
  if (STANCE_BEATS[opposing] === active) {
    return STANCE_DISADVANTAGE_SCORE
  }
  return 0
}

function collectAppliedStatuses(move: MoveDefinition, winningSide: boolean) {
  return move.appliesStatus && winningSide ? [move.appliesStatus] : []
}

function collectClearedStatuses(move: MoveDefinition) {
  return move.clearsStatus ? [move.clearsStatus] : []
}

function nextStatuses(
  current: StatusEffect[],
  applied: StatusId[],
  cleared: StatusId[],
  source: 'player' | 'rival',
) {
  const reduced = current
    .filter((status) => !cleared.includes(status.id))
    .map((status) => ({ ...status, duration: status.duration - 1 }))
    .filter((status) => status.duration > 0)

  const next = [...reduced]
  for (const statusId of applied) {
    const existing = next.find((status) => status.id === statusId)
    if (existing) {
      existing.duration = Math.max(existing.duration, DEFAULT_STATUS_DURATION)
    } else {
      next.push(makeStatus(statusId, source, DEFAULT_STATUS_DURATION))
    }
  }

  return next
}

function clampLoss(value: number) {
  return Math.max(MIN_LOSS, Math.min(MAX_LOSS, value))
}

function buildNarration(
  battle: BattleDefinition,
  playerMove: MoveDefinition,
  rivalMove: MoveDefinition,
  winner: StructuredVerdict['winner'],
) {
  if (winner === 'player') {
    return `${duelists.player.name} drives ${playerMove.name} through ${battle.scene.name}, forcing ${battle.enemy.duelist.name} off balance before ${rivalMove.name} can settle.`
  }

  if (winner === 'rival') {
    return `${battle.enemy.duelist.name} turns ${rivalMove.name} into the dominant tempo of ${battle.scene.name}, and ${duelists.player.name} has to absorb the chamber's backlash.`
  }

  return `${playerMove.name} and ${rivalMove.name} collide in a contested reading of the arena, leaving neither duelist fully in command.`
}

function buildOracleLine(
  playerMove: MoveDefinition,
  rivalMove: MoveDefinition,
  winner: StructuredVerdict['winner'],
) {
  if (winner === 'player') {
    return `The chamber records ${playerMove.name} as the stronger claim and marks ${rivalMove.name} as tactically unsound.`
  }
  if (winner === 'rival') {
    return `The chamber favors ${rivalMove.name}; the player's line is judged incomplete under present conditions.`
  }
  return `Both ${playerMove.name} and ${rivalMove.name} retain partial validity, so the verdict remains split.`
}

function buildSceneShift(scene: SceneDefinition, winner: StructuredVerdict['winner']) {
  if (winner === 'player') {
    return `${scene.name} bends toward the archive line, and the room briefly holds one stable shape.`
  }
  if (winner === 'rival') {
    return `${scene.name} distorts around the rival's pressure, making the chamber feel louder and less trustworthy.`
  }
  return `${scene.name} keeps both readings alive, and the atmosphere refuses to collapse into a single truth.`
}

function buildTacticalReason(
  playerMove: MoveDefinition,
  rivalMove: MoveDefinition,
  battleState: BattleState,
  winner: StructuredVerdict['winner'],
) {
  const memoryNote =
    battleState.turnMemory[0] ?
      `The chamber remembered ${getMoveById(battleState.turnMemory[0].playerMoveId).name} from the previous turn.`
    : 'This was the first tactical exchange of the battle.'

  if (winner === 'player') {
    return `${playerMove.name} exploited the current stance pattern and outpaced ${rivalMove.name}. ${memoryNote}`
  }
  if (winner === 'rival') {
    return `${rivalMove.name} punished the current stance and forced a defensive verdict. ${memoryNote}`
  }
  return `${playerMove.name} and ${rivalMove.name} canceled each other out. ${memoryNote}`
}
