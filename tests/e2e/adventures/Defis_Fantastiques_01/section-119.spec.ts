import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testMonnaie } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 119
const SECTION_TEXT = "Vous ouvrez votre sac à dos"
const SECTION_CHOICES = {
  269: 'Retourner à la bifurcation'
}

const BASE_URL = (params: string) =>
  `/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&${params}`

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

  // ─── Scénario 1 : velo x4, stylo x1, armure_papier équipée ──────────────────

  test.describe('Scénario 1 - Items en inventaire et armure équipée', () => {
    const PARAMS = 'item_id=velo&item_count=4&item_id2=stylo&item_count2=1&equip=armure_papier'

    test.beforeEach(async ({ page }) => {
      await page.goto(BASE_URL(PARAMS))
      await page.waitForSelector('.section-text')
    })

    test('Le choix est désactivé à l\'arrivée', async ({ page }) => {
      const btn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[269]}")`)
      await expect(btn).toBeDisabled()
    })

    test('Jeter velo présent 4x', async ({ page }) => {
      await page.locator('.hero-inventory .inv-drop-btn[title="Jeter velo"]').click()

      const veloItem = page.locator('#velo')
      await expect(veloItem).toBeVisible()
      expect(Number(await veloItem.getAttribute('data-count'))).toBe(3)

      await expect(page.locator(`.choices-list button:has-text("${SECTION_CHOICES[269]}")`)).toBeEnabled()
    })

    test('Jeter stylo présent 1x', async ({ page }) => {
      await page.locator('.hero-inventory .inv-drop-btn[title="Jeter stylo"]').click()

      await expect(page.locator('#stylo')).not.toBeVisible()
      await expect(page.locator(`.choices-list button:has-text("${SECTION_CHOICES[269]}")`)).toBeEnabled()
    })

    test('jeter une armure équipée', async ({ page }) => {
      // Ouvrir la fiche héros
      await page.click('.btn-hero-sheet')
      await page.waitForSelector('button.btn-unequip-modal[data-slot="armure"]')

      // Déséquiper l'armure
      await page.click('button.btn-unequip-modal[data-slot="armure"]')
      await page.waitForSelector('button.btn-drop-modal')

      // Jeter l'armure depuis la fiche
      await page.locator('button.btn-drop-modal').first().click()
      await page.waitForSelector('.section-text')

      await expect(page.locator(`.choices-list button:has-text("${SECTION_CHOICES[269]}")`)).toBeEnabled()
    })
  })

  // ─── Scénario 2 : uniquement des pièces d'or (fallback automatique) ──────────

  test.describe('Scénario 2 - Uniquement des pièces d\'or (fallback automatique)', () => {
    const PARAMS = 'item_id=piece-or&item_count=4'

    test.beforeEach(async ({ page }) => {
      await page.goto(BASE_URL(PARAMS))
      await page.waitForSelector('.section-text')
    })

    test('Aucun bouton Jeter visible', async ({ page }) => {
      await expect(page.locator('.hero-inventory .inv-drop-btn')).toHaveCount(0)
    })

    test('Le choix s\'active automatiquement et il reste 3 pièces d\'or', async ({ page }) => {
      await expect(page.locator(`.choices-list button:has-text("${SECTION_CHOICES[269]}")`)).toBeEnabled()
      await testMonnaie(page, 3)
    })

    test('Navigation vers la section 269', async ({ page }) => {
      await page.locator(`.choices-list button:has-text("${SECTION_CHOICES[269]}")`).click()
      await page.waitForSelector('.section-text')
      await expect(page.locator('[data-section="269"]')).toBeVisible()
    })
  })
})
