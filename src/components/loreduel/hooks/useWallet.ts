'use client'

import { useEffect, useMemo, useState } from 'react'
import { trackEvent } from '../../../lib/analytics'
import {
  connectWallet,
  disconnectWallet,
  getNetworkName,
  isWalletChainSupported,
  subscribeToWalletEvents,
  tryReconnectWallet,
  type WalletState,
} from '../../../lib/genlayer'

type UseWalletOptions = {
  hasLoaded: boolean
  onStatusChange: (note: string) => void
}

export type WalletActions = {
  wallet: WalletState | null
  walletError: string | null
  isConnecting: boolean
  networkName: string
  handleConnectWallet: () => Promise<void>
  handleDisconnectWallet: () => void
  clearWalletError: () => void
}

export function useWallet({ hasLoaded, onStatusChange }: UseWalletOptions): WalletActions {
  const [wallet, setWallet] = useState<WalletState | null>(null)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const networkName = useMemo(() => getNetworkName(), [])

  useEffect(() => {
    if (!hasLoaded) return

    tryReconnectWallet().then((reconnected) => {
      if (!reconnected) return

      setWallet(reconnected)
      if (reconnected.networkMismatch) {
        setWalletError(`Wallet is on the wrong network. Switch to ${networkName}.`)
        onStatusChange(`Wrong wallet network detected. Switch to ${networkName} for live turns.`)
        return
      }

      setWalletError(null)
    })

    const unsubscribe = subscribeToWalletEvents(
      (newWallet) => {
        setWallet(newWallet)
        if (newWallet?.networkMismatch) {
          const msg = `Wallet is on the wrong network. Switch to ${networkName}.`
          setWalletError(msg)
          onStatusChange(`Wrong wallet network detected. Switch to ${networkName} for live turns.`)
        } else {
          setWalletError(null)
        }
        if (newWallet) trackEvent({ type: 'wallet_connect_success', address: newWallet.address })
      },
      () => {
        setWallet(null)
        setWalletError(null)
        trackEvent({ type: 'wallet_disconnect' })
      },
      (chainId) => {
        const mismatch = !isWalletChainSupported(chainId)
        setWallet((current) => {
          if (!current) return current
          return { ...current, chainId: chainId ?? undefined, networkMismatch: mismatch }
        })
        if (mismatch) {
          setWalletError(`Wallet is on the wrong network. Switch to ${networkName}.`)
          onStatusChange(`Wrong wallet network detected. Switch to ${networkName} for live turns.`)
          return
        }
        setWalletError(null)
      },
    )

    return unsubscribe
  }, [hasLoaded, networkName, onStatusChange])

  async function handleConnectWallet() {
    setIsConnecting(true)
    setWalletError(null)
    trackEvent({ type: 'wallet_connect_attempt' })

    try {
      const nextWallet = await connectWallet()
      setWallet(nextWallet)
      if (nextWallet.networkMismatch) {
        setWalletError(`Wallet is on the wrong network. Switch to ${networkName}.`)
        onStatusChange(`Wrong wallet network detected. Switch to ${networkName} for live turns.`)
      } else {
        onStatusChange('Wallet connected. Live turns are available.')
      }
      trackEvent({ type: 'wallet_connect_success', address: nextWallet.address })
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Wallet connection failed.'
      setWalletError(msg)
      trackEvent({ type: 'wallet_connect_fail', error: msg })
    } finally {
      setIsConnecting(false)
    }
  }

  function handleDisconnectWallet() {
    disconnectWallet()
    setWallet(null)
    setWalletError(null)
    trackEvent({ type: 'wallet_disconnect' })
  }

  return {
    wallet,
    walletError,
    isConnecting,
    networkName,
    handleConnectWallet,
    handleDisconnectWallet,
    clearWalletError: () => setWalletError(null),
  }
}
