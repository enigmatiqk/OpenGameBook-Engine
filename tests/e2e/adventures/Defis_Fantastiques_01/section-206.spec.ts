import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testNavigation, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 206
const SECTION_TEXT = "Vous entrez dans une grande pièce carrée"
const SECTION_CHOICES = {
  284: "Je connais cette grande pièce carré",
  341: "Je découvre cette grande pièce carré"
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

  test('navigation section connue', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&sn4=206`)
    await page.waitForSelector('.section-text')

    const btn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[341]}")`)
    await expect(btn).toBeDisabled()

    await testNavigation(page, SECTION_CHOICES, 0)
  })

  test('navigation section inconnue', async ({ page }) => {
    const btn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[284]}")`)
    await expect(btn).toBeDisabled()

    await testNavigation(page, SECTION_CHOICES, 1)
  })
})