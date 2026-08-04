import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testCombatStart, testCombatRound, testRoundSuivant } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 86
const SECTION_TEXT = "D'énormes mâchoires s'ouvrent devant vous"
const SECTION_CHOICES = {
  0: 'Combattre CROCODILE'
}

// CROCODILE : HABILETÉ 7, ENDURANCE 6
// victoire → section 259
// event round 2 → choix "Essayer d'occuper votre adversaire" → section 350

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

  test('Bouton de combat', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  // ── Victoire ──────────────────────────────────────────────────────────────
  // habilete=50 + monstre_endurance=1 + lance_de=1 → crocodile tué au round 1
  test('Combat victoire → section 259', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&monstre_endurance=1&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    // round 1 : victoire garantie
    await testCombatRound(page)
    await page.click('button.combat-next-btn')

    await page.waitForSelector('[data-section="259"]', { timeout: 5000 })
    await expect(page.locator('[data-section="259"]')).toBeVisible()
  })

  // ── Défaite ───────────────────────────────────────────────────────────────
  // habilete=1 + endurance=1 + lance_de=6 → héros mort en 1 round → écran défaite
  test('Combat défaite → écran défaite', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=1&endurance=1&lance_de=6`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    // round 1 : héros perd (habilete=1, dés=6 → force attaque très faible)
    await testCombatRound(page)
    await page.click('button.combat-next-btn')

    // Si le héros est mort, l'écran défaite doit s'afficher
    await page.waitForSelector('#view-defeat', { timeout: 5000 })
    await expect(page.locator('#view-defeat')).toBeVisible()
  })

  // ── Event round 2 : choix "Essayer d'occuper votre adversaire" → section 350 ──
  // habilete=1 + endurance=100 + lance_de=1 → héros survit, crocodile aussi → event round 2
  test('Event round 2 → bouton "Essayer d\'occuper votre adversaire" visible', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=1&endurance=100&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    // round 1
    await testCombatRound(page)
    await testRoundSuivant(page)
    // round 2 → déclenche l'event
    await testCombatRound(page)

    // Le bouton de l'event doit apparaître dans les actions de combat
    const eventBtn = page.locator(`button:has-text("Essayer d'occuper votre adversaire")`)
    await expect(eventBtn).toBeVisible()
  })

  test('Event round 2 → navigation vers section 350', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=1&endurance=100&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    // round 1 : le bouton de l'event ne doit pas encore être présent
    await testCombatRound(page)
    await expect(page.locator(`button:has-text("Essayer d'occuper votre adversaire")`)).toHaveCount(0)

    await testRoundSuivant(page)
    // round 2 → déclenche l'event
    await testCombatRound(page)

    // Cliquer sur le choix de l'event
    await page.click(`button:has-text("Essayer d'occuper votre adversaire")`)
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await testSection(page, 350)
  })
})
