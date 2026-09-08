import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testNavigation, testStat, screenshotOnFailure, gotoWithParams } from '../../helpers/commonTests'
import { combatStart, combatRound, combatRoundSuivant, combatResultat } from '../../helpers/combatTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 33
const SECTION_TEXT = "La créature endormie se réveille"
const SECTION_CHOICES = {
  147: 'Combattre',
  320: "Fuir par la porte"
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

  test('Combat gagné avec habilete=12 et lance_de=1', async ({ page }) => {
    // Charger avec habilete élevée et dés favorables
    await gotoWithParams(page, {chance: '10', habilete: '12', lance_de: '1'})
    
    // Lancer le combat
    await combatStart(page)
    // round 1
    await combatRound(page)
    await combatRoundSuivant(page)
    // round 2
    await combatRound(page)
    //résultat
    await combatResultat(page)

    // Vérifier qu'on a gagné et qu'on est à la bonne section
    await testSection(page, 147)
  })

  test('Combat perdu avec endurance habilete=5 et lance_de=6', async ({ page }) => {
    // Charger avec habilete faible et dés défavorables
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=1&habilete=5&lance_de=6`)
    await page.waitForSelector('.section-text')
    
    // Lancer le combat
    await combatStart(page)
    // round 1
    await combatRound(page)

    //résultat
    await combatResultat(page)
    
    // Vérifier qu'on a perdu (on devrait voir un message de défaite ou être redirigé)
    // Le héros devrait avoir perdu de l'endurance
    const deathInfo = page.locator('div#view-defeat')
    await expect(deathInfo).toBeVisible()
  })

  test('Fuir vers section 320 avec perte endurance', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=10`)
    await page.waitForSelector('.section-text')

    await testNavigation(page, SECTION_CHOICES, 1)
    await testStat(page,"endurance",8)
  })
})