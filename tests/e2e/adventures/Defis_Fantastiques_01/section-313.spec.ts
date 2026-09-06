import { expect, test } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 313
const SECTION_TEXT = "Vous examinez le corps"
const SECTION_CHOICES = {
  221: "Continuer"
}
const SECTION_CHOICES_LOCAL = {
  1: "Prendre 2 pièces d'or",
  2: "Prendre 1 pièce d'or et le crucifix"
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
    await testChoiceButtons(page, {...SECTION_CHOICES, ...SECTION_CHOICES_LOCAL})
  })

  navigationTests(test, SECTION_CHOICES)

  test('verification choix 2 items', async ({ page }) => {
    const button_A = page.locator(`.choices-list button:has-text("${SECTION_CHOICES_LOCAL[1]}")`)
    const button_B = page.locator(`.choices-list button:has-text("${SECTION_CHOICES_LOCAL[2]}")`)

    await expect(button_A).toBeEnabled()
    await expect(button_B).toBeEnabled()

    await button_A.click()

    await expect(button_A).toBeDisabled()
    await expect(button_B).toBeDisabled()
  })
})
