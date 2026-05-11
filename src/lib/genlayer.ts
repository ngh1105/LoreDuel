import { createClient } from 'genlayer-js'
import {
  localnet,
  studionet,
  testnetAsimov,
  testnetBradbury,
} from 'genlayer-js/chains'
import { TransactionStatus } from 'genlayer-js/types'
import {
  judgeRoundLocally,
  type JudgeInput,
  type StatusId,
  type StructuredVerdict,
  type Stance,
} from './game'
import { saveTxRecord } from './tx-history'

type LiveMode = 'mock' | 'live' | 'fallback'

type RoundSubmissionResult = {
  mode: LiveMode
  note: string
  txHash?: `0x${string}`
  submissionId?: string
  verdict?: StructuredVerdict
}

export type WalletState = {
  address: `0x${string}`
  shortAddress: string
  connected: boolean
  chainId?: number
  networkMismatch?: boolean
}

type EthereumProvider = {
  request: (args: {
    method: string
    params?: unknown[] | Record<string, unknown>
  }) => Promise<unknown>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
}

type RawVerdict = {
  winner: 'player' | 'rival' | 'draw'
  player_loss: number
  rival_loss: number
  tension_shift: number
  narration: string
  oracle_line: string
  scene_shift: string
  applied_statuses: {
    player: StatusId[]
    rival: StatusId[]
  }
  cleared_statuses: {
    player: StatusId[]
    rival: StatusId[]
  }
  stance_delta: {
    player: Stance
    rival: Stance
  }
  tactical_reason: string
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}

const networkMap = {
  localnet,
  studionet,
  testnetAsimov,
  testnetBradbury,
} as const

export type SwitchResult = {
  success: boolean
  reason?: string
}

export async function switchToNetwork(provider: EthereumProvider): Promise<SwitchResult> {
  const expectedChainId = getExpectedChainId()
  if (expectedChainId === null) {
    return { success: false, reason: 'Cannot determine expected network.' }
  }

  const hexChainId = `0x${expectedChainId.toString(16)}`

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexChainId }],
    })
    return verifyActiveChain(provider, expectedChainId)
  } catch (switchError) {
    const err = switchError as Error & { code?: number }
    if (err.code === 4902) {
      try {
        const chain = getExpectedChain()
        const addParams = buildAddChainParams(chain, hexChainId)
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [addParams],
        })
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: hexChainId }],
        })
        return verifyActiveChain(provider, expectedChainId)
      } catch {
        return { success: false, reason: `Failed to add ${getNetworkName()} to wallet.` }
      }
    }
    if (err.code === 4001) {
      return { success: false, reason: 'User rejected the network switch.' }
    }
    return { success: false, reason: `Network switch failed: ${err.message}` }
  }
}

function getExpectedChain() {
  const networkName = (process.env.NEXT_PUBLIC_GENLAYER_NETWORK ||
    'studionet') as keyof typeof networkMap
  return networkMap[networkName] ?? studionet
}

async function verifyActiveChain(provider: EthereumProvider, expectedChainId: number): Promise<SwitchResult> {
  const chainId = await requestChainId(provider)
  if (chainId === expectedChainId) {
    return { success: true }
  }
  return { success: false, reason: `Wallet is still on the wrong network after switching to ${getNetworkName()}.` }
}

function buildAddChainParams(chain: unknown, hexChainId: string): Record<string, unknown> {
  const maybeChain = chain as {
    blockExplorers?: { default?: { url?: string } }
    nativeCurrency?: { name: string; symbol: string; decimals: number }
    name?: string
    rpc?: string[]
    rpcUrls?: string[] | { default?: { http?: string[] } }
  }
  const rpcUrl = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL
  const chainRpcUrls = Array.isArray(maybeChain.rpcUrls)
    ? maybeChain.rpcUrls
    : maybeChain.rpcUrls?.default?.http
  const explorerUrl = maybeChain.blockExplorers?.default?.url
  const params: Record<string, unknown> = {
    chainId: hexChainId,
    chainName: maybeChain.name ?? getNetworkName(),
    rpcUrls: rpcUrl ? [rpcUrl] : (chainRpcUrls ?? maybeChain.rpc ?? []),
    nativeCurrency: maybeChain.nativeCurrency ?? { name: 'Token', symbol: 'TOK', decimals: 18 },
  }

  if (explorerUrl) {
    params.blockExplorerUrls = [explorerUrl]
  }

  return params
}

