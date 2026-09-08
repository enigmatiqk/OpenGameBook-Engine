import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, screenshotOnFailure, gotoWithParams, testMort } from '../../helpers/commonTests'
import { combatStart, combatRound, combatRoundSuivant, combatResultat } from '../../helpers/combatTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 16
const SECTION_TEXT = "l'Ogre vous a entendu"
const SECTION_CHOICES = {
  0: 'Combattre'
}

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

  test('Combat gagné avec endurance=1 habilete=12 et lance_de=1', async ({ page }) => {
    // Charger avec habilete élevée et dés favorables
    await gotoWithParams(page, {habilete: '12', lance_de: '1'})
    
    // Lancer le combat
    await combatStart(page)
    // round 1
    await combatRound(page)
    await combatRoundSuivant(page)
    // round 2
    await combatRound(page)
    await combatRoundSuivant(page)
    // round 3
    await combatRound(page)
    await combatRoundSuivant(page)
    // round 4
    await combatRound(page)
    await combatRoundSuivant(page)
    // round 5
    await combatRound(page)
    //résultat
    await combatResultat(page)

    // Vérifier qu'on a gagné et qu'on est à la section 50
     await testSection(page, 50)
  })

  test('Combat perdu avec habilete=5 et lance_de=6', async ({ page }) => {
    // Charger avec habilete faible et dés défavorables
    await gotoWithParams(page, {endurance: '1', habilete: '5', lance_de: '6'})
    
    // Lancer le combat
    await combatStart(page)
    // round 1
    await combatRound(page)

    //résultat
    await combatResultat(page)
    
    // Vérifier qu'on a perdu (on devrait voir un message de défaite ou être redirigé)
    // Le héros devrait avoir perdu de l'endurance
    await testMort(page)
  })

    test('Pas de fuite si le hero meurt', async ({ page }) => {
    await gotoWithParams(page, {endurance: '1', habilete: '5', lance_de: '6'})
    
    // Lancer le combat
    await combatStart(page)
    // round 1
    await combatRound(page)

    // Vérifier que me bouton fuite n'apparait pas
    const sectionContent = page.locator('button.combat-fuite-direct-btn')
    await expect(sectionContent).toBeHidden()
  })

  test('Possibilité de fuir vers section 269', async ({ page }) => {    
    // Lancer le combat
    await combatStart(page)
    // round 1
    await combatRound(page)

    //fuite directe
    await page.click('button.combat-fuite-direct-btn')

    // Vérifier qu'on a fuit et qu'on est à la section 269
    await testSection(page,269)
  })

  test('Possibilité de fuir avec chance vers section 269', async ({ page }) => {
    await gotoWithParams(page, {habilete: '5', lance_de: '4'})
    
    // Lancer le combat
    await combatStart(page)
    // round 1
    await combatRound(page)

    //fuite chance
    await page.click('button.combat-fuite-chance-btn')

    // Vérifier qu'on a fuit et qu'on est à la section 269
    await testSection(page, 269)
  })
})