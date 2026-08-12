import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testCombatStart, testCombatRound, testRoundSuivant, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 19
const SECTION_TEXT = "Ces deux créatures malfaisantes sont des LUTINS"
const SECTION_CHOICES = {
  0: 'Combattre (2 combats)',
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

  test('Combat sequentiel', async ({ page }) => {
      // Charger avec habilete élevée et dés favorables
      await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&lance_de=1`)
      await page.waitForSelector('.section-text')
      
      // Lancer le combat
      await testCombatStart(page)
      // round 1
      await testCombatRound(page)
      await testRoundSuivant(page)
      // round 2
      await testCombatRound(page)
      await testRoundSuivant(page)
      // round 3
      await testCombatRound(page)
      //résultat
      await page.click('button.combat-next-btn')
      await page.waitForSelector('.combat-title', { timeout: 5000 })
        
      const combatTitle = page.locator('.combat-title')
      await expect(combatTitle).toContainText("Deuxieme LUTIN")
  })

  test('Combat sequentiel victoire', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&monstre_endurance=1&habilete=50&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    // Lutin 1 : habilete=5 endurance=5, avec habilete=50 et dés=1 on gagne en 1 round
    await testCombatRound(page)
    await page.click('button.combat-next-btn')
    // Passage automatique au Lutin 2
    // await page.waitForSelector('.combat-title', { timeout: 5000 })

    // Lutin 2 : habilete=5 endurance=6
    await testCombatRound(page)
    await page.click('button.combat-next-btn')

    // Victoire → section 317
    await testSection(page, 317)
  })

  test('Combat sequentiel fuite', async ({ page }) => {
    // La section 19 n'a pas de fuite définie → on vérifie que le bouton fuite est absent
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=10&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await testCombatRound(page)

    const fuiteBtn = page.locator('button.combat-fuite-direct-btn')
    await expect(fuiteBtn).toHaveCount(0)
  })

  test('Combat sequentiel défaite', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=1&endurance=1&lance_de=6`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await testCombatRound(page)
    await page.click('button.combat-next-btn')

    // Défaite → vue défaite
    const defeatView = page.locator('div#view-defeat')
    await expect(defeatView).toBeVisible()
  })
})