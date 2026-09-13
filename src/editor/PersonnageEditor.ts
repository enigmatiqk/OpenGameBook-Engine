/**
 * PersonnageEditor.ts — Éditeur de personnage.json
 *
 * Champs : statistiques, emplacements_equipement, inventaire, equipement,
 *          monnaie, choix_initial
 */

import type { Adventure, PersonnageTemplate, StatDefinition, InventaireItem } from '../types'

// Clés d'emplacements reconnues par l'UI du jeu (hardcodées dans equipement.ts)
const SLOT_KEYS: string[] = ['tete', 'main', 'armure', 'ceinture', 'pantalon', 'pieds']

export interface PersonnageEditorOptions {
  onChange: (data: PersonnageTemplate) => void
}

// ─────────────────────────────────────────────────────────────────────────────

export class PersonnageEditor {
  private container: HTMLElement
  private options: PersonnageEditorOptions
  private data: PersonnageTemplate = { statistiques: {}, inventaire: [] }

  constructor(container: HTMLElement, options: PersonnageEditorOptions) {
    this.container = container
    this.options   = options
  }

  render(adventure: Adventure): void {
    // Deep clone
    this.data = JSON.parse(JSON.stringify(adventure.personnage)) as PersonnageTemplate
    this._build()
  }

  getData(): PersonnageTemplate {
    return JSON.parse(JSON.stringify(this.data)) as PersonnageTemplate
  }

  // ─────────────────────────────────────────────────────────────────────────

  private _build(): void {
    this.container.innerHTML = ''
    this.container.className = 'part-editor personnage-editor'

    const form = document.createElement('div')
    form.className = 'part-form'

    form.appendChild(this._buildStats())
    form.appendChild(this._buildEmplacements())
    form.appendChild(this._buildInventaire())
    form.appendChild(this._buildEquipement())
    form.appendChild(this._buildMonnaie())
    form.appendChild(this._buildChoixInitiaux())

    this.container.appendChild(form)
  }

  // ── Statistiques ──────────────────────────────────────────────────────────

  private _buildStats(): HTMLElement {
    const sec = this._section('Statistiques')

    const stats = this.data.statistiques
    const statKeys = Object.keys(stats)

    const list = document.createElement('div')
    list.className = 'part-stat-list'

    const rebuild = (): void => {
      list.innerHTML = ''
      Object.entries(stats).forEach(([key, stat]) => {
        list.appendChild(this._buildStatRow(key, stat, stats, rebuild))
      })
    }

    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.className = 'btn btn-ghost btn-sm'
    addBtn.textContent = '+ Ajouter une stat'
    addBtn.addEventListener('click', () => {
      const newKey = `stat_${Object.keys(stats).length + 1}`
      stats[newKey] = { valeur: 0, init: '1d6+6', label: 'Nouvelle stat' }
      rebuild()
      this._notify()
    })

    void statKeys // pour éviter le warning TS si unused
    rebuild()
    sec.appendChild(list)
    sec.appendChild(addBtn)
    return sec
  }

