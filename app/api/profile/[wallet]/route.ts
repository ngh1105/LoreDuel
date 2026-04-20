import { NextResponse } from 'next/server'
import { getClientId, isAuthorized } from '../../../../src/server/api-helpers'
import { checkRateLimit } from '../../../../src/server/rate-limit'
import { getProfileRecord, upsertProfileRecord } from '../../../../src/server/repository'
import { isWalletAddress, normalizeWallet, validateProfilePayload } from '../../../../src/server/validation'

export async function GET(_req: Request, context: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await context.params
  if (!isWalletAddress(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet format' }, { status: 400 })
  }

  const record = await getProfileRecord(normalizeWallet(wallet))
  if (!record) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  return NextResponse.json({ profile: record }, { status: 200 })
}

export async function PUT(req: Request, context: { params: Promise<{ wallet: string }> }) {
  const clientId = getClientId(req)
  const rate = checkRateLimit(`profile-write:${clientId}`, 60, 60_000)
  if (!rate.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  if (!isAuthorized(req, 'API_WRITE_TOKEN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { wallet } = await context.params
  if (!isWalletAddress(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet format' }, { status: 400 })
  }

  const payload = (await req.json().catch(() => null)) as unknown
  if (!validateProfilePayload(payload)) {
    return NextResponse.json({ error: 'Invalid profile payload' }, { status: 400 })
  }

  const profile = await upsertProfileRecord({
    ...payload,
    wallet: normalizeWallet(wallet),
    updatedAt: new Date().toISOString(),
  })

  return NextResponse.json({ profile }, { status: 200 })
}
