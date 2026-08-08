import type { GameEngine } from '../engine/GameEngine'
import type { Adventure, Hero } from '../types'

/**
 * Convertit un texte en slug utilisable comme id DOM
 * Supprime les accents, remplace les espaces par des tirets, passe en minuscules
 */
function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Retourne les infos de la monnaie pour l'affichage :
 * - null si la propriété monnaie n'est pas définie dans l'aventure
 * - { label, quantite } même si l'item n'existe pas encore dans l'inventaire (quantite = 0)
 */
function getMonnaiInfo(adventure: Adventure, hero: Hero): { id: string; label: string; quantite: number } | null {
  const monnaiId = adventure.personnage.monnaie
  if (!monnaiId) return null

  const item = hero.inventaire.find(i => typeof i !== 'string' && i.id === monnaiId)
  if (item && typeof item !== 'string') {
    return { id: monnaiId, label: item.label, quantite: item.quantite ?? 0 }
  }

  // Monnaie définie mais pas encore dans l'inventaire → afficher 0
  // Cherche le label dans l'inventaire initial du personnage
  const itemDef = adventure.personnage.inventaire.find(i => typeof i !== 'string' && i.id === monnaiId)
  const label = itemDef && typeof itemDef !== 'string' ? itemDef.label : monnaiId
  return { id: monnaiId, label, quantite: 0 }
}

/**
 * Filtre l'inventaire en excluant les items équipés et la monnaie
 */
function getInventaireItems(adventure: Adventure, hero: Hero) {
  const monnaiId = adventure.personnage.monnaie
  return hero.inventaire.filter(item => {
    if (typeof item === 'string') return true
    if (item.equipe) return false
    if (monnaiId && item.id === monnaiId) return false
    return true
  })
}

/**
 * Gère l'affichage et l'interaction avec l'inventaire du héros
 */
export class InventaireView {
  /**
   * Construit le widget monnaie pour le hero-panel (inline)
   * Retourne null si la propriété monnaie n'est pas définie dans cette aventure
   * Affiche 0 si la monnaie est définie mais que le héros n'en a pas
   */
  static buildMonnaiWidget(adventure: Adventure, hero: Hero, _escHtml: (s: string) => string): HTMLElement | null {
    const monnaie = getMonnaiInfo(adventure, hero)
    if (!monnaie) return null

    const widget = document.createElement('div')
    widget.className = 'hero-monnaie'
    widget.setAttribute('aria-label', `${monnaie.label} : ${monnaie.quantite}`)
    widget.title = monnaie.label

    widget.innerHTML =
      `<span class="monnaie-icon" aria-hidden="true">🪙</span>` +
      `<span class="monnaie-value" id="monnaie-${slugify(monnaie.id)}">${monnaie.quantite}</span>`

    return widget
  }

