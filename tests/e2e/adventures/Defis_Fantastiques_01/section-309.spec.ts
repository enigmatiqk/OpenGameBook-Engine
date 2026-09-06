import { test } from '@playwright/test'
import { testSection, testMort, screenshotOnFailure, testCombatStart, testStat, CombatMonstreSuivant, testCombatRound, CombatResultat } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 309
const SECTION_TEXT = "Vous tirez votre épée et vous attendez l'assaut des RATS"

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

  test('Combat victoire', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&monstre_endurance=1`)
    await page.waitForSelector('.section-text')


    await testCombatStart(page)

    // #1
    await testCombatRound(page)
    await CombatMonstreSuivant(page)
    // #2
    await testCombatRound(page)
    await CombatMonstreSuivant(page)
    // #3
    await testCombatRound(page)

    await CombatResultat(page)

    await testSection(page,124)
  })

  test('Combat defaite et mort', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=1&endurance=1`)
    await page.waitForSelector('.section-text')
    // await page.click(".choice-btn--combat")

    // #1
    await testCombatStart(page)
    await testCombatRound(page)

    await CombatResultat(page)
    await testMort(page)
  })
})
