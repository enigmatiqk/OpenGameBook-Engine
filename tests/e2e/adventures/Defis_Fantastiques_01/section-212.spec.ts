import { expect, test } from '@playwright/test'
import { testSection, testChoiceButtons, screenshotOnFailure, testCombatStart, testCombatRound, testItem, testNavigation } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 212
const SECTION_TEXT = "Le parchemin est très abîmé"
const SECTION_CHOICES = {
  120: "poursuivre en direction du nord",
  369: "Boire le liquide de la bouteille"
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

  test('surcharge item parchemin', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=parchemin`)
    await page.waitForSelector('.section-text')

    const item = page.locator(`.inv-items #parchemin`)
    await expect(item).toContainText('Parchemin illisible');
  })

  test('section bouteille liquide vers 369', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 1, "item_id=bouteille-liquide")
  })

  test('naviguer vers 120', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 0)
  })

})