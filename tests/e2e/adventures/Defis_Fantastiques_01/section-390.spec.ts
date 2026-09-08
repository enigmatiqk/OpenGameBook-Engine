import { test } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, repasTests, testStat, testMonnaie } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 390
const SECTION_TEXT = "La Goule a un soubresaut et meurt"
const SECTION_CHOICES = {
  0: "Prendre un repas",
  120: "Aller au nord",
  393: "Fouiller le deuxième cadavre"
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    await screenshotOnFailure(page, testInfo, SECTION_NUMBER)
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&chance=10&ignore_stat_limit`)
    await page.waitForSelector('.section-text')
  })

  test('Section et texte', async ({ page }) => {
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  navigationTests(test, SECTION_CHOICES)

  repasTests(test, SECTION_CHOICES[0] )

  test('gain stat', async ({ page }) => {
    await testStat(page, "chance", 12)
  })

  test('gain or', async ({ page }) => {
    await testMonnaie(page, 6)
  })
})
