import { test, expect } from '@playwright/test'
import { testSectionAndText, testChoiceButtons } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 53
const SECTION_TEXT = "Vous essayez d'enfoncer la porte"
const SECTION_CHOICES = {
  155: "Enfoncer la porte"
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
    await testSectionAndText(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Bouton de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  test('Si réussi - section 155', async ({ page }) => {
    // habilete=10, lance_de=4 → total dés = 8 ≤ 10 → succès → section 155
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&ignore_stat_limit=1&habilete=10&lance_de=4`)
    await page.waitForSelector('.section-text')

    await page.click('.choices-list button:has-text("Enfoncer la porte")')
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await page.click('.action-roll-btn') // lancer dé

    const sectionContent = page.locator('[data-section="155"]')
    await expect(sectionContent).toBeVisible()
  })

  test('Si échoué - section 300 avec -1 endurance', async ({ page }) => {
    // habilete=5, endurance=10, lance_de=4 → total dés = 8 > 5 → échec → section 300, endurance passe à 9
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&ignore_stat_limit=1&habilete=5&endurance=10&lance_de=4`)
    await page.waitForSelector('.section-text')

    await page.click('.choices-list button:has-text("Enfoncer la porte")')
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await page.click('.action-roll-btn') // lancer dé

    const sectionContent = page.locator('[data-section="300"]')
    await expect(sectionContent).toBeVisible()

    const enduranceValue = await page.locator('#stat-endurance').textContent()
    expect(enduranceValue).toBe('9')
  })
})
