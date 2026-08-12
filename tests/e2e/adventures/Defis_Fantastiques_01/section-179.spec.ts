import { test, expect } from '@playwright/test'
import { testSection, testCombatStart, testCombatRound, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 179
const SECTION_TEXT = "Vous venez d'entrer dans une grande pièce carrée"
// MINOTAURE persistant : HABILETÉ 9, ENDURANCE 9
// Fuite disponible au round 3 → section 54
// Victoire → section 258
// Si le monstre est déjà mort → section 54

const SECTION_CHOICES_MORT = {
  54: 'Le monstre est déjà mort'
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

  test('Combat gagné → section 258', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&monstre_endurance=1&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await testCombatRound(page)
    await page.click('button.combat-next-btn')

    await testSection(page, 258)
  })

  test('Combat perdu → écran défaite', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=1&endurance=1&lance_de=6`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await testCombatRound(page)
    await page.click('button.combat-next-btn')

    await page.waitForSelector('#view-defeat', { timeout: 5000 })
    await expect(page.locator('#view-defeat')).toBeVisible()
  })

  test('Fuite disponible au round 3 → section 54', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=1&endurance=100&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    // Round 1
    await testCombatRound(page)
    await page.click('button.combat-next-btn')
    // Round 2
    await testCombatRound(page)
    await page.click('button.combat-next-btn')
    // Round 3 : bouton de fuite disponible
    await testCombatRound(page)

    const fuiteBtn = page.locator('button.combat-fuite-direct-btn')
    await expect(fuiteBtn).toBeVisible()
    await fuiteBtn.click()
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await testSection(page, 54)
  })
})