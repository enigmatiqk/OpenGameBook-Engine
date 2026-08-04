import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testCombatStart, testCombatRound, testRoundSuivant } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 116
const SECTION_TEXT = "Les deux FARFADETS ivres"

// Premier FARFADET  : HABILETÉ 5, ENDURANCE 5
// Deuxième FARFADET : HABILETÉ 4, ENDURANCE 5
// attaque_heros: "+1" → bonus +1 à la force d'attaque du héros à chaque round
// victoire → 378  |  fuite → 42

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== 'passed') {
      const screenshotPath = `test-results/section-${String(SECTION_NUMBER).padStart(3, '0')}-${testInfo.title.replace(/\s+/g, '-')}-failed.png`
      await page.screenshot({ path: screenshotPath })
    }
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}`)
    await page.waitForSelector('.section-text')
  })

  test('Section et texte', async ({ page }) => {
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })


  // ── Bonus +1 affiché dans le log du round ─────────────────────────────────
  test('Bonus +1 attaque affiché dans le log du round', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=10&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await testCombatRound(page)

    // Le log de round doit afficher le bonus +1 dans la ligne de la force d'attaque héros
    const roundRoll = page.locator('.round-roll').first()
    await expect(roundRoll).toContainText('+ 1')
  })

  // ── Combat séquentiel : passage au 2e FARFADET ────────────────────────────
  test('Passage automatique au 2e FARFADET après victoire sur le 1er', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&monstre_endurance=1&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    // 1er FARFADET tué en 1 round
    await testCombatRound(page)
    await page.click('button.combat-next-btn')

    // Le titre du combat doit maintenant mentionner le 2e FARFADET
    await page.waitForSelector('.combat-title', { timeout: 5000 })
    const combatTitle = page.locator('.combat-title')
    await expect(combatTitle).toContainText('FARFADET')
  })

  // ── Victoire → section 378 ────────────────────────────────────────────────
  test('Combat victoire → section 378', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&monstre_endurance=1&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    // 1er FARFADET
    await testCombatRound(page)
    await page.click('button.combat-next-btn')
    // 2e FARFADET
    await testCombatRound(page)
    await page.click('button.combat-next-btn')

    await testSection(page, 378)
  })

  // ── Défaite → écran défaite ───────────────────────────────────────────────
  test('Combat défaite → écran défaite', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=1&endurance=1&lance_de=6`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await testCombatRound(page)
    await page.click('button.combat-next-btn')

    await page.waitForSelector('#view-defeat', { timeout: 5000 })
    await expect(page.locator('#view-defeat')).toBeVisible()
  })

  // ── Fuite → section 42 ────────────────────────────────────────────────────
  test('Fuite possible dès le round 1 → section 42', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=1&endurance=100&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await testCombatRound(page)

    // Le bouton de fuite directe doit être disponible
    const fuiteBtn = page.locator('button.combat-fuite-direct-btn')
    await expect(fuiteBtn).toBeVisible()

    await fuiteBtn.click()
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await testSection(page, 42)
  })
})
