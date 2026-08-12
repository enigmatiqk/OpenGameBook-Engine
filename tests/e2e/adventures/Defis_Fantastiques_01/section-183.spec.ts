import { test } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, testStat, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 183
const SECTION_TEXT = "Vous fouillez les corps des Farfadets morts"
const SECTION_CHOICES = {
  266: 'Ouvrir la malette',
  237: 'Sortir par la porte sans la malette'
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

  test('Gain de +1 HABILETE à l\'entrée', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=10&ignore_stat_limit=1`)
    await page.waitForSelector('.section-text')
    await testStat(page, 'habilete', 11)
  })

  test('Gain de +5 ENDURANCE à l\'entrée', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=10&ignore_stat_limit=1`)
    await page.waitForSelector('.section-text')
    await testStat(page, 'endurance', 15)
  })
})