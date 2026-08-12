import { test, expect } from '@playwright/test'
import { testSection, testCombatRound, screenshotOnFailure } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 161
const SECTION_TEXT = "Assurez-vous bien que vous avez inscrit la référence"
// Table aléatoire : LUTIN (H5/E3), FARFADET (H6/E3), DIABLOTIN (H6/E4),
// RAT GÉANT (H5/E4), SQUELETTE (H6/E5), TROLL (H8/E4)
// Victoire → section indiquée par section_victoire (paramètre injecté via param_section_section_victoire)

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    await screenshotOnFailure(page, testInfo, SECTION_NUMBER)
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&param_section_section_victoire=12`)
    await page.waitForSelector('.section-text')
  })

  test('Section et texte', async ({ page }) => {
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Combat gagné → section_victoire 12', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&param_section_section_victoire=12&habilete=50&monstre_endurance=1&lance_de=1`)
    await page.waitForSelector('.section-text')

    // Lancer le combat (table aléatoire : on lance d'abord un dé pour choisir le monstre)
    await page.click('button.choice-btn--combat')
    await page.waitForSelector('.action-roll-box')
    await page.click('.action-roll-btn')
    await page.waitForSelector('.combat-view')

    await testCombatRound(page)
    await page.click('button.combat-next-btn')

    await testSection(page, 12)
  })

  test('Combat perdu → écran défaite', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&param_section_section_victoire=12&habilete=1&endurance=1&lance_de=6`)
    await page.waitForSelector('.section-text')

    // Lancer le combat (table aléatoire)
    await page.click('button.choice-btn--combat')
    await page.waitForSelector('.action-roll-box')
    await page.click('.action-roll-btn')
    await page.waitForSelector('.combat-view')

    await testCombatRound(page)
    await page.waitForSelector('.combat-next-btn', { timeout: 5000 })
    await page.click('.combat-next-btn')

    await page.waitForSelector('#view-defeat', { timeout: 5000 })
    await expect(page.locator('#view-defeat')).toBeVisible()
  })
})