export function readGenLayerStatus() {
  const rpcUrl = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL
  const contractAddress = process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS

  if (rpcUrl && contractAddress) {
    return {
      summary: 'Live contract ready on GenLayer. Connect a wallet to send real turns.',
    }
  }

  return {
    summary: 'Demo mode is active. You can still play locally without a wallet.',
  }
}

export function getNetworkName(): string {
  return process.env.NEXT_PUBLIC_GENLAYER_NETWORK || 'studionet'
}

export function isWalletChainSupported(chainId: number | null | undefined): boolean {
  const expected = getExpectedChainId()
  if (expected === null || chainId === null || typeof chainId === 'undefined') {
    return true
  }
  return expected === chainId
}

export async function connectWallet(): Promise<WalletState> {
  const provider = window.ethereum

  if (!provider) {
    throw new Error('Wallet provider missing. Install or unlock a browser wallet.')
  }

  const address = await requestWalletAccount(provider)
  const chainId = await requestChainId(provider)
  const networkMismatch = isNetworkMismatch(chainId ?? null)

  return {
    address,
    shortAddress: shortenAddress(address),
    connected: true,
    chainId,
    networkMismatch,
  }
}

export function disconnectWallet(): void {
  // Wallet state is managed by the caller via setState.
}

export async function tryReconnectWallet(): Promise<WalletState | null> {
  const provider = window.ethereum
  if (!provider) return null

  try {
    const accounts = (await provider.request({
      method: 'eth_accounts',
    })) as string[]

    if (accounts.length > 0) {
      const address = accounts[0] as `0x${string}`
      const chainId = await requestChainId(provider)
      return {
        address,
        shortAddress: shortenAddress(address),
        connected: true,
        chainId,
        networkMismatch: isNetworkMismatch(chainId ?? null),
      }
    }
  } catch {
    // Silent fail on reconnect attempt.
  }

  return null
}

export function subscribeToWalletEvents(
  onAccountChange: (wallet: WalletState | null) => void,
  onDisconnect: () => void,
  onChainChange?: (chainId: number | null) => void,
): () => void {
  const provider = window.ethereum
  if (!provider?.on || !provider?.removeListener) {
    return () => {}
  }

  const handleAccountsChanged = (...args: unknown[]) => {
    const accounts = args[0] as string[]
    if (accounts.length === 0) {
      onDisconnect()
      return
    }

    const address = accounts[0] as `0x${string}`
    onAccountChange({
      address,
      shortAddress: shortenAddress(address),
      connected: true,
    })
  }

  const handleChainChanged = (...args: unknown[]) => {
    const raw = args[0]
    const parsed = typeof raw === 'string' || typeof raw === 'number' ? parseChainId(raw) : null
    onChainChange?.(parsed)
  }

  const handleDisconnect = () => {
    onDisconnect()
  }

  provider.on('accountsChanged', handleAccountsChanged)
  provider.on('chainChanged', handleChainChanged)
  provider.on('disconnect', handleDisconnect)

  return () => {
    provider.removeListener?.('accountsChanged', handleAccountsChanged)
    provider.removeListener?.('chainChanged', handleChainChanged)
    provider.removeListener?.('disconnect', handleDisconnect)
  }
}

