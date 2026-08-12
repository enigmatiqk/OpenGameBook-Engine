import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testStat, tenterChance, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 125
const SECTION_TEXT = 'Tentez votre Chance'
const SECTION_CHOICES = {
  0:  'Tentez votre Chance',
  73: 'Aller au nord'
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

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  test("la navigation est désactivée à l'arrivée", async ({ page }) => {
    await expect(page.locator(`.choices-list button:has-text("${SECTION_CHOICES[73]}")`)).toBeDisabled()
  })

  test('Réussite', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=1&chance=5`)
    await page.waitForSelector('.section-text')

    await tenterChance(page, SECTION_CHOICES[0])

    await expect(page.locator(`.choices-list button:has-text("${SECTION_CHOICES[73]}")`)).toBeEnabled()
    await testStat(page, 'chance', 4)
    
    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[73]}")`)
    await testSection(page,73)
  })


  test('Echec', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=3&chance=2&lance_de=6`)
    await page.waitForSelector('.section-text')

    await tenterChance(page, SECTION_CHOICES[0])

    await testStat(page, 'endurance', 2)
    await testStat(page, 'chance', 1)

    await expect(page.locator(`.choices-list button:has-text("${SECTION_CHOICES[73]}")`)).toBeDisabled()

    await tenterChance(page, SECTION_CHOICES[0])
    await tenterChance(page, SECTION_CHOICES[0])

    await page.waitForSelector('#view-defeat.active', { timeout: 8000 })
    await expect(page.locator('#view-defeat')).toHaveClass(/active/)
  })

})