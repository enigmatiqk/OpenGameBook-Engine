import { test } from '@playwright/test'
import { testSection, testChoiceButtons, testNavigation, testStat, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 153
const SECTION_TEXT = "Vous passez les deux épées dans votre ceinture"
const SECTION_CHOICES = {
  399: "Nager vers l'est"
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

  test('Navigation vers section 399', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 0)
  })

  test('Perte de -1 ENDURANCE à l\'entrée', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=10`)
    await page.waitForSelector('.section-text')
    await testStat(page, 'endurance', 9)
  })
})