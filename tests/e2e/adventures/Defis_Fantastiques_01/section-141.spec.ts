import { test } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 141
const SECTION_TEXT = "Lorsque le vieil homme apprend que vous cherchez le trésor"
const SECTION_CHOICES = {
  66: "Sourire et remercier le vieil homme",
  111: "rester et essayer d'amadouer le vieil homme"
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

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
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  navigationTests(test, SECTION_CHOICES)
})
