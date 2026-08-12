import { test } from '@playwright/test'
import { testSection, testNavigation, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 155
const SECTION_TEXT = "La porte se fend en deux"
// Choix 0 : prendre le bouclier (pas de section cible fixe — section conditionnelle)
// Choix 1 : quitter la pièce → section 300
const SECTION_CHOICES_QUITTER = {
  300: 'Quitter la pièce en directin du couloir'
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

  test('Navigation vers section 300 (quitter la pièce)', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES_QUITTER, 0)
  })
})