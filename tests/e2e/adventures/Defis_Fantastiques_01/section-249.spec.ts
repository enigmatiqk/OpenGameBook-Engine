import { test, expect } from '@playwright/test'
import {
  testSection,
  testStat,
  testCombatStart,
  screenshotOnFailure,
} from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 249
const SECTION_TEXT = 'Le chien bondit sur vous'
const SECTION_CHOICES = {
  66: "Fuir par la porte sud",
  304: "Rester"
}

/**
 * Vérifie l'endurance affichée dans la vue combat (pas le panel héros).
 */
async function testEnduranceCombat(page: import('@playwright/test').Page, value: number) {
  const heroVie = page.locator('.combat-stat-heros .combat-stat-value')
  await expect(heroVie).toContainText(`${value} ❤️`)
}

/**
 * Lance dé ennemi + dé héros, puis attend que l'attaque spéciale soit visible (flash 2.5s).
 */
async function roundEtSouffle(page: import('@playwright/test').Page) {
  await page.click('button.combat-roll-btn') // dé ennemi
  await page.click('button.combat-roll-btn') // dé héros
  await page.waitForSelector('.combat-attaque-speciale-texte', { timeout: 5000 })
}

/**
 * Termine un combat vite : monstre_endurance=1, habilete=50.
 * Gère le round + le souffle (dé=3, pas d'effets) puis clique "Voir le résultat".
 * Lance le pile : ennemi=1, héros=1, souffle=3.
 */
