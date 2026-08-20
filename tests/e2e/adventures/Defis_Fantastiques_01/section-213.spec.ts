import { expect, test } from '@playwright/test'
import { testSection, testChoiceButtons, screenshotOnFailure, tenterChance, testStat } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 213
const SECTION_TEXT = "La porte est fermée à clé"
const SECTION_CHOICES = {
  0: "Essayer d'enfoncer la porte"
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

  test('Enfoncer la porte avec succès', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=10&lance_de=1`)
    await page.waitForSelector('.section-text')

    await tenterChance(page, SECTION_CHOICES[0])    

    await testSection(page, 36)
  })

  test('Echouer a enfoncer la porte', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=10&lance_de=6&endurance=10`)
    await page.waitForSelector('.section-text')

    await tenterChance(page, SECTION_CHOICES[0])    

    await testSection(page, 314)
    await testStat(page, "endurance", 9)
  })

})