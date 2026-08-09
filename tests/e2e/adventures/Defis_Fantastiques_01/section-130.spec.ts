import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testNavigation, testStat, testMonnaie } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 130
const SECTION_TEXT = 'Le vieil homme vous demande combien vous misez'
const SECTION_CHOICES = {
  0:   'Participer au jeu de dés',
  280: 'Revenir à la bifurcation'
}

// Joue un pari complet : saisit la mise, lance le dé héros, lance le dé adversaire
async function jouerPari(page: any, mise: number = 1) {
  await page.click(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)

  // Saisir la mise
  await page.waitForSelector('.duel-mise-input', { timeout: 5000 })
  await page.fill('.duel-mise-input', String(mise))
  await page.click('.action-roll-btn')

  // Jet héros — attendre la modale avec "Votre jet"
  await page.waitForSelector('.modal-title:has-text("Votre jet")', { timeout: 5000 })
  await page.click('button:has-text("Lancer")')

  // Attendre la modale adversaire (titre contient "adversaire")
  await page.waitForSelector('.modal-title:has-text("adversaire")', { timeout: 8000 })
  await page.click('button:has-text("Lancer")')

  // Attendre que la modale adversaire disparaisse (résultat + 2s auto)
  await page.waitForSelector('.modal-title:has-text("adversaire")', { state: 'hidden', timeout: 8000 })
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== 'passed') {
      const screenshotPath = `test-results/section-${String(SECTION_NUMBER).padStart(3, '0')}-${testInfo.title.replace(/\s+/g, '-')}-failed.png`
      await page.screenshot({ path: screenshotPath })
    }
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=piece-or&item_count=5`)
    await page.waitForSelector('.section-text')
  })

  test('Section et texte', async ({ page }) => {
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  // ─── Pas d'or → bouton désactivé ─────────────────────────────────────────────

  test('Bouton désactivé sans pièces d\'or', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=piece-or&item_count=0`)
    await page.waitForSelector('.section-text')
    const btn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await expect(btn).toBeDisabled()
  })

  // ─── Saisie de mise ───────────────────────────────────────────────────────────

  test.describe('Saisie de mise', () => {

    test('Max limité à 20 même avec plus d\'or', async ({ page }) => {
      await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=piece-or&item_count=30`)
      await page.waitForSelector('.section-text')
      await page.click(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
      await page.waitForSelector('.duel-mise-input')
      const maxAttr = await page.locator('.duel-mise-input').getAttribute('max')
      expect(Number(maxAttr)).toBe(20)
    })

    test('Max limité à la quantité disponible si < 20', async ({ page }) => {
      await page.click(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
      await page.waitForSelector('.duel-mise-input')
      const maxAttr = await page.locator('.duel-mise-input').getAttribute('max')
      expect(Number(maxAttr)).toBe(5)
    })

    test('Annuler ferme la modale sans jouer', async ({ page }) => {
      await page.click(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
      await page.waitForSelector('.duel-mise-input')
      await page.click('.duel-mise-cancel')
      await expect(page.locator('.duel-mise-input')).not.toBeVisible()
      await testMonnaie(page, 5)
    })
  })

  // ─── Défaite au pari (lance_de=1 héros, lance_de2=6 adversaire) ──────────────

  test.describe('Défaite — lance_de=1, lance_de2=6', () => {

    test.beforeEach(async ({ page }) => {
      await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=piece-or&item_count=5&lance_de=1&lance_de2=6`)
      await page.waitForSelector('.section-text')
    })

    test('Perte de la mise (1 or) après défaite', async ({ page }) => {
      await jouerPari(page, 1)
      await testMonnaie(page, 4)
    })

    test('On peut rejouer après une défaite si on a encore de l\'or', async ({ page }) => {
      await jouerPari(page, 1)
      await expect(page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)).toBeEnabled()
    })
  })

  // ─── Victoire au pari (lance_de=6 héros, lance_de2=1 adversaire) ─────────────

  test.describe('Victoire — lance_de=6, lance_de2=1', () => {

    test.beforeEach(async ({ page }) => {
      await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=piece-or&item_count=5&habilete=5&endurance=5&chance=5&ignore_stat_limit&lance_de=6&lance_de2=1`)
      await page.waitForSelector('.section-text')
    })

    test('Gain de la mise x2 (mise=2 → +2 or, total=7)', async ({ page }) => {
      await jouerPari(page, 2)
      await testMonnaie(page, 7)
    })

    test('Gain de +2 habilité après victoire', async ({ page }) => {
      await jouerPari(page, 1)
      await testStat(page, 'habilete', 7)
    })

    test('Gain de +2 endurance après victoire', async ({ page }) => {
      await jouerPari(page, 1)
      await testStat(page, 'endurance', 7)
    })

    test('Gain de +2 chance après victoire', async ({ page }) => {
      await jouerPari(page, 1)
      await testStat(page, 'chance', 7)
    })
  })

  // ─── Navigation second choix ──────────────────────────────────────────────────

  test('Navigation vers section 280', async ({ page }) => {
    await testNavigation(page, { 280: SECTION_CHOICES[280] }, 0)
  })
})
