import { test, expect } from '@playwright/test'
import { testSectionAndText, testChoiceButtons } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 47
const SECTION_TEXT = "Lorsque vous êtes au milieu de la rivière"
const SECTION_CHOICES = {
  0: 'Lancer le dé'
}

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
    await testSectionAndText(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  // dé=6 → tombe dans la rivière → section 158
  test('lance_de=6 : navigation vers section 158', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=6`)
    await page.waitForSelector('.section-text')

    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await page.waitForSelector('.action-roll-btn', { timeout: 5000 })
    await page.click('.action-roll-btn')

    await page.waitForSelector('[data-section="158"]', { timeout: 5000 })
    await expect(page.locator('[data-section="158"]')).toBeVisible()
  })

  // dé=1 à 5 → retrouve l'équilibre → section 298
  test('lance_de=1 : navigation vers section 298', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=1`)
    await page.waitForSelector('.section-text')

    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await page.waitForSelector('.action-roll-btn', { timeout: 5000 })
    await page.click('.action-roll-btn')

    await page.waitForSelector('[data-section="298"]', { timeout: 5000 })
    await expect(page.locator('[data-section="298"]')).toBeVisible()
  })
})