  private _buildStatRow(key: string, stat: StatDefinition, stats: Record<string, StatDefinition>, rebuild: () => void): HTMLElement {
    const row = document.createElement('div')
    row.className = 'part-stat-row'

    // Clé (nom de la stat)
    const keyInput = document.createElement('input')
    keyInput.type = 'text'; keyInput.className = 'part-field-input part-stat-key'
    keyInput.placeholder = 'id (ex: habilete)'
    keyInput.value = key
    keyInput.addEventListener('blur', () => {
      if (keyInput.value !== key && keyInput.value.trim()) {
        stats[keyInput.value] = { ...stat }
        delete stats[key]
        rebuild()
        this._notify()
      }
    })

    // Label
    const lblInput = document.createElement('input')
    lblInput.type = 'text'; lblInput.className = 'part-field-input part-stat-label'
    lblInput.placeholder = 'label (ex: Habileté)'
    lblInput.value = stat.label ?? ''
    lblInput.addEventListener('input', () => { stat.label = lblInput.value; this._notify() })

    // Init (formule de dés)
    const initInput = document.createElement('input')
    initInput.type = 'text'; initInput.className = 'part-field-input part-stat-init'
    initInput.placeholder = 'init (ex: 1d6+6)'
    initInput.value = stat.init ?? ''
    initInput.addEventListener('input', () => { stat.init = initInput.value; this._notify() })

    // Max
    const maxInput = document.createElement('input')
    maxInput.type = 'text'; maxInput.className = 'part-field-input part-stat-max'
    maxInput.placeholder = 'max (start ou nombre)'
    maxInput.value = stat.max !== undefined ? String(stat.max) : 'start'
    maxInput.title = '"start" = valeur initiale, ou un nombre fixe'
    maxInput.addEventListener('input', () => {
      const v = maxInput.value.trim()
      stat.max = v === 'start' ? 'start' : (isNaN(Number(v)) ? 'start' : Number(v))
      this._notify()
    })

    // Supprimer
    const del = document.createElement('button')
    del.type = 'button'; del.className = 'cpm-list-del'; del.innerHTML = '🗑'
    del.addEventListener('click', () => {
      delete stats[key]
      rebuild()
      this._notify()
    })

    // Labels de colonnes (seulement sur la première ligne)
    const isFirst = Object.keys(stats).indexOf(key) === 0
    if (isFirst) {
      const header = document.createElement('div')
      header.className = 'part-stat-header'
      ;['ID', 'Label', 'Init', 'Max', ''].forEach(t => {
        const h = document.createElement('span')
        h.className = 'part-stat-col-label'
        h.textContent = t
        header.appendChild(h)
      })
      row.appendChild(header)
    }

    const inputs = document.createElement('div')
    inputs.className = 'part-stat-inputs'
    inputs.appendChild(keyInput)
    inputs.appendChild(lblInput)
    inputs.appendChild(initInput)
    inputs.appendChild(maxInput)
    inputs.appendChild(del)
    row.appendChild(inputs)

    return row
  }

  // ── Emplacements d'équipement ─────────────────────────────────────────────

  private _buildEmplacements(): HTMLElement {
    const sec = this._section('Emplacements d\'équipement')

    // Hint : les types_acceptes ici alimentent le select "Type" de l'équipement
    const hint = document.createElement('div')
    hint.style.cssText = 'font-size:0.75rem;color:var(--text-muted);font-style:italic;margin-bottom:0.4rem;'
    hint.textContent = 'Les types saisis ici seront proposés comme choix dans l\'équipement de départ.'
    sec.appendChild(hint)

    const emps = this.data.emplacements_equipement ?? {}
    this.data.emplacements_equipement = emps

    const list = document.createElement('div')
    list.className = 'part-list'

    const rebuild = (): void => {
      list.innerHTML = ''
      Object.entries(emps).forEach(([key, emp]) => {
        const row = document.createElement('div')
        row.className = 'part-list-row part-emp-row'

        // Clé du slot — select avec les valeurs reconnues par le moteur
        const keyUsedKeys = Object.keys(emps).filter(k => k !== key)
        const keySel = document.createElement('select')
        keySel.className = 'part-field-input part-type-select'
        // Options disponibles = celles pas encore utilisées + la courante
        for (const slotKey of SLOT_KEYS) {
          if (keyUsedKeys.includes(slotKey) && slotKey !== key) continue
          const opt = document.createElement('option')
          opt.value = slotKey
          opt.textContent = slotKey
          if (slotKey === key) opt.selected = true
          keySel.appendChild(opt)
        }
        // Si la clé actuelle n'est pas dans la liste connue, l'afficher avec warning
        if (!SLOT_KEYS.includes(key)) {
          const opt = document.createElement('option')
          opt.value = key
          opt.textContent = `${key} ⚠️ (non reconnu)`
          opt.selected = true
          keySel.insertBefore(opt, keySel.firstChild)
        }
        keySel.addEventListener('change', () => {
          if (keySel.value !== key) {
            emps[keySel.value] = { ...emp }
            delete emps[key]
            rebuild(); this._notify()
          }
        })
        row.appendChild(this._labeled('Slot', keySel))

        // Label
        row.appendChild(this._labeled('Label', this._textInput(emp.label, 'ex: Mains', v => { emp.label = v; this._notify() })))

        // Capacité
        row.appendChild(this._labeled('Cap.', this._numInput(emp.capacite, 1, v => { emp.capacite = v; this._notify() })))

        // Types acceptés — texte libre, séparés par virgule
        const typesInput = this._textInput(emp.types_acceptes.join(', '), 'ex: arme_1main, bouclier', v => {
          emp.types_acceptes = v.split(',').map(t => t.trim()).filter(Boolean)
          this._notify()
        })
        typesInput.title = 'Valeurs séparées par des virgules — utilisées pour associer les items à ce slot'
        typesInput.classList.add('part-types-input')
        row.appendChild(this._labeled('Types acceptés', typesInput))

        // Supprimer
        const del = document.createElement('button')
        del.type = 'button'; del.className = 'cpm-list-del'; del.innerHTML = '🗑'
        del.addEventListener('click', () => { delete emps[key]; rebuild(); this._notify() })
        row.appendChild(del)

        list.appendChild(row)
      })
    }

    const addBtn = document.createElement('button')
    addBtn.type = 'button'; addBtn.className = 'btn btn-ghost btn-sm'
    addBtn.textContent = '+ Ajouter un emplacement'
    addBtn.addEventListener('click', () => {
      // Choisit le premier slot connu non encore utilisé
      const used = Object.keys(emps)
      const nextKey = SLOT_KEYS.find(k => !used.includes(k)) ?? `slot_${used.length + 1}`
      emps[nextKey] = { label: nextKey, capacite: 1, types_acceptes: [] }
      rebuild(); this._notify()
    })

    rebuild()
    sec.appendChild(list)
    sec.appendChild(addBtn)
    return sec
  }

