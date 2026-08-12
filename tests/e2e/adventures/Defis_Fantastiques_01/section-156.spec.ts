import { test } from '@playwright/test'
import { testSection, testChoiceButtons, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 156
const SECTION_TEXT = "Vous essayez d'enfoncer la porte à coups d'épaule"
const SECTION_CHOICES = {
  0: 'Enfoncer la porte'
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

  test('Tenter habilete réussi (habilete élevée, lance_de=1) → section 343', async ({ page }) => {
    // Avec habilete=50 et lance_de=1 : 2d6=2 <= 50 → succès → section 343
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&lance_de=1`)
    await page.waitForSelector('.section-text')

    await page.click('button:has-text("Enfoncer la porte")')
    await page.click('button:has-text("Lancer")')
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await testSection(page, 343)
  })

  test('Tenter habilete échoué (habilete faible, lance_de=6) → section 92', async ({ page }) => {
    // Avec habilete=1 et lance_de=6 : 2d6=12 > 1 → échec → section 92
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=1&lance_de=6`)
    await page.waitForSelector('.section-text')

    await page.click('button:has-text("Enfoncer la porte")')
    await page.click('button:has-text("Lancer")')
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await testSection(page, 92)
  })
})