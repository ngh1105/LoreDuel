import { NextResponse } from 'next/server'
import { getClientId, isAuthorized } from '../../../src/server/api-helpers'
import { checkRateLimit } from '../../../src/server/rate-limit'
import { appendAnalyticsRecord, listAnalyticsRecords } from '../../../src/server/repository'
import { isWalletAddress, normalizeWallet } from '../../../src/server/validation'

type EventPayload = {
  wallet?: string
  type: string
  payload?: Record<string, unknown>
}

export async function GET(req: Request) {
  const token = process.env.ANALYTICS_INGEST_TOKEN
  if (token && !isAuthorized(req, 'ANALYTICS_INGEST_TOKEN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const limit = Number.parseInt(url.searchParams.get('limit') ?? '100', 10)
  return NextResponse.json({ events: await listAnalyticsRecords(limit) }, { status: 200 })
}

export async function POST(req: Request) {
  const clientId = getClientId(req)
  const rate = checkRateLimit(`analytics-write:${clientId}`, 240, 60_000)
  if (!rate.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  if (!isAuthorized(req, 'ANALYTICS_INGEST_TOKEN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as EventPayload | null
  if (!body || typeof body.type !== 'string' || body.type.length < 2 || body.type.length > 64) {
    return NextResponse.json({ error: 'Invalid analytics event payload' }, { status: 400 })
  }

  const wallet = body.wallet
  if (wallet && !isWalletAddress(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet format' }, { status: 400 })
  }

  const requestId = req.headers.get('x-request-id') ?? undefined
  const event = await appendAnalyticsRecord({
    id: `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    wallet: wallet ? normalizeWallet(wallet) : undefined,
    type: body.type,
    payload: body.payload ?? {},
    timestamp: new Date().toISOString(),
    requestId,
  })

  return NextResponse.json({ event }, { status: 202 })
}
