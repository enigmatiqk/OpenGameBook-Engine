import { test, expect } from '@playwright/test'
import { testSectionAndText, testChoiceButtons, testNavigation } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 3
const SECTION_TEXT = 'La cloche tinte faiblement'
const SECTION_CHOICES = {
  127: 'Le menacer',
  272: 'Le payer'
}

test.describe('Section 003 - Le Passeur', () => {

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== 'passed') {
      const screenshotPath = `test-results/section-${String(SECTION_NUMBER).padStart(3, '0')}-${testInfo.title.replace(/\s+/g, '-')}-failed.png`
      await page.screenshot({ path: screenshotPath })
    }
  })

  test.beforeEach(async ({ page }) => {
    // Lancer le jeu en mode debug
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}`)
    // Attendre que la section soit chargée
    await page.waitForSelector('.section-text')
  })

  test('Section et texte', async ({ page }) => {
    await testSectionAndText(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  test('Bouton "Le payer" désactivé sans pièces', async ({ page }) => {
    // Sans pièces d'or, le bouton "Le payer" doit être désactivé
    const payButton = page.locator(`button:has-text("${SECTION_CHOICES[272]}")`)
    await expect(payButton).toBeDisabled()
  })

  test('Bouton "Le payer" activé avec 3 pièces d\'or', async ({ page }) => {
    // Charger la page avec 3 pièces d'or
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=pieces_or&item_count=3`)
    await page.waitForSelector('.section-text')
    
    // Avec 3 pièces d'or, le bouton "Le payer" doit être activé
    const payButton = page.locator(`button:has-text("${SECTION_CHOICES[272]}")`)
    await expect(payButton).toBeEnabled()
  })

  test('Navigation vers section 272 (payer avec 3 pièces d\'or)', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 1, 'item_id=pieces_or&item_count=3')
  })

  test('Navigation vers section 127 (menacer)', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 0)
  })
})
