import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testNavigation, testMonnaie } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 127
const SECTION_TEXT = "Vos menaces ne l'impressionnent pas"
const SECTION_CHOICES = {
  188: "Se préparer à attaquer",
  272: "Donner de 5 pièces d'or pour le calmer"
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
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  test("navigation limité sans 5 pieces d'or", async ({ page }) => {
    await expect(page.locator(`.choices-list button:has-text("${SECTION_CHOICES[272]}")`)).toBeDisabled()
  })

  test("Navigation avec 6 pièces d'or", async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 1, 'item_id=piece-or&item_count=6')
    await testMonnaie(page, 1)
  })

  test('Navigation vers section 188', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 0)
  })
})