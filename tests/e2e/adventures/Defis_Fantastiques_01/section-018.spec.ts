import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testStat, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 18
const SECTION_TEXT = "éboulement sous vos pieds"
const SECTION_CHOICES = {
  0: 'Tentez votre Chance',
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

  test('Tenter votre chance : réussite', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&chance=50`)
    await page.waitForSelector('.section-text')

    // Cliquer sur "Tentez votre Chance"
    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await page.waitForSelector('.action-roll-btn', { timeout: 5000 })

    //Lancer
    await page.click(`.action-roll-btn`)
    
    // Vérifier qu'on est à la section 261
    await testSection(page, 261)
  })

  test('Tenter votre chance : echec', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&chance=1&endurance=10`)
    await page.waitForSelector('.section-text')

    // Cliquer sur "Tentez votre Chance"
    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await page.waitForSelector('.action-roll-btn', { timeout: 5000 })

    //Lancer
    await page.click(`.action-roll-btn`)
    
    // Vérifier qu'on est à la section 348
    await testSection(page, 348)

    // Vérifier la perte d'endurance
    await testStat(page, "endurance", 9)
  })
})