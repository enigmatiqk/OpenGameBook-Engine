import { test, expect } from '@playwright/test'
import { testSectionAndText, testChoiceButtons, testNavigation } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 17
const SECTION_TEXT = "de l'épieu et du maillet"
const SECTION_CHOICES = {
  144: 'Combattre',
  327: 'Tentez votre Chance',
  380: 'Fuir'
}

test.describe('Section 017 - Le Vampire', () => {

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

  test('Avant action : seul "Tentez votre Chance" est disponible', async ({ page }) => {
    const chanceBtn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[327]}")`)
    await expect(chanceBtn).toBeEnabled()

    // Les boutons "Fuir" et "Combattre" doivent être désactivés
    const fuirBtn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[380]}")`)
    await expect(fuirBtn).toBeDisabled()

    const combattreBtn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[144]}")`)
    await expect(combattreBtn).toBeDisabled()
  })

  test('Après action réussie : navigation vers section 327', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&chance=50`)
    await page.waitForSelector('.section-text')

    // Cliquer sur "Tentez votre Chance"
    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[327]}")`)
    await page.waitForSelector('.action-roll-btn', { timeout: 5000 })

    //Lancer
    await page.click(`.action-roll-btn`)
    
    // Vérifier qu'on est à la section 327
    await page.waitForSelector('[data-section="327"]', { timeout: 10000 })
    const sectionContent = page.locator('[data-section="327"]')
    await expect(sectionContent).toBeVisible()
  })

  test('Après action échouée : "Fuir" et "Combattre" sont disponibles', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&chance=1`)
    await page.waitForSelector('.section-text')
    
    // Cliquer sur "Tentez votre Chance"
    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[327]}")`)
    await page.waitForSelector('.action-roll-btn', { timeout: 5000 })

    //Lancer
    await page.click(`.action-roll-btn`)
    
    // Attendre que la page se mette à jour
    await page.waitForSelector('.section-text', { timeout: 5000 })
    
    const chanceBtn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[327]}")`)
    await expect(chanceBtn).toBeDisabled()

    // Les boutons "Fuir" et "Combattre" doivent maintenant être activés
    const fuirBtn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[380]}")`)
    await expect(fuirBtn).toBeEnabled()

    const combattreBtn = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[144]}")`)
    await expect(combattreBtn).toBeEnabled()
  })

  test('Navigation vers section 380 (Fuir)', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&chance=1`)
    await page.waitForSelector('.section-text')
    
    // Cliquer sur "Tentez votre Chance"
    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[327]}")`)
    await page.waitForSelector('.action-roll-btn', { timeout: 5000 })

    //Lancer
    await page.click(`.action-roll-btn`)
    
    // Attendre que la page se mette à jour
    await page.waitForSelector('.section-text', { timeout: 5000 })
    
    // Cliquer sur "Fuir"
    await testNavigation(page, SECTION_CHOICES, 2)
  })

  test('Navigation vers section 144 (Combattre)', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&chance=1`)
    await page.waitForSelector('.section-text')
    
    // Cliquer sur "Tentez votre Chance"
    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[327]}")`)
    await page.waitForSelector('.action-roll-btn', { timeout: 5000 })

    //Lancer
    await page.click(`.action-roll-btn`)
    
    // Attendre que la page se mette à jour
    await page.waitForSelector('.section-text', { timeout: 5000 })
    
    // Cliquer sur "Combattre"
    await testNavigation(page, SECTION_CHOICES, 0)
  })
})
