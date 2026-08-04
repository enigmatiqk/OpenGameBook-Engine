import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 109
const SECTION_TEXT = "Le liquide est doux et onctueux"
const SECTION_CHOICES = {
  120: "rendez-vous au 120",
  212: "vous rendre au 212",
}

// Paramètres communs pour tester les effets :
//   stats basses pour qu'elles montent jusqu'à la cible
//   stats_start hautes pour fixer la référence
// Résultats attendus :
//   endurance : start-2 = 20-2 = 18  (current=6  → monte à 18)
//   habilete  : start-1 = 20-1 = 19  (current=5  → monte à 19)
//   chance    : delta+4 ignore_max    (current=7  → 7+4 = 11)
const STATS_PARAMS =
  'habilete=5&endurance=6&chance=7' +
  '&habilete_start=20&endurance_start=20&chance_start=20' +
  '&ignore_stat_limit=1'

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

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  // ── Effets à l'arrivée ────────────────────────────────────────────────────

  test('Endurance remontée à start-2 (18)', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&${STATS_PARAMS}`)
    await page.waitForSelector('.section-text')

    const value = await page.locator('#stat-endurance').textContent()
    expect(Number(value)).toBe(18)
  })

  test('Habilete remontée à start-1 (19)', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&${STATS_PARAMS}`)
    await page.waitForSelector('.section-text')

    const value = await page.locator('#stat-habilete').textContent()
    expect(Number(value)).toBe(19)
  })

  test('Chance augmentée de +4 ignore_max (11)', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&${STATS_PARAMS}`)
    await page.waitForSelector('.section-text')

    const value = await page.locator('#stat-chance').textContent()
    expect(Number(value)).toBe(11)
  })

  // ── Effets ne descendent pas si stat déjà supérieure ─────────────────────
  // endurance=25 > start-2=18 → doit rester à 25 (ignore_max non activé)

  test('Endurance ne descend pas si déjà supérieure à start-2', async ({ page }) => {
    await page.goto(
      `/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}` +
      `&habilete=5&endurance=25&chance=7` +
      `&habilete_start=20&endurance_start=20&chance_start=20&ignore_stat_limit=1`
    )
    await page.waitForSelector('.section-text')

    const value = await page.locator('#stat-endurance').textContent()
    expect(Number(value)).toBe(25)
  })

  // ── Navigation ────────────────────────────────────────────────────────────

  navigationTests(test, SECTION_CHOICES)
})
