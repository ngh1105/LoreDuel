'use client'

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWallet } from './useWallet'

const {
  connectWalletMock,
  disconnectWalletMock,
  getNetworkNameMock,
  isWalletChainSupportedMock,
  subscribeToWalletEventsMock,
  switchToNetworkMock,
  tryReconnectWalletMock,
} = vi.hoisted(() => ({
  connectWalletMock: vi.fn(),
  disconnectWalletMock: vi.fn(),
  getNetworkNameMock: vi.fn(() => 'studionet'),
  isWalletChainSupportedMock: vi.fn((chainId?: number | null) => chainId === 1002),
  subscribeToWalletEventsMock: vi.fn(() => () => {}),
  switchToNetworkMock: vi.fn(),
  tryReconnectWalletMock: vi.fn(),
}))

vi.mock('../../../lib/analytics', () => ({
  trackEvent: vi.fn(),
}))

vi.mock('../../../lib/genlayer', () => ({
  connectWallet: connectWalletMock,
  disconnectWallet: disconnectWalletMock,
  getNetworkName: getNetworkNameMock,
  isWalletChainSupported: isWalletChainSupportedMock,
  subscribeToWalletEvents: subscribeToWalletEventsMock,
  switchToNetwork: switchToNetworkMock,
  tryReconnectWallet: tryReconnectWalletMock,
}))

describe('useWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    connectWalletMock.mockResolvedValue({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      shortAddress: '0x1234...5678',
      connected: true,
      chainId: 1003,
      networkMismatch: true,
    })
    switchToNetworkMock.mockResolvedValue({ success: true })
    tryReconnectWalletMock.mockResolvedValue(null)
    ;(window as unknown as { ethereum?: unknown }).ethereum = { request: vi.fn() }
  })

  it('refreshes wallet state after a successful network switch', async () => {
    const onStatusChange = vi.fn()
    connectWalletMock.mockResolvedValueOnce({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      shortAddress: '0x1234...5678',
      connected: true,
      chainId: 1003,
      networkMismatch: true,
    })
    tryReconnectWalletMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        shortAddress: '0x1234...5678',
        connected: true,
        chainId: 1002,
        networkMismatch: false,
      })

    const { result } = renderHook(() => useWallet({ hasLoaded: true, onStatusChange }))

    await act(async () => {
      await result.current.handleConnectWallet()
    })

    await waitFor(() => {
      expect(result.current.wallet?.networkMismatch).toBe(false)
    })
    expect(result.current.wallet?.chainId).toBe(1002)
    expect(result.current.walletError).toBeNull()
  })
})
