import { test } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, testItem } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 296
const SECTION_TEXT = "La boîte contient un petit livre"
const SECTION_CHOICES = {
  42: "Quitter la pièce"
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    await screenshotOnFailure(page, testInfo, SECTION_NUMBER)
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&chance=10&ignore_stat_limit`)
    await page.waitForSelector('.section-text')
  })

  test('Section et texte', async ({ page }) => {
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  navigationTests(test, SECTION_CHOICES)

  test('gain livre', async ({ page }) => {
    await testItem(page, "formule-magique")
  })

})
