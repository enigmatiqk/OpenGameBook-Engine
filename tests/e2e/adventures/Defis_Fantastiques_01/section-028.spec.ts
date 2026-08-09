import { test, expect } from '@playwright/test'
import { testSectionAndText, testChoiceButtons, testNavigation, testCombatStart, testCombatRound, testRoundSuivant } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 28
const SECTION_TEXT = "L'énorme Géant est étendu raide mort"
const SECTION_CHOICES = {
  351: 'Quitter la caverne'
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
    await testSectionAndText(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  test('gain d\'habileté', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=10&ignore_stat_limit`)
    await page.waitForSelector('.section-text')

    const habileValue = await page.locator('#stat-habilete').textContent()
    expect(habileValue).toBe('12')
  })

    test('Gain de chance', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&chance=10&ignore_stat_limit`)
    await page.waitForSelector('.section-text')

    const chanceValue = await page.locator('#stat-chance').textContent()
    expect(chanceValue).toBe('12')
  })

  test('Aller vers section 351', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 0)
  })
})
