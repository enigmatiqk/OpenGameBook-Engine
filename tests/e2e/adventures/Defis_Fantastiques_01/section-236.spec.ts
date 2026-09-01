import { test } from '@playwright/test'
import { testSection, testCombatStart, testCombatRound, CombatResultat,CombatMonstreSuivant, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 236
const SECTION_TEXT = "Le combat s'engage"

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

  test('Combat gagné (3 squelettes vaincus → section 395)', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&monstre_endurance=1&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)

    // Phase 1 : Squelette A
    await testCombatRound(page)
    await CombatMonstreSuivant(page)

    // Phase 2 : Squelette B
    await testCombatRound(page)
    await CombatMonstreSuivant(page)

    // Phase 3 : Squelette C → victoire finale
    await testCombatRound(page)
    await CombatResultat(page)

    await testSection(page, 395)
  })

  test('Combat perdu → défaite', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=1&endurance=1&lance_de=6`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await testCombatRound(page)
    await page.click('button.combat-next-btn')

    // Pas de combat.mort défini sur cette section → écran défaite générique
    await page.waitForSelector('#view-defeat.active', { timeout: 10000 })
  })
})
