import { beforeEach, describe, expect, it, vi } from 'vitest'
import { battleDefinitions, createBattleState, getMoveById, type JudgeInput, type StructuredVerdict } from './game'

const mockWriteContract = vi.fn()
const mockWaitForReceipt = vi.fn()
const mockReadContract = vi.fn()

vi.mock('genlayer-js', () => ({
  createClient: vi.fn((config: { account?: string }) => {
    if (config.account) {
      return { writeContract: mockWriteContract }
    }
    return {
      waitForTransactionReceipt: mockWaitForReceipt,
      readContract: mockReadContract,
    }
  }),
}))

vi.mock('genlayer-js/chains', () => ({
  localnet: { id: 1001 },
  studionet: { id: 1002 },
  testnetAsimov: { id: 1003 },
  testnetBradbury: { id: 1004 },
}))

vi.mock('genlayer-js/types', () => ({
  TransactionStatus: { ACCEPTED: 'ACCEPTED' },
}))

function makeJudgeInput(): JudgeInput {
  const battle = battleDefinitions[0]
  const battleState = createBattleState(battle)
  return {
    battle,
    battleState,
    playerMove: getMoveById('glass-oath'),
    rivalMove: getMoveById('mirror-feint'),
  }
}

function makeWalletProvider(chainIdHex = '0x3ea') {
  return {
    request: vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
        return ['0x1234567890abcdef1234567890abcdef12345678']
      }
      if (method === 'eth_chainId') {
        return chainIdHex
      }
      return null
    }),
    on: vi.fn(),
    removeListener: vi.fn(),
    chainId: chainIdHex,
  }
}

const liveVerdict: StructuredVerdict = {
  winner: 'player',
  playerLoss: 1,
  rivalLoss: 3,
  tensionShift: 12,
  narration: 'Live narration',
  oracleLine: 'Live oracle',
  sceneShift: 'Live shift',
  appliedStatuses: { player: [], rival: ['shaken'] },
  clearedStatuses: { player: [], rival: [] },
  stanceDelta: { player: 'bulwark', rival: 'trickster' },
  tacticalReason: 'Live tactical reason',
}

describe('genlayer integration', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    window.localStorage.clear()
    delete (window as unknown as { ethereum?: unknown }).ethereum
    delete process.env.NEXT_PUBLIC_GENLAYER_RPC_URL
    delete process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS
    delete process.env.NEXT_PUBLIC_GENLAYER_NETWORK
  })

  it('uses mock mode when live env config is missing', async () => {
    const { submitRoundToGenLayer } = await import('./genlayer')
    const result = await submitRoundToGenLayer(makeJudgeInput())
    expect(result.mode).toBe('mock')
    expect(result.verdict).toBeDefined()
    expect(mockWriteContract).not.toHaveBeenCalled()
  })

  it('submits live turn and parses structured verdict', async () => {
    process.env.NEXT_PUBLIC_GENLAYER_RPC_URL = 'https://example-rpc.invalid'
    process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000001'
    process.env.NEXT_PUBLIC_GENLAYER_NETWORK = 'studionet'

    ;(window as unknown as { ethereum?: unknown }).ethereum = makeWalletProvider('0x3ea')
    mockWriteContract.mockResolvedValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    mockWaitForReceipt.mockResolvedValue({})
    mockReadContract.mockResolvedValue(
      JSON.stringify({
        winner: liveVerdict.winner,
        player_loss: liveVerdict.playerLoss,
        rival_loss: liveVerdict.rivalLoss,
        tension_shift: liveVerdict.tensionShift,
        narration: liveVerdict.narration,
        oracle_line: liveVerdict.oracleLine,
        scene_shift: liveVerdict.sceneShift,
        applied_statuses: liveVerdict.appliedStatuses,
        cleared_statuses: liveVerdict.clearedStatuses,
        stance_delta: liveVerdict.stanceDelta,
        tactical_reason: liveVerdict.tacticalReason,
      }),
    )

    const { submitRoundToGenLayer } = await import('./genlayer')
    const result = await submitRoundToGenLayer(makeJudgeInput())

    expect(result.mode).toBe('live')
    expect(result.txHash).toBeDefined()
    expect(result.verdict?.tacticalReason).toBe('Live tactical reason')
    expect(mockWriteContract).toHaveBeenCalledTimes(1)
    expect(mockReadContract).toHaveBeenCalledTimes(1)
  })

  it('falls back to local verdict when live write fails', async () => {
    process.env.NEXT_PUBLIC_GENLAYER_RPC_URL = 'https://example-rpc.invalid'
    process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000001'
    process.env.NEXT_PUBLIC_GENLAYER_NETWORK = 'studionet'

    ;(window as unknown as { ethereum?: unknown }).ethereum = makeWalletProvider('0x3ea')
    mockWriteContract.mockRejectedValue(new Error('write failed'))

    const { submitRoundToGenLayer } = await import('./genlayer')
    const result = await submitRoundToGenLayer(makeJudgeInput())

    expect(result.mode).toBe('fallback')
    expect(result.note).toContain('Live verdict failed')
    expect(result.verdict).toBeDefined()
  })

  it('marks wrong network on connect and blocks live mode', async () => {
    process.env.NEXT_PUBLIC_GENLAYER_RPC_URL = 'https://example-rpc.invalid'
    process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000001'
    process.env.NEXT_PUBLIC_GENLAYER_NETWORK = 'studionet'

    ;(window as unknown as { ethereum?: unknown }).ethereum = makeWalletProvider('0x3eb')
    const { connectWallet, submitRoundToGenLayer } = await import('./genlayer')

    const wallet = await connectWallet()
    expect(wallet.networkMismatch).toBe(true)

    const result = await submitRoundToGenLayer(makeJudgeInput())
    expect(result.mode).toBe('mock')
    expect(result.note).toContain('Wrong wallet network')
    expect(mockWriteContract).not.toHaveBeenCalled()
  })
})
