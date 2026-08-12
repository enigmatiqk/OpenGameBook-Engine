import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testNavigation, testStat, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 135
const SECTION_TEXT = "L'Être gît recroquevillé"
const SECTION_CHOICES = {
  0: 'Prendre un repas',
  360: 'Prendre la porte nord'
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    await screenshotOnFailure(page, testInfo, SECTION_NUMBER)
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

  test('Navigation vers section 360', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 1)
  })

  // ── Effets à l'arrivée ────────────────────────────────────────────────────

  test('18 pièces d\'or et +2 chance à l\'arrivée', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&chance=8&ignore_stat_limit`)
    await page.waitForSelector('.section-text')

    await testStat(page, 'chance', 10)
  })

  // ── Manger un repas ───────────────────────────────────────────────────────

  test('Bouton "Prendre un repas" désactivé sans repas', async ({ page }) => {
    const repasBtn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await expect(repasBtn).toBeDisabled()
  })

  test('Manger un repas augmente l\'endurance de 4 et désactive le bouton', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=repas&item_count=1&endurance=10&ignore_stat_limit`)
    await page.waitForSelector('.section-text')

    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await testStat(page, 'endurance', 14)

    const repasBtn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await expect(repasBtn).toBeDisabled()
  })
})