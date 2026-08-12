import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testCombatStart, testCombatRound, testRoundSuivant, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 61
const SECTION_TEXT = "En examinant la caverne"
const SECTION_CHOICES = {
  0: 'Combattre ARAIGNÉE GÉANTE',
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

  test('Combat victoire', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&monstre_endurance=1&habilete=50&lance_de=1`)
    await page.waitForSelector('.section-text')

    // Lancer le combat
    await testCombatStart(page)
    // round 1
    await testCombatRound(page)

    await page.click('button.combat-next-btn')

    // Victoire → section 29
    await page.waitForSelector('[data-section="29"]', { timeout: 5000 })
    await expect(page.locator('[data-section="29"]')).toBeVisible()
  })

  test('Combat affichage bouton fuite', async ({ page }) => {
      // Charger avec habilete élevée et dés favorables
      await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=100&habilete=1&lance_de=1`)
      await page.waitForSelector('.section-text')
      
      // Lancer le combat
      await testCombatStart(page)
      // round 1
      await testCombatRound(page)
      await testRoundSuivant(page)
      await expect(page.locator('button.combat-fuite-direct-btn')).toHaveCount(0)
      await expect(page.locator('button.combat-fuite-chance-btn')).toHaveCount(0)

      // round 2
      await testCombatRound(page)

      await expect(page.locator('button.combat-fuite-direct-btn')).toBeVisible()
      await expect(page.locator('button.combat-fuite-chance-btn')).toBeVisible()
  })

    test('Combat fuite', async ({ page }) => {
      // Charger avec habilete élevée et dés favorables
      await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=100&habilete=1&lance_de=1`)
      await page.waitForSelector('.section-text')
      
      // Lancer le combat
      await testCombatStart(page)
      // round 1
      await testCombatRound(page)
      await testRoundSuivant(page)

      // round 2
      await testCombatRound(page)

      //fuite
      await page.click('button.combat-fuite-direct-btn')
      await testSection(page,375)
  })

})