import { test } from '@playwright/test'
import { testSection, testChoiceButtons, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 166
const SECTION_TEXT = "Vous tombez dans l'eau glacée"
// lancer_de 1d6 : 1-4 → section 218, 5-6 → section 158
const SECTION_CHOICES = {
  0: 'Lancer le dé'
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

  test('Lancer le dé résultat 1-4 (lance_de=2) → section 218', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=2`)
    await page.waitForSelector('.section-text')

    await page.click('button:has-text("Lancer le dé")')
    await page.click('.action-roll-btn')
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await testSection(page, 218)
  })

  test('Lancer le dé résultat 5-6 (lance_de=5) → section 158', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=5`)
    await page.waitForSelector('.section-text')

    await page.click('button:has-text("Lancer le dé")')
    await page.click('.action-roll-btn')
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await testSection(page, 158)
  })
})