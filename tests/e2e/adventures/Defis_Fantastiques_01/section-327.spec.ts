import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, screenshotOnFailure, testNavigation, repasTests, gotoWithParams,showFicheHero,closeModal, dropEquipment, testMonnaie, testItem } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 327
const SECTION_TEXT = "Le corps allongé sur le sol vieillit à vue d'oeil"
const SECTION_CHOICES = {
  0: "Prendre l'or, le livre et le baton",
  1: "Prendre un repas",
  380: "Sortir par la porte ouest"
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

  test('Prendre les objets', async ({ page }) => {
    gotoWithParams(page, {equip: 'casque_alu'} )

    const button = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await expect(button).toBeDisabled()

    await showFicheHero(page)

    await dropEquipment(page, "alu")
    await closeModal(page)

    await expect(button).toBeEnabled()
    await button.click()

    await testMonnaie(page, 1)
    await testItem(page, "livre")
    await testItem(page, "baton-y")
  })

  repasTests(test, SECTION_CHOICES[1])

  test('Sortir par la porte', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 2)
  })
})
