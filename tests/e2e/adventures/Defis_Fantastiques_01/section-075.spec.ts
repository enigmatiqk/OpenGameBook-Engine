import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testNavigation, testItem, testStat } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 75
const SECTION_TEXT = 'Vous vous asseyez et prenez un peu de repos'
const SECTION_CHOICES = {
  0: 'Prendre un repas',
  93: 'En direction du croisement',
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

  // ── Items reçus en arrivant ───────────────────────────────────────────────

  test('Clé 111 présente dans l\'inventaire', async ({ page }) => {
    await testItem(page,'cle-111' )
  })

  test('Pierre précieuse présente dans l\'inventaire', async ({ page }) => {
    await testItem(page,'pierre-precieuse' )
  })

  // ── +3 CHANCE à l'arrivée ─────────────────────────────────────────────────

  test('+3 CHANCE appliqués à l\'arrivée (ignore_stat_limit)', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&chance=10&ignore_stat_limit`)
    await page.waitForSelector('.section-text')

    await testStat(page, "chance",13)
  })

  // ── Manger un repas ───────────────────────────────────────────────────────

  test('Manger un repas augmente l\'endurance de 4', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=repas&item_count=1&endurance=10&ignore_stat_limit`)
    await page.waitForSelector('.section-text')

    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await testStat(page, "endurance",14)
  })

  test('Bouton "Prendre un repas" désactivé sans repas', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=repas&item_count=0`)
    await page.waitForSelector('.section-text')

    const repasBtn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await expect(repasBtn).toBeDisabled()
  })

  // ── Navigation ────────────────────────────────────────────────────────────

  test('Navigation vers section 93', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 1)
  })
})
