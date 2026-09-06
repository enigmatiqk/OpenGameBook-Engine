import { test } from '@playwright/test'
import { testSection, testMort, screenshotOnFailure, testCombatStart, testCombatRound, CombatResultat,  testStat } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 304
const SECTION_TEXT = "Le vieil homme est furieux que vous ayez tué son chien"
const SECTION_CHOICES = {
  66: "Fuir par la porte derrière moi"
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

  test('Fuite avant combat', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=10`)
    await page.waitForSelector('.section-text')

    const button = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[66]}")`)
    await button.click()

    await testSection(page, 66)
    await testStat(page, "endurance",8)
  })

  test('victoire', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&monstre_endurance=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await testCombatRound(page)

    await CombatResultat(page)

    await testSection(page, 203)
  })

  test('defaite', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=1&endurance=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await testCombatRound(page)

    await CombatResultat(page)

    await testMort(page)
  })
})
