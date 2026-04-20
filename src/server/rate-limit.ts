type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function checkRateLimit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number } {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1 }
  }

  if (bucket.count >= limit) {
    return { ok: false, remaining: 0 }
  }

  bucket.count += 1
  return { ok: true, remaining: Math.max(0, limit - bucket.count) }
}
