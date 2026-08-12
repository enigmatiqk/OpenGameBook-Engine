import { test } from '@playwright/test'
import { testSection, testNavigation, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 159
const SECTION_TEXT = "Vous ouvrez la porte et vous découvrez une grande pièce"
const SECTION_CHOICES_ATTAQUER = {
  365: 'Attaquer les farfadets'
}
const SECTION_CHOICES_CHANCE = {
  0: 'Tentez votre Chance pour fuir'
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

  test('Navigation vers section 365 (attaquer)', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES_ATTAQUER, 0)
  })
})