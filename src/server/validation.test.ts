import { describe, expect, it } from 'vitest'
import { isWalletAddress, normalizeWallet, validateProfilePayload, validateRunPayload } from './validation'

describe('server validation', () => {
  it('validates wallet address format', () => {
    expect(isWalletAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe(true)
    expect(isWalletAddress('0x123')).toBe(false)
  })

  it('normalizes wallet casing', () => {
    expect(normalizeWallet('0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD')).toBe(
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    )
  })

  it('validates profile payload structure', () => {
    expect(
      validateProfilePayload({
        runsCompleted: 1,
        wins: 1,
        losses: 0,
        favoriteMoveId: 'glass-oath',
        unlockedScenes: ['velis-atrium'],
        unlockedEnemies: ['choir-knight'],
      }),
    ).toBe(true)

    expect(validateProfilePayload({ runsCompleted: -1 })).toBe(false)
  })

  it('validates run payload structure', () => {
    expect(
      validateRunPayload({
        wallet: '0x1234567890abcdef1234567890abcdef12345678',
        battlesWon: ['battle-1'],
        result: 'win',
        summary: 'completed run',
      }),
    ).toBe(true)

    expect(
      validateRunPayload({
        wallet: 'not-a-wallet',
        battlesWon: [],
        result: 'win',
      }),
    ).toBe(false)
  })
})
