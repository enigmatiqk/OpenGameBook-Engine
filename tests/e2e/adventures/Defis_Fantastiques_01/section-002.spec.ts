import { test, expect } from '@playwright/test'
import { testSectionAndText, testChoiceButtons, testNavigation } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 2
const SECTION_TEXT = 'Tentez votre Chance'
const SECTION_CHOICES = {
  0:'Tentez votre Chance'
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

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

  test('Navigation vers section 269 (avec chance - lance_de=5)', async ({ page }) => {
    // Surcharger l'URL avec lance_de=5
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=5`)
    await page.waitForSelector('.section-text')
    
    // Avec lance_de=5 et chance=10, 2d6=10 <= 10 donc succès → section 269
    // Cliquer sur le bouton "Tentez votre Chance"
    await page.click(`button:has-text("${SECTION_CHOICES[0]}")`)
    
    // Cliquer sur le bouton "Lancer"
    await page.click('button:has-text("Lancer")')
    
    // Attendre le chargement de la section 269
    await page.waitForSelector('.section-text')
    
    // Vérifier qu'on est à la section 269
    const sectionContent = page.locator('[data-section="269"]')
    await expect(sectionContent).toBeVisible()
  })

  test('Navigation vers section 16 (sans chance - lance_de=11)', async ({ page }) => {
    // Surcharger l'URL avec lance_de=11
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=11`)
    await page.waitForSelector('.section-text')
    
    // Avec lance_de=11 et chance=10, 2d6=22 > 10 donc échec → section 16
    // Cliquer sur le bouton "Tentez votre Chance"
    await page.click(`button:has-text("${SECTION_CHOICES[0]}")`)
    
    // Cliquer sur le bouton "Lancer"
    await page.click('button:has-text("Lancer")')
    
    // Attendre le chargement de la section 16
    await page.waitForSelector('.section-text')
    
    // Vérifier qu'on est à la section 16
    const sectionContent = page.locator('[data-section="16"]')
    await expect(sectionContent).toBeVisible()
  })
})
