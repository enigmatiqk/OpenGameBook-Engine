import { test, expect } from '@playwright/test'
import { testSection } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 105
const SECTION_TEXT = 'Vous fouillez dans votre sac à dos'

// Les 5 choix et leur item requis
const ALL_CHOICES = {
  "Potion d'Invisibilité":        { section: 39,  item_id: 'potion-invisibilite' },
  "L'OEil du Cyclope":            { section: 382, item_id: 'oeil-cyclope' },
  "Un morceau de Fromage":        { section: 368, item_id: 'morceau-fromage' },
  "L'Arc à la Flèche d'Argent":   { section: 194, item_id: 'arc-fleche-argent' },
  "Un Bâton en forme de Y":       { section: 215, item_id: 'baton-y' },
}

// Helpers pour construire les paramètres URL multi-items
function buildItemParams(itemIds: string[]): string {
  return itemIds
    .map((id, i) => i === 0
      ? `item_id=${id}&item_count=1`
      : `item_id${i + 1}=${id}&item_count${i + 1}=1`)
    .join('&')
}

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

  // ── Sans aucun item : aucun bouton actif ──────────────────────────────────
  test('Sans item → aucun bouton actif', async ({ page }) => {
    const buttons = page.locator('.choices-list button:not([disabled])')
    await expect(buttons).toHaveCount(0)
  })

  // ── 2 items : Potion d'Invisibilité + Œil du Cyclope ─────────────────────
  test('Avec 2 items → 2 boutons actifs', async ({ page }) => {
    const params = buildItemParams(['potion-invisibilite', 'oeil-cyclope'])
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&${params}`)
    await page.waitForSelector('.section-text')

    const buttons = page.locator('.choices-list button:not([disabled])')
    await expect(buttons).toHaveCount(2)
  })

  test('Avec 2 items → navigation Potion d\'Invisibilité → section 39', async ({ page }) => {
    const params = buildItemParams(['potion-invisibilite', 'oeil-cyclope'])
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&${params}`)
    await page.waitForSelector('.section-text')

    await page.click(`.choices-list button:has-text("Potion d'Invisibilité")`)
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await testSection(page, 39)
  })

  test('Avec 2 items → navigation Œil du Cyclope → section 382', async ({ page }) => {
    const params = buildItemParams(['potion-invisibilite', 'oeil-cyclope'])
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&${params}`)
    await page.waitForSelector('.section-text')

    await page.click(`.choices-list button:has-text("L'OEil du Cyclope")`)
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await testSection(page, 382)
  })

  // ── 3 items : + morceau de Fromage ───────────────────────────────────────
  test('Avec 3 items → 3 boutons actifs', async ({ page }) => {
    const params = buildItemParams(['potion-invisibilite', 'oeil-cyclope', 'morceau-fromage'])
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&${params}`)
    await page.waitForSelector('.section-text')

    const buttons = page.locator('.choices-list button:not([disabled])')
    await expect(buttons).toHaveCount(3)
  })

  test('Avec 3 items → navigation morceau de Fromage → section 368', async ({ page }) => {
    const params = buildItemParams(['potion-invisibilite', 'oeil-cyclope', 'morceau-fromage'])
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&${params}`)
    await page.waitForSelector('.section-text')

    await page.click(`.choices-list button:has-text("Un morceau de Fromage")`)
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await testSection(page, 368)
  })

  test('Avec 3 items → navigation Potion d\'Invisibilité → section 39', async ({ page }) => {
    const params = buildItemParams(['potion-invisibilite', 'oeil-cyclope', 'morceau-fromage'])
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&${params}`)
    await page.waitForSelector('.section-text')

    await page.click(`.choices-list button:has-text("Potion d'Invisibilité")`)
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await testSection(page, 39)
  })
})
