import { test } from '@playwright/test'
import { testSectionAndText, testChoiceButtons, testNavigation } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 1
const SECTION_TEXT = 'Vos deux jours de marche'
const SECTION_CHOICES = {
  71: 'Aller vers l\'ouest',
  278: 'Aller vers l\'est'
}

test.describe('Section 001 - Début de l\'aventure', () => {

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== 'passed') {
      const screenshotPath = `test-results/section-${String(SECTION_NUMBER).padStart(3, '0')}-${testInfo.title.replace(/\s+/g, '-')}-failed.png`
      await page.screenshot({ path: screenshotPath })
    }
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}`)
    await page.waitForSelector('.section-text')
  })

  test('Section et texte', async ({ page }) => {
    await testSectionAndText(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  test('Navigation vers section 71 (ouest)', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 0)
  })

  test('Navigation vers section 278 (est)', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 1)
  })
})
