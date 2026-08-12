import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testNavigation, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 38
const SECTION_TEXT = "Vous ouvrez la porte et vous trouvez le garde-manger"

// Pour testChoiceButtons : clés fictives distinctes — seuls les labels sont vérifiés par le helper
const SECTION_CHOICES: Record<number, string> = {
  661: "Prendre le bocal et sortir par la porte sud",
  662: "Sortir par la porte sud sans prendre le bocal",
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    await screenshotOnFailure(page, testInfo, SECTION_NUMBER)
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

  test('prendre le bocal avant de naviguer vers 66', async ({ page }) => {
    // Démarrer avec 0 repas
    await testNavigation(page, { 66: SECTION_CHOICES[661] }, 0, 'item_id=repas&item_count=0')
    // Après avoir pris le bocal, on doit avoir 2 repas dans l'inventaire
    const repasItem = page.locator('#repas')
    await expect(repasItem).toBeVisible()
    await expect(repasItem).toHaveAttribute('data-count', '2')
  })

  test('Navigation vers section 66 sans bocal', async ({ page }) => {
    // Démarrer avec 0 repas
    await testNavigation(page, { 66: SECTION_CHOICES[662] }, 0, 'item_id=repas&item_count=0')
    // Sans bocal, les repas doivent rester à 0 (item absent de l'inventaire)
    const repasItem = page.locator('#repas')
    await expect(repasItem).toHaveAttribute('data-count', '0')
  })
})