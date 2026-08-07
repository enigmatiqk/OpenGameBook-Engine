import { test } from '@playwright/test'
import { testSection, testChoiceButtons, testNavigation } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 138
const SECTION_TEXT = 'Le passage s\'élargit'
const SECTION_CHOICES = {
  163: 'Affronter cette brute',
  351: 'Revenir à la bifurcation'
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

  test('Navigation vers section 163', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 0)
  })

  test('Navigation vers section 351', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 1)
  })
})
