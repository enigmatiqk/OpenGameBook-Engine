import { test } from '@playwright/test'
import { testSection, testChoiceButtons, screenshotOnFailure, testNavigation, gotoWithParams, testItem } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 348
const SECTION_TEXT = "Vous êtes au fond d'un trou"
const SECTION_CHOICES = {
  51: "J'ai une potion d'invisibilité",
  331: "Affronter le troll"
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

  test('Navigation de base', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 1)
  })

  test('Navigation avec potion', async ({ page }) => {
    await gotoWithParams(page, {item_id: 'potion-invisibilite'})

    await testItem(page, "potion-invisibilite", 1)
    await testNavigation(page, SECTION_CHOICES, 0)

    await testItem(page, "potion-invisibilite", 0)
  })
})
