import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testMort, screenshotOnFailure, gotoWithParams } from '../../helpers/commonTests'
import { combatStart, combatRound, combatRoundSuivant } from '../../helpers/combatTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 8
const SECTION_TEXT = 'BARBARE'
const SECTION_CHOICES = {
  0: 'Combattre'
}
 const delay = (ms: number | undefined) => new Promise(resolve => setTimeout(resolve, ms))

test.describe('Section 008 - Combat contre le Barbare', () => {

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
    //résultat
    await page.click('button.combat-next-btn')

    // Vérifier qu'on a gagné et qu'on est à la section 273
    await testSection(page, 273)
  })

  test('Combat perdu avec habilete=5 et lance_de=6', async ({ page }) => {
    // Charger avec habilete faible et dés défavorables
    await gotoWithParams(page, {endurance: '1', habilete: '5', lance_de: '6'})
    
    // Lancer le combat
    await combatStart(page)
    // round 1
    await combatRound(page)
    
    //resultat
    await page.click('button.combat-next-btn')
    
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

  test('Possibilité de fuir vers section 189', async ({ page }) => {    
    // Lancer le combat
    await combatStart(page)
    // round 1
    await combatRound(page)

    //fuite directe
    await page.click('button.combat-fuite-direct-btn')

    // Vérifier qu'on a fuit et qu'on est à la section 189
    await testSection(page, 189)
  })

  test('Possibilité de fuir avec chance vers section 189', async ({ page }) => {
    await gotoWithParams(page, {chance: '10', habilete: '5', lance_de: '4'})
    
    // Lancer le combat
    await combatStart(page)
    // round 1
    await combatRound(page)

    //fuite chance
    await page.click('button.combat-fuite-chance-btn')

    // Vérifier qu'on a fuit et qu'on est à la section 189
    await testSection(page, 189)
  })

  test('tester attaque_chance chanceux', async ({ page }) => {
    await gotoWithParams(page, {chance: '10', habilete: '50', lance_de: '1'})

    // Lancer le combat
    await combatStart(page)
    // round 1
    await combatRound(page)

    //attente du bouton attaque_chance
    await page.waitForSelector('.combat-action-btn', { timeout: 5000 })
    await page.click('button.combat-action-btn')

    await page.waitForSelector('.combat-roll-prompt .combat-roll-btn', { timeout: 5000 })
    await page.click('button.combat-roll-btn')

    await delay(3000)
    let EnemyEnduranceValue = await page.locator('.combat-stat-enemy .combat-stat-value').textContent()
    await expect(EnemyEnduranceValue).toBe('2 ❤️')

    await page.waitForSelector('.combat-next-btn', { timeout: 10000 })

  })

  test('tester attaque_chance malchanceux', async ({ page }) => {
    await gotoWithParams(page, {chance: '10', habilete: '50', lance_de: '6'})

    // Lancer le combat
    await combatStart(page)
    // round 1
    await combatRound(page)

    //attente du bouton attaque_chance
    await page.waitForSelector('.combat-action-btn', { timeout: 5000 })
    await page.click('button.combat-action-btn')

    await page.waitForSelector('.combat-roll-prompt .combat-roll-btn', { timeout: 5000 })
    await page.click('button.combat-roll-btn')

    await delay(3000)
    let EnemyEnduranceValue = await page.locator('.combat-stat-enemy .combat-stat-value').textContent()
    await expect(EnemyEnduranceValue).toBe('5 ❤️')

    await page.waitForSelector('.combat-next-btn', { timeout: 10000 })
  })

  test('tester defense_chance chanceux', async ({ page }) => {
    await gotoWithParams(page, {chance: '10', endurance: '10', habilete: '1', lance_de: '1'})

    // Lancer le combat
    await combatStart(page)
    // round 1
    await combatRound(page)

    //attente du bouton attaque_chance
    await page.waitForSelector('.combat-action-btn', { timeout: 5000 })
    await page.click('button.combat-action-btn')

    await page.waitForSelector('.combat-roll-prompt .combat-roll-btn', { timeout: 5000 })
    await page.click('button.combat-roll-btn')

    await delay(3000)
    let EnemyEnduranceValue = await page.locator('.combat-stat-heros .combat-stat-value').textContent()
    await expect(EnemyEnduranceValue).toBe('9 ❤️')

    await page.waitForSelector('.combat-next-btn', { timeout: 10000 })
    // const sectionText = page.locator('.section-text')
    // await expect(sectionText).toContainText(expectedText)
  })

  test('tester defense_chance malchanceux', async ({ page }) => {
    await gotoWithParams(page, {chance: '10', endurance: '10', habilete: '1', lance_de: '6'})

    // Lancer le combat
    await combatStart(page)
    // round 1
    await combatRound(page)

    //attente du bouton attaque_chance
    await page.waitForSelector('.combat-action-btn', { timeout: 5000 })
    await page.click('button.combat-action-btn')

    await page.waitForSelector('.combat-roll-prompt .combat-roll-btn', { timeout: 5000 })
    await page.click('button.combat-roll-btn')

    await delay(3000)
    let EnemyEnduranceValue = await page.locator('.combat-stat-heros .combat-stat-value').textContent()
    await expect(EnemyEnduranceValue).toBe('7 ❤️')

    await page.waitForSelector('.combat-next-btn', { timeout: 10000 })
  })
})