  /**
   * Construit le panneau d'inventaire pour la vue principale
   */
  static buildHeroInventoryPanel(adventure: Adventure, _hero: Hero, engine: GameEngine, escHtml: (s: string) => string, onDrop?: () => void): HTMLElement {
    const panel = document.createElement('div')
    panel.className = 'hero-inventory'

    /** Reconstruit le contenu du panel en place */
    const rebuild = () => {
      panel.innerHTML = ''
      const lbl = document.createElement('span')
      lbl.className = 'inv-label'
      lbl.textContent = 'Inventaire :'
      panel.appendChild(lbl)
      panel.appendChild(buildItems())
    }

    const buildItems = (): HTMLElement => {
      const itemsContainer = document.createElement('span')
      itemsContainer.className = 'inv-items'

      const currentHero = engine.getHero()
      if (!currentHero) return itemsContainer

      const inventoryItems = getInventaireItems(adventure, currentHero)
      const dropAllowed = engine.isDropAllowed()
      const equipDropAllowed = engine.isEquipementDropAllowed()

      for (let i = 0; i < inventoryItems.length; i++) {
        const item = inventoryItems[i]

        if (i > 0) {
          const separator = document.createElement('span')
          separator.textContent = ', '
          itemsContainer.appendChild(separator)
        }

        if (typeof item === 'string') {
          const span = document.createElement('span')
          span.id = slugify(item)
          span.textContent = escHtml(item)
          itemsContainer.appendChild(span)
        } else {
          // Item avec usage = consommable
          if (item.usage) {
            const btn = document.createElement('button')
            btn.className = 'inv-item-btn'
            btn.type = 'button'
            btn.id = slugify(item.id)
            if (item.quantite !== undefined) btn.dataset.count = String(item.quantite)
            const qty = item.quantite !== undefined ? ` (${item.quantite}${item.quantite_label ? ' ' + item.quantite_label : ''})` : ''
            btn.textContent = escHtml(item.label) + qty
            btn.title = item.description || 'Cliquez pour consommer'
            btn.addEventListener('click', () => {
              const result = engine.consumeItem(item.id)
              if (result.success) {
                rebuild()
              } else {
                alert(result.message)
              }
            })
            itemsContainer.appendChild(btn)
          } else {
            // Item sans usage = non consommable
            const span = document.createElement('span')
            span.id = slugify(item.id)
            if (item.quantite !== undefined) span.dataset.count = String(item.quantite)
            const qty = item.quantite !== undefined ? ` (${item.quantite}${item.quantite_label ? ' ' + item.quantite_label : ''})` : ''
            span.textContent = escHtml(item.label) + qty
            if (item.description) {
              span.title = item.description
            }
            itemsContainer.appendChild(span)
          }

          // Bouton Jeter (icône seulement)
          // Visible si : drop inventaire autorisé, OU drop équipement autorisé ET item équipable (a un type)
          const showDrop = dropAllowed || (equipDropAllowed && !!item.type)
          if (showDrop) {
            const dropBtn = document.createElement('button')
            dropBtn.className = 'inv-drop-btn'
            dropBtn.type = 'button'
            dropBtn.textContent = '🗑️'
            dropBtn.title = `Jeter ${item.label}`
            dropBtn.setAttribute('aria-label', `Jeter ${item.label}`)
            dropBtn.addEventListener('click', () => {
              const result = engine.dropItem(item.id)
              if (result.success) {
                if (onDrop) {
                  onDrop()
                } else {
                  rebuild()
                }
              } else {
                alert(result.message)
              }
            })
            itemsContainer.appendChild(dropBtn)
          }
        }
      }

      return itemsContainer
    }

    const label = document.createElement('span')
    label.className = 'inv-label'
    label.textContent = 'Inventaire :'
    panel.appendChild(label)
    panel.appendChild(buildItems())

    return panel
  }

  /**
   * Construit la section monnaie pour la modal héros (HTML string)
   * Retourne une chaîne vide si la propriété monnaie n'est pas définie dans cette aventure
   * Affiche 0 si la monnaie est définie mais que le héros n'en a pas
   */
  static buildMonnaiSection(adventure: Adventure, hero: Hero, escHtml: (s: string) => string): string {
    const monnaie = getMonnaiInfo(adventure, hero)
    if (!monnaie) return ''

    return `<div class="hero-monnaie-section">` +
      `<h3>Monnaie</h3>` +
      `<p class="monnaie-modal-line">🪙 <strong>${monnaie.quantite}</strong> ${escHtml(monnaie.label)}</p>` +
      `</div>`
  }

  /**
   * Construit la section inventaire pour la modal héros
   */
  static buildInventorySection(adventure: Adventure, hero: Hero, escHtml: (s: string) => string, escAttr: (s: string) => string, _engine: GameEngine): string {
    let content = '<div class="hero-inventory-section">'
    content += '<h3>Inventaire</h3>'
    
    const inventoryItems = getInventaireItems(adventure, hero)
    const dropAllowed = _engine.isDropAllowed()
    const equipDropAllowed = _engine.isEquipementDropAllowed()

    if (inventoryItems.length > 0) {
      content += '<ul class="inventory-list">'
      for (const item of inventoryItems) {
        if (typeof item === 'string') {
          content += `<li>${escHtml(item)}</li>`
        } else {
          const qty = item.quantite !== undefined ? ` <em>(${item.quantite}${item.quantite_label ? ' ' + item.quantite_label : ''})</em>` : ''
          const equipBtn = item.type ? `<button class="btn-equip-modal" data-item-id="${escAttr(item.id)}">⚔️</button>` : ''
          const showDrop = dropAllowed || (equipDropAllowed && !!item.type)
          const dropBtn = showDrop ? `<button class="btn-drop-modal" data-item-id="${escAttr(item.id)}">🗑️ Jeter</button>` : ''
          content += `<li>${escHtml(item.label)}${qty} ${equipBtn}${dropBtn}</li>`
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

  /**
   * Ajoute les event listeners pour les boutons Jeter dans la modal
   */
  static attachDropListeners(overlay: HTMLElement, engine: GameEngine, onDropped: () => void): void {
    overlay.querySelectorAll<HTMLButtonElement>('.btn-drop-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        const itemId = btn.dataset.itemId
        if (itemId) {
          const result = engine.dropItem(itemId)
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
