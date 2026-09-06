import { test } from '@playwright/test'
import { testSection, testChoiceButtons, testNavigation, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 292
const SECTION_TEXT = "Au nord, le passage aboutit à une massive porte de bois"
const SECTION_CHOICES = {
  40: "Continuer",
  239: "J'ai bien une chandelle bleu"
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

  test('navigation sans chandelle', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES,0)
  })

  test('navigation avec chandelle', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=chandelle-bleu`)
    await page.waitForSelector('.section-text')

    await testNavigation(page, SECTION_CHOICES,1)
  })
})
