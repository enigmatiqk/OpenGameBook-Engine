import { test, expect } from '@playwright/test'
import { testSectionAndText, testChoiceButtons, testNavigation } from '../../helpers/commonTests'

const ADVENTURE_ID = 3
const SECTION_NUMBER = 14
const SECTION_TEXT = "Il n'y a pas trace de passage secret"
const SECTION_CHOICES = {
  117: 'Continuer',
  161: "Découvrir ce qui s'approche ainsi"
}

test.describe('Section 014', () => {

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

  test('1ere visite', async ({ page }) => {
    const ButtonA = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[161]}")`)
    await expect(ButtonA).toBeEnabled()

    const ButtonB = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[117]}")`)
    await expect(ButtonB).toBeDisabled()
  })

  test('Retour', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&sn2=${SECTION_NUMBER}`)
    await page.waitForSelector('.section-text')
    
    const ButtonA = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[161]}")`)
    await expect(ButtonA).toBeDisabled()

    const ButtonB = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[117]}")`)
    await expect(ButtonB).toBeEnabled()
  })

  test('Navigation vers section 161', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 1)
  })
  test('Navigation vers section 117', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 0, `sn2=${SECTION_NUMBER}`)
  })
})
