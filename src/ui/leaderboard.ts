import { SaveStore } from '../engine/SaveStore'
import type { LeaderboardEntry } from '../types'

export class LeaderboardView {
  private saveStore: SaveStore
  private adventureTitle: string

  constructor(adventureTitle: string, _adventure: any, saveStore?: SaveStore) {
    this.adventureTitle = adventureTitle
    this.saveStore = saveStore ?? new SaveStore()
  }

  render(container: HTMLElement): void {
    const entries = this.saveStore.getLeaderboard(this.adventureTitle)

    if (entries.length === 0) {
      container.innerHTML = `
        <div class="leaderboard-modal">
          <div class="leaderboard-content">
            <h2>Tableau de score</h2>
            <p class="empty-message">Aucun score enregistré pour cette aventure.</p>
            <button class="btn btn-secondary" id="btn-close-leaderboard">Fermer</button>
          </div>
        </div>
      `
    } else {
      const statsKeys = this.extractStatsKeys(entries)
      const statsHeaderHtml = statsKeys.map(key => `<th>${this.escHtml(key)}</th>`).join('')

      container.innerHTML = `
        <div class="leaderboard-modal">
          <div class="leaderboard-content">
            <h2>Tableau de score</h2>
            <div class="leaderboard-table-wrapper">
              <table class="leaderboard-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nom</th>
                    <th>Temps</th>
                    <th>Sauvegardes</th>
                    ${statsHeaderHtml}
                  </tr>
                </thead>
                <tbody>
                  ${entries.map((e, i) => this.renderRow(i + 1, e, statsKeys)).join('')}
                </tbody>
              </table>
            </div>
            <button class="btn btn-secondary" id="btn-close-leaderboard">Fermer</button>
          </div>
        </div>
      `
    }

    container.querySelector<HTMLButtonElement>('#btn-close-leaderboard')?.addEventListener('click', () => {
      container.innerHTML = ''
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

  private renderRow(rank: number, entry: LeaderboardEntry, statsKeys: string[]): string {
    const minutes = Math.floor(entry.tempsJeuMs / 60000)
    const seconds = Math.floor((entry.tempsJeuMs % 60000) / 1000)
    const timeStr = `${minutes}m ${seconds}s`
    const statsHtml = statsKeys.map(key => {
      const value = entry.statistiques?.[key] ?? '-'
      return `<td>${value}</td>`
    }).join('')

    return `
      <tr>
        <td class="rank">#${rank}</td>
        <td class="name">${this.escHtml(entry.nom)}</td>
        <td class="time">${timeStr}</td>
        <td class="saves">${entry.nombreSauvegardes ?? 0}</td>
        ${statsHtml}
      </tr>
    `
  }

  private escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }
}
