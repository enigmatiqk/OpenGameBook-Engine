/**
 * Bouton global "Notes & Questions" de section.
 * Affiche les propriétés `questions` et `notes` de la section courante.
 * Se met à jour à chaque changement de section via `updateSectionNotes()`.
 */

import type { Section } from '../types'

let _currentSection: Section | null = null

function _esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function showNotesPanel(): void {
  const section = _currentSection
  if (!section) return

  // Supprime un éventuel panneau déjà ouvert
  document.getElementById('section-notes-panel')?.remove()

  let content = ''

  if (section.questions?.length) {
    content += '<h3>❓ Questions</h3><ul class="sn-list sn-list--questions">'
    for (const q of section.questions) {
      content += `<li>${_esc(q)}</li>`
    }
    content += '</ul>'
  }

  if (section.notes?.length) {
    content += '<h3>📝 Notes</h3><ul class="sn-list sn-list--notes">'
    for (const n of section.notes) {
      content += `<li>${_esc(n)}</li>`
    }
    content += '</ul>'
  }

  const overlay = document.createElement('div')
  overlay.id = 'section-notes-panel'
  overlay.setAttribute('style',
    'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;' +
    'align-items:center;justify-content:center;z-index:1000;padding:1rem'
  )
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', `Notes — Section ${section.numero}`)

  overlay.innerHTML = `
    <div style="background:#16213e;border:1px solid #2a2a4a;border-radius:8px;
                box-shadow:0 4px 16px rgba(0,0,0,0.4);max-width:600px;width:100%;
                max-height:80vh;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:1rem 1.25rem;border-bottom:1px solid #2a2a4a;">
        <h2 style="font-size:1.1rem;margin:0;color:#e0e0e0;">
          🔍 Section ${section.numero} — Questions &amp; Notes
        </h2>
        <button id="sn-close" style="background:none;border:none;color:#a0a0b0;
                font-size:1.25rem;cursor:pointer;padding:0.25rem 0.5rem;border-radius:4px;"
                aria-label="Fermer">✕</button>
      </div>
      <div style="padding:1.25rem;overflow-y:auto;font-size:0.95rem;line-height:1.7;">
        ${content}
      </div>
    </div>
  `

  // Styles intégrés pour les listes (on peut aussi ajouter dans styles.css)
  const style = document.createElement('style')
  style.textContent = `
    #section-notes-panel h3 {
      font-size:0.875rem;text-transform:uppercase;letter-spacing:.05em;
      color:#a0a0b0;margin:1rem 0 .5rem;
    }
    #section-notes-panel h3:first-child { margin-top:0; }
    .sn-list { padding-left:1.25rem;margin:0; }
    .sn-list li { margin-bottom:.4rem; }
    .sn-list--questions li { color:#fbbf24; }
    .sn-list--notes li { color:#e0e0e0; }
  `
  overlay.appendChild(style)

  const close = () => overlay.remove()
  overlay.querySelector<HTMLButtonElement>('#sn-close')!.addEventListener('click', close)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey) }
  })

  document.body.appendChild(overlay)
}

/**
 * Met à jour la section courante et l'état visible du bouton.
 * À appeler depuis GameView à chaque changement de section.
 */
export function updateSectionNotes(section: Section | null): void {
  _currentSection = section

  const btn = document.getElementById('btn-section-notes') as HTMLButtonElement | null
  if (!btn) return

  const hasContent = !!(section?.questions?.length || section?.notes?.length)
  btn.style.display = hasContent ? '' : 'none'
}

/**
 * Initialise le bouton dans le DOM global.
 * À appeler une seule fois au démarrage.
 */
export function initSectionNotesButton(): void {
  const btn = document.getElementById('btn-section-notes') as HTMLButtonElement | null
  if (!btn) return

  btn.style.display = 'none' // caché par défaut, révélé par updateSectionNotes()
  btn.addEventListener('click', showNotesPanel)
}
