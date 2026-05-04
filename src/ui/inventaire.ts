import type { GameEngine } from '../engine/GameEngine'
import type { Adventure, Hero } from '../types'

/**
 * Gère l'affichage et l'interaction avec l'inventaire du héros
 */
export class InventaireView {
  /**
   * Construit le panneau d'inventaire pour la vue principale
   */
  static buildHeroInventoryPanel(adventure: Adventure, hero: Hero, engine: GameEngine, escHtml: (s: string) => string): HTMLElement {
    const panel = document.createElement('div')
    panel.className = 'hero-inventory'
    
    const label = document.createElement('span')
    label.className = 'inv-label'
    label.textContent = 'Inventaire :'
    panel.appendChild(label)

    const itemsContainer = document.createElement('span')
    itemsContainer.className = 'inv-items'

    // Affiche l'inventaire (sans les items équipés)
    const inventoryItems = hero.inventaire.filter(item => {
      if (typeof item === 'string') return true
      return !item.equipe
    })

    for (let i = 0; i < inventoryItems.length; i++) {
      const item = inventoryItems[i]
      
      if (i > 0) {
        const separator = document.createElement('span')
        separator.textContent = ', '
        itemsContainer.appendChild(separator)
      }

      if (typeof item === 'string') {
        const span = document.createElement('span')
        span.textContent = escHtml(item)
        itemsContainer.appendChild(span)
      } else {
        // Item avec usage = consommable
        if (item.usage) {
          const btn = document.createElement('button')
          btn.className = 'inv-item-btn'
          btn.type = 'button'
          const qty = item.quantite !== undefined ? ` (${item.quantite}${item.quantite_label ? ' ' + item.quantite_label : ''})` : ''
          btn.textContent = escHtml(item.label) + qty
          btn.title = item.description || 'Cliquez pour consommer'
          btn.addEventListener('click', () => {
            const result = engine.consumeItem(item.id)
            if (result.success) {
              // Rerender le panel
              window.dispatchEvent(new CustomEvent('game-render'))
            } else {
              alert(result.message)
            }
          })
          itemsContainer.appendChild(btn)
        } else {
          // Item sans usage = non consommable
          const span = document.createElement('span')
          const qty = item.quantite !== undefined ? ` (${item.quantite}${item.quantite_label ? ' ' + item.quantite_label : ''})` : ''
          span.textContent = escHtml(item.label) + qty
          if (item.description) {
            span.title = item.description
          }
          itemsContainer.appendChild(span)
        }
      }
    }

    panel.appendChild(itemsContainer)
    return panel
  }

  /**
   * Construit la section inventaire pour la modal héros
   */
  static buildInventorySection(hero: Hero, escHtml: (s: string) => string, escAttr: (s: string) => string, engine: GameEngine): string {
    let content = '<div class="hero-inventory-section">'
    content += '<h3>Inventaire</h3>'
    
    const inventoryItems = hero.inventaire.filter(item => {
      if (typeof item === 'string') return true
      return !item.equipe
    })
    
    if (inventoryItems.length > 0) {
      content += '<ul class="inventory-list">'
      for (const item of inventoryItems) {
        if (typeof item === 'string') {
          content += `<li>${escHtml(item)}</li>`
        } else {
          const qty = item.quantite !== undefined ? ` <em>(${item.quantite}${item.quantite_label ? ' ' + item.quantite_label : ''})</em>` : ''
          const equipBtn = item.type ? `<button class="btn-equip-modal" data-item-id="${escAttr(item.id)}">⚔️</button>` : ''
          content += `<li>${escHtml(item.label)}${qty} ${equipBtn}</li>`
        }
      }
      content += '</ul>'
    } else {
      content += '<p><em>Inventaire vide</em></p>'
    }
    content += '</div>'
    
    return content
  }

  /**
   * Ajoute les event listeners pour les boutons d'équipement dans la modal
   */
  static attachEquipmentListeners(overlay: HTMLElement, engine: GameEngine, onEquipped: () => void): void {
    overlay.querySelectorAll<HTMLButtonElement>('.btn-equip-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        const itemId = btn.dataset.itemId
        if (itemId) {
          const result = engine.equipItem(itemId)
          if (result.success) {
            onEquipped()
          } else {
            alert(result.message)
          }
        }
      })
    })
  }
}
