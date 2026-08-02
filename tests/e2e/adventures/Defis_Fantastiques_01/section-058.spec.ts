import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testNavigation, testStat } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 58
const SECTION_TEXT = 'Vous rampez prudemment le long du couloir'
const SECTION_CHOICES_SANS_REPAS = {
  367: "Continuer"
}
const SECTION_CHOICES_AVEC_REPAS = {
  15: "Prendre un repas",
  367: "Continuer"
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== 'passed') {
      const screenshotPath = `test-results/${testInfo.title.replace(/\s+/g, '-')}-failed.png`
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

  test('Sans repas : bouton "Prendre un repas" désactivé', async ({ page }) => {
    // Sans item repas, le bouton doit être présent mais désactivé
    const btn = page.locator('.choices-list button:has-text("Prendre un repas")')
    await expect(btn).toBeDisabled()
  })

  test('Sans repas : navigation vers section 367', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES_SANS_REPAS, 0)
  })

  test('Avec repas : bouton "Prendre un repas" activé', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=repas&item_count=1`)
    await page.waitForSelector('.section-text')

    const btn = page.locator('.choices-list button:has-text("Prendre un repas")')
    await expect(btn).toBeEnabled()
  })

  test('Avec repas : navigation vers section 15 avec gain de stats', async ({ page }) => {
    // endurance=10, habilete=10, ignore_stat_limit=1 → après section 15 : endurance=12, habilete=11
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=repas&item_count=1&endurance=10&habilete=10&ignore_stat_limit=1`)
    await page.waitForSelector('.section-text')

    await page.click('.choices-list button:has-text("Prendre un repas")')
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await testSection(page, 15)

    await testStat(page, "endurance", 12)
    await testStat(page, "habilete", 11)
  })
})
