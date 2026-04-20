type AnalyticsEvent =
  | { type: 'page_view'; page: string }
  | { type: 'demo_start' }
  | { type: 'wallet_connect_attempt' }
  | { type: 'wallet_connect_success'; address: string }
  | { type: 'wallet_connect_fail'; error: string }
  | { type: 'wallet_disconnect' }
  | { type: 'battle_start'; battleId: string }
  | { type: 'battle_win'; battleId: string; rounds: number }
  | { type: 'battle_loss'; battleId: string; rounds: number }
  | { type: 'campaign_complete'; battlesWon: number }
  | { type: 'live_verdict_success'; battleId: string; txHash: string }
  | { type: 'live_verdict_fail'; battleId: string; error: string }
  | { type: 'fallback_used'; battleId: string }
  | { type: 'settings_change'; setting: string; value: string }
  | { type: 'tutorial_dismissed' }
  | { type: 'move_selected'; moveId: string }
  | { type: 'session_start' }
  | { type: 'session_end'; durationMs: number }

const SESSION_LOG_KEY = 'loreduel-analytics-log'
const MAX_LOG_ENTRIES = 200

let sessionStartTime = Date.now()
let clientId: string | null = null

function getClientId(): string {
  if (clientId) return clientId

  try {
    const key = 'loreduel-client-id'
    const existing = window.localStorage.getItem(key)
    if (existing) {
      clientId = existing
      return existing
    }

    const created = `client-${Math.random().toString(36).slice(2, 10)}`
    window.localStorage.setItem(key, created)
    clientId = created
    return created
  } catch {
    const fallback = `client-${Math.random().toString(36).slice(2, 10)}`
    clientId = fallback
    return fallback
  }
}

function shipEvent(entry: Record<string, unknown>): void {
  const body = JSON.stringify({
    type: String(entry.type ?? 'unknown'),
    payload: entry,
  })

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const sent = navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }))
    if (sent) return
  }

  fetch('/api/events', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-client-id': getClientId(),
    },
    body,
    keepalive: true,
  }).catch(() => {
    // Ignore telemetry transport errors.
  })
}

export function trackEvent(event: AnalyticsEvent): void {
  const entry = {
    ...event,
    timestamp: new Date().toISOString(),
    sessionMs: Date.now() - sessionStartTime,
  }

  if (process.env.NODE_ENV === 'development') {
    console.debug('[Analytics]', entry)
  }

  try {
    const raw = window.localStorage.getItem(SESSION_LOG_KEY)
    const log: unknown[] = raw ? JSON.parse(raw) : []
    log.unshift(entry)
    if (log.length > MAX_LOG_ENTRIES) {
      log.length = MAX_LOG_ENTRIES
    }
    window.localStorage.setItem(SESSION_LOG_KEY, JSON.stringify(log))
  } catch {
    // Storage full or unavailable - silently skip.
  }

  shipEvent(entry as Record<string, unknown>)
}

export function initSession(): void {
  sessionStartTime = Date.now()
  trackEvent({ type: 'session_start' })

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      trackEvent({ type: 'session_end', durationMs: Date.now() - sessionStartTime })
    })
  }
}

export function getAnalyticsLog(): unknown[] {
  try {
    const raw = window.localStorage.getItem(SESSION_LOG_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
