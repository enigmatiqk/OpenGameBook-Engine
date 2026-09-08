import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, screenshotOnFailure, navigationTests, testEquipement, testStat, gotoWithParams, showFicheHero } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 202
const SECTION_TEXT = "Vous mettez le casque sur votre tête"
const SECTION_CHOICES = {
  87: "revenir sur mes pas"
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

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  navigationTests(test, SECTION_CHOICES)

  test('casque maudit - perte habileté', async ({ page }) => {
    await testStat(page, "habilete", 9)
    await testEquipement(page, "casque-bronze")
  })

  test('casque maudit - ne peut être retiré', async ({ page }) => {
    await gotoWithParams(page, {equip: 'arme_1main_test', equipement_dropable:''})

    //fiche hero
    await showFicheHero(page)

    //item de test dropable
    const item_test = page.locator('.equipment-slot-rpg')
      .filter({ has: page.locator('.slot-item#test') })

    await expect(item_test.locator('.btn-unequip-modal')).toBeVisible()
    await expect(item_test.locator('.btn-drop-equip-modal')).toBeVisible()

    //item de non dropable
    const item_drop = page.locator('.equipment-slot-rpg')
      .filter({ has: page.locator('.slot-item#casque-bronze') })

    await expect(item_drop.locator('.btn-unequip-modal')).toBeHidden()
    await expect(item_drop.locator('.btn-drop-equip-modal')).toBeHidden()
  })
})