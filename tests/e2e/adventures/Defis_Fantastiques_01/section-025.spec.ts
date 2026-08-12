import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testNavigation, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 25
const SECTION_TEXT = "Les peintures sont des portraits d'homme"
const SECTION_CHOICES = {
  90: 'Fuir par la porte nord',
  340: 'Combattre le pouvoir du Sorcier'
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

  test('perte habileté à l\'arrivée sur la section', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=10`)
    await page.waitForSelector('.section-text')

    const habileValue = await page.locator('#stat-habilete').textContent()
    expect(habileValue).toBe('9')
  })

  test('fuite avec perte endurance vers section 90', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=10&endurance=10`)
    await page.waitForSelector('.section-text')

    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[90]}")`)
    await testSection(page, 90)

    // -2 endurance à la fuite
    const enduranceValue = await page.locator('#stat-endurance').textContent()
    expect(enduranceValue).toBe('8')
  })

  test('combattre le pouvoir du Sorcier vers section 340', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 1)
  })
})