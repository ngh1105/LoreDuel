import { expect, test } from '@playwright/test'

test('landing page renders core CTA', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'ENTER_CHAMBER' })).toBeVisible()
  await expect(page.getByText('GRIMOIRE_EDITION // SPECS')).toBeVisible()
})

test('core gameplay loop works and chronicle updates', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'ENTER_CHAMBER' }).click()

  await expect(page.getByRole('button', { name: 'CAST_TURN' })).toBeVisible()
  await page.getByRole('button', { name: 'CAST_TURN' }).click()

  await expect(page.getByRole('heading', { name: 'Chronicle' })).toBeVisible()
  await expect(page.getByText('records')).toBeVisible()
})

test('health endpoint reports service status', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.ok()).toBe(true)

  const payload = await response.json()
  expect(payload.ok).toBe(true)
  expect(payload.service).toBe('loreduel-web')
  expect(payload.gameConfigVersion).toBe(1)
})
