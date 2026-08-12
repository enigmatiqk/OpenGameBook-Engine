import { test, expect } from '@playwright/test'
import { testSection, testCombatStart, testCombatRound, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 199
const SECTION_TEXT = "Le passage s'élargit devant vous"
// Phase 1 : HOMME DES CAVERNES HABILETÉ 7, ENDURANCE 6
// Phase 2 : HOMME DES CAVERNES HABILETÉ 6, ENDURANCE 4
// Victoire → section 283

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

  test('Combat gagné (2 phases) → section 283', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&monstre_endurance=1&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    // Phase 1 : 1er Homme des Cavernes
    await testCombatRound(page)
    await page.click('button.combat-next-btn')
    // Phase 2 : 2e Homme des Cavernes
    await testCombatRound(page)
    await page.click('button.combat-next-btn')

    await testSection(page, 283)
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

  test('Passage automatique au 2e combattant après victoire sur le 1er', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&monstre_endurance=1&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    // Tuer le 1er
    await testCombatRound(page)
    await page.click('button.combat-next-btn')

    // Le titre doit mentionner le 2e HOMME DES CAVERNES
    await page.waitForSelector('.combat-title', { timeout: 5000 })
    const combatTitle = page.locator('.combat-title')
    await expect(combatTitle).toContainText('CAVERNES')
  })
})