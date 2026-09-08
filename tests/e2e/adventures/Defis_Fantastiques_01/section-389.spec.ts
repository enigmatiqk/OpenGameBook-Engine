import { test } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, testStat, gotoWithParams, tenterChance } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 389
const SECTION_TEXT = "Tentez votre Chance"
const SECTION_CHOICES = {
  289: "Tentez votre Chance" // 112
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

  test('tenter chance reussi', async ({ page }) => {
    await gotoWithParams(page, {lance_de: '1'})

    await tenterChance(page, SECTION_CHOICES[289] )

    await testSection(page, 289)
  })

  test('tenter chance echec', async ({ page }) => {
    await gotoWithParams(page, {lance_de: '6'})

    await tenterChance(page, SECTION_CHOICES[289] )

    await testSection(page, 112)
  })
})
