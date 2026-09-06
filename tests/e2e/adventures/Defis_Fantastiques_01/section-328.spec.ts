import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, screenshotOnFailure, navigationTests, gotoWithParams,showFicheHero,closeModal, dropEquipment, testItem } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 328
const SECTION_TEXT = "Les deux morceaux de bois ont la forme d'un Y"
const SECTION_CHOICES = {
  0: "Prendre les batons",
  73: "Partir par la porte nord",
  125: "Rester pour examiner la corde"
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

  navigationTests(test,SECTION_CHOICES)

  test('Prendre les objets', async ({ page }) => {
    gotoWithParams(page, {equip: 'casque_alu'} )

    const button = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await expect(button).toBeDisabled()

    await showFicheHero(page)

    await dropEquipment(page, "alu")
    await closeModal(page)

    await expect(button).toBeEnabled()
    await button.click()

    await testItem(page, "baton-y", 2)
  })
})
