import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testCombatStart, testCombatRound, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 142
const SECTION_TEXT = "D'une voix tonitruante, il lance"
const SECTION_CHOICES = {
  0: 'Combattre SORCIER'
}
 const delay = (ms: number | undefined) => new Promise(resolve => setTimeout(resolve, ms))

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    await screenshotOnFailure(page, testInfo, SECTION_NUMBER)
  })

  test.beforeEach(async ({ page }) => {
    // Lancer le jeu en mode debug
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}`)
    // Attendre que la section soit chargée
    await page.waitForSelector('.section-text')
  })

  test('Section et texte', async ({ page }) => {
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  test('Combat gagné', async ({ page }) => {
    // Charger avec habilete élevée et dés favorables
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&monstre_endurance=2&habilete=50&lance_de=1`)
    await page.waitForSelector('.section-text')
    
    // Lancer le combat
    await testCombatStart(page)
    // round 1
    await testCombatRound(page)
    //résultat
    await page.click('button.combat-next-btn')

    // Vérifier qu'on a gagné et qu'on est à la section
    await testSection(page, 396)
  })

  test('Combat perdu', async ({ page }) => {
    // Charger avec habilete faible et dés défavorables
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=1&habilete=1&lance_de=6`)
    await page.waitForSelector('.section-text')
    
    // Lancer le combat
    await testCombatStart(page)
    // round 1
    await testCombatRound(page)
    
    //resultat
    await page.click('button.combat-next-btn')
    
    // Vérifier qu'on a perdu (on devrait voir un message de défaite ou être redirigé)
    // Le héros devrait avoir perdu de l'endurance
    const deathInfo = page.locator('div#view-defeat')
    await expect(deathInfo).toBeVisible()
  })
})