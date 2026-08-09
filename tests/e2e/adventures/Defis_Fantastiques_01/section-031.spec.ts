import { test, expect } from '@playwright/test'
import { testSectionAndText, testChoiceButtons, testNavigation, testCombatStart, testCombatRound, testRoundSuivant } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 31
const SECTION_TEXT = "Si vous êtes en possession de la pierre précieuse"
const SECTION_CHOICES = {
  90: 'Sortir par la porte nord'
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

  test('gain d\'habileté avec pierre précieuse', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=10&ignore_stat_limit&item_id=pierre_oeil_cyclope&item_count=1`)
    await page.waitForSelector('.section-text')

    const habileValue = await page.locator('#stat-habilete').textContent()
    expect(habileValue).toBe('12')
  })

  test('pas de gain d\'habileté sans pierre précieuse', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=10&ignore_stat_limit&item_id=pierre_oeil_cyclope&item_count=0`)
    await page.waitForSelector('.section-text')

    const habileValue = await page.locator('#stat-habilete').textContent()
    expect(habileValue).toBe('10')
  })

  test('Naviguer vers section 90', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 0)
  })

})
