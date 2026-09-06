import { expect, test } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, tenterChance, testItem } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 317
const SECTION_TEXT = "Vous coupez la corde à laquelle est pendu le nain"
const SECTION_CHOICES = {
  0: "Prendre le fromage",
  303: "Quitter la pièce direction nord"
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

  navigationTests(test, SECTION_CHOICES)

  test('Prendre le fromage', async ({ page }) => {
    const button = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)

    await expect(button).toBeEnabled()
    await button.click()

    await expect(button).toBeDisabled()
    await testItem(page, "fromage")
  })
})
