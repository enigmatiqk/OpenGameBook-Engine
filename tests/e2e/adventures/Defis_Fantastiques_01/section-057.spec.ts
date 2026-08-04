import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 57
const SECTION_TEXT = 'Lorsque vous entrez dans la caverne'
const SECTION_CHOICES = {
  16: "Attaquer l'ogre quand il entre",
  2: "Essayer de se glisser au-dehors",
  119: "Essayer de détourner son attention"
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

  navigationTests(test, SECTION_CHOICES)
})
