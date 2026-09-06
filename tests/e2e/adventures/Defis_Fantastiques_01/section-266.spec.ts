import { test } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, gotoWithParams, screenshotOnFailure, repasTests, testStat, testItem } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 266
const SECTION_TEXT = "La mallette s'ouvre facilement et"
const SECTION_CHOICES = {
  0: "Prendre un repas",
  237: "Continuer"
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

  test('Gain stat', async ({ page }) => {
    await gotoWithParams(page, { chance:'10',ignore_stat_limit:''})

    await testStat(page, "chance", 11)
  })

  test('Gain arc', async ({ page }) => {
    await testItem(page, "celui-qui-donne-sommeil")
  })

  repasTests(test, SECTION_CHOICES[0]  )
})
