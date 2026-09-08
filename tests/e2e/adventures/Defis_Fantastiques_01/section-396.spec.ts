import { test } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, testItem, gotoWithParams, testNavigation, testMort } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 396
const SECTION_TEXT = "A présent que le Sorcier est vaincu"
const SECTION_CHOICES = {
  242: "Mettre les 2 clés",
  2422: "Essayer d'enfoncer la porte"
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

  test('Avec deux cles', async ({ page }) => {
    await gotoWithParams(page, {item1_id: 'cle-A', item2_id: 'cle-B', item1_type: 'cle', item2_type: 'cle'})

    await testNavigation(page, SECTION_CHOICES,0)
  })

  test('Enfoncer la porte et rester en vie', async ({ page }) => {
    await gotoWithParams(page, {endurance: '10'})

    const button = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[2422]}")`)
    await button.click()

    await testSection(page, 242)
  })

  test('Enfoncer la porte et mourir', async ({ page }) => {
    await gotoWithParams(page, {endurance: '5'})

    const button = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[2422]}")`)
    await button.click()

    await testSection(page, 242)
    await testMort(page)
  })
})
