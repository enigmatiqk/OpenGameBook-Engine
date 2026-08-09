import { test, expect } from '@playwright/test'
import { testSectionAndText, testChoiceButtons, testNavigation } from '../../helpers/commonTests'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 11
const SECTION_TEXT = 'outils magiques'
const SECTION_CHOICES = {
  366: 'Aller au nord',
  250: 'Aller au sud'
}

test.describe('Section 011 - Les Outils Magiques', () => {

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

  test('Vérifier l\'augmentation de stat', async ({ page }) => {
    // Charger avec endurance initiale de 10 et ignore_stat_limit pour dépasser le max
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=10&endurance=10&ignore_stat_limit`)
    await page.waitForSelector('.section-text')
    
    // Vérifier que l'endurance a augmenté de 2 (10 + 2 = 12)
    let enduranceValue = await page.locator('#stat-endurance').textContent()
    expect(enduranceValue).toBe('12')

    // Vérifier que l'habilete a augmenté de 1 (10 + 1 = 11)
    let habiletyValue = await page.locator('#stat-habilete').textContent()
    expect(habiletyValue).toBe('11')
  })

  test('Navigation vers section 366 (nord)', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 0)
  })

  test('Navigation vers section 250 (sud)', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 1)
  })
})
