import { test } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests,testStat, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 241
const SECTION_TEXT = "Tandis que vous vous lancez à l'attaque"
const SECTION_CHOICES = {
  90: "Prendre la fuite"
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    await screenshotOnFailure(page, testInfo, SECTION_NUMBER)
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=10`)
    await page.waitForSelector('.section-text')
  })

  test('Section et texte', async ({ page }) => {
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  navigationTests(test, SECTION_CHOICES)

  test('test effet habilete -1', async ({ page }) => {
    await testStat(page, "habilete", 9)
  })
})
