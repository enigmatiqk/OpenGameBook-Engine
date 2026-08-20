import { test, expect} from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, testItem } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 215
const SECTION_TEXT = "Vous fouillez dans votre sac à dos à la recherche du bâton"
const SECTION_CHOICES = {
  142: "Prendre mon épée et attaquer",
  105: "Chercher encore dans le sac à dos"
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

  navigationTests(test, SECTION_CHOICES)

  test('Vérification effet - baton', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=baton-y&item_count=2`)
    await page.waitForSelector('.section-text')

    await testItem(page, "baton-y", 1)
  })

  test('Vérification destruction baton', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=baton-y`)
    await page.waitForSelector('.section-text')

    const item = page.locator(`.inv-items #baton-y`)
    await expect(item).toBeHidden()
  })
})