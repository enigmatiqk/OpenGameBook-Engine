import { test } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, testItem, gotoWithParams } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 369
const SECTION_TEXT = "Vous avalez une gorgée du liquide"
const SECTION_CHOICES = {
  109: "Burp"
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    await screenshotOnFailure(page, testInfo, SECTION_NUMBER)
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=10`)
    await page.waitForSelector('.section-text')
  })

  test('Section et texte', async ({ page }) => {
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  navigationTests(test, SECTION_CHOICES)

  test('perte endurance', async ({ page }) => {
    await gotoWithParams(page, {item_id: 'bouteille-liquide', item_count: '2'})
    await testItem(page, "bouteille-liquide", 1)
  })

})
