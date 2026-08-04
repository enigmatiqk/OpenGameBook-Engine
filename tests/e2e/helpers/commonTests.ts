import { expect, Page } from '@playwright/test'

/**
 * Teste que la bonne section est affichée
 */
export async function testSection(page: Page, sectionNumber: number, expectedText?: string) {
  // await page.waitForSelector(`[data-section="${sectionNumber}"]`, { timeout: 5000 })
  const sectionContent = page.locator(`[data-section="${sectionNumber}"]`)
  await expect(sectionContent).toBeVisible()

  if (expectedText) {
    const sectionText = page.locator('.section-text')
    await expect(sectionText).toContainText(expectedText)
  }
}

/**
 * Teste que la bonne section est affichée et que le texte est correct
 */
export async function testSectionAndText(page: Page, sectionNumber: number, expectedText: string) {
  await testSection(page, sectionNumber, expectedText)
}

/**
 * Teste que le nombre de boutons de choix est correct et que les labels sont présents
 */
export async function testChoiceButtons(page: Page, sectionChoices: Record<number, string>) {
  const buttonLabels = Object.values(sectionChoices)
  const choiceButtons = page.locator('.choice-btn')
  await expect(choiceButtons).toHaveCount(buttonLabels.length)
  
  for (const label of buttonLabels) {
    const button = page.locator(`.choices-list button:has-text("${label}")`)
    // Vérifier que le bouton existe (même s'il est désactivé)
    await expect(button).toHaveCount(1)
  }
}

/**
 * Teste la navigation vers une section cible
 * @param page - La page Playwright
 * @param sectionChoices - L'objet SECTION_CHOICES { sectionNumber: buttonLabel, ... }
 * @param choiceIndex - L'index du choix (0, 1, ...)
 * @param urlParams - Paramètres URL optionnels (ex: "item_id=pieces_or&item_count=3")
 */
export async function testNavigation(page: Page, sectionChoices: Record<number, string>, choiceIndex: number, urlParams?: string) {
  const entries = Object.entries(sectionChoices)
  const [targetSectionStr, buttonLabel] = entries[choiceIndex]
  const targetSection = Number(targetSectionStr)
  
  // Si des paramètres URL sont fournis, recharger la page avec ces paramètres
  if (urlParams) {
    const currentUrl = page.url()
    const separator = currentUrl.includes('?') ? '&' : '?'
    await page.goto(`${currentUrl}${separator}${urlParams}`)
    await page.waitForSelector('.section-text', { timeout: 5000 })
  }
  
  await page.click(`.choices-list button:has-text("${buttonLabel}")`)
  // Attendre le chargement de la nouvelle section
  await page.waitForSelector('.section-text', { timeout: 5000 })
  // Vérifier qu'on est à la bonne section
  const sectionContent = page.locator(`[data-section="${targetSection}"]`)
  await expect(sectionContent).toBeVisible()
}

/**
 * Génère des tests de navigation pour chaque choix d'une section.
 */
export function navigationTests(test: (name: string, fn: (args: { page: Page }) => Promise<void>) => void, sectionChoices: Record<number, string>) {
  Object.entries(sectionChoices).forEach(([targetSection], index) => {
    test(`Navigation vers section ${targetSection}`, async ({ page }) => {
      await testNavigation(page, sectionChoices, index)
    })
  })
}

/**
 * verifie une stat
 * @param page - La page Playwright
 * @param stat - la statistique (ex: habilete)
 * @param value - la valeur de la statistique attendue
 */
export async function testStat(page: Page, stat: String, value: Number) {
    const statValue = Number(await page.locator(`#stat-${stat}`).textContent())
    expect(statValue).toBe(value)
}

/**
 * Vérifie qu'un item est visible dans l'inventaire et que son data-count est correct
 * @param page - La page Playwright
 * @param item_id - l'id DOM de l'item (ex: "cle-111")
 * @param count - le nombre d'item attendu (default: 1)
 * @param strict - si true: data-count === count, si false: data-count >= count (default: false)
 */
export async function testItem(page: Page, item_id: string, count: number = 1, strict: boolean = false) {
  const item = page.locator(`#${item_id}`)
  await expect(item).toBeVisible()

  const rawCount = await item.getAttribute('data-count')
  if (rawCount !== null) {
    const actual = Number(rawCount)
    if (strict) {
      expect(actual).toBe(count)
    } else {
      expect(actual).toBeGreaterThanOrEqual(count)
    }
  }
}

/**
 * Lance le combat (clic sur le bouton de combat)
 * @param page - La page Playwright
 */
export async function testCombatStart(page: Page) {
  await page.click('button.choice-btn--combat')
  await page.waitForSelector('.combat-view', { timeout: 10000 })
}

/**
 * Lance un round de combat (dé monstre + dé héros)
 * @param page - La page Playwright
 */
export async function testCombatRound(page: Page) {
  // Lancer le dé monstre
  await page.click('button.combat-roll-btn')
  // Lancer le dé heros
  await page.click('button.combat-roll-btn')
  await page.waitForSelector('.combat-actions', { timeout: 10000 })
}

/**
 * Passe au round suivant du combat
 * @param page - La page Playwright
 */
export async function testRoundSuivant(page: Page) {
  await page.click('button.combat-next-btn')
  await page.waitForSelector('.combat-log', { timeout: 5000 })
}
