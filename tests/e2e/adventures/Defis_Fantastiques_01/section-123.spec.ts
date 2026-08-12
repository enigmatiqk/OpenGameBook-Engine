import { test } from '@playwright/test'
import { testSection, testChoiceButtons, testStat, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 123
const SECTION_TEXT = "Vont-ils croire votre histoire d'achat de bateau"
const SECTION_CHOICES = {
  0: 'Lancer le dé'
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
    // dé=1 à 3
  test('lance de 1', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=1&chance=10&ignore_stat_limit`)
    await page.waitForSelector('.section-text')

    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await page.waitForSelector('.action-roll-btn', { timeout: 5000 })
    await page.click('.action-roll-btn')

    await testSection(page, 184)
    await testStat(page,"chance",12)
  })

  // dé=4 à 5
  test('lance de 4', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=4`)
    await page.waitForSelector('.section-text')

    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await page.waitForSelector('.action-roll-btn', { timeout: 5000 })
    await page.click('.action-roll-btn')

    await testSection(page, 164)
  })

  // dé=6
  test('lance de 6', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=6`)
    await page.waitForSelector('.section-text')

    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await page.waitForSelector('.action-roll-btn', { timeout: 5000 })
    await page.click('.action-roll-btn')

    await testSection(page, 140)
  })

})