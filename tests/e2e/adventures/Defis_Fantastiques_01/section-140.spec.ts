import { test, expect } from '@playwright/test'
import { testSection, testCombatStart, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 140
const SECTION_TEXT = 'Les Squelettes avancent sur vous'

// Section 140 — 3 phases de combat :
//   Phase 1 : SQUELETTE Chef   HAB 7  END 5  (phase simple)
//   Phase 2 : SQUELETTE A      HAB 6  END 6  + SQUELETTE B HAB 5  END 6  (escorte)
//   Phase 3 : SQUELETTE A      HAB 5  END 5  + SQUELETTE B HAB 6  END 5  (escorte)
// Victoire → section 395
//
// Paramètres debug utilisés :
//   habilete=50        → héros gagne toujours le duel principal (FA très haute)
//   monstre_endurance=1 → tous les monstres ont 1 END, tués en 1 round victorieux
//   lance_de=1         → tous les dés font 1 (FA ennemis très basse)

/**
 * Lance un round de combat simple (dé ennemi + dé héros).
 */
async function roundSimple(page: any) {
  await page.click('button.combat-roll-btn')  // dé ennemi
  await page.click('button.combat-roll-btn')  // dé héros
  await page.waitForSelector('.combat-actions', { timeout: 10000 })
}

/**
 * Choisit la cible en phase escorte (index 0 = premier monstre de la liste).
 */
async function choisirCible(page: any, index: number = 0) {
  const btns = page.locator('button.combat-target-btn')
  await btns.nth(index).click()
  await page.waitForSelector('button.combat-roll-btn', { timeout: 5000 })
}

/**
 * Lance un round complet en phase escorte (2 monstres).
 * Ordre : dé A + héros A + dé B + héros B → round_result
 */
async function roundEscorte(page: any) {
  await page.click('button.combat-roll-btn')  // dé ennemi principal (A)
  await page.click('button.combat-roll-btn')  // dé héros vs A
  await page.click('button.combat-roll-btn')  // dé secondaire (B)
  await page.click('button.combat-roll-btn')  // dé héros vs B
  await page.waitForSelector('.combat-actions', { timeout: 10000 })
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    await screenshotOnFailure(page, testInfo, SECTION_NUMBER)
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}`)
    await page.waitForSelector('.section-text')
  })

  // ── Texte de la section ───────────────────────────────────────────────────
  test('Section et texte', async ({ page }) => {
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })

  // ── Phase 1 : SQUELETTE Chef tué en 1 round ───────────────────────────────
  test('Phase 1 : SQUELETTE Chef affiché dans le titre de combat', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&monstre_endurance=1&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    const monstre = page.locator('.monstre-name')
    await expect(monstre).toContainText('SQUELETTE CHEF')
  })

  // ── Transition phase 1 → phase 2 (escorte) ───────────────────────────────
  test('Après phase 1, passage en phase escorte avec choix de cible', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&monstre_endurance=1&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    // Phase 1 : tuer le Chef en 1 round
    await roundSimple(page)
    await page.click('button.combat-next-btn')

    // L'écran de choix de cible doit apparaître
    await page.waitForSelector('button.combat-target-btn', { timeout: 5000 })
    const targetBtns = page.locator('button.combat-target-btn')
    await expect(targetBtns).toHaveCount(2)
    await expect(targetBtns.nth(0)).toContainText('SQUELETTE A')
    await expect(targetBtns.nth(1)).toContainText('SQUELETTE B')
  })

  // ── Phase 2 : indicateur de phase affiché ────────────────────────────────
  test('Indicateur de phase affiché (Phase 2 / 3)', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&monstre_endurance=1&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await roundSimple(page)
    await page.click('button.combat-next-btn')
    await page.waitForSelector('button.combat-target-btn', { timeout: 5000 })

    const indicator = page.locator('.combat-phase-indicator')
    await expect(indicator).toBeVisible()
    await expect(indicator).toContainText('2')
    await expect(indicator).toContainText('3')
  })

  // ── Phase 2 : contexte visible pendant round escorte ─────────────────────
  test('Phase 2 escorte : contexte du round principal visible avant jet B', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&monstre_endurance=1&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await roundSimple(page)
    await page.click('button.combat-next-btn')
    await page.waitForSelector('button.combat-target-btn', { timeout: 5000 })

    // Choisir SQUELETTE A comme cible
    await choisirCible(page, 0)

    // Lancer dé A et héros A
    await page.click('button.combat-roll-btn')  // dé A
    await page.click('button.combat-roll-btn')  // héros A

    // Maintenant on est en pending_secondaire_ennemi :
    // le contexte du round principal doit être visible
    await page.waitForSelector('.combat-round-context', { timeout: 5000 })
    const ctx = page.locator('.combat-round-context')
    await expect(ctx).toBeVisible()
    await expect(ctx).toContainText('SQUELETTE A')
    await expect(ctx).toContainText('Héros')
  })

  // ── Phase 2 : log du round escorte complet ────────────────────────────────
  test('Phase 2 escorte : log contient les 4 lignes de dés après round_result', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&monstre_endurance=1&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await roundSimple(page)
    await page.click('button.combat-next-btn')
    await page.waitForSelector('button.combat-target-btn', { timeout: 5000 })

    await choisirCible(page, 0)
    await roundEscorte(page)

    // Le log doit contenir les lignes secondaires
    const rounds = page.locator('.combat-round')
    await expect(rounds).toHaveCount(1)
    const roundEl = rounds.first()
    await expect(roundEl).toContainText('SQUELETTE A')
    await expect(roundEl).toContainText('SQUELETTE B')
    await expect(roundEl).toContainText('escorte')
    // Les deux lignes "Héros" (une par monstre)
    const heroLines = roundEl.locator('.round-roll').filter({ hasText: 'Héros' })
    await expect(heroLines).toHaveCount(2)
  })

  // ── Phase 3 : transition phase 2 → phase 3 ───────────────────────────────
  test('Après phase 2, passage en phase 3 escorte', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&monstre_endurance=1&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    // Phase 1
    await roundSimple(page)
    await page.click('button.combat-next-btn')
    // Phase 2
    await page.waitForSelector('button.combat-target-btn', { timeout: 5000 })
    await choisirCible(page, 0)
    await roundEscorte(page)
    await page.click('button.combat-next-btn')
    // Phase 3 : nouvel écran de choix de cible
    await page.waitForSelector('button.combat-target-btn', { timeout: 5000 })
    const indicator = page.locator('.combat-phase-indicator')
    await expect(indicator).toContainText('3')
    await expect(indicator).toContainText('3')
  })

  // ── Victoire complète → section 395 ──────────────────────────────────────
  test('Victoire complète (3 phases) → section 395', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&monstre_endurance=1&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)

    // Phase 1 : SQUELETTE Chef
    await roundSimple(page)
    await page.click('button.combat-next-btn')

    // Phase 2 : SQUELETTE A (cible) + SQUELETTE B (escorte)
    await page.waitForSelector('button.combat-target-btn', { timeout: 5000 })
    await choisirCible(page, 0)
    await roundEscorte(page)
    await page.click('button.combat-next-btn')

    // Phase 3 : SQUELETTE A (cible) + SQUELETTE B (escorte)
    await page.waitForSelector('button.combat-target-btn', { timeout: 5000 })
    await choisirCible(page, 0)
    await roundEscorte(page)
    await page.click('button.combat-next-btn')

    // Victoire → section 395
    await page.waitForSelector('[data-section="395"]', { timeout: 5000 })
    await expect(page.locator('[data-section="395"]')).toBeVisible()
  })

  // ── Défaite ───────────────────────────────────────────────────────────────
  test('Défaite → écran défaite', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=1&endurance=1&lance_de=6`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await roundSimple(page)
    await page.click('button.combat-next-btn')

    await page.waitForSelector('#view-defeat', { timeout: 5000 })
    await expect(page.locator('#view-defeat')).toBeVisible()
  })

})