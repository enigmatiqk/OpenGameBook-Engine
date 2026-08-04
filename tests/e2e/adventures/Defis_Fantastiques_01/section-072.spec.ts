import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 72
const SECTION_TEXT = 'Vous avez à présent une nouvelle armure'
const SECTION_CHOICES = {
  319: "Conserver l'armure",
  3190: "Prendre la nouvelle armure",
}

// L'id DOM de l'armure injectée via ?equip=armure_papier est slugifié depuis "debug_equip_armure_1"
const ARMURE_PAPIER_DOM_ID = 'debug-equip-armure-1'
// L'id DOM de la nouvelle armure après remplacement est slugifié depuis "nouvelle_armure"
const NOUVELLE_ARMURE_DOM_ID = 'nouvelle-armure'

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== 'passed') {
      const screenshotPath = `test-results/section-${String(SECTION_NUMBER).padStart(3, '0')}-${testInfo.title.replace(/\s+/g, '-')}-failed.png`
      await page.screenshot({ path: screenshotPath })
    }
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&equip=armure_papier`)
    await page.waitForSelector('.section-text')
  })

  test('Section et texte', async ({ page }) => {
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  // ── Cas 1 : Conserver l'armure ────────────────────────────────────────────
  // L'armure_papier reste équipée, on arrive à la section 319
  test('Conserver armure', async ({ page }) => {
    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[319]}")`)
    await page.waitForSelector('.section-text', { timeout: 5000 })

    // Vérifier qu'on est bien en section 319
    await testSection(page, 319)

    //afficher la modale heros
    await page.click(`.btn-hero-sheet`)


    // armure_papier doit rester dans le slot armure (équipée) — elle ne doit PAS être dans l'inventaire
    const armureEquipeeSlot = page.locator('.slot-armure .slot-item')
    await expect(armureEquipeeSlot).toContainText('papier')

    // Elle ne doit pas apparaître dans la zone inventaire
    const armureInInventaire = page.locator(`#${ARMURE_PAPIER_DOM_ID}`)
    await expect(armureInInventaire).toHaveCount(0)
  })

  // ── Cas 2 : Prendre la nouvelle armure ────────────────────────────────────
  // nouvelle_armure remplace armure_papier : armure_papier passe en inventaire, on arrive à la section 319
  test('Prendre nouvelle armure', async ({ page }) => {
    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[3190]}")`)
    await page.waitForSelector('.section-text', { timeout: 5000 })

    // Vérifier qu'on est bien en section 319
    await testSection(page, 319)

    //afficher la modale heros
    await page.click(`.btn-hero-sheet`)

    // La nouvelle armure doit être équipée dans le slot armure
    const armureEquipeeSlot = page.locator('.slot-armure .slot-item')
    await expect(armureEquipeeSlot).toContainText('Nouvelle armure')

    // armure_papier doit être présente dans l'inventaire (déséquipée)
    const armurePapierInInventaire = page.locator(`#${ARMURE_PAPIER_DOM_ID}`)
    await expect(armurePapierInInventaire).toBeVisible()
  })
})
