import { test } from '@playwright/test'
import { testSection, testChoiceButtons, tenterChance, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 275
const SECTION_TEXT = "En vous dirigeant vers le second corps"
const SECTION_CHOICES = {
  0: "Tentez votre chance"
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

  test('Chanceux', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=1`)
    await page.waitForSelector('.section-text')

    await tenterChance(page, SECTION_CHOICES[0])
  })

  test('Malchanceux', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=6`)
    await page.waitForSelector('.section-text')

    await tenterChance(page, SECTION_CHOICES[0])
  })
})
