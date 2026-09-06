import { expect, test } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, testNavigation, gotoWithParams } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 340
const SECTION_TEXT = "Vous tentez de lutter contre le regard du tableau"
const SECTION_CHOICES = {
  31: "Brandir l'OEil du Cyclope devant le portrait",
  45: "Lui jeter un morceau de Fromage",
  241: "Le transpercer à l'aide d'un épieu",
  388: "Lacérer la toile du tableau avec votre épée"
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

  test('Navigation de base', async ({ page }) => {
    const button_oeil = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[31]}")`)
    const button_epieu = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[241]}")`)
    const button_fromage = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[45]}")`)

    await expect(button_oeil).toBeDisabled()
    await expect(button_epieu).toBeDisabled()
    await expect(button_fromage).toBeDisabled()

    await testNavigation(page, SECTION_CHOICES,3)
  })

  test('Navigation avec oeil', async ({ page }) => {
    await gotoWithParams(page, {item_id: 'oeil-cyclope'})

    const button_oeil = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[31]}")`)
    const button_epieu = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[241]}")`)
    const button_fromage = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[45]}")`)

    await expect(button_oeil).toBeEnabled()
    await expect(button_epieu).toBeDisabled()
    await expect(button_fromage).toBeDisabled()

    await testNavigation(page, SECTION_CHOICES,0)
  })

  test('Navigation avec epieu', async ({ page }) => {
    await gotoWithParams(page, {item_id: 'epieu'})

    const button_oeil = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[31]}")`)
    const button_epieu = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[241]}")`)
    const button_fromage = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[45]}")`)

    await expect(button_oeil).toBeDisabled()
    await expect(button_epieu).toBeEnabled()
    await expect(button_fromage).toBeDisabled()

    await testNavigation(page, SECTION_CHOICES,2)
  })

  test('Navigation avec fromage', async ({ page }) => {
    await gotoWithParams(page, {item_id: 'fromage'})

    const button_oeil = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[31]}")`)
    const button_epieu = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[241]}")`)
    const button_fromage = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[45]}")`)

    await expect(button_oeil).toBeDisabled()
    await expect(button_epieu).toBeDisabled()
    await expect(button_fromage).toBeEnabled()

    await testNavigation(page, SECTION_CHOICES,1)
  })
})
