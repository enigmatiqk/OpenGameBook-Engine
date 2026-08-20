import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, screenshotOnFailure, testItem, testNavigation, testMonnaie } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 201
const SECTION_TEXT = "Vous vous effondrez sur le sol"
const SECTION_CHOICES = {
  0: 'Prendre un repas',
  293: "Prendre 25 pièces d'or et quitter la pièce",
  2932: "Prendre la Potion d'Invisibilité et quitter la pièce",
  2933: "Prendre le gant (?) et quitter la pièce"
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

  test(`prise repas + 25 pieces d'or`, async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=repas&item_count=2`)
    await page.waitForSelector('.section-text')

    //repas
    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    testItem(page, "repas", 1)

    //navigation avec 25 pieces d'or
    await testNavigation(page, SECTION_CHOICES, 1)
    await testMonnaie(page, 25)
  })

  test(`pas de repas + potion`, async ({ page }) => {
    const btn_repas = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await expect(btn_repas).toBeDisabled()
    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[2932]}")`)
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await testSection(page, 293)
    await testItem(page, "potion-invisibilite", 1)
  })

  test(`pas de repas + gant`, async ({ page }) => {
    const btn_repas = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await expect(btn_repas).toBeDisabled()

    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[2933]}")`)
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await testSection(page, 293)
    await testItem(page, "gant-mystere", 1)
  })
})