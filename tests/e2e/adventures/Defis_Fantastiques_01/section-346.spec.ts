import { expect, test } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, gotoWithParams, testMonnaie } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 346
const SECTION_TEXT = "Les cartes peuvent être avec vous ou contre vous"
const SECTION_CHOICES = {
  131: "Continuer"
}
const SECTION_CHOICES_JEUX = {
  0: "S'en remettre aux cartes",
  1: "Se servir de ma Chance"
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    await screenshotOnFailure(page, testInfo, SECTION_NUMBER)
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=piece-or&item_count=5`)
    await page.waitForSelector('.section-text')
  })

  test('Section et texte', async ({ page }) => {
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, {...SECTION_CHOICES, ...SECTION_CHOICES_JEUX})
  })

  test('Boutons navigation desactive au debut', async ({ page }) => {
    const button = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[131]}")`)

    await expect(button).toBeDisabled()
  })

  test('cartes reussi de = 3', async ({ page }) => {
    await gotoWithParams(page, {lance_de:'3'})

    const button_de = page.locator(`.choices-list button:has-text("${SECTION_CHOICES_JEUX[0]}")`)
    await button_de.click()
    await page.click(".action-roll-btn")

    await testMonnaie(page, 8)
  })

  test('cartes echec de = 4', async ({ page }) => {
    await gotoWithParams(page, {lance_de:'4'})

    const button_de = page.locator(`.choices-list button:has-text("${SECTION_CHOICES_JEUX[0]}")`)
    await button_de.click()
    await page.click(".action-roll-btn")

    await testMonnaie(page, 1)
  })

  test('cartes echec de = 6 - or non negatif', async ({ page }) => {
    await gotoWithParams(page, {lance_de:'6'})

    const button_de = page.locator(`.choices-list button:has-text("${SECTION_CHOICES_JEUX[0]}")`)
    await button_de.click()
    await page.click(".action-roll-btn")

    await testMonnaie(page, 0)
  })

  test('bouton cartes desactive aussi chance', async ({ page }) => {
    await gotoWithParams(page, {lance_de:'3'})

    const button_de = page.locator(`.choices-list button:has-text("${SECTION_CHOICES_JEUX[0]}")`)
    const button_chance = page.locator(`.choices-list button:has-text("${SECTION_CHOICES_JEUX[1]}")`)

    await expect(button_de).toBeEnabled()
    await expect(button_chance).toBeEnabled()

    await button_de.click()
    await page.click(".action-roll-btn")

    await expect(button_de).toBeDisabled()
    await expect(button_chance).toBeDisabled()
  })


  test('chance reussi', async ({ page }) => {
    await gotoWithParams(page, {lance_de_pile: '2,2,3,4'})

    const button_de = page.locator(`.choices-list button:has-text("${SECTION_CHOICES_JEUX[1]}")`)
    await button_de.click()
    await page.click(".action-roll-btn")

    await page.click(".action-roll-btn")

    await testMonnaie(page, 12)
  })

  test('chance echec', async ({ page }) => {
    await gotoWithParams(page, {item_count: '20', lance_de: '6'})

    const button_de = page.locator(`.choices-list button:has-text("${SECTION_CHOICES_JEUX[1]}")`)
    await button_de.click()
    await page.click(".action-roll-btn")

    await testMonnaie(page, 8)
  })

})
