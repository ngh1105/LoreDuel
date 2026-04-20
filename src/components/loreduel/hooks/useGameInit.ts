'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { initSession } from '../../../lib/analytics'
import {
  loadProfile,
  loadRunState,
  loadSettings,
  loadTutorialDismissed,
  saveProfile,
  saveRunState,
  saveSettings,
  saveTutorialDismissed,
  type SettingsData,
} from '../../../lib/storage'
import { loadTxHistory, type TransactionRecord } from '../../../lib/tx-history'
import { createInitialProfile, type PlayerProfile, type RunState } from '../../../lib/game'

export type GameInitState = {
  runState: RunState | null
  profile: PlayerProfile
  settings: SettingsData
  tutorialDismissed: boolean
  txHistory: TransactionRecord[]
  isOffline: boolean
  storageWarning: string | null
  hasLoaded: boolean
}

export type GameInitActions = {
  setRunState: React.Dispatch<React.SetStateAction<RunState | null>>
  setProfile: React.Dispatch<React.SetStateAction<PlayerProfile>>
  setSettings: React.Dispatch<React.SetStateAction<SettingsData>>
  setTutorialDismissed: React.Dispatch<React.SetStateAction<boolean>>
  setTxHistory: React.Dispatch<React.SetStateAction<TransactionRecord[]>>
  setStorageWarning: React.Dispatch<React.SetStateAction<string | null>>
}

type InitialSnapshot = {
  runState: RunState | null
  profile: PlayerProfile
  settings: SettingsData
  tutorialDismissed: boolean
  txHistory: TransactionRecord[]
  isOffline: boolean
  storageWarning: string | null
}

function loadInitialSnapshot(): InitialSnapshot {
  if (typeof window === 'undefined') {
    return {
      runState: null,
      profile: createInitialProfile(),
      settings: loadSettings(),
      tutorialDismissed: false,
      txHistory: [],
      isOffline: false,
      storageWarning: null,
    }
  }

  const runResult = loadRunState()
  const profileResult = loadProfile()
  const warnings = [
    runResult.corrupted ? 'Saved run data was corrupted and has been reset.' : null,
    profileResult.corrupted ? 'Profile data was corrupted and has been reset.' : null,
  ].filter(Boolean)

  return {
    runState: runResult.data,
    profile: profileResult.data,
    settings: loadSettings(),
    tutorialDismissed: loadTutorialDismissed(),
    txHistory: loadTxHistory(),
    isOffline: !navigator.onLine,
    storageWarning: warnings[0] ?? null,
  }
}

function subscribeToHydration() {
  return () => {}
}

export function useGameInit(): GameInitState & GameInitActions {
  const initialSnapshot = useMemo(() => loadInitialSnapshot(), [])

  const [runState, setRunState] = useState<RunState | null>(initialSnapshot.runState)
  const [profile, setProfile] = useState<PlayerProfile>(initialSnapshot.profile)
  const [settings, setSettings] = useState<SettingsData>(initialSnapshot.settings)
  const [tutorialDismissed, setTutorialDismissed] = useState(initialSnapshot.tutorialDismissed)
  const [txHistory, setTxHistory] = useState<TransactionRecord[]>(initialSnapshot.txHistory)
  const [isOffline, setIsOffline] = useState(initialSnapshot.isOffline)
  const [storageWarning, setStorageWarning] = useState<string | null>(initialSnapshot.storageWarning)
  const hasLoaded = useSyncExternalStore(subscribeToHydration, () => true, () => false)

  // Start analytics and setup offline detection after hydration.
  useEffect(() => {
    initSession()
    const goOffline = () => setIsOffline(true)
    const goOnline = () => setIsOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)

    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  // Sync state changes to storage
  useEffect(() => { if (hasLoaded) saveRunState(runState) }, [hasLoaded, runState])
  useEffect(() => { if (hasLoaded) saveProfile(profile) }, [hasLoaded, profile])
  useEffect(() => { if (hasLoaded) saveTutorialDismissed(tutorialDismissed) }, [hasLoaded, tutorialDismissed])
  useEffect(() => { if (hasLoaded) saveSettings(settings) }, [hasLoaded, settings])

  return {
    runState, setRunState,
    profile, setProfile,
    settings, setSettings,
    tutorialDismissed, setTutorialDismissed,
    txHistory, setTxHistory,
    isOffline,
    storageWarning, setStorageWarning,
    hasLoaded,
  }
}
