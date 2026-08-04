import { test, expect } from '@playwright/test'
import { testSection } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 118
const SECTION_TEXT = "Lorsque vous vous approchez de lui"

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== 'passed') {
      const screenshotPath = `test-results/section-${String(SECTION_NUMBER).padStart(3, '0')}-${testInfo.title.replace(/\s+/g, '-')}-failed.png`
      await page.screenshot({ path: screenshotPath })
    }
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}`)
    await page.waitForSelector('.section-text')
  })

  test('Section et texte', async ({ page }) => {
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Bouton de défaite présent', async ({ page }) => {
    const button = page.locator('.defeat-next-btn')
    await expect(button).toHaveCount(1)
  })

  test('Clic défaite → écran défaite', async ({ page }) => {
    await page.click('.defeat-next-btn')

    const defeatView = page.locator('#view-defeat')
    await expect(defeatView).toBeVisible()
  })
})
