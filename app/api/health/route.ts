import { NextResponse } from 'next/server'
import { GAME_CONFIG_VERSION } from '../../../src/lib/game'
import { getDataStats } from '../../../src/server/repository'

export async function GET() {
  const stats = await getDataStats()
  const hasPublicChainConfig =
    Boolean(process.env.NEXT_PUBLIC_GENLAYER_RPC_URL) &&
    Boolean(process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS) &&
    Boolean(process.env.NEXT_PUBLIC_GENLAYER_NETWORK)

  return NextResponse.json(
    {
      ok: true,
      service: 'loreduel-web',
      gameConfigVersion: GAME_CONFIG_VERSION,
      timestamp: new Date().toISOString(),
      network: process.env.NEXT_PUBLIC_GENLAYER_NETWORK ?? 'unknown',
      storageBackend: stats.backend,
      checks: {
        publicChainConfig: hasPublicChainConfig ? 'ok' : 'missing',
      },
    },
    { status: 200 },
  )
}