  // ── Inventaire de départ ──────────────────────────────────────────────────

  private _buildInventaire(): HTMLElement {
    const sec = this._section('Inventaire de départ')
    const items = this.data.inventaire as InventaireItem[]

    const list = document.createElement('div')
    list.className = 'part-list'

    const rebuild = (): void => {
      list.innerHTML = ''
      items.forEach((item, i) => {
        if (typeof item === 'string') {
          // Item simple (string) — rare, on l'affiche en texte
          const row = document.createElement('div')
          row.className = 'part-list-row'
          const inp = this._textInput(item, 'id item', v => { (items as unknown as string[])[i] = v; this._notify() })
          row.appendChild(inp)
          const del = document.createElement('button')
          del.type = 'button'; del.className = 'cpm-list-del'; del.innerHTML = '🗑'
          del.addEventListener('click', () => { items.splice(i, 1); rebuild(); this._notify() })
          row.appendChild(del)
          list.appendChild(row)
          return
        }

        const it = item as InventaireItem
        const row = document.createElement('div')
        row.className = 'part-list-row part-inv-row'

        row.appendChild(this._labeled('ID',    this._textInput(it.id ?? '', 'item_id', v => { it.id = v || undefined as unknown as string; this._notify() })))
        row.appendChild(this._labeled('Label', this._textInput(it.label ?? '', 'nom affiché', v => { it.label = v; this._notify() })))
        row.appendChild(this._labeled('Qté',   this._numInput(it.quantite ?? 1, 0, v => { it.quantite = v || undefined; this._notify() })))
        row.appendChild(this._labeled('Usage', this._textInput(it.usage ?? '', 'ex: manger_repas', v => { it.usage = v || undefined; this._notify() })))

        const del = document.createElement('button')
        del.type = 'button'; del.className = 'cpm-list-del'; del.innerHTML = '🗑'
        del.addEventListener('click', () => { items.splice(i, 1); rebuild(); this._notify() })
        row.appendChild(del)

        list.appendChild(row)
      })
    }

    const addBtn = document.createElement('button')
    addBtn.type = 'button'; addBtn.className = 'btn btn-ghost btn-sm'
    addBtn.textContent = '+ Ajouter un item'
    addBtn.addEventListener('click', () => {
      items.push({ id: '', label: '', quantite: 1 })
      rebuild(); this._notify()
    })

    rebuild()
    sec.appendChild(list)
    sec.appendChild(addBtn)
    return sec
  }

  // ── Équipement de départ ──────────────────────────────────────────────────

