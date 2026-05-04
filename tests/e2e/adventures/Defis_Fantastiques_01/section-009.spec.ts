import { test, expect } from '@playwright/test'
import { testSectionAndText, testChoiceButtons, testNavigation } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 9
const SECTION_TEXT = 'Squelette'
const SECTION_CHOICES = {
  34: 'Examiner les outils',
  322: 'Fouiller les tiroirs'
}

test.describe('Section 009 - L\'Établi du Squelette', () => {

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

  test('Navigation vers section 34 (examiner les outils)', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 0)
  })

  test('Navigation vers section 322 (fouiller les tiroirs)', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 1)
  })
})
