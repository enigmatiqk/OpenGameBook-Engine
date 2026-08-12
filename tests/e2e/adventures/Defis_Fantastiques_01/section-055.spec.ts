import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 55
const SECTION_TEXT = 'Lancez deux dés'
const SECTION_CHOICES = {
  7: "Monter sur le radeau"
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

  test('Bouton de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  test('Si réussi - section 7', async ({ page }) => {
    // chance=10, endurance=10, lance_de=4 → total dés = 8 ≤ 10 ET 8 ≤ 10 → succès → section 7
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&ignore_stat_limit&chance=10&endurance=10&lance_de=4`)
    await page.waitForSelector('.section-text')

    await page.click('.choices-list button:has-text("Monter sur le radeau")')
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await page.click('.action-roll-btn') // lancer dés

    await testSection(page, 7)
  })

  test('Si échoué - section 166', async ({ page }) => {
    // chance=5, endurance=10, lance_de=4 → total dés = 8 > 5 → échec → section 166
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&ignore_stat_limit&chance=5&endurance=10&lance_de=4`)
    await page.waitForSelector('.section-text')

    await page.click('.choices-list button:has-text("Monter sur le radeau")')
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await page.click('.action-roll-btn') // lancer dés

    await testSection(page, 166)
  })
})