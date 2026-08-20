import { expect, test } from '@playwright/test'
import { testSection, testChoiceButtons, screenshotOnFailure, testCombatStart, testCombatRound } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 211
const SECTION_TEXT = "Les Etres ne sont vulnérables"
const SECTION_CHOICES = {
  0: "Combattre",
  173: "J'ai une arme en argent !"
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

  test('Si item argent, pas de combat', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=lune argent`)
    await page.waitForSelector('.section-text')

    const btn_argent = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[173]}")`)
    const btn_combat = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)

    await expect(btn_argent).toBeEnabled()
    await expect(btn_combat).toBeDisabled()

    await btn_argent.click()

    await testSection(page, 173)
  })

    test('Si equip argent, pas de combat', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&equip=casque_couleur argent`)
    await page.waitForSelector('.section-text')

    const btn_argent = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[173]}")`)
    const btn_combat = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)

    await expect(btn_argent).toBeEnabled()
    await expect(btn_combat).toBeDisabled()

    await btn_argent.click()

    await testSection(page, 173)
  })


  test('combat obligatoire sans item argent', async ({ page }) => {
    const btn_argent = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[173]}")`)
    const btn_combat = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)

    await expect(btn_argent).toBeDisabled()
    await expect(btn_combat).toBeEnabled()
  })

  test("combat d'un seul round avant de fuir", async ({ page }) => {
    const btn_combat = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)

    await testCombatStart(page)
    await testCombatRound(page)

    const btn_fuite_directe = page.locator(`.combat-actions .combat-fuite-direct-btn`)
    const btn_fuite_chance = page.locator(`.combat-actions .combat-fuite-chance-btn`)

    await expect(btn_fuite_directe).toBeVisible()
    await expect(btn_fuite_chance).toBeHidden()

    await btn_fuite_directe.click()

    await testSection(page, 360)
    
  })
})