import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadRunState,
  saveRunState,
  loadProfile,
  saveProfile,
  loadSettings,
  saveSettings,
  saveTutorialDismissed,
  loadTutorialDismissed,
  type SettingsData,
} from './storage'
import { createInitialProfile, createInitialRunState } from './game'

describe('storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  describe('run state', () => {
    it('saves and loads a run state with checksum', () => {
      const run = createInitialRunState()
      saveRunState(run)
      const result = loadRunState()
      expect(result.corrupted).toBe(false)
      expect(result.data).not.toBeNull()
      expect(result.data?.started).toBe(true)
    })

    it('returns null for empty storage', () => {
      const result = loadRunState()
      expect(result.data).toBeNull()
      expect(result.corrupted).toBe(false)
    })

    it('detects corrupted data', () => {
      window.localStorage.setItem('loreduel-run', '{"version":1,"checksum":"bad","data":{"started":true}}')
      const result = loadRunState()
      expect(result.corrupted).toBe(true)
      expect(result.data).toBeNull()
    })

    it('handles completely invalid JSON', () => {
      window.localStorage.setItem('loreduel-run', 'not-json-at-all')
      const result = loadRunState()
      expect(result.corrupted).toBe(true)
    })

    it('removes run state when saving null', () => {
      saveRunState(createInitialRunState())
      expect(window.localStorage.getItem('loreduel-run')).not.toBeNull()
      saveRunState(null)
      expect(window.localStorage.getItem('loreduel-run')).toBeNull()
    })

    it('migrates legacy unversioned data', () => {
      const legacy = JSON.stringify(createInitialRunState())
      window.localStorage.setItem('loreduel-run', legacy)
      const result = loadRunState()
      expect(result.data).not.toBeNull()
      expect(result.corrupted).toBe(false)
    })
  })

  describe('profile', () => {
    it('saves and loads profile with integrity', () => {
      const profile = createInitialProfile()
      profile.wins = 5
      saveProfile(profile)
      const result = loadProfile()
      expect(result.corrupted).toBe(false)
      expect(result.data.wins).toBe(5)
    })

    it('returns default profile for empty storage', () => {
      const result = loadProfile()
      expect(result.data.wins).toBe(0)
      expect(result.corrupted).toBe(false)
    })
  })

  describe('settings', () => {
    it('returns defaults when nothing is saved', () => {
      const settings = loadSettings()
      expect(settings.animationIntensity).toBe('full')
      expect(settings.soundEnabled).toBe(true)
      expect(settings.highContrast).toBe(false)
    })

    it('saves and loads custom settings', () => {
      const custom: SettingsData = { animationIntensity: 'none', soundEnabled: false, highContrast: true }
      saveSettings(custom)
      const loaded = loadSettings()
      expect(loaded.animationIntensity).toBe('none')
      expect(loaded.soundEnabled).toBe(false)
      expect(loaded.highContrast).toBe(true)
    })
  })

  describe('tutorial', () => {
    it('defaults to false', () => {
      expect(loadTutorialDismissed()).toBe(false)
    })

    it('saves and loads dismissed state', () => {
      saveTutorialDismissed(true)
      expect(loadTutorialDismissed()).toBe(true)
    })
  })

  describe('storage failure handling', () => {
    it('handles storage quota errors gracefully', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError')
      })
      expect(() => saveRunState(createInitialRunState())).not.toThrow()
      spy.mockRestore()
    })
  })
})
