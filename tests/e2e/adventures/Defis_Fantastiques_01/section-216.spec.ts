import { test, expect} from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, testStat } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 216
const SECTION_TEXT = "L'eau est rafraîchissante"
const SECTION_CHOICES = {
  0: "Prendre un repas",
  384: "Sortir par la porte nord"
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

  test('Vérification effets stat', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete_start=15&endurance_start=16&chance_start=17`)
    await page.waitForSelector('.section-text')

    await testStat(page, "habilete", 15)
    await testStat(page, "endurance", 14)
    await testStat(page, "chance", 17)
  })

  test('Pas de repas', async ({ page }) => {
    const btn_repas = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await expect(btn_repas).toBeDisabled()
  })

  test('prise de repas', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance_start=20&item_id=repas&item_count=3`)
    await page.waitForSelector('.section-text')

    const btn_repas = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await btn_repas.click()

    await testStat(page, "endurance", 18)
  })
})