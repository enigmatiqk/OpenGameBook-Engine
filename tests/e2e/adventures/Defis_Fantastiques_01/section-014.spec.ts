import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testNavigation, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 3
const SECTION_NUMBER = 14
const SECTION_TEXT = "Il n'y a pas trace de passage secret"
const SECTION_CHOICES = {
  161: "Découvrir ce qui s'approche ainsi"
}

test.describe('Section 014', () => {

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

  test('Navigation vers section 161', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES, 0)
  })

  test('Combat 161, victoire en 117', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&monstre_endurance=2&habilete=50`)
    await page.waitForSelector('.section-text')

    //aller sur la page de combat
    await page.click(`.choices-list button:has-text("${SECTION_CHOICES[161]}")`)
    await page.waitForSelector('.section-text')

    //definir le monstre
    await page.click(`.choice-btn--combat`)
    //lancer de
    await page.click(`.action-roll-btn`)
    //round 1
    await page.click(`.combat-roll-btn`)
    await page.click(`.combat-roll-btn`)

    await page.waitForSelector('.combat-next-btn')
    await page.click(`.combat-next-btn`)
    
    await testSection(page, 117)

  })
})