  private _buildEquipement(): HTMLElement {
    const sec = this._section('Équipement de départ')
    const items: InventaireItem[] = this.data.equipement ?? []
    this.data.equipement = items

    const list = document.createElement('div')
    list.className = 'part-list'

    const rebuild = (): void => {
      list.innerHTML = ''
      // Recalcule la liste des types disponibles depuis les emplacements courants
      const availableTypes = this._collectAvailableTypes()

      items.forEach((it, i) => {
        const row = document.createElement('div')
        row.className = 'part-list-row part-inv-row'

        row.appendChild(this._labeled('ID',    this._textInput(it.id ?? '',    'item_id', v => { it.id = v; this._notify() })))
        row.appendChild(this._labeled('Label', this._textInput(it.label ?? '', 'nom',     v => { it.label = v; this._notify() })))
        // Type : select construit depuis les types_acceptes des emplacements
        row.appendChild(this._labeled('Type',  this._typeSelect(it.type ?? '', availableTypes, v => { it.type = v || undefined; this._notify() })))
        row.appendChild(this._labeled('Poids', this._numInput(it.poids ?? 1, 0, v => { it.poids = v; this._notify() })))

        const del = document.createElement('button')
        del.type = 'button'; del.className = 'cpm-list-del'; del.innerHTML = '🗑'
        del.addEventListener('click', () => { items.splice(i, 1); rebuild(); this._notify() })
        row.appendChild(del)

        list.appendChild(row)
      })
    }

    const addBtn = document.createElement('button')
    addBtn.type = 'button'; addBtn.className = 'btn btn-ghost btn-sm'
    addBtn.textContent = '+ Ajouter un équipement'
    addBtn.addEventListener('click', () => {
      items.push({ id: '', label: '', poids: 1 })
      rebuild(); this._notify()
    })

    rebuild()
    sec.appendChild(list)
    sec.appendChild(addBtn)
    return sec
  }

  /**
   * Collecte toutes les valeurs de types_acceptes de tous les emplacements
   * définis dans l'aventure — ce sont les seules valeurs valides pour `type`.
   * Dédupliquées et triées.
   */
  private _collectAvailableTypes(): string[] {
    const emps = this.data.emplacements_equipement ?? {}
    const set = new Set<string>()
    for (const emp of Object.values(emps)) {
      for (const t of emp.types_acceptes) {
        if (t) set.add(t)
      }
    }
    return [...set].sort()
  }

  // ── Monnaie ───────────────────────────────────────────────────────────────

  private _buildMonnaie(): HTMLElement {
    const sec = this._section('Monnaie')

    const row = document.createElement('div')
    row.className = 'part-field'

    const lbl = document.createElement('label')
    lbl.className = 'part-field-label'
    lbl.textContent = 'ID de l\'item monnaie'

    const input = document.createElement('input')
    input.type = 'text'; input.className = 'part-field-input'
    input.placeholder = 'ex: piece-or'
    input.value = this.data.monnaie ?? ''
    input.addEventListener('input', () => {
      this.data.monnaie = input.value || undefined
      this._notify()
    })

    row.appendChild(lbl); row.appendChild(input)
    sec.appendChild(row)
    return sec
  }

  // ── Choix initiaux ────────────────────────────────────────────────────────

