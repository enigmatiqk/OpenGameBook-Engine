import { test, expect } from '@playwright/test'
import { testSection, testStat, tenterChance, testNavigation, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 243
const SECTION_TEXT = "A votre grande horreur"

const CHOIX_LANCER_DE = "Main droite ou main gauche ?"
const CHOIX_LEVIER    = "Essayer le levier de droite"

const SECTION_CHOICES = {
  128: CHOIX_LEVIER
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

  test('Choix 2 disabled à l\'arrivée (lancer_de pas encore fait)', async ({ page }) => {
    const btn = page.locator(`.choices-list button:has-text("${CHOIX_LEVIER}")`)
    await expect(btn).toBeDisabled()
  })

  test('lance_de=2 (pair) : perte -1 HAB / -2 END', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=10&endurance=10&lance_de=2&ignore_stat_limit`)
    await page.waitForSelector('.section-text')

    await tenterChance(page, CHOIX_LANCER_DE)

    await testStat(page, 'habilete', 9)   // -1 HAB
    await testStat(page, 'endurance', 8)  // -2 END
  })

  test('lance_de=3 (impair) : perte -3 HAB / -1 END', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=10&endurance=10&lance_de=3&ignore_stat_limit`)
    await page.waitForSelector('.section-text')

    await tenterChance(page, CHOIX_LANCER_DE)

    await testStat(page, 'habilete', 7)   // -3 HAB
    await testStat(page, 'endurance', 9)  // -1 END
  })

  test('Après le lancer : choix 1 disabled, choix 2 enabled', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=2`)
    await page.waitForSelector('.section-text')

    await tenterChance(page, CHOIX_LANCER_DE)

    const btn1 = page.locator(`.choices-list button:has-text("${CHOIX_LANCER_DE}")`)
    const btn2 = page.locator(`.choices-list button:has-text("${CHOIX_LEVIER}")`)

    await expect(btn1).toBeDisabled()
    await expect(btn2).toBeEnabled()
  })

  test('Navigation vers section 128 après le lancer', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=2`)
    await page.waitForSelector('.section-text')

    await tenterChance(page, CHOIX_LANCER_DE)

    await testNavigation(page, SECTION_CHOICES, 0)
  })
})
