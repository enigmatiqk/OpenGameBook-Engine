import { test } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests,testStat, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 247
const SECTION_TEXT = "Il est quelque peu surpris par votre assaut"
const SECTION_CHOICES = {
  292: "Retourner dans le couloir"
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

  test('test effet endurance -2', async ({ page }) => {
    await testStat(page, "endurance", 8)
  })
})
