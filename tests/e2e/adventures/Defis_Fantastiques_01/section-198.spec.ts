import { test, expect } from '@playwright/test'
import { testSection, testStat, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 198
const SECTION_TEXT = "L'une des clés fonctionne, mais pas les deux autres"
// tenter_chance :
//   si_reussi → effet -2 ENDURANCE (esquive fléchettes) puis choix → section 139
//   si_echoue → défaite

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

  test('Tentez votre Chance réussi (lance_de=1) → bouton section 139 disponible', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=1`)
    await page.waitForSelector('.section-text')

    await page.click('button:has-text("Tenter ma chance et esquiver la flechette")')
    await page.click('button:has-text("Lancer")')
    await page.waitForSelector('button:has-text("Lancer")', { state: 'hidden', timeout: 5000 })

    // Après succès le bouton "Essayer une nouvelle combinaison" doit apparaître
    const btnSuivant = page.locator('button:has-text("Essayer une nouvelle combinaison de clés")')
    await expect(btnSuivant).toBeVisible()
  })

  test('Tentez votre Chance réussi : perte de -2 ENDURANCE', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=10&lance_de=1`)
    await page.waitForSelector('.section-text')

    await page.click('button:has-text("Tenter ma chance et esquiver la flechette")')
    await page.click('button:has-text("Lancer")')
    await page.waitForSelector('button:has-text("Lancer")', { state: 'hidden', timeout: 5000 })

    await testStat(page, 'endurance', 8)
  })

  test('Tentez votre Chance échoué (lance_de=11) → défaite', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=11`)
    await page.waitForSelector('.section-text')

    await page.click('button:has-text("Tenter ma chance et esquiver la flechette")')
    await page.click('button:has-text("Lancer")')

    await page.waitForSelector('#view-defeat', { timeout: 5000 })
    await expect(page.locator('#view-defeat')).toBeVisible()
  })
})