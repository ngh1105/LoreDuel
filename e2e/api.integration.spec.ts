import { expect, test } from '@playwright/test'

const WALLET = '0x1234567890abcdef1234567890abcdef12345678'

test('profile and runs APIs work through live server', async ({ request }) => {
  const putProfile = await request.put(`/api/profile/${WALLET}`, {
    data: {
      runsCompleted: 3,
      wins: 2,
      losses: 1,
      favoriteMoveId: 'glass-oath',
      unlockedScenes: ['velis-atrium', 'ash-balcony'],
      unlockedEnemies: ['choir-knight', 'ember-prince'],
    },
    headers: { 'x-forwarded-for': '127.0.0.1' },
  })
  expect(putProfile.status()).toBe(200)

  const getProfile = await request.get(`/api/profile/${WALLET}`)
  expect(getProfile.status()).toBe(200)
  const profilePayload = await getProfile.json()
  expect(profilePayload.profile.wallet).toBe(WALLET)
  expect(profilePayload.profile.wins).toBe(2)

  const createRun = await request.post('/api/runs', {
    data: {
      wallet: WALLET,
      battlesWon: ['battle-1'],
      result: 'win',
      summary: 'api integration run',
    },
    headers: { 'x-forwarded-for': '127.0.0.1' },
  })
  expect(createRun.status()).toBe(201)

  const listRuns = await request.get(`/api/runs?wallet=${WALLET}`)
  expect(listRuns.status()).toBe(200)
  const runsPayload = await listRuns.json()
  expect(Array.isArray(runsPayload.runs)).toBe(true)
  expect(runsPayload.runs.length).toBeGreaterThan(0)
})

test('events and metrics endpoints expose observability data', async ({ request }) => {
  const ingestEvent = await request.post('/api/events', {
    data: {
      type: 'integration_event',
      payload: { source: 'playwright' },
    },
    headers: {
      'x-forwarded-for': '127.0.0.2',
      'x-request-id': 'req-integration-1',
    },
  })
  expect(ingestEvent.status()).toBe(202)

  const events = await request.get('/api/events?limit=10')
  expect(events.status()).toBe(200)
  const eventsPayload = await events.json()
  expect(Array.isArray(eventsPayload.events)).toBe(true)
  expect(eventsPayload.events.some((event: { type?: string }) => event.type === 'integration_event')).toBe(true)

  const metrics = await request.get('/api/metrics')
  expect(metrics.status()).toBe(200)
  const metricsText = await metrics.text()
  expect(metricsText).toContain('loreduel_up 1')
  expect(metricsText).toContain('loreduel_profiles_total')
  expect(metricsText).toContain('loreduel_analytics_events_total')
})
