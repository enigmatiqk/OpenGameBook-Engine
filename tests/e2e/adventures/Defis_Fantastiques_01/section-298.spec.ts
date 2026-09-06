import { test } from '@playwright/test'
import { testSection, testChoiceButtons, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 298
const SECTION_TEXT = "Des flaques d'eau ont rendu le pont glissant"
const SECTION_CHOICES = {
  0: "Lancer le dé"
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

  test('lancer le de - 5', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=5`)
    await page.waitForSelector('.section-text')

    const btn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await btn.click()

    await page.click(`.action-roll-btn`)

    await page.waitForSelector('.section-text')
    await testSection(page, 7)
  })

  test('lancer le de - 6', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=6`)
    await page.waitForSelector('.section-text')

    const btn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await btn.click()

    await page.click(`.action-roll-btn`)

    await page.waitForSelector('.section-text')
    await testSection(page, 86)
  })
})