import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testNavigation, testStat } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 65
const SECTION_TEXT = 'Alors que vous bondissez sur le Chef'
const SECTION_CHOICES = {
  293: "Prendre la fuite",
  372: "Poursuivre le combat"
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== 'passed') {
      const screenshotPath = `test-results/${testInfo.title.replace(/\s+/g, '-')}-failed.png`
      await page.screenshot({ path: screenshotPath })
    }
  })

  test.beforeEach(async ({ page }) => {
    // Lancer le jeu en mode debug
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}`)
    // Attendre que la section soit chargée
    await page.waitForSelector('.section-text')
  })

  test('Section et texte', async ({ page }) => {
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  test('Navigation vers section 293', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=10`)
    // Attendre que la section soit chargée
    await page.waitForSelector('.section-text')

    await testNavigation(page, SECTION_CHOICES, 0)

    await testStat(page, "endurance",8)
  })

  test('Navigation vers section 372', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 1)
  })
})
