import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, gotoWithParams } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 383
const SECTION_TEXT = "Au-dessus de la porte, une pancarte indique"
const SECTION_CHOICES = {
  80: "Utiliser la clef du hangar",
  264: "Tenter d'enfoncer la porte",
  129: "retourner sur la berge de la rivière et prendre un autre chemin"
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

  test('sans cle', async ({ page }) => {
    const button_cle = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[80]}")`)
    const button_enfoncer = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[264]}")`)
    const button_retourner = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[129]}")`)

    await expect(button_cle).toBeDisabled()
    await expect(button_enfoncer).toBeEnabled()
    await expect(button_retourner).toBeEnabled()
  })

  test('avec cle', async ({ page }) => {
    await gotoWithParams(page, {item_id: 'trousseau-hangar-bateau'})

    const button_cle = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[80]}")`)
    const button_enfoncer = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[264]}")`)
    const button_retourner = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[129]}")`)

    await expect(button_cle).toBeEnabled()
    await expect(button_enfoncer).toBeEnabled()
    await expect(button_retourner).toBeEnabled()

    await button_cle.click()

    await testSection(page, 80)
  })
})
