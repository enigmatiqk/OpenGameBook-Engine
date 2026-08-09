import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testNavigation, testStat } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 131
const SECTION_TEXT = "Vous bavardez de choses et d'autres"
const SECTION_CHOICES = {
  0: "Prendre un repas",
  291: "Sortir de la pièce"
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== 'passed') {
      const screenshotPath = `test-results/${testInfo.title.replace(/\s+/g, '-')}-failed.png`
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

  test('Navigation vers section 291', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 1)
  })

  // ── Manger un repas (partagé : +2 au lieu de +4) ─────────────────────────

  test('Bouton "Prendre un repas" désactivé sans repas', async ({ page }) => {
    const repasBtn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await expect(repasBtn).toBeDisabled()
  })

  test('Manger un repas partagé augmente l\'endurance de 2 seulement et désactive le bouton', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=repas&item_count=1&endurance=10&ignore_stat_limit`)
    await page.waitForSelector('.section-text')

    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await page.waitForSelector('.section-text', { timeout: 5000 })

    // Surcharge regle_surcharge: { delta: 2 } → +2 seulement (pas +4)
    await testStat(page, 'endurance', 12)

    // Le repas a été consommé : le bouton doit être désactivé
    const repasBtn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await expect(repasBtn).toBeDisabled()
  })
})
