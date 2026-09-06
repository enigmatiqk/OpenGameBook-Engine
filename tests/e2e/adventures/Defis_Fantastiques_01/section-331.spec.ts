import { test } from '@playwright/test'
import { testSection, testMort, screenshotOnFailure, testCombatStart, testCombatRound, CombatResultat,  gotoWithParams } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 331
const SECTION_TEXT = "La créature a la taille d'un homme"

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

    await testCombatStart(page)
    await testCombatRound(page)

    await CombatResultat(page)

    await testSection(page, 287)
  })

  test('defaite', async ({ page }) => {
    await gotoWithParams(page, {habilete: '1', endurance:'1'})

    await testCombatStart(page)
    await testCombatRound(page)

    await CombatResultat(page)

    await testMort(page)
  })
})
