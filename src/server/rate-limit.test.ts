import { describe, expect, it } from 'vitest'
import { checkRateLimit } from './rate-limit'

describe('rate limiter', () => {
  it('allows requests within limit and blocks overflow', () => {
    const key = `test-key-${Date.now()}`
    expect(checkRateLimit(key, 2, 60_000).ok).toBe(true)
    expect(checkRateLimit(key, 2, 60_000).ok).toBe(true)
    expect(checkRateLimit(key, 2, 60_000).ok).toBe(false)
  })
})
