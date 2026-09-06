import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, testNavigation } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 279
const SECTION_TEXT = "La créature qui vous fait face est un VAMPIRE"
const SECTION_CHOICES = {
  17: "Tuer le vampire avec mon épieu",
  333: "Attaquer avec mon épée",
  380: "Franchir la porte avec mon crucifix"
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

  // navigationTests(test, SECTION_CHOICES)

  test('Boutons en arrivant', async ({ page }) => {
    await expect(page.locator(`.choices-list button:has-text("${SECTION_CHOICES[17]}")`)).toBeDisabled()
    await expect(page.locator(`.choices-list button:has-text("${SECTION_CHOICES[380]}")`)).toBeDisabled()

    await expect(page.locator(`.choices-list button:has-text("${SECTION_CHOICES[333]}")`)).toBeEnabled()
  })

  test('Navigation disponible', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES,1)
  })

  test('Navigation avec crucifix', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=crucifix`)
    await page.waitForSelector('.section-text')

    const button = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[380]}")`)
    await button.click()

    await testSection(page, 380)
  })
})
