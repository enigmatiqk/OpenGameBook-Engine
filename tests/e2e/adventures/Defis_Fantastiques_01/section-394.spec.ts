import { test, expect } from '@playwright/test'
import { testSection, screenshotOnFailure, gotoWithParams, testMort } from '../../helpers/commonTests'
import { combatResultat, combatRound, combatStart } from '../../helpers/combatTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 394
const SECTION_TEXT = "Les bottes sont élégantes"

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

  test('bottes -2 attaque heros', async ({ page }) => {
    // Force habilete=10, dés héros [6,6] → FA sans malus = 22, avec -2 = 20
    await gotoWithParams(page, { habilete: '10', lance_de_pile: '1,1,6,6' })

    await combatStart(page)
    await combatRound(page)

    // La ligne héros doit afficher le bonus -2 et une FA de 20
    const heroLine = page.locator('.round-roll--heros').first()
    await expect(heroLine).toContainText('-2')
    await expect(heroLine).toContainText('→ 20')
  })

  test('Combat victoire', async ({ page }) => {
    await gotoWithParams(page, {habilete: '50', monstre_endurance: '1'})
    
    await combatStart(page)
    await combatRound(page)

    await combatResultat(page)

    await testSection(page, 232)
  })

  test('Combat defaite mort', async ({ page }) => {
    await gotoWithParams(page, {habilete: '2', endurance: '1'})
    
    await combatStart(page)
    await combatRound(page)

    await combatResultat(page)

    await testMort(page)
  })

})
