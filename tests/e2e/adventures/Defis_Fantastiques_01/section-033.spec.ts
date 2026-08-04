import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testNavigation, testCombatStart, testCombatRound, testRoundSuivant, testStat } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 33
const SECTION_TEXT = "La créature endormie se réveille"
const SECTION_CHOICES = {
  320: "Fuir par la porte",
  147: 'Combattre'
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== 'passed') {
      const screenshotPath = `test-results/section-${String(SECTION_NUMBER).padStart(3, '0')}-${testInfo.title.replace(/\s+/g, '-')}-failed.png`
      await page.screenshot({ path: screenshotPath })
    }
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
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=12&lance_de=1`)
    await page.waitForSelector('.section-text')
    
    // Lancer le combat
    await testCombatStart(page)
    // round 1
    await testCombatRound(page)
    await testRoundSuivant(page)
    // round 2
    await testCombatRound(page)
    //résultat
    await page.click('button.combat-next-btn')

    // Vérifier qu'on a gagné et qu'on est à la bonne section
    await page.waitForSelector('[data-section="147"]', { timeout: 5000 })
    const sectionContent = page.locator('[data-section="147"]')
    await expect(sectionContent).toBeVisible()
  })

  test('Combat perdu avec endurance habilete=5 et lance_de=6', async ({ page }) => {
    // Charger avec habilete faible et dés défavorables
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=1&habilete=5&lance_de=6`)
    await page.waitForSelector('.section-text')
    
    // Lancer le combat
    await testCombatStart(page)
    // round 1
    await testCombatRound(page)

    //résultat
    await page.click('button.combat-next-btn')
    
    // Vérifier qu'on a perdu (on devrait voir un message de défaite ou être redirigé)
    // Le héros devrait avoir perdu de l'endurance
    const deathInfo = page.locator('div#view-defeat')
    await expect(deathInfo).toBeVisible()
  })

  test('Fuir vers section 320 avec perte endurance', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=10`)
    await page.waitForSelector('.section-text')

    await testNavigation(page, SECTION_CHOICES, 1)
    testStat(page,"endurance",8)
  })
})
