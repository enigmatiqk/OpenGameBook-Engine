import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testNavigation, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 3
const SECTION_NUMBER = 12
const SECTION_TEXT = 'Au moment où vous tirez la poignée'
const SECTION_CHOICES = {
  161: 'Livrer le combat',
  256: 'Retourner à la bifurcation',
  364: 'Pousser la poignée'
}

test.describe('Section 012', () => {

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

  test('1ere visite', async ({ page }) => {
    const ButtonA = page.locator(`button:has-text("${SECTION_CHOICES[161]}")`)
    await expect(ButtonA).toBeEnabled()

    const ButtonB = page.locator(`button:has-text("${SECTION_CHOICES[256]}")`)
    await expect(ButtonB).toBeDisabled()

    const ButtonC = page.locator(`button:has-text("${SECTION_CHOICES[364]}")`)
    await expect(ButtonC).toBeDisabled()
  })

  test('Retour', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&sn2=${SECTION_NUMBER}`)
    await page.waitForSelector('.section-text')
    
    const ButtonA = page.locator(`button:has-text("${SECTION_CHOICES[161]}")`)
    await expect(ButtonA).toBeDisabled()

    const ButtonB = page.locator(`button:has-text("${SECTION_CHOICES[256]}")`)
    await expect(ButtonB).toBeEnabled()

    const ButtonC = page.locator(`button:has-text("${SECTION_CHOICES[364]}")`)
    await expect(ButtonC).toBeEnabled()
  })

  test('Navigation vers section 161', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 0)
  })
  test('Navigation vers section 256', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 1, `sn2=${SECTION_NUMBER}`)
  })
  test('Navigation vers section 364', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 2, `sn2=${SECTION_NUMBER}`)
  })
})