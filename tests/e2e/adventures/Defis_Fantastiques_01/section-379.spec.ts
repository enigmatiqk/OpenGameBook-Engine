import { test } from '@playwright/test'
import { testSection, testChoiceButtons, tenterChance, screenshotOnFailure, gotoWithParams, testStat, testMort, testEquipement } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 379
const SECTION_TEXT = "Tandis que vous vous préparez à abattre votre épée sur le coffre"
const SECTION_CHOICES = {
  139: "Tentez votre Chance"
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    await screenshotOnFailure(page, testInfo, SECTION_NUMBER)
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&chance=10`)
    await page.waitForSelector('.section-text')
  })

  test('Section et texte', async ({ page }) => {
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  test('chanceux avec epee', async ({ page }) => {
    await gotoWithParams(page, {lance_de: '1', equip: 'arme_1main_epee'})

    await tenterChance(page, SECTION_CHOICES[139])

    await testEquipement(page, "epee", false)
    await testStat(page, "chance", 9)
  })

  test('chanceux avec epee bidon', async ({ page }) => {
    await gotoWithParams(page, {lance_de: '1', equip: 'arme_1main_epee_bidon'})

    await tenterChance(page, SECTION_CHOICES[139])

    await testEquipement(page, "epee-bidon", false)
    await testStat(page, "chance", 9)
  })

  test('malchanceux', async ({ page }) => {
    await gotoWithParams(page, {lance_de: '6'})

    await tenterChance(page, SECTION_CHOICES[139])
    
    await testMort(page)
  })
})
