import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testNavigation } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 64
const SECTION_TEXT = 'La Goule danse de joie autour de votre corps'
const SECTION_CHOICES = {
  0: "Défaite"
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
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Boutons de défaite', async ({ page }) => {  
    const button = page.locator(`.defeat-next-btn`)
    await expect(button).toHaveCount(1)
  })

  test('Navigation vers la mort', async ({ page }) => {
    await page.click(`.defeat-next-btn`)

    const looseContent = page.locator(`#view-defeat`)
    await expect(looseContent).toBeVisible()
  })
})
