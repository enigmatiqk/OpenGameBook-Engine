import { test } from '@playwright/test'
import { testSection, screenshotOnFailure, gotoWithParams, testStat, testMort } from '../../helpers/commonTests'
import { combatStart, combatRound, combatResultat, combatRoundSuivant } from '../../helpers/combatTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 350
const SECTION_TEXT = "La « turbulence » vous entoure"

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    await screenshotOnFailure(page, testInfo, SECTION_NUMBER)
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=2&ignore_stat_limit`)
    await page.waitForSelector('.section-text')
  })

  test('Section et texte', async ({ page }) => {
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('crocodile blessé - combat victoire', async ({ page }) => {
    await gotoWithParams(page, {monstre_data: 'crocodile:5:5:10', habilete: '50'})

    await combatStart(page)
    await combatRound(page)
    await combatResultat(page)

    await testSection(page, 7)
    await testStat(page, "chance", 11)
  })

  test('crocodile intact - lance dé reussi - combat victoire', async ({ page }) => {
    await gotoWithParams(page, {lance_de: '4', habilete: '50'})
    
    await combatStart(page)
    await page.waitForSelector('.combat-modifier-roll', { timeout: 5000 })
    await page.click(".combat-roll-btn")
    await page.waitForSelector('.combat-modifier-roll', { state: 'hidden', timeout: 5000 })
    await combatRound(page)
    await combatResultat(page)

    await testSection(page, 7)
    await testStat(page, "chance", 11)
  })

  test('crocodile intact - lance dé echoue - combat victoire', async ({ page }) => {
    await gotoWithParams(page, {lance_de: '1', habilete: '50'})

    await combatStart(page)
    await page.waitForSelector('.combat-modifier-roll', { timeout: 5000 })
    await page.click(".combat-roll-btn")
    await page.waitForSelector('.combat-modifier-roll', { state: 'hidden', timeout: 5000 })
    await combatRound(page)

    await combatRoundSuivant(page)
    await combatRound(page)

    await combatRoundSuivant(page)
    await combatRound(page)

    await combatResultat(page)

    await testSection(page, 7)
    await testStat(page, "chance", 11)

  })

  test('crocodile blessé - combat defaite', async ({ page }) => {
    await gotoWithParams(page, {monstre_data: 'crocodile:5:5:10', habilete: '1'})

    await combatStart(page)
    await combatRound(page)
    await combatResultat(page)

    await testMort(page)
  })

  test('crocodile intact - lance dé reussi - combat defaite', async ({ page }) => {
    await gotoWithParams(page, {lance_de: '4', habilete: '1'})

    await combatStart(page)
    await page.waitForSelector('.combat-modifier-roll', { timeout: 5000 })
    await page.click(".combat-roll-btn")
    await page.waitForSelector('.combat-modifier-roll', { state: 'hidden', timeout: 5000 })
    await combatRound(page)
    await combatResultat(page)

    await testMort(page)
  })

  test('crocodile intact - lance dé echoue - combat defaite', async ({ page }) => {
    await gotoWithParams(page, {lance_de: '1', habilete: '1'})

    await combatStart(page)
    await page.waitForSelector('.combat-modifier-roll', { timeout: 5000 })
    await page.click(".combat-roll-btn")
    await page.waitForSelector('.combat-modifier-roll', { state: 'hidden', timeout: 5000 })
    await combatRound(page)
    await combatResultat(page)

    await testMort(page)
  })
})
