import { test } from '@playwright/test'
import { testSection, testChoiceButtons, testNavigation, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 34
const SECTION_TEXT = 'En examinant les outils'
const SECTION_CHOICES = {
  0: "Prendre le maillet en bois",
  1: "Prendre le ciseau avec lame en argent",
  96: 'Aller voir de quoi il s\'agit'
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

  test('Navigation vers section 96', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 2)
  })
})