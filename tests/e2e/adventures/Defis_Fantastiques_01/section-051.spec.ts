import { test, expect } from '@playwright/test'
import { testSectionAndText, testChoiceButtons, testNavigation } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 51
const SECTION_TEXT = 'Vous buvez la Potion'
const SECTION_CHOICES = {
  287: "Continuer en direction du nord"
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

  test('gain de chance', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&chance=10&ignore_stat_limit`)
    await page.waitForSelector('.section-text')

    const chanceValue = await page.locator('#stat-chance').textContent()
    expect(chanceValue).toBe('12')
  })

  test('Navigation vers section 287', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 0)
  })
})
