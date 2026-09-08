import { test, expect } from '@playwright/test'
import { testSection, testMort, screenshotOnFailure, gotoWithParams } from '../../helpers/commonTests'
import { combatStart, combatRound, combatResultat } from '../../helpers/combatTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 338
const SECTION_TEXT = "Vous approchez prudemment de la statue"

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
    await gotoWithParams(page, {habilete: '50', monstre_endurance: '1', lance_de: '1'})

    await combatStart(page)
    await combatRound(page)
    await combatResultat(page)

    await testSection(page, 75)
  })

  test('Combat perdu → écran défaite', async ({ page }) => {
    await gotoWithParams(page, {habilete: '1', endurance: '1', lance_de: '6'})

    await combatStart(page)
    await combatRound(page)
    await combatResultat(page)

    await testMort(page)
  })

  test('Fuite possible', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=1&endurance=100&lance_de=1`)
    await page.waitForSelector('.section-text')

    await combatStart(page)
    await combatRound(page)

    const fuiteBtn = page.locator('button.combat-fuite-direct-btn')
    await expect(fuiteBtn).toBeVisible()
    await fuiteBtn.click()
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await testSection(page, 93)
  })
})
