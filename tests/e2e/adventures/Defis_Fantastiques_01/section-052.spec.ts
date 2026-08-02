import { test, expect } from '@playwright/test'
import { testSectionAndText, testChoiceButtons, testNavigation } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 52
const SECTION_TEXT = 'Vous vous trouvez à un croisement'
const SECTION_CHOICES = {
  391: "Aller au sud",
  362: "Découvrir des passages secrets dans le couloir sud",
  354: "Aller au nord",
  234: "Découvrir des passages secrets dans le couloir nord",
  291: "Aller à l'est"
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== 'passed') {
      const screenshotPath = `test-results/${testInfo.title.replace(/\s+/g, '-')}-failed.png`
      await page.screenshot({ path: screenshotPath })
    }
  })

  test.beforeEach(async ({ page }) => {
    // Lancer le jeu en mode debug
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}`)
    // Attendre que la section soit chargée
    await page.waitForSelector('.section-text')
  })

  test('Section et texte', async ({ page }) => {
    await testSectionAndText(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  test('Navigation vers section 391', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 0)
  })

  test('Navigation vers section 362', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 1)
  })

  test('Navigation vers section 354', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 2)
  })

  test('Navigation vers section 234', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 3)
  })

  test('Navigation vers section 291', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 4)
  })
})
