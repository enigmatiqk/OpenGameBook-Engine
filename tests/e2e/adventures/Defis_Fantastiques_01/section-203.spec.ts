import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, screenshotOnFailure, testItem, testStat, testNavigation } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 203
const SECTION_TEXT = "Prenez 1 point de CHANCE pour avoir vaincu le Loup-Garou"
const SECTION_CHOICES = {
  0: "Prendre un repas",
  1: "prendre les clefs",
  38: "Ouvrir la porte à l'ouest",
  66: "Ouvrir la porte au sud"
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

  test('gain de chance', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&chance=10&ignore_stat_limit`)
    await page.waitForSelector('.section-text')

    await testStat(page, "chance", 11)
  })

  test('Repas pris', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=10&item_id=repas&item_count=2&ignore_stat_limit`)
    await page.waitForSelector('.section-text')

    //clic sur choix repas
    const btn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await btn.click()
    
    await testStat(page, "endurance", 14)
    await testItem(page, "repas", 1)

    //vérifier qu'une seule utilisation
    await expect(btn).toBeDisabled()
  })

  test('Récupérer la clef', async ({ page }) => {
    const btn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[1]}")`)
    await btn.click()

    await testItem(page, "trousseau-hangar-bateau", 1)

    //vérifier qu'une seule utilisation
    await expect(btn).toBeDisabled()
  })

  test('Navigation vers 38', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 2)
  })

  test('Navigation vers 66', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 3)
  })
})