import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, screenshotOnFailure, testNavigation } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 204
const SECTION_TEXT = "Le vieil homme ne lève pas les yeux de la table"
const SECTION_CHOICES = {
  130: "Miser de l'argent",
  280: "Quitter la pièce",
  377: "Attaquer le vieil homme"
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

  test('miser argent sans or', async ({ page }) => {
    const btn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[130]}")`)
 
    await expect(btn).toBeDisabled()
  })

  test('miser argent avec or', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 0, "item_id=piece-or")
  })

  test('Navigation vers 280', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 1)
  })

  test('Navigation vers 377', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 2)
  })
})