import { test } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 287
const SECTION_TEXT = "Le passage vous mène au bout"
const SECTION_CHOICES = {
  32: "J'ai bien du fromage",
  309: "Zut, je n'ai pas de fromage"
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

  test('navigation sans frmage', async ({ page }) => {
    const button = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[309]}")`)
    await button.click()

    await testSection(page, 309)
  })

  test('navigation avec frmage', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=fromage`)
    await page.waitForSelector('.section-text')

    const button = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[32]}")`)
    await button.click()

    await testSection(page, 32)
  })
})
