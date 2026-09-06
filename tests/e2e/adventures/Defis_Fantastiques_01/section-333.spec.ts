import { test, expect } from '@playwright/test'
import { testSection, screenshotOnFailure, gotoWithParams, testMort } from '../../helpers/commonTests'
import { combatStart, combatRound, combatResultat, combatRoundSuivant } from '../../helpers/combatTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 333
const SECTION_TEXT = "Vous brandissez votre épée en direction de la créature"

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

  test('victoire', async ({ page }) => {
    await gotoWithParams(page, {habilete: '50', monstre_endurance:'1'})

    await combatStart(page)
    await combatRound(page)

    await combatResultat(page)

    await testSection(page, 327)
  })

  test('defaite', async ({ page }) => {
    await gotoWithParams(page, {habilete: '1', endurance:'1'})

    await combatStart(page)
    await combatRound(page)

    await combatResultat(page)

    await testMort(page)
  })

  test('Fuite tout les 6 rounds', async ({ page }) => {
    test.setTimeout(120_000)
    await gotoWithParams(page, {endurance: '80', monstre_endurance:'80'})

    //#1
    await combatStart(page)
    await combatRound(page)
    await expect(page.locator('.combat-fuite-chance-btn')).toHaveCount(0)
    test.info().annotations.push({ type: 'log', description: 'fin round 1' })


    //#2
    await combatRoundSuivant(page)
    await combatRound(page)
    await expect(page.locator('.combat-fuite-chance-btn')).toHaveCount(0)
test.info().annotations.push({ type: 'log', description: 'fin round 2' })

    //#3
    await combatRoundSuivant(page)
    await combatRound(page)
    await expect(page.locator('.combat-fuite-chance-btn')).toHaveCount(0)
    test.info().annotations.push({ type: 'log', description: 'fin round 3' })

    //#4
    await combatRoundSuivant(page)
    await combatRound(page)
    await expect(page.locator('.combat-fuite-chance-btn')).toHaveCount(0)
    test.info().annotations.push({ type: 'log', description: 'fin round 4' })

    //#5
    await combatRoundSuivant(page)
    await combatRound(page)
    await expect(page.locator('.combat-fuite-chance-btn')).toHaveCount(0)
    test.info().annotations.push({ type: 'log', description: 'fin round 5' })

    //#6
    await combatRoundSuivant(page)
    await combatRound(page)
    await expect(page.locator('.combat-fuite-chance-btn')).toHaveCount(1)
    test.info().annotations.push({ type: 'log', description: 'fin round 6' })

    //#7
    await combatRoundSuivant(page)
    await combatRound(page)
    await expect(page.locator('.combat-fuite-chance-btn')).toHaveCount(0)
    test.info().annotations.push({ type: 'log', description: 'fin round 7' })

    //#8
    await combatRoundSuivant(page)
    await combatRound(page)
    await expect(page.locator('.combat-fuite-chance-btn')).toHaveCount(0)
    test.info().annotations.push({ type: 'log', description: 'fin round 8' })

    //#9
    await combatRoundSuivant(page)
    await combatRound(page)
    await expect(page.locator('.combat-fuite-chance-btn')).toHaveCount(0)
    test.info().annotations.push({ type: 'log', description: 'fin round 9' })

    //#10
    await combatRoundSuivant(page)
    await combatRound(page)
    await expect(page.locator('.combat-fuite-chance-btn')).toHaveCount(0)
    test.info().annotations.push({ type: 'log', description: 'fin round 10' })

    //#11
    await combatRoundSuivant(page)
    await combatRound(page)
    await expect(page.locator('.combat-fuite-chance-btn')).toHaveCount(0)
    test.info().annotations.push({ type: 'log', description: 'fin round 11' })

    //#12
    await combatRoundSuivant(page)
    await combatRound(page)
    await expect(page.locator('.combat-fuite-chance-btn')).toHaveCount(1)
    test.info().annotations.push({ type: 'log', description: 'fin round 12' })

    //#13
    await combatRoundSuivant(page)
    await combatRound(page)
    await expect(page.locator('.combat-fuite-chance-btn')).toHaveCount(0)
    test.info().annotations.push({ type: 'log', description: 'fin round 13' })
  })

  test('Fuite réussie', async ({ page }) => {
    await gotoWithParams(page, {endurance: '50', habilete: '50', monstre_endurance:'999', lance_de: '1'})

    //#1
    await combatStart(page)
    await combatRound(page)
    //#2
    await combatRoundSuivant(page)
    await combatRound(page)
    //#3
    await combatRoundSuivant(page)
    await combatRound(page)
    //#4
    await combatRoundSuivant(page)
    await combatRound(page)
    //#5
    await combatRoundSuivant(page)
    await combatRound(page)
    //#6
    await combatRoundSuivant(page)
    await combatRound(page)

    const button_fuite_chance = page.locator('.combat-fuite-chance-btn')
    await button_fuite_chance.click()

    await testSection(page, 380)
  })

  test('Fuite echoue', async ({ page }) => {
    await gotoWithParams(page, {endurance: '50', habilete: '50', monstre_endurance:'999', chance: '5', lance_de: '3'})

    //#1
    await combatStart(page)
    await combatRound(page)
    //#2
    await combatRoundSuivant(page)
    await combatRound(page)
    //#3
    await combatRoundSuivant(page)
    await combatRound(page)
    //#4
    await combatRoundSuivant(page)
    await combatRound(page)
    //#5
    await combatRoundSuivant(page)
    await combatRound(page)
    //#6
    await combatRoundSuivant(page)
    await combatRound(page)

    const button_fuite_chance = page.locator('.combat-fuite-chance-btn')
    await button_fuite_chance.click()

    //TODO comment detecter fuite chance echoue

  })

  test('Fuite echec critique', async ({ page }) => {
    await gotoWithParams(page, {endurance: '50', habilete: '50', monstre_endurance:'999', lance_de: '6'})

    //#1
    await combatStart(page)
    await combatRound(page)
    //#2
    await combatRoundSuivant(page)
    await combatRound(page)
    //#3
    await combatRoundSuivant(page)
    await combatRound(page)
    //#4
    await combatRoundSuivant(page)
    await combatRound(page)
    //#5
    await combatRoundSuivant(page)
    await combatRound(page)
    //#6
    await combatRoundSuivant(page)
    await combatRound(page)

    const button_fuite_chance = page.locator('.combat-fuite-chance-btn')
    await button_fuite_chance.click()

    await testSection(page, 224)
  })
})
