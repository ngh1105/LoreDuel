import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 8_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:3005',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- -H 127.0.0.1 -p 3005',
    url: 'http://127.0.0.1:3005',
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_GENLAYER_RPC_URL: 'http://127.0.0.1:1',
      NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS: '0x0000000000000000000000000000000000000001',
      NEXT_PUBLIC_GENLAYER_NETWORK: 'studionet',
      DATABASE_URL: '',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
