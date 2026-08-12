import { test } from '@playwright/test'
import { testSection, testChoiceButtons, testNavigation, screenshotOnFailure, testMonnaie } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 110
const SECTION_TEXT = "Vous êtes maintenant plus riche de 8 Pièces"
const SECTION_CHOICES = {
  319: 'Continuer'
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

  test('Navigation vers section 319 avec or', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=piece-or&item_count=2`)
    await page.waitForSelector('.section-text')

    await testNavigation(page, SECTION_CHOICES, 0)

    await testMonnaie(page, 12)
  })

})