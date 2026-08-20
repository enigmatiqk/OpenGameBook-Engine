import { test, expect} from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, testStat, testMonnaie } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 218
const SECTION_TEXT = "Vous vous trouvez sur la berge"
const SECTION_CHOICES = {
  3: "Sonner la cloche",
  386: "Utiliser le radeau",
  209: "Se risquer sur le pont",
  316: "Je prefère nager"
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


  test("pas d'or pour la cloche", async ({ page }) => {
    const btn_cloche = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[3]}")`)
    await expect(btn_cloche).toBeDisabled()
  })

  //ne consomme pas d'or, juste une condition
  test("de l'or la cloche", async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=piece-or&item_count=5`)
    await page.waitForSelector('.section-text')

    const btn_repas = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[3]}")`)
    await btn_repas.click()

    await testSection(page, 3)
  })
})