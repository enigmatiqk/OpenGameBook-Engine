import { expect, Page, TestInfo } from '@playwright/test'

/**
 * Sanitize un titre de test pour l'utiliser dans un nom de fichier.
 * Remplace tous les caractères non alphanumériques par des tirets,
 * et réduit les tirets consécutifs à un seul.
 */
function sanitizeTitle(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9À-ÿ]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * À appeler dans test.afterEach pour capturer un screenshot en cas d'échec.
 * Le nom de fichier est sanitizé pour éviter les erreurs liées aux caractères spéciaux.
 *
 * @example
 * test.afterEach(async ({ page }, testInfo) => {
 *   await screenshotOnFailure(page, testInfo, SECTION_NUMBER)
 * })
 */
export async function screenshotOnFailure(page: Page, testInfo: TestInfo, sectionNumber: number): Promise<void> {
  if (testInfo.status !== 'passed') {
    const sectionPadded = String(sectionNumber).padStart(3, '0')
    const safeTitle = sanitizeTitle(testInfo.title)
    const screenshotPath = `test-results/section-${sectionPadded}-${safeTitle}-failed.png`
    await page.screenshot({ path: screenshotPath })
  }
}

/**
 * Navigate vers l'URL courante en ajoutant des paramètres supplémentaires.
 * Utile pour enrichir l'URL fournie par beforeEach sans répéter adventure/section.
 * @param page - La page Playwright
 * @param params - Paramètres à ajouter (valeur vide "" pour les flags sans valeur ex: ignore_stat_limit)
 */
export async function gotoWithParams(page: Page, params: Record<string, string>): Promise<void> {
  const url = new URL(page.url())
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  await page.goto(url.toString())
  await page.waitForSelector('.section-text', { timeout: 5000 })
}
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
// export async function testSectionAndText(page: Page, sectionNumber: number, expectedText: string) {
//   await testSection(page, sectionNumber, expectedText)
// }

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

  await testSection(page, targetSection)
}

/**
 * Génère des tests de navigation pour chaque choix d'une section.
 */
export function navigationTests(test: (name: string, fn: (args: { page: Page }) => Promise<void>) => void, sectionChoices: Record<number, string>) {
  Object.entries(sectionChoices).forEach(([targetSection], index) => {
    if (index === 0) return
    test(`Navigation vers section ${targetSection}`, async ({ page }) => {
      await testNavigation(page, sectionChoices, index)
    })
  })
}

