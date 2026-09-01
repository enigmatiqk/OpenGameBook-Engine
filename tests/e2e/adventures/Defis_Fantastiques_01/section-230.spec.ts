import { test, expect } from '@playwright/test'
import { testSection, testCombatStart, testCombatRound, screenshotOnFailure, testRoundSuivant } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 230
const SECTION_TEXT = "La créature qui vous fait face"

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

  test('Combat gagné', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&monstre_endurance=1&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await testCombatRound(page)
    await page.click('button.combat-next-btn')

    await testSection(page, 390)
  })

  test('Combat perdu : changement de section', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=1&endurance=1&lance_de=6`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await testCombatRound(page)
    await page.click('button.combat-next-btn')

    await testSection(page, 64)
  })

  test('event 4 rounds dégats heros', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=1&endurance=100&lance_de=6`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await testCombatRound(page)

    await testRoundSuivant(page)
    await testCombatRound(page)

    await testRoundSuivant(page)
    await testCombatRound(page)

    await testRoundSuivant(page)
    await testCombatRound(page)

    await testRoundSuivant(page)
    
    await testSection(page, 64)
  })
})