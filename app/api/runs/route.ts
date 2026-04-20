import { NextResponse } from 'next/server'
import { getClientId, isAuthorized } from '../../../src/server/api-helpers'
import { checkRateLimit } from '../../../src/server/rate-limit'
import { appendRunRecord, listRunsForWallet } from '../../../src/server/repository'
import { normalizeWallet, validateRunPayload } from '../../../src/server/validation'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const wallet = url.searchParams.get('wallet')
  if (!wallet) {
    return NextResponse.json({ error: 'wallet query param is required' }, { status: 400 })
  }

  return NextResponse.json({ runs: await listRunsForWallet(normalizeWallet(wallet)) }, { status: 200 })
}

export async function POST(req: Request) {
  const clientId = getClientId(req)
  const rate = checkRateLimit(`runs-write:${clientId}`, 120, 60_000)
  if (!rate.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  if (!isAuthorized(req, 'API_WRITE_TOKEN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = (await req.json().catch(() => null)) as unknown
  if (!validateRunPayload(payload)) {
    return NextResponse.json({ error: 'Invalid run payload' }, { status: 400 })
  }

  const run = await appendRunRecord({
    ...payload,
    wallet: normalizeWallet(payload.wallet),
    id: `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: new Date().toISOString(),
  })

  return NextResponse.json({ run }, { status: 201 })
}
