import { test } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, testItem } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 273
const SECTION_TEXT = "Vous ne trouvez rien de bien utile en fouillant"
const SECTION_CHOICES = {
  0: "Prendre les 5 piquets",
  189: "Franchir la porte du mur nord"
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


  test('Prendre les 5 piquets', async ({ page }) => {
    const button = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await button.click()

    await testItem(page, "piquet-bois", 5)
  })
})
