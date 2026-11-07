/**
 * ItemImageSlot.ts — Slot d'upload d'image pour les items de l'éditeur.
 *
 * Identique au slot de SectionEditor mais :
 * - taille carrée fixe (CSS class item-image-slot)
 * - avertissement ⚠️ si l'image uploadée n'est pas carrée (ratio ≠ 1:1)
 */

export interface ItemImageSlotOptions {
  /** Champ cible : 'image' ou 'image_ia' */
  field: 'image' | 'image_ia'
  /** Label affiché au-dessus du slot */
  label: string
  /** Nom de fichier actuel (peut être undefined) */
  filename: string | undefined
  /** Base URL du répertoire images pour l'aperçu */
  imageBaseUrl: string
  /** Rappel quand un fichier est sélectionné : (filename, dataUrl) */
  onChange: (filename: string, dataUrl: string) => void
}

/**
 * Construit un slot d'upload carré pour une image d'item.
 * Avertit (⚠️ visible + console.warn) si l'image n'est pas carrée.
 */
export function buildItemImageSlot(options: ItemImageSlotOptions): HTMLElement {
  const { field, label, filename, imageBaseUrl, onChange } = options

  const slot = document.createElement('div')
  slot.className = 'item-image-slot'
  slot.dataset.field = field

  // Label
  const lbl = document.createElement('div')
  lbl.className = 'item-image-slot-label'
  lbl.textContent = label
  slot.appendChild(lbl)

  // Thumbnail
  const thumb = document.createElement('div')
  thumb.className = 'item-image-thumb'

  const buildSrc = (name: string | undefined): string | null =>
    name ? `${imageBaseUrl.replace(/\/?$/, '/')}${name}` : null

  // Avertissement ratio
  const ratioWarn = document.createElement('div')
  ratioWarn.className = 'item-image-ratio-warn'
  ratioWarn.textContent = '⚠️ Image non carrée'
  ratioWarn.hidden = true
  slot.appendChild(ratioWarn)

  const checkRatio = (img: HTMLImageElement): void => {
    const isSquare = img.naturalWidth > 0 && img.naturalWidth === img.naturalHeight
    ratioWarn.hidden = isSquare
    if (!isSquare && img.naturalWidth > 0) {
      console.warn(
        `[Item image] "${filename ?? '?'}" n'est pas carrée : ${img.naturalWidth}×${img.naturalHeight}px`
      )
    }
  }

  const addZoomBtn = (imgEl: HTMLImageElement): void => {
    const btn = document.createElement('button')
    btn.className = 'image-zoom-btn'
    btn.type = 'button'
    btn.title = 'Voir en grand'
    btn.innerHTML = '🔍'
    btn.addEventListener('click', () => openLightbox(imgEl.src, label))
    thumb.appendChild(btn)
  }

  const currentSrc = buildSrc(filename)
  if (currentSrc) {
    const img = document.createElement('img')
    img.className = 'item-image-thumb-img'
    img.alt = label
    img.loading = 'lazy'
    img.src = currentSrc
    img.onerror = () => { img.style.opacity = '0.3' }
    img.onload = () => checkRatio(img)
    thumb.appendChild(img)
    addZoomBtn(img)
  } else {
    const ph = document.createElement('div')
    ph.className = 'item-image-thumb-placeholder'
    ph.textContent = '🖼️'
    thumb.appendChild(ph)
  }
  slot.appendChild(thumb)

  // Nom de fichier courant
  const fname = document.createElement('div')
  fname.className = 'item-image-filename'
  fname.textContent = filename ?? '(aucune)'
  slot.appendChild(fname)

  // Input file caché
  const hiddenInput = document.createElement('input')
  hiddenInput.type = 'file'
  hiddenInput.accept = 'image/*'
  hiddenInput.style.display = 'none'
  slot.appendChild(hiddenInput)

  // Bouton choisir
  const uploadBtn = document.createElement('button')
  uploadBtn.className = 'btn btn-ghost btn-sm'
  uploadBtn.type = 'button'
  uploadBtn.innerHTML = '📁 Choisir'
  uploadBtn.addEventListener('click', () => hiddenInput.click())
  slot.appendChild(uploadBtn)

  const handleFile = (file: File): void => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string

      // Mettre à jour l'aperçu
      const existingImg = thumb.querySelector<HTMLImageElement>('.item-image-thumb-img')
      if (existingImg) {
        existingImg.src = dataUrl
        existingImg.style.opacity = '1'
        thumb.querySelector('.image-zoom-btn')?.remove()
        existingImg.onload = () => checkRatio(existingImg)
        addZoomBtn(existingImg)
      } else {
        thumb.innerHTML = ''
        const newImg = document.createElement('img')
        newImg.className = 'item-image-thumb-img'
        newImg.alt = label
        newImg.src = dataUrl
        newImg.onload = () => checkRatio(newImg)
        thumb.appendChild(newImg)
        addZoomBtn(newImg)
      }

      fname.textContent = file.name
      onChange(file.name, dataUrl)
    }
    reader.readAsDataURL(file)
  }

  hiddenInput.addEventListener('change', () => {
    const file = hiddenInput.files?.[0]
    if (file) handleFile(file)
  })

  // Drag & drop
  slot.addEventListener('dragover',  (e) => { e.preventDefault(); slot.classList.add('dragover') })
  slot.addEventListener('dragleave', ()  => slot.classList.remove('dragover'))
  slot.addEventListener('drop', (e) => {
    e.preventDefault()
    slot.classList.remove('dragover')
    const file = e.dataTransfer?.files?.[0]
    if (file) handleFile(file)
  })

  return slot
}

// ── Lightbox inline (identique à SectionEditor) ───────────────────────────────

function openLightbox(src: string, alt: string): void {
  document.getElementById('editor-lightbox')?.remove()

  const overlay = document.createElement('div')
  overlay.id = 'editor-lightbox'
  overlay.className = 'lightbox-overlay'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', alt)

  const img = document.createElement('img')
  img.className = 'lightbox-img'
  img.src = src
  img.alt = alt

  const closeBtn = document.createElement('button')
  closeBtn.className = 'lightbox-close'
  closeBtn.type = 'button'
  closeBtn.innerHTML = '✕'
  closeBtn.title = 'Fermer'

  const close = (): void => overlay.remove()
  closeBtn.addEventListener('click', close)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })
  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', handler) }
  })

  overlay.appendChild(img)
  overlay.appendChild(closeBtn)
  document.body.appendChild(overlay)
  closeBtn.focus()
}