async function combatVictoireRapide(page: import('@playwright/test').Page) {
  await testCombatStart(page)
  await roundEtSouffle(page)
  await page.click('button.combat-roll-btn') // souffle (3 → pas d'effets)

  await page.waitForSelector('.combat-next-btn', { timeout: 5000 })

  await page.click('button.combat-next-btn')
  // Victoire avec section:0 → navigation immédiate vers section 249
  await page.waitForSelector('.section-text', { timeout: 5000 })
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    await screenshotOnFailure(page, testInfo, SECTION_NUMBER)
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}`)
    await page.waitForSelector('.section-text')
  })

  // ── Affichage ──────────────────────────────────────────────────────────────

  test('Section et texte', async ({ page }) => {
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Bouton combat enable en arrivant', async ({ page }) => {
    await expect(page.locator('button.choice-btn--combat')).toBeEnabled()
  })

  test(`Les choix de section sont disabled avant combat`, async ({ page }) => {
    // Avant victoire : les boutons avec condition combat_victoire sont absents
    await expect(page.locator(`.choices-list button:has-text("${SECTION_CHOICES[66]}")`)).toBeDisabled()
    await expect(page.locator(`.choices-list button:has-text("${SECTION_CHOICES[304]}")`)).toBeDisabled()
  })

  // ── Victoire → choix 1 : Fuir par la porte sud ───────────────────────────

  test(`Victoire → section 66, +1 chance`, async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&monstre_endurance=1&chance=8&chance_start=8&lance_de=5&ignore_stat_limit`)
    await page.waitForSelector('.section-text')

    await combatVictoireRapide(page)

    // +1 chance à la victoire → 8 + 1 = 9
    await testStat(page, 'chance', 9)

    // Choix post-victoire visibles
    await expect(page.locator(`.choices-list button:has-text("${SECTION_CHOICES[66]}")`)).toBeVisible()
    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[66]}")`)
    await page.waitForSelector('.section-text', { timeout: 5000 })
    
    await testSection(page, 66)
  })

  // ── Victoire → choix 2 : Rester ──────────────────────────────────────────

  test(`Victoire → section 304`, async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&monstre_endurance=1&lance_de=5&ignore_stat_limit`)
    await page.waitForSelector('.section-text')

    await combatVictoireRapide(page)

    await expect(page.locator(`.choices-list button:has-text("${SECTION_CHOICES[304]}")`)).toBeVisible()
    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[304]}")`)
    await page.waitForSelector('.section-text', { timeout: 5000 })
    await testSection(page, 304)
  })

  // ── Souffle non déclenché (dé 3) ─────────────────────────────────────────

  test('Souffle non déclenché (dé 3) → pas de parade, endurance inchangée +1 chance', async ({ page }) => {
    // Pile : ennemi=1, héros=1 (égalité, pas de dégâts combat), souffle=3 (pas dans 1,2)
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=10&habilete=7&lance_de_pile=1,1,6,6,5&monstre_endurance=1&ignore_stat_limit`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await roundEtSouffle(page)

    await page.click('button.combat-roll-btn') // dé souffle → 3 → pas d'effets
    await page.waitForSelector('.combat-next-btn', { timeout: 5000 })

    await page.click('.combat-next-btn')
    await testStat(page, "endurance", 10)
    await testStat(page, "chance", 11)
  })

  // ── Parade lancer_de réussie ──────────────────────────────────────────────

  test('Parade lancer_de réussie (dé 4) → endurance inchangée +1 chance', async ({ page }) => {
    // Pile : ennemi=1, héros=1 (égalité), souffle=2 (effets), parade=4 (dans 3-6 → réussi)
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=10&habilete=7&chance=10&chance_start=15&lance_de_pile=1,1,6,6,1,5&monstre_endurance=1&ignore_stat_limit`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await roundEtSouffle(page)

    await page.click('button.combat-roll-btn') // souffle (2 → effets)
    await page.waitForSelector('button:has-text("Esquiver")', { timeout: 5000 })
    await page.click('button:has-text("Esquiver")')

    // Dé de parade (pile: 4 → 3-6 → réussi)
    // await page.waitForSelector('button.combat-roll-btn', { timeout: 5000 })
    // await page.click('button.combat-roll-btn')
    await page.waitForSelector('.combat-next-btn', { timeout: 5000 })

    // Endurance inchangée (souffle paré)
    // await testEnduranceCombat(page, 10)
    // Log : ligne attaque spéciale "esquivé"
    await expect(page.locator('.round-attaque-speciale--parade')).toBeVisible()
    await expect(page.locator('.round-attaque-speciale--parade')).toContainText('esquivé')

    await page.click('button.combat-next-btn')
    await testStat(page, "endurance", 10)
    await testStat(page, "chance", 11)
  })

  // ── Parade lancer_de échouée ──────────────────────────────────────────────

  test('Parade lancer_de échouée (dé 2) → -1 endurance +1 chance', async ({ page }) => {
    // Pile : ennemi=1, héros=1, souffle=2 (effets), parade=2 (2 < 3 → échec)
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=10&habilete=7&chance=10&chance_start=15&lance_de_pile=1,1,6,6,1,1&monstre_endurance=1&ignore_stat_limit`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await roundEtSouffle(page)

    await page.click('button.combat-roll-btn') // souffle (2 → effets)
    await page.waitForSelector('button:has-text("Esquiver")', { timeout: 5000 })
    await page.click('button:has-text("Esquiver")')

    await page.waitForSelector('.combat-next-btn', { timeout: 5000 })

    await expect(page.locator('.round-attaque-speciale--touche')).toBeVisible()
    await expect(page.locator('.round-attaque-speciale--touche')).toContainText('−1')

    await page.click('button.combat-next-btn')
    await testStat(page, "endurance", 9)
    await testStat(page, "chance", 11)

  })

  // ── Parade tenter_chance réussie ──────────────────────────────────────────

  test('Parade tenter_chance réussie (jet 2) → endurance inchangée, -1+1 chance', async ({ page }) => {
    // chance=10, tenter_chance 2d6=1+1=2 → 2 <= 10 → chanceux → parade réussie
    // Pile : ennemi=1, héros=1, souffle=2 (effets), 2d6 tenter_chance: 1,1
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=10&habilete=7&chance=10&chance_start=15&lance_de_pile=1,1,6,6,1,2,2&monstre_endurance=1&ignore_stat_limit`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await roundEtSouffle(page)

    await page.click('button.combat-roll-btn') // souffle (2 → effets)
    await page.waitForSelector('button:has-text("Tenter ma chance")', { timeout: 5000 })
    await page.click('button:has-text("Tenter ma chance")')

    // 2d6 dépile 1+1=2 → chanceux
    await page.waitForSelector('button.combat-roll-btn', { timeout: 5000 })
    await page.click('button.combat-roll-btn')
    await page.waitForSelector('.combat-next-btn', { timeout: 5000 })

    await page.click('button.combat-next-btn')
    await testStat(page, "endurance", 10)
    await testStat(page, "chance", 10)

  })

  // ── Parade tenter_chance échouée ──────────────────────────────────────────

  test('Parade tenter_chance échouée (jet 12) → -1 endurance, -1+1 chance', async ({ page }) => {
    // chance=5, 2d6=6+6=12 > 5 → malchanceux → parade échouée
    // Pile : ennemi=1, héros=1, souffle=2 (effets), 2d6: 6,6
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&monstre_endurance=1&endurance=10&habilete=7&chance=10&chance_start=15&lance_de_pile=1,1,6,6,1,6,6&ignore_stat_limit`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await roundEtSouffle(page)

    await page.click('button.combat-roll-btn') // souffle (2 → effets)
    await page.waitForSelector('button:has-text("Tenter ma chance")', { timeout: 5000 })
    await page.click('button:has-text("Tenter ma chance")')

    // 2d6 dépile 6+6=12 > 5 → malchanceux
    await page.waitForSelector('button.combat-roll-btn', { timeout: 5000 })
    await page.click('button.combat-roll-btn')
    await page.waitForSelector('.combat-next-btn', { timeout: 5000 })

    // Endurance -1 dans la vue combat (souffle non paré)
    await expect(page.locator('.round-attaque-speciale--touche')).toBeVisible()
    await expect(page.locator('.round-attaque-speciale--touche')).toContainText('−1')

    await page.click('button.combat-next-btn')
    await testStat(page, "endurance", 9)
    await testStat(page, "chance", 10)

  })

  // ── Fuite pendant le combat ───────────────────────────────────────────────

  test('Fuite pendant le combat → section 66, -2 endurance', async ({ page }) => {
    // Pile : ennemi=1, héros=1 (égalité), souffle=3 (pas d'effets) → round_result + bouton fuite
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=10&habilete=7&lance_de_pile=3,3,1,1,5&monstre_endurance=6&ignore_stat_limit=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await roundEtSouffle(page)

    await page.click('button.combat-roll-btn') // souffle (3 → pas d'effets)
    await page.waitForSelector('.combat-fuite-direct-btn', { timeout: 5000 })
    await page.click('button.combat-fuite-direct-btn')

    await page.waitForSelector('.section-text', { timeout: 5000 })
    await testSection(page, 66)
    // Coût fuite : -2 endurance → 10 - 2 = 8
    await testStat(page, 'endurance', 8)
  })

  // ── Défaite ───────────────────────────────────────────────────────────────

  test('Défaite → écran de défaite', async ({ page }) => {
    // habilete=1, endurance=2 → chien gagne (7+6=13 > 1+6=7) → 2 dégâts → mort
    // Pile : ennemi=6, héros=6, souffle=6 (pas dans 1,2 → pas d'effets)
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=1&endurance=2&lance_de_pile=6,6,6,6,6&ignore_stat_limit=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await roundEtSouffle(page)

    await page.click('button.combat-roll-btn') // souffle (6 → pas d'effets)
    await page.waitForSelector('.combat-next-btn', { timeout: 5000 })
    await page.click('button.combat-next-btn') // Voir le résultat

    await page.waitForSelector('#view-defeat', { timeout: 5000 })
    await expect(page.locator('#view-defeat')).toBeVisible()
  })
})
