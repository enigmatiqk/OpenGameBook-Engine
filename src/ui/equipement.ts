import type { GameEngine } from '../engine/GameEngine'
import type { Adventure, Hero } from '../types'

/**
 * Gère l'affichage et l'interaction avec l'équipement du héros
 */
export class EquipementView {
  /**
   * Construit la section équipement pour la modal héros
   */
  static buildEquipmentSection(adventure: Adventure, hero: Hero, escHtml: (s: string) => string, escAttr: (s: string) => string): string {
    const emplacements = adventure.personnage.emplacements_equipement || {}
    
    if (Object.keys(emplacements).length === 0) {
      return ''
    }

    let content = '<div class="hero-equipment-section">'
    content += '<h3>Équipement</h3>'
    content += '<div class="equipment-display">'
    
    // Créer une grille RPG avec le personnage au centre
    content += '<div class="equipment-grid-rpg">'
    
    // Slot Tête (top)
    if (emplacements['tete']) {
      const item = hero.equipement['tete']
      content += `<div class="equipment-slot-rpg slot-tete">
        <div class="slot-label">${escHtml(emplacements['tete'].label)}</div>
        <div class="slot-item">${item ? escHtml(item.label) : '(vide)'}</div>
        ${item ? `<button class="btn-unequip-modal" data-slot="tete">✕</button>` : ''}
      </div>`
    }

    // Slot Main (left) - peut avoir plusieurs sous-slots
    if (emplacements['main']) {
      const capacite = emplacements['main'].capacite
      for (let i = 1; i <= capacite; i++) {
        const slotName = capacite > 1 ? `main_${i}` : 'main'
        const item = hero.equipement[slotName]
        const slotLabel = capacite > 1 ? `Main ${i}` : 'Main'
        content += `<div class="equipment-slot-rpg slot-main-left">
          <div class="slot-label">${escHtml(slotLabel)}</div>
          <div class="slot-item">${item ? escHtml(item.label) : '(vide)'}</div>
          ${item ? `<button class="btn-unequip-modal" data-slot="${slotName}">✕</button>` : ''}
        </div>`
      }
    }

    // Personnage au centre
    content += '<div class="equipment-heros">'
    const heroImage = adventure.personnage.image || adventure.personnage.image_ia
    if (heroImage) {
      const imagePath = adventure.repertoire_images.replace(/\/?$/, '/') + heroImage
      content += `<img src="${escAttr(imagePath)}" alt="Personnage" class="hero-image">`
    } else {
      content += '👤'
    }
    content += '</div>'

    // Slot Armure (right)
    if (emplacements['armure']) {
      const item = hero.equipement['armure']
      content += `<div class="equipment-slot-rpg slot-armure">
        <div class="slot-label">${escHtml(emplacements['armure'].label)}</div>
        <div class="slot-item">${item ? escHtml(item.label) : '(vide)'}</div>
        ${item ? `<button class="btn-unequip-modal" data-slot="armure">✕</button>` : ''}
      </div>`
    }

    // Slot Ceinture (bottom-left)
    if (emplacements['ceinture']) {
      const item = hero.equipement['ceinture']
      content += `<div class="equipment-slot-rpg slot-ceinture">
        <div class="slot-label">${escHtml(emplacements['ceinture'].label)}</div>
        <div class="slot-item">${item ? escHtml(item.label) : '(vide)'}</div>
        ${item ? `<button class="btn-unequip-modal" data-slot="ceinture">✕</button>` : ''}
      </div>`
    }

    // Slot Pantalon (bottom-center)
    if (emplacements['pantalon']) {
      const item = hero.equipement['pantalon']
      content += `<div class="equipment-slot-rpg slot-pantalon">
        <div class="slot-label">${escHtml(emplacements['pantalon'].label)}</div>
        <div class="slot-item">${item ? escHtml(item.label) : '(vide)'}</div>
        ${item ? `<button class="btn-unequip-modal" data-slot="pantalon">✕</button>` : ''}
      </div>`
    }

    // Slot Pieds (bottom-right)
    if (emplacements['pieds']) {
      const item = hero.equipement['pieds']
      content += `<div class="equipment-slot-rpg slot-pieds">
        <div class="slot-label">${escHtml(emplacements['pieds'].label)}</div>
        <div class="slot-item">${item ? escHtml(item.label) : '(vide)'}</div>
        ${item ? `<button class="btn-unequip-modal" data-slot="pieds">✕</button>` : ''}
      </div>`
    }

    content += '</div>' // ferme equipment-grid-rpg
    content += '</div>' // ferme equipment-display
    content += '</div>' // ferme hero-equipment-section
    
    return content
  }

  /**
   * Ajoute les event listeners pour les boutons de déséquipement dans la modal
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
}
