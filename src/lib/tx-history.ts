export type TransactionRecord = {
  txHash: `0x${string}`
  battleId: string
  round: number
  mode: 'live' | 'fallback'
  timestamp: number
}

const TX_HISTORY_KEY = 'loreduel-tx-history'
const MAX_TX_HISTORY = 50

export function saveTxRecord(record: TransactionRecord): void {
  try {
    const history = loadTxHistory()
    history.unshift(record)
    if (history.length > MAX_TX_HISTORY) {
      history.length = MAX_TX_HISTORY
    }
    window.localStorage.setItem(TX_HISTORY_KEY, JSON.stringify(history))
  } catch (error) {
    console.error('[TxHistory] Failed to save:', error)
  }
}

export function loadTxHistory(): TransactionRecord[] {
  try {
    const raw = window.localStorage.getItem(TX_HISTORY_KEY)
    if (!raw) return []
    return JSON.parse(raw) as TransactionRecord[]
  } catch {
    return []
  }
}

export function getExplorerUrl(txHash: `0x${string}`, network: string): string {
  const explorers: Record<string, string> = {
    studionet: 'https://studio.genlayer.com/explorer/tx/',
    testnetAsimov: 'https://explorer.genlayer.com/tx/',
    testnetBradbury: 'https://explorer.genlayer.com/tx/',
  }
  const base = explorers[network] ?? explorers.studionet
  return `${base}${txHash}`
}
