import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 53
const SECTION_TEXT = "Vous essayez d'enfoncer la porte"
const SECTION_CHOICES = {
  155: "Enfoncer la porte"
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    await screenshotOnFailure(page, testInfo, SECTION_NUMBER)
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}`)
    await page.waitForSelector('.section-text')
  })

  test('Section et texte', async ({ page }) => {
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Bouton de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  test('Si réussi - section 155', async ({ page }) => {
    // habilete=10, lance_de=4 → total dés = 8 ≤ 10 → succès → section 155
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&ignore_stat_limit&habilete=10&lance_de=4`)
    await page.waitForSelector('.section-text')

    await page.click('.choices-list button:has-text("Enfoncer la porte")')
    await page.waitForSelector('.action-roll-btn', { timeout: 5000 })

    await page.click('.action-roll-btn') // lancer dé
    await page.waitForSelector('.action-roll-total', { timeout: 5000 })
    await page.waitForSelector('.action-roll-box', { state: 'detached', timeout: 5000 })
    
    await testSection(page, 155)
  })

  test('Si échoué - section 300 avec -1 endurance', async ({ page }) => {
    // habilete=5, endurance=10, lance_de=4 → total dés = 8 > 5 → échec → section 300, endurance passe à 9
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&ignore_stat_limit&habilete=5&endurance=10&lance_de=4`)
    await page.waitForSelector('.section-text')

    await page.click('.choices-list button:has-text("Enfoncer la porte")')
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await page.click('.action-roll-btn') // lancer dé

    await testSection(page, 300)

    const enduranceValue = await page.locator('#stat-endurance').textContent()
    expect(enduranceValue).toBe('9')
  })
})