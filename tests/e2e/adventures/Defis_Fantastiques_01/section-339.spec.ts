import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, gotoWithParams, testMort } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 339
const SECTION_TEXT = "A l'évidence, la serrure n'est guère solide"
const SECTION_CHOICES = {
  0: "Lancer le dé",
  201: "Continuer"
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

  // navigationTests(test, SECTION_CHOICES)

  test('Lancer le dé et mourrir', async ({ page }) => {
    await gotoWithParams(page, {endurance: '2', lance_de: '2'})

    const button_de = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)

    await button_de.click()
    await page.waitForSelector('.modal-box', { timeout: 10000 })
    await page.click(".action-roll-btn")
    await page.waitForSelector('.modal-box', { state: 'hidden', timeout: 10000 }),

    await testMort(page)
  })

  test('Lancer le dé pour naviguer', async ({ page }) => {
    const button_de = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    const button_navigation = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[201]}")`)

    await expect(button_de).toBeEnabled()
    await expect(button_navigation).toBeDisabled()

    await button_de.click()

    await page.waitForSelector('.modal-box', { timeout: 10000 })
    await page.click(".action-roll-btn")

    await page.waitForSelector('.modal-box', { state: 'hidden', timeout: 10000 }),
    await expect(button_de).toBeDisabled()
    await expect(button_navigation).toBeEnabled()
    await button_navigation.click()

    await testSection(page, 201)

  })
})
