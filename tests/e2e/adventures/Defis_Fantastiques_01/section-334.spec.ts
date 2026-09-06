import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, gotoWithParams, testMonnaie, testItem } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 334
const SECTION_TEXT = "Tandis que vous lui parlez, le vieil homme se lève"
const SECTION_CHOICES = {
  0: "Acheter une Chandelle Bleue",
  292: "Quitter la pièce pour aller au nord"
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

  navigationTests(test, SECTION_CHOICES)

  test("pas d'argent", async ({ page }) => {
    const button = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await expect(button).toBeDisabled()
  })

  test("achat 1 chandelle", async ({ page }) => {
    await gotoWithParams(page, {item_id: 'piece-or', item_count: '30'})

    const button = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await expect(button).toBeEnabled()

    await button.click()
    await expect(button).toBeDisabled()

    await testMonnaie(page, 10)
    await testItem(page, "chandelle-bleue")
  })

})
