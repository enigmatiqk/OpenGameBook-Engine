import { test } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 305
const SECTION_TEXT = "Tentez votre Chance trois fois"
const SECTION_CHOICES = {
  0: "Tentez votre chance"
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

  test('Tenter chance defaite', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=6`)
    await page.waitForSelector('.section-text')

    const button = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await button.click()

    await page.click('button:has-text("Lancer")')
    await page.waitForSelector('button:has-text("Lancer")', { state: 'hidden', timeout: 5000 })

    await testSection(page,108)
  })

  test('Tenter chance defaite au 2nd', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de_pile=1,1,6,6`)
    await page.waitForSelector('.section-text')

    const button = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await button.click()

    await page.click('button:has-text("Lancer")')

    await page.waitForSelector('button:has-text("Lancer"):not([disabled])', { timeout: 10000 })
    await page.click('button:has-text("Lancer")')

    await testSection(page,108)
  })

  test('Tenter chance reussite', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&lance_de=1`)
    await page.waitForSelector('.section-text')

    const button = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[0]}")`)
    await button.click()

    await page.click('button:has-text("Lancer")')

    await page.waitForSelector('button:has-text("Lancer"):not([disabled])', { timeout: 10000 })
    await page.click('button:has-text("Lancer")')

    await page.waitForSelector('button:has-text("Lancer"):not([disabled])', { timeout: 10000 })
    await page.click('button:has-text("Lancer")')

    await testSection(page,162)
  })
})