export function repasTests(test: (name: string, fn: (args: { page: Page }) => Promise<void>) => void, button_name: string) {


  test('no repas', async ({ page }) => {
    const button = page.locator(`.choices-list button:has-text("${button_name}")`)
    await expect(button).toBeDisabled()
  })

  test('repas', async ({ page }) => {
    // await page.goto(`/?adventure=${adventure_id}&section=${section_number}&endurance=10&item_id=repas&item_count=2&ignore_stat_limit`)
    // await page.waitForSelector('.section-text')
    await gotoWithParams(page, { endurance:'10', 'item_id':'repas', item_count:'2', ignore_stat_limit:''})

    await page.click(`.choices-list button:has-text("${button_name}")`)

    await testItem(page, "repas",1)
    await testStat(page, "endurance", 14)
    const button = page.locator(`.choices-list button:has-text("${button_name}")`)
    await expect(button).toBeDisabled()
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
  const item = page.locator(`.inv-items #${item_id}`)

  if (count === 0) {
    // Vérifier que l'item est absent du DOM
    await expect(item).toHaveCount(0)
    return
  }

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

export async function showFicheHero(page: Page) {
  //fiche hero
  await page.click(`.btn-hero-sheet`)
  await page.waitForSelector('.equipment-grid-rpg', { timeout: 5000 })
}

export async function closeModal(page: Page) {
  await page.click(`.modal-close`)
  await page.waitForSelector('.modal-close', { state: 'hidden', timeout: 5000 })
}

export async function dropEquipment(page: Page, item_id: string) {
  const button_drop = page.locator(`.equipment-slot-rpg:has(#${item_id}) .btn-drop-equip-modal`)
  await button_drop.click()
}


/**
 * Vérifie qu'un item est équipé sur la fiche du heros
 * @param page - La page Playwright
 * @param item_id - l'id DOM de l'equiment (ex: "casque-bronze")
 */
export async function testEquipement(page: Page, item_id: string) {
  await showFicheHero(page)

  const item = page.locator(`.equipment-grid-rpg .slot-item#${item_id}`)
  await expect(item).toHaveCount(1)
}

/**
 * Vérifie la valeur affichée de la monnaie dans le hero-panel
 * @param page - La page Playwright
 * @param value - La valeur attendue
 */
export async function testMonnaie(page: Page, value: number) {
  const monnaie = page.locator('.monnaie-value')
  await expect(monnaie).toBeVisible()
  await expect(monnaie).toHaveText(String(value))
}

/**
 * Lance une action avec dés (tenter_chance, tenter_habilete, etc.)
 * Clique sur le bouton d'action puis sur "Lancer" et attend que le résultat soit appliqué.
 * @param page - La page Playwright
 * @param buttonText - Texte du bouton d'action (ex: "Tentez votre Chance")
 */
export async function tenterChance(page: Page, buttonText: string) {
  await page.click(`.choices-list button:has-text("${buttonText}")`)
  await page.waitForSelector('button:has-text("Lancer")', { timeout: 5000 })
  await page.click('button:has-text("Lancer")')
  // Attend que le bouton "Lancer" disparaisse : signe que le résultat a été appliqué et rendu
  await page.waitForSelector('button:has-text("Lancer")', { state: 'hidden', timeout: 5000 })
}

/**
 * verifie que c'est bien la page de mort
 * @param page - La page Playwright
 */
export async function testMort(page: Page) {
    await page.waitForSelector('#view-defeat', { timeout: 10000 })
    await expect(page.locator(`#view-defeat`)).toHaveCount(1)
}

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

/**
 * Passe au round suivant du combat
 * @param page - La page Playwright
 */
export async function CombatMonstreSuivant(page: Page) {
  await page.click('button.combat-next-btn')
}

/**
 * Passe au round suivant du combat
 * @param page - La page Playwright
 */
export async function CombatResultat(page: Page) {
  await page.click('button.combat-next-btn')
}

/**
 * Lance un jet dans une séquence de multi-tentatives (tenter_chance avec tentatives > 1).
 * Attend que le bouton "Lancer" soit désactivé puis réactivé (ou disparu si c'est la dernière tentative).
 * @param page - La page Playwright
 */
export async function lancerUnJetMulti(page: Page): Promise<void> {
  await page.click('button:has-text("Lancer")')
  // Attend que le bouton soit désactivé (l'animation démarre)
  await page.waitForSelector('button:has-text("Lancer")[disabled]', { timeout: 3000 })
  // Attend que la prochaine modale soit prête : bouton à nouveau actif OU modale disparue
  await Promise.race([
    page.waitForSelector('button:has-text("Lancer"):not([disabled])', { timeout: 10000 }),
    page.waitForSelector('button:has-text("Lancer")', { state: 'hidden', timeout: 10000 }),
  ])
}

/**
 * Lance une action avec dés impliquant plusieurs tentatives consécutives.
 * @param page - La page Playwright
 * @param buttonText - Texte du bouton d'action (ex: "Tentez votre Chance")
 * @param tentatives - Nombre de jets à effectuer
 */
export async function tenterChanceMulti(page: Page, buttonText: string, tentatives: number): Promise<void> {
  await page.click(`.choices-list button:has-text("${buttonText}")`)
  await page.waitForSelector('button:has-text("Lancer")', { timeout: 5000 })
  for (let i = 0; i < tentatives; i++) {
    await lancerUnJetMulti(page)
  }
}
