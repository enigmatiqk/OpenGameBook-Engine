import { test, expect } from '@playwright/test'
import { testSectionAndText, testChoiceButtons, testNavigation } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 15
const SECTION_TEXT = 'Tandis que vous êtes assis'
const SECTION_CHOICES = {
  367: 'Avancer le long du couloir'
}

test.describe('Section 015', () => {

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

  test('Vérifier l\'augmentation de la stat habileté', async ({ page }) => {
    // Charger avec endurance initiale de 10 et ignore_stat_limit pour dépasser le max
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=10&ignore_stat_limit=1`)
    await page.waitForSelector('.section-text')

    // Vérifier que l'habilete a augmenté de 1 (10 + 1 = 11)
    let habiletyValue = await page.locator('#stat-habilete').textContent()
    expect(habiletyValue).toBe('11')
  })

  test('manger repas', async ({ page }) => {
    // Charger avec endurance initiale de 10 et ignore_stat_limit pour dépasser le max
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=repas&item_count=1&endurance=10&ignore_stat_limit=1`)
    await page.waitForSelector('.section-text')
    
    // Vérifier que l'endurance a augmenté de 4
    let enduranceValue = await page.locator('#stat-endurance').textContent()
    expect(enduranceValue).toBe('14')
  })

  test('Navigation vers section 367', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 0)
  })
})
