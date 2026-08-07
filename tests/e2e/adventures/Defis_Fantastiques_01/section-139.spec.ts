import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 139
const SECTION_TEXT = 'Au cours de votre aventure'
const SECTION_CHOICES = {
  0: 'Saisir la somme des 3 clés numérotées'
}

// Paramètres d'URL pour injecter 3 clés de type "cle"
const PARAMS_3_CLES = 'item_id=cle-111&item_type=cle&item_count=1&item2_id=cle+de+12&item2_type=cle&item2_count=1&item3_id=clef-molette&item3_type=cle&item3_count=1'

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

  // ── Sans clés ─────────────────────────────────────────────────────────────

  test('Bouton désactivé sans clés', async ({ page }) => {
    const btn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await expect(btn).toBeDisabled()
  })

  // ── Avec 3 clés ───────────────────────────────────────────────────────────

  test('Bouton activé avec 3 clés', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&${PARAMS_3_CLES}`)
    await page.waitForSelector('.section-text')

    const btn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await expect(btn).toBeEnabled()
  })

  test('Saisie invalide → message d\'erreur visible', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&${PARAMS_3_CLES}`)
    await page.waitForSelector('.section-text')

    // Ouvre la modale
    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await page.waitForSelector('.section-saisie-input', { timeout: 5000 })

    // Saisie d'une valeur hors liste
    await page.fill('.section-saisie-input', '123')
    await page.click('.section-saisie-confirm')

    // Le message d'erreur doit apparaître
    const errorEl = page.locator('.section-saisie-error')
    await expect(errorEl).toBeVisible()
    await expect(errorEl).toContainText('combinaison')

    // On reste sur la même section (modale encore ouverte)
    await expect(page.locator('.section-saisie-input')).toBeVisible()
  })

  test('Saisie valide → navigation vers la section saisie', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&${PARAMS_3_CLES}`)
    await page.waitForSelector('.section-text')

    // Ouvre la modale
    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await page.waitForSelector('.section-saisie-input', { timeout: 5000 })

    // 174 est une somme valide (99+66+9)
    await page.fill('.section-saisie-input', '174')
    await page.click('.section-saisie-confirm')

    // Navigation vers la section 174
    await page.waitForSelector('[data-section="174"]', { timeout: 5000 })
    await expect(page.locator('[data-section="174"]')).toBeVisible()
  })
})
