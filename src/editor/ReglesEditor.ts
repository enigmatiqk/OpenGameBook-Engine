/**
 * ReglesEditor.ts — Éditeur de regles.json
 *
 * Deux sections :
 *   1. Règles moteur  — champs fixes reconnus par le moteur :
 *        combat, victoire, defaite, item_drop, equipement_drop
 *   2. Règles nommées — règles libres créées par l'auteur :
 *        test_stat, composite, restaurer_stat, duel_de
 */

import type {
  Adventure, Regles, CombatRules,
  RegleTestStat, RegleComposite, RegleRestaurerStat, RegleDuelDe, Regle,
} from '../types'
import { EffetsEditor } from './EffetsEditor'

// Clés réservées au moteur — ne pas les traiter comme règles nommées
const MOTEUR_KEYS = new Set(['combat', 'victoire', 'defaite', 'item_drop', 'equipement_drop'])

export interface ReglesEditorOptions {
  onChange: (regles: Regles) => void
}

// ─────────────────────────────────────────────────────────────────────────────

export class ReglesEditor {
  private container: HTMLElement
  private options:   ReglesEditorOptions
  private data:      Regles

  constructor(container: HTMLElement, options: ReglesEditorOptions) {
    this.container = container
    this.options   = options
    this.data      = {} as Regles
  }

  render(adventure: Adventure): void {
    this.data = JSON.parse(JSON.stringify(adventure.regles)) as Regles
    this._build()
  }

  getData(): Regles {
    return JSON.parse(JSON.stringify(this.data)) as Regles
  }

  // ─────────────────────────────────────────────────────────────────────────

  private _build(): void {
    this.container.innerHTML = ''
    this.container.className = 'part-editor regles-editor'

    const form = document.createElement('div')
    form.className = 'part-form'

    form.appendChild(this._buildMoteur())
    form.appendChild(this._buildNommees())

    this.container.appendChild(form)
  }

