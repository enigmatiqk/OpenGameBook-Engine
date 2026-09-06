import { test } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, testMonnaie, gotoWithParams, testStat } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 342
const SECTION_TEXT = "Le RAT-GAROU s'effondre sur le sol"
const SECTION_CHOICES = {
  7: "Avancer"
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

  test('gain or', async ({ page }) => {
    await testMonnaie(page, 2)
  })

  test('gain stat', async ({ page }) => {
    await gotoWithParams(page, {chance: '10', ignore_stat_limit:''})

    await testStat(page,"chance", 12)
  })
})
