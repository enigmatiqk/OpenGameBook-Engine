import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 91
const SECTION_TEXT = 'Si vous êtes chanceux, votre tricherie restera ignorée'
const SECTION_CHOICES = {
  0: "Tentez votre Chance"
}

// Résultat du lancer tenter_chance :
//   chance=50 + lance_de=4 → total dés (4+4=8) ≤ 50 → succès → section 131 + gain 2d6 pièces d'or
//   chance=1  + lance_de=4 → total dés (4+4=8) >  1  → échec  → section 20
//
// Gain pièces d'or : 2d6 forcé avec lance_de=3 → 3+3=6 pièces d'or
// Id DOM de l'item : slugify("pieces d'or") → "pieces-d-or"

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

  test('Bouton de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  // ── Chance réussie → section 131 ─────────────────────────────────────────
  test('Chance réussie → section 131', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&ignore_stat_limit&chance=50&lance_de=4`)
    await page.waitForSelector('.section-text')

    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await page.waitForSelector('.action-roll-btn', { timeout: 5000 })

    // 1er lancer : tenter_chance
    await page.click('.action-roll-btn')
    await page.waitForSelector('.action-roll-btn', { timeout: 5000 })

    // 2e lancer : gain 2d6 pièces d'or
    await page.click('.action-roll-btn')

    await page.waitForSelector('[data-section="131"]', { timeout: 10000 })
    await expect(page.locator('[data-section="131"]')).toBeVisible()
  })

  // ── Chance échouée → section 20 ──────────────────────────────────────────
  test('Chance échouée → section 20', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&ignore_stat_limit&chance=1&lance_de=4`)
    await page.waitForSelector('.section-text')

    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await page.waitForSelector('.action-roll-btn', { timeout: 5000 })

    // lancer : tenter_chance → échoue
    await page.click('.action-roll-btn')

    await page.waitForSelector('[data-section="20"]', { timeout: 5000 })
    await expect(page.locator('[data-section="20"]')).toBeVisible()
  })

  // ── Gain pièces d'or (2d6 forcé lance_de=3 → 3+3=6) ─────────────────────
  test('Chance réussie → gain 6 pièces d\'or (lance_de=3)', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&ignore_stat_limit&chance=50&lance_de=3`)
    await page.waitForSelector('.section-text')

    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await page.waitForSelector('.action-roll-btn', { timeout: 5000 })

    // 1er lancer : tenter_chance (3+3=6 ≤ 50 → succès)
    await page.click('.action-roll-btn')
    await page.waitForSelector('.action-roll-btn', { timeout: 5000 })

    // 2e lancer : gain 2d6 → 3+3=6 pièces d'or
    await page.click('.action-roll-btn')

    await page.waitForSelector('[data-section="131"]', { timeout: 10000 })

    // Vérifier que les pièces d'or sont dans l'inventaire avec data-count=6
    const piecesOr = page.locator('#pieces-d-or')
    await expect(piecesOr).toBeVisible()
    await expect(piecesOr).toHaveAttribute('data-count', '6')
  })
})
