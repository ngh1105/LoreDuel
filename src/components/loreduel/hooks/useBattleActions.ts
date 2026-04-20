'use client'

import { useState } from 'react'
import { trackEvent } from '../../../lib/analytics'
import {
  advanceRunState,
  applyVerdictToBattleState,
  chooseEnemyMove,
  createInitialRunState,
  getMoveById,
  isBattleLost,
  isBattleWon,
  makeChronicleEntry,
  recordFavoriteMove,
  type BattleDefinition,
  type PlayerProfile,
  type RunState,
  type StructuredVerdict,
} from '../../../lib/game'
import { readGenLayerStatus, submitRoundToGenLayer, type WalletState } from '../../../lib/genlayer'
import { loadTxHistory, type TransactionRecord } from '../../../lib/tx-history'

type UseBattleActionsOptions = {
  runState: RunState | null
  profile: PlayerProfile
  battle: BattleDefinition
  wallet: WalletState | null
  onRunStateChange: (next: RunState | null) => void
  onProfileChange: (next: PlayerProfile) => void
  onStatusChange: (note: string) => void
  onTxHistoryChange: (history: TransactionRecord[]) => void
}

export type BattleActions = {
  isResolving: boolean
  lastTxHash: `0x${string}` | null
  retryPayload: (() => void) | null
  handleMoveSelect: (moveId: string) => void
  handlePlayRound: () => Promise<void>
  handleStartDemo: () => void
  handleResetRun: () => void
  handleEndRun: () => void
}

export function useBattleActions({
  runState,
  profile,
  battle,
  onRunStateChange,
  onProfileChange,
  onStatusChange,
  onTxHistoryChange,
}: UseBattleActionsOptions): BattleActions {
  const [isResolving, setIsResolving] = useState(false)
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | null>(null)
  const [retryPayload, setRetryPayload] = useState<(() => void) | null>(null)

  const battleState = runState?.activeBattle
  const selectedMove = battleState ? getMoveById(battleState.selectedMoveId) : getMoveById(battle.enemy.movePool[0])
  const rivalMove = battleState ? chooseEnemyMove(battle, battleState) : getMoveById(battle.enemy.movePool[0])

  function handleMoveSelect(moveId: string) {
    if (!runState?.activeBattle) return
    trackEvent({ type: 'move_selected', moveId })
    onRunStateChange({
      ...runState,
      activeBattle: { ...runState.activeBattle, selectedMoveId: moveId },
    })
  }

  async function handlePlayRound() {
    if (!runState?.activeBattle || isResolving) return

    setIsResolving(true)
    setRetryPayload(null)

    try {
      const liveResult = await submitRoundToGenLayer({
        battle,
        battleState: runState.activeBattle,
        playerMove: selectedMove,
        rivalMove,
      })

      if (liveResult.txHash) {
        setLastTxHash(liveResult.txHash)
        onTxHistoryChange(loadTxHistory())
        trackEvent({ type: 'live_verdict_success', battleId: battle.id, txHash: liveResult.txHash })
      }
      if (liveResult.mode === 'fallback') {
        trackEvent({ type: 'fallback_used', battleId: battle.id })
      }

      const verdict = liveResult.verdict as StructuredVerdict
      const nextBattleState = applyVerdictToBattleState(
        runState.activeBattle,
        battle,
        selectedMove,
        rivalMove,
        verdict,
      )
      const chronicleEntry = makeChronicleEntry(battle, runState.activeBattle, verdict, liveResult.mode, liveResult.txHash)

      let nextRunState: RunState = {
        ...runState,
        activeBattle: nextBattleState,
        chronicle: [chronicleEntry, ...runState.chronicle],
      }
      let nextProfile = recordFavoriteMove(profile, nextRunState.chronicle)

      if (isBattleWon(nextBattleState)) {
        trackEvent({ type: 'battle_win', battleId: battle.id, rounds: nextBattleState.round })
        const advanced = advanceRunState(nextRunState, nextProfile)
        nextRunState = advanced.runState
        nextProfile = advanced.profile
        if (nextRunState.completed) {
          trackEvent({ type: 'campaign_complete', battlesWon: nextRunState.battlesWon.length })
        }
      } else if (isBattleLost(nextBattleState)) {
        trackEvent({ type: 'battle_loss', battleId: battle.id, rounds: nextBattleState.round })
        const advanced = advanceRunState(nextRunState, nextProfile)
        nextRunState = advanced.runState
        nextProfile = advanced.profile
      }

      onRunStateChange(nextRunState)
      onProfileChange(nextProfile)
      onStatusChange(liveResult.note)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown runtime error'
      trackEvent({ type: 'live_verdict_fail', battleId: battle.id, error: msg })
      setRetryPayload(() => () => handlePlayRound())
      onStatusChange('Turn failed unexpectedly. You can retry or continue in demo mode.')
    } finally {
      setIsResolving(false)
    }
  }

  function handleStartDemo() {
    onRunStateChange(createInitialRunState())
    onStatusChange(readGenLayerStatus().summary)
    setLastTxHash(null)
    setRetryPayload(null)
    trackEvent({ type: 'demo_start' })
    trackEvent({ type: 'battle_start', battleId: 'battle-1' })
  }

  function handleResetRun() {
    onRunStateChange(createInitialRunState())
    onStatusChange(readGenLayerStatus().summary)
    setLastTxHash(null)
    setRetryPayload(null)
    trackEvent({ type: 'demo_start' })
  }

  function handleEndRun() {
    onRunStateChange(null)
    setLastTxHash(null)
    setRetryPayload(null)
  }

  return {
    isResolving,
    lastTxHash,
    retryPayload,
    handleMoveSelect,
    handlePlayRound,
    handleStartDemo,
    handleResetRun,
    handleEndRun,
  }
}
