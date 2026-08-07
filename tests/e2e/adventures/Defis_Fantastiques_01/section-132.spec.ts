import { test, expect } from '@playwright/test'
import { testSection, testItem } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 132
const SECTION_TEXT = 'Le bouclier est en bois'

// Les deux choix mènent à la section 319
const SECTION_CHOICES = {
  garder: "Garder le bouclier et continuer",
  jeter:  "Jeter le bouclier et continuer"
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

  test('Deux boutons de choix présents', async ({ page }) => {
    await expect(page.locator(`.choices-list button:has-text("${SECTION_CHOICES.garder}")`)).toHaveCount(1)
    await expect(page.locator(`.choices-list button:has-text("${SECTION_CHOICES.jeter}")`)).toHaveCount(1)
  })

  test('Garder le bouclier → navigation vers 319 + item "bouclier en bois" dans l\'inventaire', async ({ page }) => {
    await page.click(`.choices-list button:has-text("${SECTION_CHOICES.garder}")`)
    await page.waitForSelector('[data-section="319"]', { timeout: 5000 })
    await expect(page.locator('[data-section="319"]')).toBeVisible()

    // L'item doit être présent dans l'inventaire (id dérivé du name : "bouclier-en-bois")
    await testItem(page, 'bouclier-en-bois')
  })

  test('Jeter le bouclier → navigation vers 319 sans item "bouclier en bois"', async ({ page }) => {
    await page.click(`.choices-list button:has-text("${SECTION_CHOICES.jeter}")`)
    await page.waitForSelector('[data-section="319"]', { timeout: 5000 })
    await expect(page.locator('[data-section="319"]')).toBeVisible()

    // L'item ne doit pas apparaître dans l'inventaire
    await expect(page.locator('#bouclier-en-bois')).toHaveCount(0)
  })
})
