import { test, expect } from '@playwright/test'
import { testSection, testCombatStart, testCombatRound, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 143
const SECTION_TEXT = "Vous vous accroupissez sur le sable de la rive"
// VER MARIN GÉANT : HABILETÉ 7, ENDURANCE 7
// Fuite disponible à partir du round 3 → section 399
// Victoire → section 44

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

  test('Combat gagné → section 44', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&monstre_endurance=1&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await testCombatRound(page)
    await page.click('button.combat-next-btn')

    await testSection(page, 44)
  })

  test('Combat perdu → écran défaite', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=1&endurance=1&lance_de=6`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await testCombatRound(page)
    await page.click('button.combat-next-btn')

    await page.waitForSelector('#view-defeat', { timeout: 5000 })
    await expect(page.locator('#view-defeat')).toBeVisible()
  })

  test('Fuite disponible au round 3 → section 399', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=1&endurance=100&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    // Round 1
    await testCombatRound(page)
    await page.click('button.combat-next-btn')
    // Round 2
    await testCombatRound(page)
    await page.click('button.combat-next-btn')
    // Round 3 : le bouton de fuite doit apparaître
    await testCombatRound(page)

    const fuiteBtn = page.locator('button.combat-fuite-direct-btn')
    await expect(fuiteBtn).toBeVisible()
    await fuiteBtn.click()
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await testSection(page, 399)
  })
})