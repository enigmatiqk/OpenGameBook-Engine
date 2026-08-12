import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testCombatStart, testCombatRound, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 20
const SECTION_TEXT = "La bagarre commence. Vous avez votre épée, ils ont leurs haches."
const SECTION_CHOICES = {
  0: 'Combattre (4 combats)',
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

  test('Combat sequentiel : passage au nain suivant', async ({ page }) => {
    // Charger avec habilete élevée et dés favorables
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    // Nain 1 (habilete=7 endurance=6) : tué en 1 round
    await testCombatRound(page)
    await page.click('button.combat-next-btn')

    // Passage automatique au Nain 2
    await page.waitForSelector('.combat-title', { timeout: 5000 })
    const combatTitle = page.locator('.combat-title')
    await expect(combatTitle).toContainText('NAIN')
  })

  test('Combat sequentiel victoire', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&monstre_endurance=1&lance_de=1`)
    await page.waitForSelector('.section-text')

    // Lancer le combat 
    await testCombatStart(page)
    // 4 nains — habilete=50 + lance_de=1 : chacun tué en 1 round
    for (let i = 0; i < 4; i++) {
      await testCombatRound(page)
      await page.click('button.combat-next-btn')
      if (i < 3) {
        await page.waitForSelector('.combat-title', { timeout: 5000 })
      }
    }

    // Victoire → section 376
    await testSection(page, 376)
  })

  test('Combat sequentiel fuite', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=10&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await testCombatRound(page)

    // Le bouton fuite doit être disponible (fuite définie vers 291)
    const fuiteBtn = page.locator('button.combat-fuite-direct-btn')
    await expect(fuiteBtn).toBeVisible()

    await fuiteBtn.click()

    // Fuite → section 291
    await testSection(page, 291)
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