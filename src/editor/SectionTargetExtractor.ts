import type { Section, SectionRef, Action, ActionRegle, ActionLancerDe } from '../types'

/**
 * Une section cible extraite d'une section donnée.
 * `numero` est null quand la destination est dynamique (param, -1...).
 */
export interface SectionTarget {
  /** Numéro de section fixe, ou null si dynamique / retour */
  numero: number | null
  /** Étiquette courte décrivant le contexte (choix, victoire, fuite...) */
  badge: 'choix' | 'action' | 'combat' | 'fuite' | 'mort' | 'condition' | 'lancer'
  /** Texte du choix ou description de l'entrée */
  texte: string
  /** Label affiché si la destination est dynamique */
  dynamicLabel?: string
}

// ─────────────────────────────────────────────────────────────────────────────

function resolveRef(ref: SectionRef): number | null {
  if (typeof ref === 'number') return ref === -1 ? null : ref
  return null // { param: "..." } → dynamique
}

function dynamicLabel(ref: SectionRef): string | undefined {
  if (typeof ref === 'object' && 'param' in ref) return `{${ref.param}}`
  if (ref === -1) return '← retour'
  return undefined
}

/**
 * Extrait récursivement toutes les destinations de section d'un `Action`.
 */
function extractFromAction(action: Action, texte: string, out: SectionTarget[]): void {
  if ('lancer_de' in action && action.type === 'lancer_de') {
    const ld = (action as ActionLancerDe).lancer_de
    for (const [face, outcome] of Object.entries(ld.resultats)) {
      if (outcome.section !== undefined) {
        out.push({
          numero: resolveRef(outcome.section),
          badge: 'lancer',
          texte: `${texte} (face ${face})`,
          dynamicLabel: dynamicLabel(outcome.section),
        })
      }
    }
    return
  }

  const regle = action as ActionRegle
  if (regle.si_reussi?.choix?.section !== undefined) {
    const ref = regle.si_reussi.choix.section
    out.push({
      numero: resolveRef(ref),
      badge: 'action',
      texte: `${texte} → ${regle.name} (réussi)`,
      dynamicLabel: dynamicLabel(ref),
    })
  }
  if (regle.si_echoue?.choix?.section !== undefined) {
    const ref = regle.si_echoue.choix.section
    out.push({
      numero: resolveRef(ref),
      badge: 'action',
      texte: `${texte} → ${regle.name} (échoué)`,
      dynamicLabel: dynamicLabel(ref),
    })
  }
}

/**
 * Extrait toutes les `SectionTarget` d'une section, en lisant le schema de façon
 * data-driven (sans hard-coder de logique métier spécifique à une aventure).
 */
export function extractTargets(section: Section): SectionTarget[] {
  const out: SectionTarget[] = []

  // ── 1. Choix directs ──────────────────────────────────────────────────────
  for (const choice of section.choix ?? []) {
    if (choice.section !== undefined) {
      const ref = choice.section as SectionRef
      const num = resolveRef(ref)
      const dyn = dynamicLabel(ref)
      // Exclure les choix locaux (num non défini mais pas de retour)
      if (num !== null || dyn) {
        out.push({
          numero: num,
          badge: 'choix',
          texte: choice.texte,
          dynamicLabel: dyn,
        })
      }
    }

    // Choix avec action (tenter_chance, lancer_de, etc.)
    if (choice.action) {
      const action: Action = typeof choice.action === 'string'
        ? { name: choice.action } as ActionRegle
        : choice.action as Action
      extractFromAction(action, choice.texte, out)
    }
  }

  // ── 2. Combat ─────────────────────────────────────────────────────────────
  if (section.combat) {
    const c = section.combat

    if (c.victoire?.section !== undefined) {
      const ref = c.victoire.section
      out.push({
        numero: resolveRef(ref),
        badge: 'combat',
        texte: 'Victoire au combat',
        dynamicLabel: dynamicLabel(ref),
      })
    }

    if (c.fuite?.section !== undefined) {
      const ref = c.fuite.section
      out.push({
        numero: resolveRef(ref),
        badge: 'fuite',
        texte: 'Fuite',
        dynamicLabel: dynamicLabel(ref),
      })
    }

    if (c.mort?.section !== undefined) {
      const ref = c.mort.section
      out.push({
        numero: resolveRef(ref),
        badge: 'mort',
        texte: 'Mort au combat',
        dynamicLabel: dynamicLabel(ref),
      })
    }

    // Événements de combat avec section cible
    for (const evt of c.events ?? []) {
      if (evt.section !== undefined) {
        const ref = evt.section
        out.push({
          numero: resolveRef(ref),
          badge: 'combat',
          texte: `Événement combat (round ${evt.round} – ${evt.declencheur})`,
          dynamicLabel: dynamicLabel(ref),
        })
      }
      // Événement avec choix multiples
      if (Array.isArray(evt.choix)) {
        for (const ch of evt.choix as Array<{ texte: string; section: SectionRef }>) {
          out.push({
            numero: resolveRef(ch.section),
            badge: 'combat',
            texte: `Événement combat → ${ch.texte}`,
            dynamicLabel: dynamicLabel(ch.section),
          })
        }
      }
    }

    // Phases : lancer_de pré-combat → resultats sont des strings (modifs de défense), pas des sections cibles

    // Victoire/fuite/mort au niveau phase
    for (const phase of c.phases ?? []) {
      if (phase.victoire?.section !== undefined) {
        const ref = phase.victoire.section
        out.push({
          numero: resolveRef(ref),
          badge: 'combat',
          texte: 'Victoire (phase)',
          dynamicLabel: dynamicLabel(ref),
        })
      }
      if (phase.fuite?.section !== undefined) {
        const ref = phase.fuite.section
        out.push({
          numero: resolveRef(ref),
          badge: 'fuite',
          texte: 'Fuite (phase)',
          dynamicLabel: dynamicLabel(ref),
        })
      }
      if (phase.mort?.section !== undefined) {
        const ref = phase.mort.section
        out.push({
          numero: resolveRef(ref),
          badge: 'mort',
          texte: 'Mort (phase)',
          dynamicLabel: dynamicLabel(ref),
        })
      }
    }
  }

  // ── 3. Effets de navigation (type "navigation" sur la section elle-même) ──
  for (const effet of section.effets ?? []) {
    // Les effets de type "section" (si un jour ils pointent vers une section)
    if (effet.type === 'navigation' && (effet as unknown as { section: SectionRef }).section !== undefined) {
      const ref = (effet as unknown as { section: SectionRef }).section
      out.push({
        numero: resolveRef(ref),
        badge: 'condition',
        texte: 'Effet de navigation',
        dynamicLabel: dynamicLabel(ref),
      })
    }
  }

  // Déduplique les entrées numéro + badge identiques (garde le premier trouvé)
  const seen = new Set<string>()
  return out.filter(t => {
    const key = `${t.badge}:${t.numero ?? t.dynamicLabel}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
