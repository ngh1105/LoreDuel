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
  studionet: {
    id: 1002,
    name: 'GenLayer Studio Network',
    rpcUrls: { default: { http: ['https://studio.genlayer.com/api'] } },
    nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
    blockExplorers: { default: { name: 'GenLayer Explorer', url: 'https://genlayer-explorer.vercel.app' } },
  },
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

  describe('switchToNetwork', () => {
    it('switches to the expected chain via wallet_switchEthereumChain', async () => {
      process.env.NEXT_PUBLIC_GENLAYER_NETWORK = 'studionet'
      let hasSwitched = false
      const provider = makeWalletProvider('0x3eb')
      provider.request = vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
          return ['0x1234567890abcdef1234567890abcdef12345678']
        }
        if (method === 'eth_chainId') {
          return hasSwitched ? '0x3ea' : '0x3eb'
        }
        if (method === 'wallet_switchEthereumChain') {
          hasSwitched = true
          return null
        }
        return null
      })

      const { switchToNetwork } = await import('./genlayer')
      const result = await switchToNetwork(provider)

      expect(result.success).toBe(true)
      expect(provider.request).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'wallet_switchEthereumChain' }),
      )
      expect(provider.request).toHaveBeenCalledWith({ method: 'eth_chainId' })
    })

    it('adds the expected chain with wallet metadata, then switches to it', async () => {
      process.env.NEXT_PUBLIC_GENLAYER_NETWORK = 'studionet'
      const provider = makeWalletProvider('0x3eb')
      const switchError = new Error('Unrecognized chain')
      ;(switchError as unknown as { code: number }).code = 4902
      let didAddChain = false

      provider.request = vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
          return ['0x1234567890abcdef1234567890abcdef12345678']
        }
        if (method === 'eth_chainId') {
          return didAddChain ? '0x3ea' : '0x3eb'
        }
        if (method === 'wallet_switchEthereumChain') {
          if (!didAddChain) throw switchError
          return null
        }
        if (method === 'wallet_addEthereumChain') {
          didAddChain = true
          return null
        }
        return null
      })

      const { switchToNetwork } = await import('./genlayer')
      const result = await switchToNetwork(provider)

      expect(result.success).toBe(true)
      expect(provider.request).toHaveBeenCalledWith({
        method: 'wallet_addEthereumChain',
        params: [
          expect.objectContaining({
            chainId: '0x3ea',
            chainName: 'GenLayer Studio Network',
            rpcUrls: ['https://studio.genlayer.com/api'],
            nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
            blockExplorerUrls: ['https://genlayer-explorer.vercel.app'],
          }),
        ],
      })
      expect(provider.request).toHaveBeenLastCalledWith({ method: 'eth_chainId' })
    })

    it('fails when adding a chain does not switch to the expected chain', async () => {
      process.env.NEXT_PUBLIC_GENLAYER_NETWORK = 'studionet'
      const provider = makeWalletProvider('0x3eb')
      const switchError = new Error('Unrecognized chain')
      ;(switchError as unknown as { code: number }).code = 4902
      let didAddChain = false

      provider.request = vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
          return ['0x1234567890abcdef1234567890abcdef12345678']
        }
        if (method === 'eth_chainId') {
          return didAddChain ? '0x3eb' : '0x3eb'
        }
        if (method === 'wallet_switchEthereumChain') {
          if (!didAddChain) throw switchError
          return null
        }
        if (method === 'wallet_addEthereumChain') {
          didAddChain = true
          return null
        }
        return null
      })

      const { switchToNetwork } = await import('./genlayer')
      const result = await switchToNetwork(provider)

      expect(result.success).toBe(false)
      expect(result.reason).toContain('still on the wrong network')
    })

    it('returns failure when user rejects the switch', async () => {
      process.env.NEXT_PUBLIC_GENLAYER_NETWORK = 'studionet'
      const provider = makeWalletProvider('0x3eb')
      const rejectError = new Error('User rejected')
      ;(rejectError as unknown as { code: number }).code = 4001

      provider.request = vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
          return ['0x1234567890abcdef1234567890abcdef12345678']
        }
        if (method === 'eth_chainId') {
          return '0x3eb'
        }
        if (method === 'wallet_switchEthereumChain') {
          throw rejectError
        }
        return null
      })

      const { switchToNetwork } = await import('./genlayer')
      const result = await switchToNetwork(provider)

      expect(result.success).toBe(false)
      expect(result.reason).toContain('rejected')
    })

    it('returns failure when add chain also fails', async () => {
      process.env.NEXT_PUBLIC_GENLAYER_NETWORK = 'studionet'
      const provider = makeWalletProvider('0x3eb')
      const switchError = new Error('Unrecognized chain')
      ;(switchError as unknown as { code: number }).code = 4902

      provider.request = vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
          return ['0x1234567890abcdef1234567890abcdef12345678']
        }
        if (method === 'eth_chainId') {
          return '0x3eb'
        }
        if (method === 'wallet_switchEthereumChain') {
          throw switchError
        }
        if (method === 'wallet_addEthereumChain') {
          throw new Error('Add chain failed')
        }
        return null
      })

      const { switchToNetwork } = await import('./genlayer')
      const result = await switchToNetwork(provider)

      expect(result.success).toBe(false)
      expect(result.reason).toContain('Failed')
    })
  })
})
