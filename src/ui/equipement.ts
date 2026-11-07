import type { GameEngine } from '../engine/GameEngine'
import type { Adventure, Hero, InventaireItem } from '../types'
import { resolveImage } from '../utils/imageUtils'

/**
 * Construit le contenu HTML d'un item dans un slot ou une liste.
 * - Si l'item a une image résolue : affiche une vignette carrée avec le label en title
 * - Sinon : affiche le texte du label + console.warn pour faciliter l'identification
 */
export function buildItemContent(
  item: InventaireItem,
  adventure: Adventure,
  escHtml: (s: string) => string,
  escAttr: (s: string) => string
): string {
  const imageFile = resolveImage(item.image, item.image_ia)
  if (imageFile) {
    const src = adventure.repertoire_images.replace(/\/?$/, '/') + imageFile
    return `<img src="${escAttr(src)}" alt="${escAttr(item.label)}" title="${escAttr(item.label)}" class="item-thumbnail">`
  }
  // Pas d'image : fallback texte avec warning
  console.warn(`[Item] Pas d'image pour l'item "${item.id}" (${item.label})`)
  return escHtml(item.label)
}

/**
 * Gère l'affichage et l'interaction avec l'équipement du héros
 */
export class EquipementView {
  /**
   * Construit la section équipement pour la modal héros.
   * Si equipementDropAllowed, ajoute un bouton 🗑️ sur chaque slot occupé.
   */
  static buildEquipmentSection(
    adventure: Adventure,
    hero: Hero,
    escHtml: (s: string) => string,
    escAttr: (s: string) => string,
    equipementDropAllowed: boolean = false
  ): string {
    const emplacements = adventure.personnage.emplacements_equipement || {}

    if (Object.keys(emplacements).length === 0) return ''

    let content = '<div class="hero-equipment-section">'
    content += '<h3>Équipement</h3>'
    if (equipementDropAllowed) {
      content += '<p class="equipement-drop-hint">Jetez un équipement pour libérer de la place.</p>'
    }
    content += '<div class="equipment-display">'
    content += '<div class="equipment-grid-rpg">'

    const buildSlot = (slotName: string, slotLabel: string, cssClass: string): string => {
      const item = hero.equipement[slotName]
      const dropBtn = (equipementDropAllowed && item && item.item_dropable !== false)
        ? `<button class="btn-drop-equip-modal" data-slot="${escAttr(slotName)}" title="Jeter ${escAttr(item.label)}">🗑️</button>`
        : ''
      const unequipBtn = (item && item.item_unequip !== false) ? `<button class="btn-unequip-modal" data-slot="${escAttr(slotName)}">✕</button>` : ''
      const slotContent = item ? buildItemContent(item, adventure, escHtml, escAttr) : '(vide)'
      return `<div class="equipment-slot-rpg ${cssClass}">
        <div class="slot-label">${escHtml(slotLabel)}</div>
        <div class="slot-item"${item ? ` id="${escAttr(item.id)}"` : ''}>${slotContent}</div>
        ${unequipBtn}${dropBtn}
      </div>`
    }

    if (emplacements['tete']) content += buildSlot('tete', emplacements['tete'].label, 'slot-tete')

    if (emplacements['main']) {
      const capacite = emplacements['main'].capacite
      for (let i = 1; i <= capacite; i++) {
        const slotName = capacite > 1 ? `main_${i}` : 'main'
        const slotLabel = capacite > 1 ? `Main ${i}` : 'Main'
        content += buildSlot(slotName, slotLabel, 'slot-main-left')
      }
    }

    // Personnage au centre
    content += '<div class="equipment-heros">'
    const heroImageFile = resolveImage(adventure.personnage.image, adventure.personnage.image_ia)
    if (heroImageFile) {
      const imagePath = adventure.repertoire_images.replace(/\/?$/, '/') + heroImageFile
      content += `<img src="${escAttr(imagePath)}" alt="Personnage" class="hero-image">`
    } else {
      content += '👤'
    }
    content += '</div>'

    if (emplacements['armure'])   content += buildSlot('armure',   emplacements['armure'].label,   'slot-armure')
    if (emplacements['ceinture']) content += buildSlot('ceinture', emplacements['ceinture'].label, 'slot-ceinture')
    if (emplacements['pantalon']) content += buildSlot('pantalon', emplacements['pantalon'].label, 'slot-pantalon')
    if (emplacements['pieds'])    content += buildSlot('pieds',    emplacements['pieds'].label,    'slot-pieds')

    content += '</div>' // equipment-grid-rpg
    content += '</div>' // equipment-display
    content += '</div>' // hero-equipment-section

    return content
  }

  /**
   * Ajoute les event listeners pour les boutons de déséquipement (✕)
   */
  static attachUnequipmentListeners(overlay: HTMLElement, engine: GameEngine, onUnequipped: () => void): void {
    overlay.querySelectorAll<HTMLButtonElement>('.btn-unequip-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        const slot = btn.dataset.slot
        if (slot) {
          const result = engine.unequipItem(slot)
          if (result.success) {
            onUnequipped()
          } else {
            alert(result.message)
          }
        }
      })
    })
  }

  /**
   * Ajoute les event listeners pour les boutons Jeter équipement (🗑️)
   */
  static attachEquipmentDropListeners(overlay: HTMLElement, engine: GameEngine, onDropped: () => void): void {
    overlay.querySelectorAll<HTMLButtonElement>('.btn-drop-equip-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        const slot = btn.dataset.slot
        if (slot) {
          const result = engine.dropEquippedItem(slot)
          if (result.success) {
            onDropped()
          } else {
            alert(result.message)
          }
        }
      })
    })
  }
}
