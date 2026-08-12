import { test } from '@playwright/test'
import { testSection, testChoiceButtons, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 144
const SECTION_TEXT = "La créature plonge son regard dans le vôtre"
const SECTION_CHOICES = {
  0: 'Tentez votre Chance'
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

  test('Tentez votre Chance réussi (lance_de=1) → section 101', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=1`)
    await page.waitForSelector('.section-text')

    await page.click('button:has-text("Tentez votre Chance")')
    await page.click('button:has-text("Lancer")')
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await testSection(page, 101)
  })

  test('Tentez votre Chance échoué (lance_de=11) → section 217', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=11`)
    await page.waitForSelector('.section-text')

    await page.click('button:has-text("Tentez votre Chance")')
    await page.click('button:has-text("Lancer")')
    await page.waitForSelector('.section-text', { timeout: 5000 })

    await testSection(page, 217)
  })
})