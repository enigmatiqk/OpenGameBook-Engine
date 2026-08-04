import { test } from '@playwright/test'
import { testSection, testChoiceButtons, testNavigation, testItem } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 110
const SECTION_TEXT = "Vous êtes maintenant plus riche de 8 Pièces"
const SECTION_CHOICES = {
  319: 'Continuer'
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

  test('Navigation vers section 319 + pieces or', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=piece-or&item_count=2`)
    await page.waitForSelector('.section-text')

    await testNavigation(page, SECTION_CHOICES, 0)

    await testItem(page, "piece-or", 12)
  })

})
