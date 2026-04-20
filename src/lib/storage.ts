import { type PlayerProfile, type RunState, createInitialProfile } from './game'
import { validateRunState, validateProfile } from './validation'

const CURRENT_VERSION = 1

const storageKeys = {
  run: 'loreduel-run',
  profile: 'loreduel-profile',
  tutorial: 'loreduel-tutorial-dismissed',
}

type VersionedPayload<T> = {
  version: number
  checksum: string
  data: T
}

function computeChecksum(data: unknown): string {
  const raw = JSON.stringify(data)
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return (hash >>> 0).toString(36)
}

function wrap<T>(data: T): string {
  const payload: VersionedPayload<T> = {
    version: CURRENT_VERSION,
    checksum: computeChecksum(data),
    data,
  }
  return JSON.stringify(payload)
}

function unwrap<T>(raw: string): { data: T; valid: boolean; migrated: boolean } | null {
  try {
    const parsed = JSON.parse(raw)

    if (parsed && typeof parsed === 'object' && 'version' in parsed && 'checksum' in parsed) {
      const payload = parsed as VersionedPayload<T>
      const expectedChecksum = computeChecksum(payload.data)
      const valid = payload.checksum === expectedChecksum
      const migrated = payload.version < CURRENT_VERSION

      if (migrated) {
        const migrationResult = migrate(payload.data)
        return { data: migrationResult as T, valid, migrated: true }
      }

      return { data: payload.data, valid, migrated: false }
    }

    return { data: parsed as T, valid: true, migrated: true }
  } catch {
    return null
  }
}

function migrate(data: unknown): unknown {
  return data
}

export function saveRunState(runState: RunState | null): void {
  try {
    if (runState) {
      window.localStorage.setItem(storageKeys.run, wrap(runState))
    } else {
      window.localStorage.removeItem(storageKeys.run)
    }
  } catch (error) {
    console.error('[Storage] Failed to save run state:', error)
  }
}

export function loadRunState(): { data: RunState | null; corrupted: boolean } {
  try {
    const raw = window.localStorage.getItem(storageKeys.run)
    if (!raw) {
      return { data: null, corrupted: false }
    }

    const result = unwrap<RunState>(raw)
    if (!result) {
      return { data: null, corrupted: true }
    }

    if (!result.valid) {
      return { data: null, corrupted: true }
    }

    if (!validateRunState(result.data)) {
      return { data: null, corrupted: true }
    }

    return { data: result.data, corrupted: false }
  } catch {
    return { data: null, corrupted: true }
  }
}

export function saveProfile(profile: PlayerProfile): void {
  try {
    window.localStorage.setItem(storageKeys.profile, wrap(profile))
  } catch (error) {
    console.error('[Storage] Failed to save profile:', error)
  }
}

export function loadProfile(): { data: PlayerProfile; corrupted: boolean } {
  try {
    const raw = window.localStorage.getItem(storageKeys.profile)
    if (!raw) {
      return { data: createInitialProfile(), corrupted: false }
    }

    const result = unwrap<PlayerProfile>(raw)
    if (!result || !result.valid) {
      return { data: createInitialProfile(), corrupted: true }
    }

    if (!validateProfile(result.data)) {
      return { data: createInitialProfile(), corrupted: true }
    }

    return { data: result.data, corrupted: false }
  } catch {
    return { data: createInitialProfile(), corrupted: true }
  }
}

export function saveTutorialDismissed(dismissed: boolean): void {
  try {
    window.localStorage.setItem(storageKeys.tutorial, String(dismissed))
  } catch (error) {
    console.error('[Storage] Failed to save tutorial state:', error)
  }
}

export function loadTutorialDismissed(): boolean {
  try {
    return window.localStorage.getItem(storageKeys.tutorial) === 'true'
  } catch {
    return false
  }
}

export type SettingsData = {
  animationIntensity: 'full' | 'reduced' | 'none'
  soundEnabled: boolean
  highContrast: boolean
}

const SETTINGS_KEY = 'loreduel-settings'

const defaultSettings: SettingsData = {
  animationIntensity: 'full',
  soundEnabled: true,
  highContrast: false,
}

export function saveSettings(settings: SettingsData): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch (error) {
    console.error('[Storage] Failed to save settings:', error)
  }
}

export function loadSettings(): SettingsData {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) {
      return { ...defaultSettings }
    }
    return { ...defaultSettings, ...JSON.parse(raw) }
  } catch {
    return { ...defaultSettings }
  }
}
