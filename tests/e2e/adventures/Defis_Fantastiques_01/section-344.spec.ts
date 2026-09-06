import { test } from '@playwright/test'
import { testSection, testChoiceButtons, testItem, screenshotOnFailure, testStat, testNavigation, testEquipement } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 344
const SECTION_TEXT = "Vous rengainez votre épée dans son fourreau"
const SECTION_CHOICES = {
  56: "Jeter mon ancienne épée dans la rivière",
  153: "Conserver les 2 épées"
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    await screenshotOnFailure(page, testInfo, SECTION_NUMBER)
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=10`)
    await page.waitForSelector('.section-text')
  })

  test('Section et texte', async ({ page }) => {
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  test('jeter epee et naviguer', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES,0)

    await testEquipement(page, "epee-legere")
    await testItem(page, "epee", 0)

    await testStat(page, "habilete", 11)
  })

  test('garder epee et naviguer', async ({ page }) => {
    await testNavigation(page, SECTION_CHOICES,1)
  })
})
