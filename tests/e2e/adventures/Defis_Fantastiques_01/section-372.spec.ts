import { test } from '@playwright/test'
import { testSection, testMort, screenshotOnFailure, gotoWithParams } from '../../helpers/commonTests'

import { combatMonstreSuivant, combatResultat, combatRound, combatStart, combatFuiteDirecte } from '../../helpers/combatTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 372
const SECTION_TEXT = "Le combat s'engage"

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
    await gotoWithParams(page, {habilete: '50', monstre_endurance: '1'})

    await combatStart(page)
    //#1
    await combatRound(page)

    //#2
    await combatMonstreSuivant(page)
    await combatRound(page)

    await combatResultat(page)

    await testSection(page, 21)
  })

  test('Combat mort', async ({ page }) => {
    await gotoWithParams(page, {habilete: '1', endurance: '1'})

    await combatStart(page)
    //#1
    await combatRound(page)

    await combatResultat(page)

    await testMort(page)
  })

})
