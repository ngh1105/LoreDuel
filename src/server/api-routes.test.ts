import { beforeEach, describe, expect, it } from 'vitest'
import { GET as healthGet } from '../../app/api/health/route'
import { GET as eventsGet, POST as eventsPost } from '../../app/api/events/route'
import { GET as runsGet, POST as runsPost } from '../../app/api/runs/route'
import { GET as profileGet, PUT as profilePut } from '../../app/api/profile/[wallet]/route'
import { __resetStoreForTests } from './store'

const WALLET = '0x1234567890abcdef1234567890abcdef12345678'

type JsonRequestInit = Omit<RequestInit, 'body'> & { body?: unknown }

function jsonRequest(url: string, init: JsonRequestInit): Request {
  const headers = new Headers(init.headers)
  if (typeof init.body !== 'undefined') {
    headers.set('content-type', 'application/json')
  }
  return new Request(url, {
    ...init,
    headers,
    body: typeof init.body === 'undefined' ? undefined : JSON.stringify(init.body),
  })
}

describe('api routes', () => {
  beforeEach(() => {
    delete process.env.API_WRITE_TOKEN
    delete process.env.ANALYTICS_INGEST_TOKEN
    delete process.env.DATABASE_URL
    __resetStoreForTests()
  })

  it('health route returns service info', async () => {
    const response = await healthGet()
    expect(response.status).toBe(200)
    const payload = (await response.json()) as Record<string, unknown>
    expect(payload.ok).toBe(true)
    expect(payload.service).toBe('loreduel-web')
  })

  it('profile PUT then GET roundtrip', async () => {
    const putReq = jsonRequest(`http://localhost/api/profile/${WALLET}`, {
      method: 'PUT',
      body: {
        runsCompleted: 2,
        wins: 1,
        losses: 1,
        favoriteMoveId: 'glass-oath',
        unlockedScenes: ['velis-atrium'],
        unlockedEnemies: ['choir-knight'],
      },
      headers: { 'x-forwarded-for': '10.0.0.1' },
    })

    const putRes = await profilePut(putReq, { params: Promise.resolve({ wallet: WALLET }) })
    expect(putRes.status).toBe(200)

    const getRes = await profileGet(new Request(`http://localhost/api/profile/${WALLET}`), {
      params: Promise.resolve({ wallet: WALLET }),
    })
    expect(getRes.status).toBe(200)
    const payload = (await getRes.json()) as { profile: { wins: number } }
    expect(payload.profile.wins).toBe(1)
  })

  it('runs POST then list by wallet', async () => {
    const postRes = await runsPost(
      jsonRequest('http://localhost/api/runs', {
        method: 'POST',
        body: {
          wallet: WALLET,
          battlesWon: ['battle-1'],
          result: 'win',
          summary: 'test run',
        },
        headers: { 'x-forwarded-for': '10.0.0.2' },
      }),
    )
    expect(postRes.status).toBe(201)

    const getRes = await runsGet(new Request(`http://localhost/api/runs?wallet=${WALLET}`))
    expect(getRes.status).toBe(200)
    const payload = (await getRes.json()) as { runs: Array<{ result: string }> }
    expect(payload.runs.length).toBeGreaterThan(0)
    expect(payload.runs[0]?.result).toBe('win')
  })

  it('events route enforces token when configured', async () => {
    process.env.ANALYTICS_INGEST_TOKEN = 'token-1'

    const unauthorizedPost = await eventsPost(
      jsonRequest('http://localhost/api/events', {
        method: 'POST',
        body: { type: 'demo_start', payload: {} },
        headers: { 'x-forwarded-for': '10.0.0.3' },
      }),
    )
    expect(unauthorizedPost.status).toBe(401)

    const authorizedPost = await eventsPost(
      jsonRequest('http://localhost/api/events', {
        method: 'POST',
        body: { type: 'demo_start', payload: {} },
        headers: { authorization: 'Bearer token-1', 'x-forwarded-for': '10.0.0.3' },
      }),
    )
    expect(authorizedPost.status).toBe(202)

    const unauthorizedGet = await eventsGet(new Request('http://localhost/api/events?limit=10'))
    expect(unauthorizedGet.status).toBe(401)

    const authorizedGet = await eventsGet(
      new Request('http://localhost/api/events?limit=10', {
        headers: { authorization: 'Bearer token-1' },
      }),
    )
    expect(authorizedGet.status).toBe(200)
    const payload = (await authorizedGet.json()) as { events: Array<{ type: string }> }
    expect(payload.events[0]?.type).toBe('demo_start')
  })
})
