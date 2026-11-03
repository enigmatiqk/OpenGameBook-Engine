import { SaveStore } from '../engine/SaveStore'
import type { LeaderboardEntry } from '../types'

type Filtre = 'tous' | 'victoire' | 'defaite'

export class LeaderboardView {
  private saveStore: SaveStore
  private adventureTitle: string
  private filtreCourant: Filtre = 'tous'

  constructor(adventureTitle: string, _adventure: any, saveStore?: SaveStore) {
    this.adventureTitle = adventureTitle
    this.saveStore = saveStore ?? new SaveStore()
  }

  render(container: HTMLElement): void {
    const allEntries = this.saveStore.getLeaderboard(this.adventureTitle)

    if (allEntries.length === 0) {
      container.innerHTML = `
        <div class="leaderboard-modal">
          <div class="leaderboard-content">
            <h2>Tableau de score</h2>
            <p class="empty-message">Aucun score enregistré pour cette aventure.</p>
            <button class="btn btn-secondary" id="btn-close-leaderboard">Fermer</button>
          </div>
        </div>
      `
      container.querySelector<HTMLButtonElement>('#btn-close-leaderboard')?.addEventListener('click', () => {
        container.innerHTML = ''
      })
      return
    }

    this._renderWithFilter(container, allEntries)
  }

  private _renderWithFilter(container: HTMLElement, allEntries: LeaderboardEntry[]): void {
    const filtered = allEntries.filter(e => {
      if (this.filtreCourant === 'tous') return true
      // Compatibilité arrière : entrées sans resultat comptent comme victoire
      const r = e.resultat ?? 'victoire'
      return r === this.filtreCourant
    })

    const hasDefeats = filtered.some(e => (e.resultat ?? 'victoire') === 'defaite')
    const statsKeys = this.extractStatsKeys(filtered)
    const statsHeaderHtml = statsKeys.map(key => `<th>${this.escHtml(key)}</th>`).join('')

    const sectionColHtml = hasDefeats ? '<th>§ Mort</th>' : ''

    container.innerHTML = `
      <div class="leaderboard-modal">
        <div class="leaderboard-content">
          <h2>Tableau de score</h2>
          <div class="leaderboard-filters">
            <button class="btn btn-filter ${this.filtreCourant === 'tous'     ? 'active' : ''}" data-filtre="tous">Tous</button>
            <button class="btn btn-filter ${this.filtreCourant === 'victoire' ? 'active' : ''}" data-filtre="victoire">🏆 Victoires</button>
            <button class="btn btn-filter ${this.filtreCourant === 'defaite'  ? 'active' : ''}" data-filtre="defaite">💀 Défaites</button>
          </div>
          ${filtered.length === 0
            ? '<p class="empty-message">Aucune entrée pour ce filtre.</p>'
            : `<div class="leaderboard-table-wrapper">
                <table class="leaderboard-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th></th>
                      <th>Nom</th>
                      <th>Temps</th>
                      <th>Sections</th>
                      <th>Carte</th>
                      ${sectionColHtml}
                      ${statsHeaderHtml}
                    </tr>
                  </thead>
                  <tbody>
                    ${filtered.map((e, i) => this.renderRow(i + 1, e, statsKeys, hasDefeats)).join('')}
                  </tbody>
                </table>
              </div>`
          }
          <button class="btn btn-secondary" id="btn-close-leaderboard">Fermer</button>
        </div>
      </div>
    `

    container.querySelector<HTMLButtonElement>('#btn-close-leaderboard')?.addEventListener('click', () => {
      container.innerHTML = ''
    })

    container.querySelectorAll<HTMLButtonElement>('.btn-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        this.filtreCourant = btn.dataset.filtre as Filtre
        this._renderWithFilter(container, allEntries)
      })
    })
  }

  private extractStatsKeys(entries: LeaderboardEntry[]): string[] {
    const keys = new Set<string>()
    for (const entry of entries) {
      if (entry.statistiques) {
        Object.keys(entry.statistiques).forEach(k => keys.add(k))
      }
    }
    return Array.from(keys).sort()
  }

  private renderRow(rank: number, entry: LeaderboardEntry, statsKeys: string[], showSectionMort: boolean): string {
    const minutes = Math.floor(entry.tempsJeuMs / 60000)
    const seconds = Math.floor((entry.tempsJeuMs % 60000) / 1000)
    const timeStr = `${minutes}m ${seconds}s`
    const resultat = entry.resultat ?? 'victoire'
    const badge = resultat === 'victoire'
      ? '<span class="lb-badge lb-badge--victoire" title="Victoire">🏆</span>'
      : '<span class="lb-badge lb-badge--defaite" title="Défaite">💀</span>'
    const rowClass = resultat === 'victoire' ? 'lb-row--victoire' : 'lb-row--defaite'
    const statsHtml = statsKeys.map(key => {
      const value = entry.statistiques?.[key]
      const initial = entry.statistiques_initiales?.[key]
      if (value === undefined) return `<td>-</td>`
      const display = initial !== undefined && initial !== value
        ? `${value}<span class="stat-initial">/${initial}</span>`
        : `${value}<span class="stat-initial">/${initial ?? value}</span>`
      return `<td>${display}</td>`
    }).join('')
    const sectionMortHtml = showSectionMort
      ? `<td class="section-mort">${entry.sectionMort !== undefined ? `§${entry.sectionMort}` : '-'}</td>`
      : ''

    return `
      <tr class="${rowClass}">
        <td class="rank">#${rank}</td>
        <td class="badge">${badge}</td>
        <td class="name">${this.escHtml(entry.nom)}</td>
        <td class="time">${timeStr}</td>
        <td class="sections">${entry.nombreSectionsParcourues ?? '-'}</td>
        <td class="carte">${entry.nombreOuverturesCarte ?? '-'}</td>
        ${sectionMortHtml}
        ${statsHtml}
      </tr>
    `
  }

  private escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }
}
