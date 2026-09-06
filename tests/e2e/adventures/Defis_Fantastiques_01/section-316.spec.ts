import { test } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, tenterChance } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 316
const SECTION_TEXT = "L'eau est glaciale. Vous vous mettez à nager"

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

  test('Tenter chance réussi', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=1`)
    await page.waitForSelector('.section-text')

    await tenterChance(page, "Tenir bon")

    await testSection(page, 151)
  })

  test('Tenter chance echoue', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=6`)
    await page.waitForSelector('.section-text')

    await tenterChance(page, "Tenir bon")

    await testSection(page, 218)
  })
})
