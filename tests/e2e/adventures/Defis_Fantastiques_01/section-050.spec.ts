import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, testItem } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 50
const SECTION_TEXT = 'La créature que vous avez tuée s\'écroule sur le sol'
const SECTION_CHOICES = {
  269: "Retourner à la bifurcation"
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    await screenshotOnFailure(page, testInfo, SECTION_NUMBER)
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

  test('gain clé N°9', async ({ page }) => {
    await testItem(page, "cle-9", 1)
  })

  navigationTests(test, SECTION_CHOICES)
})