export async function submitRoundToGenLayer(
  input: JudgeInput,
): Promise<RoundSubmissionResult> {
  const config = getLiveConfig()

  if (!config.ready) {
    return {
      mode: 'mock',
      note: config.reason,
      verdict: judgeRoundLocally(input),
    }
  }

  try {
    const provider = window.ethereum
    if (!provider) {
      throw new Error('Wallet provider missing during live submission.')
    }

    const account = await requestWalletAccount(provider)
    const readClient = createClient({
      chain: config.chain,
      endpoint: config.rpcUrl,
    })
    const writeClient = createClient({
      chain: config.chain,
      endpoint: config.rpcUrl,
      account,
      provider,
    })

    const memory = JSON.stringify(input.battleState.turnMemory.slice(0, 3))
    const submissionId = createSubmissionId(input, account)

    const txHash = await writeClient.writeContract({
      address: config.contractAddress,
      functionName: 'submit_turn',
      args: [
        input.battle.scene.name,
        input.battle.scene.detail,
        input.playerMove.name,
        input.rivalMove.name,
        input.battleState.playerStance,
        input.battleState.rivalStance,
        memory,
        submissionId,
      ],
      value: 0n,
    })

    await readClient.waitForTransactionReceipt({
      hash: txHash,
      status: TransactionStatus.ACCEPTED,
    })

    const rawVerdict = await readVerdictBySubmissionId(
      readClient,
      config.contractAddress,
      submissionId,
    )
    const verdict = parseOracleVerdict(String(rawVerdict), input)

    saveTxRecord({
      txHash,
      battleId: input.battle.id,
      round: input.battleState.round,
      mode: 'live',
      timestamp: Date.now(),
    })

    return {
      mode: 'live',
      note: 'Live contract accepted the turn and returned a structured verdict.',
      txHash,
      submissionId,
      verdict,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown GenLayer error'
    return {
      mode: 'fallback',
      note: `Live verdict failed, so the local oracle resolved the turn instead. ${message}`,
      verdict: judgeRoundLocally(input),
    }
  }
}

function validateRawVerdict(parsed: Partial<RawVerdict>): parsed is RawVerdict {
  const validWinner = parsed.winner === 'player' || parsed.winner === 'rival' || parsed.winner === 'draw'
  const validLosses =
    typeof parsed.player_loss === 'number' &&
    parsed.player_loss >= 1 &&
    parsed.player_loss <= 4 &&
    typeof parsed.rival_loss === 'number' &&
    parsed.rival_loss >= 1 &&
    parsed.rival_loss <= 4
  const validTensionShift =
    typeof parsed.tension_shift === 'number' &&
    parsed.tension_shift >= 0 &&
    parsed.tension_shift <= 40
  const validNarration =
    typeof parsed.narration === 'string' &&
    typeof parsed.oracle_line === 'string' &&
    typeof parsed.scene_shift === 'string' &&
    typeof parsed.tactical_reason === 'string'
  const validStatuses =
    Array.isArray(parsed.applied_statuses?.player) &&
    Array.isArray(parsed.applied_statuses?.rival) &&
    Array.isArray(parsed.cleared_statuses?.player) &&
    Array.isArray(parsed.cleared_statuses?.rival)
  const validStances =
    parsed.stance_delta?.player &&
    parsed.stance_delta?.rival &&
    ['bulwark', 'trickster', 'eclipse'].includes(parsed.stance_delta.player) &&
    ['bulwark', 'trickster', 'eclipse'].includes(parsed.stance_delta.rival)

  return !!(validWinner && validLosses && validTensionShift && validNarration && validStatuses && validStances)
}

function mapRawToStructuredVerdict(raw: RawVerdict): StructuredVerdict {
  return {
    winner: raw.winner,
    playerLoss: raw.player_loss,
    rivalLoss: raw.rival_loss,
    tensionShift: raw.tension_shift,
    narration: raw.narration,
    oracleLine: raw.oracle_line,
    sceneShift: raw.scene_shift,
    appliedStatuses: raw.applied_statuses,
    clearedStatuses: raw.cleared_statuses,
    stanceDelta: raw.stance_delta,
    tacticalReason: raw.tactical_reason,
  }
}

function parseOracleVerdict(raw: string, input: JudgeInput): StructuredVerdict {
  try {
    const parsed = JSON.parse(raw) as Partial<RawVerdict>
    if (validateRawVerdict(parsed)) {
      return mapRawToStructuredVerdict(parsed)
    }
  } catch {
    // Fall through to local fallback
  }

  return judgeRoundLocally(input)
}

function getLiveConfig() {
  const rpcUrl = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL
  const contractAddress = process.env
    .NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS as `0x${string}` | undefined
  const networkName = (process.env.NEXT_PUBLIC_GENLAYER_NETWORK ||
    'studionet') as keyof typeof networkMap
  const chain = networkMap[networkName] ?? studionet

  if (!rpcUrl || !contractAddress) {
    return {
      ready: false as const,
      reason: 'Demo mode stayed active because the live contract settings are missing.',
    }
  }

  if (!window.ethereum) {
    return {
      ready: false as const,
      reason: 'No wallet found, so this turn was judged in demo mode.',
    }
  }

  const walletChainId = getWalletChainIdSync(window.ethereum)
  if (isNetworkMismatch(walletChainId)) {
    return {
      ready: false as const,
      reason: `Wrong wallet network. Please switch to ${networkName} before sending live turns.`,
    }
  }

  return {
    ready: true as const,
    rpcUrl,
    contractAddress,
    chain,
  }
}

function getWalletChainIdSync(provider: EthereumProvider): number | null {
  const maybeProvider = provider as EthereumProvider & { chainId?: unknown }
  if (typeof maybeProvider.chainId === 'string' || typeof maybeProvider.chainId === 'number') {
    return parseChainId(maybeProvider.chainId)
  }
  return null
}

function parseChainId(raw: string | number): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw
  }

  const value = String(raw).trim()
  if (!value) {
    return null
  }

  if (value.startsWith('0x')) {
    const parsedHex = Number.parseInt(value, 16)
    return Number.isFinite(parsedHex) ? parsedHex : null
  }

  const parsedDec = Number.parseInt(value, 10)
  return Number.isFinite(parsedDec) ? parsedDec : null
}

