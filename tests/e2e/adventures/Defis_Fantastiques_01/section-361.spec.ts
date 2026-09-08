import { test } from '@playwright/test'
import { testSection, testChoiceButtons, screenshotOnFailure, testItem, gotoWithParams, testStat } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 361
const SECTION_TEXT = "Vous décrochez la clé"
const SECTION_CHOICES = {
  136: "Enfoncer la porte"
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    await screenshotOnFailure(page, testInfo, SECTION_NUMBER)
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=10&habilete=10`)
    await page.waitForSelector('.section-text')
  })

  test('Section et texte', async ({ page }) => {
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  test('gain cle ', async ({ page }) => {
    await testItem(page, "cle-125")
  })

  test('Enfoncer porte reussie', async ({ page }) => {
    await gotoWithParams(page, {lance_de:'1'})

    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[136]}")`)
    await page.click(".action-roll-btn")

    await testSection(page, 136)
  })

  test('Enfoncer porte echoue', async ({ page }) => {
    await gotoWithParams(page, {lance_de:'6'})

    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[136]}")`)
    await page.click(".action-roll-btn")

    await page.waitForSelector('.modal-box', { state: 'hidden', timeout: 5000 })

    await testStat(page, "habilete", 8)
    await testStat(page, "endurance", 7)

    await testSection(page, 136)
  })
})
