import { test, expect } from '@playwright/test'
import { testSectionAndText, testChoiceButtons, testNavigation, testCombatStart, testCombatRound, testRoundSuivant } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 24
const SECTION_TEXT = "Après avoir subi votre troisième blessure"
const SECTION_CHOICES = {
  360: 'Prendre la fuite',
  0: 'Continuer le combat',
  135: 'J\'ai vaincu la créature'
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
    await testSectionAndText(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  test('perte habileté à l\'arrivée sur la section', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=10`)
    await page.waitForSelector('.section-text')

    const habileValue = await page.locator('#stat-habilete').textContent()
    expect(habileValue).toBe('9')
  })

  test('tester section -1', async ({ page }) => {
    // "Continuer le combat" redirige vers section -1 = retour à la section précédente (sn1)
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&sn1=8`)
    await page.waitForSelector('.section-text')

    await page.click(`.choices-list button:has-text("Continuer le combat")`)

    // On doit être renvoyé sur la section définie dans sn1
    await page.waitForSelector('[data-section="8"]', { timeout: 5000 })
    await expect(page.locator('[data-section="8"]')).toBeVisible()
  })

  test('fuite avec perte d\'endurance', async ({ page }) => {
    // La fuite vers 360 applique -2 endurance
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=10&endurance=10`)
    await page.waitForSelector('.section-text')

    // Fuir vers 360
    await page.click(`.choices-list button:has-text("Prendre la fuite")`)
    await page.waitForSelector('[data-section="360"]', { timeout: 5000 })
    await expect(page.locator('[data-section="360"]')).toBeVisible()

    // Vérifier la perte d'endurance due à la fuite
    const enduranceValue = await page.locator('#stat-endurance').textContent()
    expect(enduranceValue).toBe('8')
  })

  test('tester condition combat_victoire', async ({ page }) => {
    // Avec combat_victoire=1, seul "J'ai vaincu la créature" est disponible
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&combat_victoire=1`)
    await page.waitForSelector('.section-text')

    // Les boutons conditionnels "non victoire" doivent être masqués/désactivés
    const fuiteBtn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[360]}")`)
    const continuerBtn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await expect(fuiteBtn).toBeDisabled()
    await expect(continuerBtn).toBeDisabled()

    // Seul "J'ai vaincu la créature" est actif
    const victoireBtn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[135]}")`)
    await expect(victoireBtn).toBeEnabled()

    // Naviguer vers 135
    await victoireBtn.click()
    await page.waitForSelector('[data-section="135"]', { timeout: 5000 })
    await expect(page.locator('[data-section="135"]')).toBeVisible()
  })
})