function getExpectedChainId(): number | null {
  const networkName = (process.env.NEXT_PUBLIC_GENLAYER_NETWORK ||
    'studionet') as keyof typeof networkMap
  const chain = networkMap[networkName] ?? studionet
  const maybeChain = chain as { id?: unknown }
  return typeof maybeChain.id === 'number' ? maybeChain.id : null
}

function isNetworkMismatch(walletChainId: number | null): boolean {
  const expected = getExpectedChainId()
  return expected !== null && walletChainId !== null && expected !== walletChainId
}

async function readVerdictBySubmissionId(
  client: ReturnType<typeof createClient>,
  contractAddress: `0x${string}`,
  submissionId: string,
) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const rawVerdict = await client.readContract({
      address: contractAddress,
      functionName: 'get_verdict',
      args: [submissionId],
    })

    if (String(rawVerdict).trim()) {
      return rawVerdict
    }

    await delay(1500)
  }

  throw new Error('Timed out while waiting for the live verdict to propagate.')
}

function createSubmissionId(input: JudgeInput, account: `0x${string}`) {
  return [
    input.battle.id,
    `r${input.battleState.round}`,
    account.toLowerCase(),
    Date.now().toString(36),
  ].join(':')
}

async function requestWalletAccount(provider: EthereumProvider) {
  const accounts = (await provider.request({
    method: 'eth_requestAccounts',
  })) as string[]

  return accounts[0] as `0x${string}`
}

async function requestChainId(provider: EthereumProvider): Promise<number | undefined> {
  try {
    const raw = await provider.request({ method: 'eth_chainId' })
    if (typeof raw === 'string' || typeof raw === 'number') {
      const parsed = parseChainId(raw)
      return parsed ?? undefined
    }
  } catch {
    // No-op: some providers may not expose chain id immediately.
  }
  return undefined
}

function shortenAddress(address: `0x${string}`) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
