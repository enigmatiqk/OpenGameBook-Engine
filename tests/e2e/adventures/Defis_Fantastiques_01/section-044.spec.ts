import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testNavigation } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 44
const SECTION_TEXT = 'Haletant après la bataille'
const SECTION_CHOICES = {
  0: "Prendre un repas",
  399: "Avancer dans le cours d'eau"
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

  test('Navigation vers section 399', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 1)
  })
})
