import { test } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, testStat, gotoWithParams } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 330
const SECTION_TEXT = "Les tonneaux contiennent un liquide de couleur"
const SECTION_CHOICES = {
  81: "Continuer"
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

  test('Gains stat', async ({ page }) => {
    gotoWithParams(page, {endurance:'10', chance:'10', ignore_stat_limit:''})
    await testStat(page, "endurance",16)
    await testStat(page, "chance",11)
  })
})
