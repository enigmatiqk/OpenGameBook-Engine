import { test,expect } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, testItem } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 322
const SECTION_TEXT = "Tous les tiroirs sont pleins de clous"
const SECTION_CHOICES = {
  0: "Prendre la clé 66",
  96: "Aller à la porte nord"
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

  test('pas de clé sans équipement', async ({ page }) => {
    const button = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await expect(button).toBeDisabled()
  })

  test('prendre la clé en jetant un équipement', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&equip=casque_papier`)
    await page.waitForSelector('.section-text')

    const button = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await expect(button).toBeDisabled()

    await page.click(".btn-hero-sheet")

    await page.click("div.equipment-slot-rpg.slot-tete button.btn-drop-equip-modal")
    await page.click(".modal-close")

    await expect(button).toBeEnabled()
    await button.click()

    await expect(button).toBeDisabled()
    await testItem(page, "cle-66")
  })
})
