import { test, expect } from '@playwright/test'
import { testSectionAndText, testChoiceButtons, testNavigation } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 50
const SECTION_TEXT = 'La créature que vous avez tuée s\'écroule sur le sol'
const SECTION_CHOICES = {
  269: "Retourner à la bifurcation"
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

  test('gain clé N°9', async ({ page }) => {
    const cleItem = page.locator('#cle-9')
    await expect(cleItem).toBeVisible()
    await expect(cleItem).toHaveAttribute('data-count', '1')
  })

  test('Navigation vers section 122', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 0)
  })
})