  private _notify(): void {
    this.options.onChange(this.getData())
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 1 : Règles moteur
  // ══════════════════════════════════════════════════════════════════════════

  private _buildMoteur(): HTMLElement {
    const { sec, body } = this._collapsibleSection('⚙️ Règles moteur')

    body.appendChild(this._buildCombatRules())
    body.appendChild(this._buildVictoire())
    body.appendChild(this._buildDefaite())
    body.appendChild(this._buildDropRules())

    return sec
  }

  // ── Combat rules ──────────────────────────────────────────────────────────

  private _buildCombatRules(): HTMLElement {
    const { sec: block, body: blockBody } = this._subSection('Combat')
    const c = (this.data.combat ?? {
      formule_attaque: 'habilete+2d6', formule_vie: 'endurance',
      attaque: '>', degats_victoire: 2, degats_defaite: 2,
    }) as CombatRules
    this.data.combat = c

    // Formule attaque
    blockBody.appendChild(this._fieldRow('Formule attaque', this._textIn(c.formule_attaque,
      'ex: habilete+2d6', v => { c.formule_attaque = v; this._notify() })))
    blockBody.appendChild(this._fieldRow('Formule vie', this._textIn(c.formule_vie,
      'ex: endurance', v => { c.formule_vie = v; this._notify() })))

    // Attaque opérateur
    blockBody.appendChild(this._fieldRow('Comparaison attaque', this._selectIn(
      c.attaque, [['>', '>  (strictement supérieur)'], ['>=', '>= (supérieur ou égal)']],
      v => { c.attaque = v as CombatRules['attaque']; this._notify() })))

    // Dégâts
    blockBody.appendChild(this._fieldRow('Dégâts victoire',
      this._numIn(c.degats_victoire, 0, v => { c.degats_victoire = v; this._notify() })))
    blockBody.appendChild(this._fieldRow('Dégâts défaite',
      this._numIn(c.degats_defaite, 0, v => { c.degats_defaite = v; this._notify() })))

    // Stats combat (liste de noms)
    blockBody.appendChild(this._fieldRow('Stats temporaires de combat',
      this._textIn((c.stats_combat ?? []).join(', '),
        'ex: degats_victoire, degats_defaite',
        v => { c.stats_combat = v.split(',').map(s => s.trim()).filter(Boolean); this._notify() })))

    // Fuite
    const { sec: fuiteBlock, body: fuiteBody } = this._subSection('Fuite')
    const fuite = c.fuite ?? { possible: 'section', cout: '-2 endurance' }
    c.fuite = fuite

    fuiteBody.appendChild(this._fieldRow('Possible',
      this._selectIn(fuite.possible,
        [['non','Non'],['livre','Selon le livre'],['section','Via section (fuite.section)']],
        v => { fuite.possible = v as typeof fuite.possible; this._notify() })))
    fuiteBody.appendChild(this._fieldRow('Coût',
      this._textIn(fuite.cout, 'ex: -2 endurance', v => { fuite.cout = v; this._notify() })))
    blockBody.appendChild(fuiteBlock)

    // Events (attaque/defense/fuite → nom de règle)
    const { sec: evBlock, body: evBody } = this._subSection('Événements combat (noms de règles)')
    const ev = c.events ?? {}; c.events = ev
    evBody.appendChild(this._fieldRow('Attaque',
      this._textIn(ev.attaque ?? '', 'règle déclenchée (ex: attaque_chance)',
        v => { ev.attaque = v || undefined; this._notify() })))
    evBody.appendChild(this._fieldRow('Défense',
      this._textIn(ev.defense ?? '', 'règle déclenchée (ex: defense_chance)',
        v => { ev.defense = v || undefined; this._notify() })))
    evBody.appendChild(this._fieldRow('Fuite',
      this._textIn(ev.fuite ?? '', 'règle déclenchée (ex: fuite_chance)',
        v => { ev.fuite = v || undefined; this._notify() })))
    blockBody.appendChild(evBlock)

    return block
  }

  // ── Victoire ──────────────────────────────────────────────────────────────

  private _buildVictoire(): HTMLElement {
    const { sec: block, body: blockBody } = this._subSection('Victoire')
    const v = (this.data.victoire ?? { sections: [] }) as { sections: number[] }
    this.data.victoire = v

    blockBody.appendChild(this._fieldRow('Sections de victoire',
      this._textIn(v.sections.join(', '), 'ex: 400',
        val => {
          v.sections = val.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
          this._notify()
        })))
    return block
  }

  // ── Défaite ───────────────────────────────────────────────────────────────

  private _buildDefaite(): HTMLElement {
    const { sec: block, body: blockBody } = this._subSection('Défaite')
    const d = (this.data.defaite ?? { endurance_min: 0 }) as { endurance_min: number }
    this.data.defaite = d

    blockBody.appendChild(this._fieldRow('Endurance minimum',
      this._numIn(d.endurance_min, 0, v => { d.endurance_min = v; this._notify() })))
    return block
  }

  // ── Drop rules ────────────────────────────────────────────────────────────

  private _buildDropRules(): HTMLElement {
    const { sec: block, body: blockBody } = this._subSection('Boutons Jeter')

    const id = this.data.item_drop as { aventure?: boolean; section?: boolean } | undefined ?? {}
    this.data.item_drop = id as Regles['item_drop']
    const ed = this.data.equipement_drop as { aventure?: boolean; section?: boolean } | undefined ?? {}
    this.data.equipement_drop = ed as Regles['equipement_drop']

    const row1 = document.createElement('div'); row1.className = 'regles-drop-row'
    row1.appendChild(this._fieldRow('Items — toujours', this._toggleIn(!!id.aventure,
      v => { id.aventure = v; this._notify() })))
    row1.appendChild(this._fieldRow('Items — sur section', this._toggleIn(!!id.section,
      v => { id.section = v; this._notify() })))
    blockBody.appendChild(row1)

    const row2 = document.createElement('div'); row2.className = 'regles-drop-row'
    row2.appendChild(this._fieldRow('Équipement — toujours', this._toggleIn(!!ed.aventure,
      v => { ed.aventure = v; this._notify() })))
    row2.appendChild(this._fieldRow('Équipement — sur section', this._toggleIn(!!ed.section,
      v => { ed.section = v; this._notify() })))
    blockBody.appendChild(row2)

    return block
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 2 : Règles nommées
  // ══════════════════════════════════════════════════════════════════════════

  private _buildNommees(): HTMLElement {
    const { sec, body } = this._collapsibleSection('📜 Règles nommées')

    // Extraire toutes les règles nommées (hors moteur)
    const namedKeys = Object.keys(this.data).filter(k => !MOTEUR_KEYS.has(k))

    const listEl = document.createElement('div')
    listEl.className = 'regles-nommees-list'

    const rebuild = (): void => {
      listEl.innerHTML = ''
      const keys = Object.keys(this.data).filter(k => !MOTEUR_KEYS.has(k))
      keys.forEach(key => {
        const regle = this.data[key] as Regle | undefined
        if (!regle || typeof regle !== 'object' || !('type' in regle)) return
        listEl.appendChild(this._buildRegleCard(key, regle as Regle, rebuild))
      })
    }

    // Sélecteur pour ajouter une nouvelle règle
    const addRow = document.createElement('div')
    addRow.className = 'regles-add-row'

    const nameInput = document.createElement('input')
    nameInput.type = 'text'; nameInput.className = 'part-field-input'
    nameInput.placeholder = 'nom de la règle (ex: ma_regle)'
    nameInput.style.flex = '1'

    const typeSel = document.createElement('select')
    typeSel.className = 'cpm-select'
    ;[
      ['test_stat',       '🎲 Test de stat'],
      ['composite',       '🔗 Composite'],
      ['restaurer_stat',  '💊 Restaurer stat'],
      ['duel_de',         '⚔️ Duel de dés'],
    ].forEach(([v, l]) => {
      const opt = document.createElement('option'); opt.value = v; opt.textContent = l
      typeSel.appendChild(opt)
    })

    const addBtn = document.createElement('button')
    addBtn.type = 'button'; addBtn.className = 'btn btn-ghost btn-sm'
    addBtn.textContent = '+ Ajouter'
    addBtn.addEventListener('click', () => {
      const key = nameInput.value.trim()
      if (!key) return
      if (this.data[key]) { alert(`La règle "${key}" existe déjà.`); return }
      const type = typeSel.value
      ;(this.data as Record<string, unknown>)[key] = this._defaultRegle(type)
      nameInput.value = ''
      rebuild(); this._notify()
    })

    addRow.append(nameInput, typeSel, addBtn)
    body.appendChild(listEl)
    body.appendChild(addRow)

    void namedKeys
    rebuild()
    return sec
  }

  private _defaultRegle(type: string): Regle {
    switch (type) {
      case 'test_stat': return {
        type: 'test_stat', jet_heros: '2d6',
        stats: [{ stat: 'chance', condition: '<=' }],
        resultats: { succes: 'chanceux', echec: 'malchanceux' },
      } as RegleTestStat
      case 'composite': return {
        type: 'composite', utilise: '', effets: { chanceux: [], malchanceux: [] },
      } as RegleComposite
      case 'restaurer_stat': return {
        type: 'restaurer_stat', stat: 'endurance', valeur: 'start',
      } as RegleRestaurerStat
      case 'duel_de': return {
        type: 'duel_de', jet_heros: '2d6', jet_adversaire: '2d6',
        resultats: { succes: 'chanceux', echec: 'malchanceux' },
        cout: { item_id: '' },
      } as RegleDuelDe
      default: return { type: 'test_stat' } as unknown as Regle
    }
  }

  // ── Carte d'une règle nommée ───────────────────────────────────────────────

  private _buildRegleCard(key: string, regle: Regle, rebuild: () => void): HTMLElement {
    const card = document.createElement('div')
    card.className = 'regles-card'

    // Header
    const hdr = document.createElement('div')
    hdr.className = 'regles-card-header'

    // Bouton collapse
    const colBtn = document.createElement('button')
    colBtn.type = 'button'; colBtn.className = 'combat-collapse-btn'; colBtn.textContent = '▶'
    const body = document.createElement('div'); body.className = 'regles-card-body'
    body.hidden = true   // collapsé par défaut

    colBtn.addEventListener('click', () => {
      body.hidden = !body.hidden
      colBtn.textContent = body.hidden ? '▶' : '▼'
    })

    // Nom (renommable)
    const nameLbl = document.createElement('span')
    nameLbl.className = 'regles-card-name'; nameLbl.textContent = key
    const nameInput = document.createElement('input')
    nameInput.type = 'text'; nameInput.className = 'part-field-input regles-name-input'
    nameInput.value = key; nameInput.style.display = 'none'
    nameLbl.addEventListener('dblclick', () => {
      nameLbl.style.display = 'none'; nameInput.style.display = ''
      nameInput.focus(); nameInput.select()
    })
    nameInput.addEventListener('blur', () => {
      const newKey = nameInput.value.trim()
      if (newKey && newKey !== key && !this.data[newKey]) {
        ;(this.data as Record<string, unknown>)[newKey] = this.data[key]
        delete (this.data as Record<string, unknown>)[key]
        this._notify(); rebuild()
      } else {
        nameInput.value = key
        nameInput.style.display = 'none'; nameLbl.style.display = ''
      }
    })

    // Badge type
    const typeBadge = document.createElement('span')
    typeBadge.className = 'regles-type-badge'
    typeBadge.textContent = regle.type

    // Supprimer
    const del = document.createElement('button')
    del.type = 'button'; del.className = 'cpm-list-del'; del.innerHTML = '🗑'
    del.title = `Supprimer "${key}"`
    del.addEventListener('click', () => {
      if (!confirm(`Supprimer la règle "${key}" ?`)) return
      delete (this.data as Record<string, unknown>)[key]
      rebuild(); this._notify()
    })

    hdr.append(colBtn, nameLbl, nameInput, typeBadge, del)
    card.appendChild(hdr)

    // Corps selon le type
    switch (regle.type) {
      case 'test_stat':      body.appendChild(this._buildTestStat(key, regle as RegleTestStat)); break
      case 'composite':      body.appendChild(this._buildComposite(key, regle as RegleComposite)); break
      case 'restaurer_stat': body.appendChild(this._buildRestaurerStat(key, regle as RegleRestaurerStat)); break
      case 'duel_de':        body.appendChild(this._buildDuelDe(key, regle as RegleDuelDe)); break
    }

    card.appendChild(body)
    return card
  }

  // ── test_stat ─────────────────────────────────────────────────────────────

  private _buildTestStat(key: string, r: RegleTestStat): HTMLElement {
    const wrap = document.createElement('div'); wrap.className = 'regles-form'

    wrap.appendChild(this._fieldRow('Formule de dés', this._textIn(r.jet_heros, '2d6',
      v => { r.jet_heros = v; this._notifyKey(key, r) })))

    wrap.appendChild(this._fieldRow('Opérateur stats', this._selectIn(r.operator ?? 'AND',
      [['AND','ET (toutes les stats)'],['OR','OU (au moins une)']],
      v => { r.operator = v as 'AND'|'OR'; this._notifyKey(key, r) })))

    // Stats à tester
    const { sec: statsBlock, body: statsBody } = this._subSection('Stats testées')
    const statsListEl = document.createElement('div'); statsListEl.className = 'regles-stats-list'

    const rebuildStats = (): void => {
      statsListEl.innerHTML = ''
      r.stats.forEach((s, i) => {
        const row = document.createElement('div'); row.className = 'regles-stat-row'

        const statIn = this._textIn(s.stat, 'stat (ex: chance)', v => { s.stat = v; this._notifyKey(key, r) })
        statIn.style.flex = '1'
        const condSel = this._selectIn(s.condition, [['<=','≤'],['<','<'],['>=','≥'],['>','>']],
          v => { s.condition = v as typeof s.condition; this._notifyKey(key, r) })
        const del = document.createElement('button')
        del.type = 'button'; del.className = 'cpm-list-del'; del.innerHTML = '🗑'
        del.addEventListener('click', () => { r.stats.splice(i, 1); rebuildStats(); this._notifyKey(key, r) })

        row.append(statIn, condSel, del)
        statsListEl.appendChild(row)
      })
    }

    const addStatBtn = document.createElement('button')
    addStatBtn.type = 'button'; addStatBtn.className = 'btn btn-ghost btn-sm'
    addStatBtn.textContent = '+ Stat'
    addStatBtn.addEventListener('click', () => {
      r.stats.push({ stat: '', condition: '<=' }); rebuildStats(); this._notifyKey(key, r)
    })

    rebuildStats()
    statsBody.appendChild(statsListEl); statsBody.appendChild(addStatBtn)
    wrap.appendChild(statsBlock)

    // Résultats
    const { sec: resBlock, body: resBody } = this._subSection('Résultats')
    resBody.appendChild(this._fieldRow('Libellé succès',
      this._textIn(r.resultats['succes'] ?? 'chanceux', 'ex: chanceux',
        v => { r.resultats['succes'] = v; this._notifyKey(key, r) })))
    resBody.appendChild(this._fieldRow('Libellé échec',
      this._textIn(r.resultats['echec'] ?? 'malchanceux', 'ex: malchanceux',
        v => { r.resultats['echec'] = v; this._notifyKey(key, r) })))
    wrap.appendChild(resBlock)

    // Tentatives / réussites
    wrap.appendChild(this._fieldRow('Tentatives',
      this._numIn(r.tentatives ?? 1, 1, v => { r.tentatives = v; this._notifyKey(key, r) })))
    wrap.appendChild(this._fieldRow('Réussites requises',
      this._numIn(r.reussites_requises ?? 1, 1, v => { r.reussites_requises = v; this._notifyKey(key, r) })))
    wrap.appendChild(this._fieldRow('Consécutif (arrêt sur échec)',
      this._toggleIn(r.consecutif !== false, v => { r.consecutif = v; this._notifyKey(key, r) })))

    // Effets "toujours"
    const { sec: effBlock, body: effBody } = this._subSection('Effets "toujours"')
    const effContainer = document.createElement('div')
    const toujours = r.effets?.toujours
    const toujoursArr = Array.isArray(toujours) ? toujours : (toujours ? [toujours as import('../types').Effet] : [])
    new EffetsEditor(effContainer, {
      effets: toujoursArr,
      onChange: effets => {
        if (!r.effets) r.effets = {}
        r.effets.toujours = effets.length > 0 ? (effets.length === 1 ? effets[0] : effets as unknown as import('../types').Effet) : undefined
        this._notifyKey(key, r)
      },
      addLabel: '+ Effet toujours',
    })
    effBody.appendChild(effContainer)
    wrap.appendChild(effBlock)

    return wrap
  }

  // ── composite ─────────────────────────────────────────────────────────────

  private _buildComposite(key: string, r: RegleComposite): HTMLElement {
    const wrap = document.createElement('div'); wrap.className = 'regles-form'

    wrap.appendChild(this._fieldRow('Règle utilisée (nom)',
      this._textIn(r.utilise, 'ex: tenter_chance',
        v => { r.utilise = v; this._notifyKey(key, r) })))

    // Effets par résultat
    const { sec: effBlock, body: effBody } = this._subSection('Effets par résultat')
    const effKeys = Object.keys(r.effets)

    const rebuildEffets = (): void => {
      effBody.innerHTML = ''

      Object.entries(r.effets).forEach(([res, effets]) => {
        const resDiv = document.createElement('div'); resDiv.className = 'regles-composite-res'
        const resHdr = document.createElement('div'); resHdr.className = 'regles-composite-res-header'

        const resLbl = document.createElement('span'); resLbl.className = 'regles-card-name'
        resLbl.textContent = res
        const resInput = document.createElement('input')
        resInput.type = 'text'; resInput.className = 'part-field-input'; resInput.value = res
        resInput.style.display = 'none'
        resLbl.addEventListener('dblclick', () => { resLbl.style.display='none'; resInput.style.display=''; resInput.focus() })
        resInput.addEventListener('blur', () => {
          const nk = resInput.value.trim()
          if (nk && nk !== res) { r.effets[nk] = r.effets[res]; delete r.effets[res]; this._notifyKey(key, r); rebuildEffets() }
          else { resInput.style.display='none'; resLbl.style.display='' }
        })

        const delRes = document.createElement('button')
        delRes.type = 'button'; delRes.className = 'cpm-list-del'; delRes.innerHTML = '🗑'
        delRes.addEventListener('click', () => { delete r.effets[res]; this._notifyKey(key, r); rebuildEffets() })

        resHdr.append(resLbl, resInput, delRes)
        resDiv.appendChild(resHdr)

        const effContainer = document.createElement('div')
        new EffetsEditor(effContainer, {
          effets: effets ?? [],
          onChange: updated => { r.effets[res] = updated; this._notifyKey(key, r) },
        })
        resDiv.appendChild(effContainer)
        effBody.appendChild(resDiv)
      })

      const addResRow = document.createElement('div'); addResRow.className = 'regles-add-row'
      const resNameIn = document.createElement('input')
      resNameIn.type = 'text'; resNameIn.className = 'part-field-input'; resNameIn.placeholder = 'libellé résultat'
      resNameIn.style.flex = '1'
      const addResBtn = document.createElement('button')
      addResBtn.type = 'button'; addResBtn.className = 'btn btn-ghost btn-sm'; addResBtn.textContent = '+ Résultat'
      addResBtn.addEventListener('click', () => {
        const k = resNameIn.value.trim(); if (!k) return
        r.effets[k] = []; resNameIn.value = ''; this._notifyKey(key, r); rebuildEffets()
      })
      addResRow.append(resNameIn, addResBtn)
      effBody.appendChild(addResRow)
    }

    void effKeys
    rebuildEffets()
    wrap.appendChild(effBlock)
    return wrap
  }

  // ── restaurer_stat ────────────────────────────────────────────────────────

  private _buildRestaurerStat(key: string, r: RegleRestaurerStat): HTMLElement {
    const wrap = document.createElement('div'); wrap.className = 'regles-form'

    wrap.appendChild(this._fieldRow('Stat',
      this._textIn(r.stat, 'ex: endurance', v => { r.stat = v; this._notifyKey(key, r) })))

    wrap.appendChild(this._fieldRow('Valeur cible',
      this._textIn(r.valeur !== undefined ? String(r.valeur) : '', '"start", "max" ou nombre',
        v => {
          r.valeur = v === '' ? undefined : (v === 'start' || v === 'max' ? v : (isNaN(Number(v)) ? undefined : Number(v)))
          this._notifyKey(key, r)
        })))

    wrap.appendChild(this._fieldRow('Delta',
      this._numOptIn(r.delta, 'variation relative', v => { r.delta = v; this._notifyKey(key, r) })))

    wrap.appendChild(this._fieldRow('Ignorer max',
      this._toggleIn(!!r.ignore_max, v => { r.ignore_max = v || undefined; this._notifyKey(key, r) })))

    // Condition item requis
    const { sec: condBlock, body: condBody } = this._subSection('Condition (item requis)')
    const cond = r.condition ?? {}; r.condition = cond
    condBody.appendChild(this._fieldRow('ID item',
      this._textIn(cond.item_id ?? '', 'ex: repas', v => { cond.item_id = v || undefined; this._notifyKey(key, r) })))
    condBody.appendChild(this._fieldRow('Quantité min',
      this._numOptIn(cond.quantite, '1', v => { cond.quantite = v; this._notifyKey(key, r) })))
    wrap.appendChild(condBlock)

    // Coût item
    const { sec: coutBlock, body: coutBody } = this._subSection('Coût (item consommé)')
    const cout = r.cout_item ?? { item_id: '' }; r.cout_item = cout
    coutBody.appendChild(this._fieldRow('ID item',
      this._textIn(cout.item_id, 'ex: repas', v => { cout.item_id = v; this._notifyKey(key, r) })))
    coutBody.appendChild(this._fieldRow('Quantité',
      this._numOptIn(cout.quantite, '1', v => { cout.quantite = v; this._notifyKey(key, r) })))
    wrap.appendChild(coutBlock)

    // Max utilisations
    const { sec: maxBlock, body: maxBody } = this._subSection('Max utilisations')
    const mu = r.max_utilisations ?? {}; r.max_utilisations = mu
    maxBody.appendChild(this._fieldRow('Par section (fixe)',
      this._numOptIn(mu.section, '∞', v => { mu.section = v; this._notifyKey(key, r) })))
    maxBody.appendChild(this._fieldRow('Par visite section',
      this._numOptIn(mu.section_courante, '∞', v => { mu.section_courante = v; this._notifyKey(key, r) })))
    maxBody.appendChild(this._fieldRow('Pendant combat',
      this._numOptIn(mu.combat, '∞', v => { mu.combat = v; this._notifyKey(key, r) })))
    maxBody.appendChild(this._fieldRow('Par aventure',
      this._numOptIn(mu.aventure, '∞', v => { mu.aventure = v; this._notifyKey(key, r) })))
    wrap.appendChild(maxBlock)

    return wrap
  }

  // ── duel_de ───────────────────────────────────────────────────────────────

  private _buildDuelDe(key: string, r: RegleDuelDe): HTMLElement {
    const wrap = document.createElement('div'); wrap.className = 'regles-form'

    wrap.appendChild(this._fieldRow('Formule héros',
      this._textIn(r.jet_heros, '2d6', v => { r.jet_heros = v; this._notifyKey(key, r) })))
    wrap.appendChild(this._fieldRow('Formule adversaire',
      this._textIn(r.jet_adversaire, '2d6', v => { r.jet_adversaire = v; this._notifyKey(key, r) })))
    wrap.appendChild(this._fieldRow('Libellé succès',
      this._textIn(r.resultats.succes, 'chanceux', v => { r.resultats.succes = v; this._notifyKey(key, r) })))
    wrap.appendChild(this._fieldRow('Libellé échec',
      this._textIn(r.resultats.echec, 'malchanceux', v => { r.resultats.echec = v; this._notifyKey(key, r) })))

    // Condition succès
    wrap.appendChild(this._fieldRow('Condition succès (expr)',
      this._textIn(r.conditions?.succes?.expr ?? '', 'ex: {jet_heros} >= {jet_adversaire}',
        v => {
          if (v) r.conditions = { succes: { type: 'expr', expr: v } }
          else r.conditions = undefined
          this._notifyKey(key, r)
        })))

    // Coût
    const { sec: coutBlock, body: coutBody } = this._subSection('Coût (mise)')
    const cout = r.cout; 
    coutBody.appendChild(this._fieldRow('ID item monnaie',
      this._textIn(cout.item_id, 'ex: piece-or', v => { cout.item_id = v; this._notifyKey(key, r) })))
    coutBody.appendChild(this._fieldRow('Mise fixe',
      this._numOptIn(cout.quantite, '—', v => { cout.quantite = v; this._notifyKey(key, r) })))
    coutBody.appendChild(this._fieldRow('Mise min (choix joueur)',
      this._numOptIn(cout.quantite_choix?.min, '—',
        v => {
          if (v) cout.quantite_choix = { min: v, max: cout.quantite_choix?.max ?? v }
          else cout.quantite_choix = undefined
          this._notifyKey(key, r)
        })))
    coutBody.appendChild(this._fieldRow('Mise max (choix joueur)',
      this._numOptIn(cout.quantite_choix?.max, '—',
        v => {
          if (v && cout.quantite_choix) cout.quantite_choix.max = v
          this._notifyKey(key, r)
        })))
    wrap.appendChild(coutBlock)

    // Gain
    const { sec: gainBlock, body: gainBody } = this._subSection('Gain')
    const gain = r.gain ?? {}; r.gain = gain
    gainBody.appendChild(this._fieldRow('Multiplicateur',
      this._numOptIn(gain.multiplicateur, 'ex: 2', v => { gain.multiplicateur = v; this._notifyKey(key, r) })))
    gainBody.appendChild(this._fieldRow('Item gagné (id)',
      this._textIn(gain.item_id ?? '', 'ex: piece-or', v => { gain.item_id = v || undefined; this._notifyKey(key, r) })))
    gainBody.appendChild(this._fieldRow('Quantité gagnée',
      this._numOptIn(gain.quantite, '—', v => { gain.quantite = v; this._notifyKey(key, r) })))
    wrap.appendChild(gainBlock)

    return wrap
  }

  // ── Helpers de structure ───────────────────────────────────────────────────

  /** Section avec header cliquable ▶/▼, réduite par défaut. Retourne { sec, body }. */
  private _collapsibleSection(title: string): { sec: HTMLElement; body: HTMLElement } {
    const sec = document.createElement('div'); sec.className = 'part-section regles-collapsible'

    const hdr = document.createElement('div'); hdr.className = 'part-section-title regles-section-header'
    hdr.style.cursor = 'pointer'

    const colBtn = document.createElement('button')
    colBtn.type = 'button'; colBtn.className = 'combat-collapse-btn'; colBtn.textContent = '▼'
    hdr.appendChild(colBtn)
    hdr.appendChild(document.createTextNode(' ' + title))

    const body = document.createElement('div')
    body.className = 'regles-section-body'
    // Ouvert par défaut

    hdr.addEventListener('click', () => {
      const collapsed = body.style.display === 'none'
      body.style.display = collapsed ? '' : 'none'
      colBtn.textContent = collapsed ? '▼' : '▶'
    })

    sec.appendChild(hdr)
    sec.appendChild(body)
    return { sec, body }
  }

  private _subSection(title: string): { sec: HTMLElement; body: HTMLElement } {
    const sec = document.createElement('div'); sec.className = 'regles-subsection'

    const hdr = document.createElement('div')
    hdr.className = 'regles-subsection-title'
    hdr.style.cursor = 'pointer'

    const colBtn = document.createElement('button')
    colBtn.type = 'button'; colBtn.className = 'combat-collapse-btn'; colBtn.textContent = '▶'
    hdr.appendChild(colBtn)
    hdr.appendChild(document.createTextNode(' ' + title))

    const body = document.createElement('div')
    body.hidden = true   // collapsé par défaut

    hdr.addEventListener('click', () => {
      body.hidden = !body.hidden
      colBtn.textContent = body.hidden ? '▶' : '▼'
    })

    sec.appendChild(hdr)
    sec.appendChild(body)
    return { sec, body }
  }

  private _fieldRow(label: string, control: HTMLElement): HTMLElement {
    const row = document.createElement('div'); row.className = 'part-field'
    const lbl = document.createElement('label'); lbl.className = 'part-field-label'; lbl.textContent = label
    row.appendChild(lbl); row.appendChild(control); return row
  }

  // ── Contrôles ──────────────────────────────────────────────────────────────

  private _textIn(value: string, placeholder: string, onChange: (v: string) => void): HTMLInputElement {
    const i = document.createElement('input')
    i.type = 'text'; i.className = 'part-field-input'; i.placeholder = placeholder; i.value = value
    i.addEventListener('input', () => onChange(i.value)); return i
  }

  private _numIn(value: number, min: number, onChange: (v: number) => void): HTMLInputElement {
    const i = document.createElement('input')
    i.type = 'number'; i.className = 'part-field-input part-num-input'
    i.min = String(min); i.value = String(value)
    i.addEventListener('input', () => onChange(parseInt(i.value, 10) || 0)); return i
  }

  private _numOptIn(value: number | undefined, placeholder: string, onChange: (v: number | undefined) => void): HTMLInputElement {
    const i = document.createElement('input')
    i.type = 'number'; i.className = 'part-field-input part-num-input'
    i.placeholder = placeholder; if (value !== undefined) i.value = String(value)
    i.addEventListener('input', () => {
      const n = parseInt(i.value, 10)
      onChange(isNaN(n) ? undefined : n)
    }); return i
  }

  private _selectIn(value: string, options: [string, string][], onChange: (v: string) => void): HTMLSelectElement {
    const sel = document.createElement('select'); sel.className = 'part-field-input cpm-select'
    options.forEach(([v, l]) => {
      const opt = document.createElement('option'); opt.value = v; opt.textContent = l
      if (v === value) opt.selected = true; sel.appendChild(opt)
    })
    sel.addEventListener('change', () => onChange(sel.value)); return sel
  }

  private _toggleIn(value: boolean, onChange: (v: boolean) => void): HTMLLabelElement {
    const lbl = document.createElement('label'); lbl.className = 'cpm-toggle-wrap'
    lbl.style.cssText = 'flex-direction:row;gap:0.4rem;cursor:pointer;'
    const cb = document.createElement('input'); cb.type = 'checkbox'
    cb.className = 'cpm-toggle-input'; cb.checked = value
    cb.addEventListener('change', () => onChange(cb.checked))
    const track = document.createElement('span'); track.className = 'cpm-toggle-track'
    const thumb = document.createElement('span'); thumb.className = 'cpm-toggle-thumb'
    track.appendChild(thumb); lbl.append(cb, track); return lbl
  }

  private _notifyKey(key: string, regle: Regle): void {
    ;(this.data as Record<string, unknown>)[key] = regle
    this._notify()
  }
}
