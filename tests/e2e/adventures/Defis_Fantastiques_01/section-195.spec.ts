import { test } from '@playwright/test'
import { testSection, testChoiceButtons, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 195
const SECTION_TEXT = "C'est une histoire peu vraisemblable"
// lancer_de 1d6 : 1-2 → section 140, 3-4 → section 164, 5-6 → section 9 (+2 CHANCE)
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

  test('Lancer le dé résultat 1-2 (lance_de=1) → section 140', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=1`)
    await page.waitForSelector('.section-text')

    await page.click('button:has-text("Lancer le dé")')
    await page.click('.action-roll-btn')
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await testSection(page, 140)
  })

  test('Lancer le dé résultat 3-4 (lance_de=3) → section 164', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=3`)
    await page.waitForSelector('.section-text')

    await page.click('button:has-text("Lancer le dé")')
    await page.click('.action-roll-btn')
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await testSection(page, 164)
  })

  test('Lancer le dé résultat 5-6 (lance_de=5) → section 9', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=5`)
    await page.waitForSelector('.section-text')

    await page.click('button:has-text("Lancer le dé")')
    await page.click('.action-roll-btn')
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await testSection(page, 9)
  })
})