  private _buildChoixInitiaux(): HTMLElement {
    const sec = this._section('Choix initiaux (sélection de départ)')

    const choixList = this.data.choix_initial ?? []
    this.data.choix_initial = choixList

    const listEl = document.createElement('div')
    listEl.className = 'part-list'

    const rebuild = (): void => {
      listEl.innerHTML = ''
      choixList.forEach((choix, ci) => {
        const card = document.createElement('div')
        card.className = 'part-choix-card'

        // Header du choix
        const cardHdr = document.createElement('div')
        cardHdr.className = 'part-choix-header'

        cardHdr.appendChild(this._labeled('ID',     this._textInput(choix.id, 'id', v => { choix.id = v; this._notify() })))
        cardHdr.appendChild(this._labeled('Label',  this._textInput(choix.label, 'libellé', v => { choix.label = v; this._notify() })))
        cardHdr.appendChild(this._labeled('Quantité', this._numInput(choix.quantite, 1, v => { choix.quantite = v; this._notify() })))

        const delChoix = document.createElement('button')
        delChoix.type = 'button'; delChoix.className = 'cpm-list-del'; delChoix.innerHTML = '🗑'
        delChoix.addEventListener('click', () => { choixList.splice(ci, 1); rebuild(); this._notify() })
        cardHdr.appendChild(delChoix)
        card.appendChild(cardHdr)

        // Options du choix
        const optTitle = document.createElement('div')
        optTitle.className = 'part-choix-opt-title'
        optTitle.textContent = 'Options :'
        card.appendChild(optTitle)

        const optList = document.createElement('div')
        optList.className = 'part-list'

        const rebuildOpts = (): void => {
          optList.innerHTML = ''
          choix.options.forEach((opt, oi) => {
            const optRow = document.createElement('div')
            optRow.className = 'part-list-row part-inv-row'

            optRow.appendChild(this._labeled('ID',    this._textInput(opt.id, 'id', v => { opt.id = v; this._notify() })))
            optRow.appendChild(this._labeled('Label', this._textInput(opt.label, 'libellé', v => { opt.label = v; this._notify() })))
            optRow.appendChild(this._labeled('Qté',   this._numInput(opt.quantite ?? 1, 0, v => { opt.quantite = v; this._notify() })))
            optRow.appendChild(this._labeled('Usage', this._textInput(opt.usage ?? '', 'règle', v => { opt.usage = v || undefined; this._notify() })))

            const delOpt = document.createElement('button')
            delOpt.type = 'button'; delOpt.className = 'cpm-list-del'; delOpt.innerHTML = '🗑'
            delOpt.addEventListener('click', () => { choix.options.splice(oi, 1); rebuildOpts(); this._notify() })
            optRow.appendChild(delOpt)

            optList.appendChild(optRow)
          })
        }

        const addOpt = document.createElement('button')
        addOpt.type = 'button'; addOpt.className = 'btn btn-ghost btn-sm'
        addOpt.textContent = '+ Option'
        addOpt.addEventListener('click', () => {
          choix.options.push({ id: '', label: '' })
          rebuildOpts(); this._notify()
        })

        rebuildOpts()
        card.appendChild(optList)
        card.appendChild(addOpt)
        listEl.appendChild(card)
      })
    }

    const addChoix = document.createElement('button')
    addChoix.type = 'button'; addChoix.className = 'btn btn-ghost btn-sm'
    addChoix.textContent = '+ Ajouter un choix initial'
    addChoix.addEventListener('click', () => {
      choixList.push({ id: '', label: '', quantite: 1, options: [] })
      rebuild(); this._notify()
    })

    rebuild()
    sec.appendChild(listEl)
    sec.appendChild(addChoix)
    return sec
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private _section(title: string): HTMLElement {
    const sec = document.createElement('div')
    sec.className = 'part-section'
    const hdr = document.createElement('div')
    hdr.className = 'part-section-title'
    hdr.textContent = title
    sec.appendChild(hdr)
    return sec
  }

  private _labeled(label: string, input: HTMLElement): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'part-labeled'
    const lbl = document.createElement('span')
    lbl.className = 'part-labeled-lbl'
    lbl.textContent = label
    wrap.appendChild(lbl)
    wrap.appendChild(input)
    return wrap
  }

  private _typeSelect(value: string, types: string[], onChange: (v: string) => void): HTMLSelectElement {
    const sel = document.createElement('select')
    sel.className = 'part-field-input part-type-select'

    // Option vide (aucun type = item non équipable)
    const blank = document.createElement('option')
    blank.value = ''
    blank.textContent = '— aucun —'
    sel.appendChild(blank)

    for (const t of types) {
      const opt = document.createElement('option')
      opt.value = t
      opt.textContent = t
      sel.appendChild(opt)
    }

    sel.value = value
    // Si la valeur actuelle n'est pas dans la liste, l'afficher quand même
    if (value && !types.includes(value)) {
      const opt = document.createElement('option')
      opt.value = value
      opt.textContent = `${value} ⚠️ (non déclaré)`
      sel.appendChild(opt)
      sel.value = value
    }

    sel.addEventListener('change', () => onChange(sel.value))
    return sel
  }

  private _textInput(value: string, placeholder: string, onChange: (v: string) => void, onBlurOnly = false): HTMLInputElement {
    const input = document.createElement('input')
    input.type = 'text'; input.className = 'part-field-input'
    input.placeholder = placeholder; input.value = value
    if (onBlurOnly) {
      input.addEventListener('blur', () => onChange(input.value))
    } else {
      input.addEventListener('input', () => onChange(input.value))
    }
    return input
  }

  private _numInput(value: number, min: number, onChange: (v: number) => void): HTMLInputElement {
    const input = document.createElement('input')
    input.type = 'number'; input.className = 'part-field-input part-num-input'
    input.min = String(min); input.value = String(value)
    input.addEventListener('input', () => onChange(parseInt(input.value, 10) || 0))
    return input
  }

  private _notify(): void {
    this.options.onChange(this.getData())
  }
}
