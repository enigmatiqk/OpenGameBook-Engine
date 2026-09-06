import { test } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, testMonnaie, gotoWithParams, testStat } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 343
const SECTION_TEXT = "La porte s'ouvre à la volée"
const SECTION_CHOICES = {
  92: "Direction l'ouest"
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

  test('gain stat', async ({ page }) => {
    await testStat(page,"endurance", 9)
  })
})
