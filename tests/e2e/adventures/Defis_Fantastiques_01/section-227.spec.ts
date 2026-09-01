import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 227
const SECTION_TEXT = "La porte s'ouvre et vous vous retrouvez"
const SECTION_CHOICES = {
  131: "Bavarder avec eux",
  291: "S'excuser et quitter la pièce", 
  100: "Se proposer de jour avec eux",
  20: "Attaquer leur chef"
}

const SECTION_CHOICES_CONNUE = {
  2912: "La pièce est vide"
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
    await testChoiceButtons(page, {...SECTION_CHOICES, ...SECTION_CHOICES_CONNUE})
  })

  //navigation par défaut
  navigationTests(test, SECTION_CHOICES)

  test('piece vide desactive', async ({ page }) => {
      const btn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES_CONNUE[2912]}")`)
      await expect(btn).toBeDisabled()
  })

  test('retour dans la section', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&sn1=12&sn2=123&sn3=227`)
    await page.waitForSelector('.section-text')

    const btnA = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[131]}")`)
    const btnB = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[291]}")`)
    const btnC = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[100]}")`)
    const btnD = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[20]}")`)

    await expect(btnA).toBeDisabled()
    await expect(btnB).toBeDisabled()
    await expect(btnC).toBeDisabled()
    await expect(btnD).toBeDisabled()

    const btn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES_CONNUE[2912]}")`)
    await expect(btn).toBeEnabled()

    await btn.click()
    await testSection(page, 291)
  })
  
})
