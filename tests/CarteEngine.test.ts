import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { Section } from '../src/types'
import { buildCarte, getPlayerCase } from '../src/carte/CarteEngine'
import { CarteView } from '../src/ui/CarteView'
import type { CarteCase, CarteState } from '../src/carte/CarteEngine'

const adventureSections = (JSON.parse(readFileSync(
  'adventures/Defis_Fantastiques_01_-_Le_Sorcier_de_la_Montagne_de_feu/sections.json',
  'utf8',
)) as { sections: Section[] }).sections

describe('buildCarte', () => {
  it('combines the section path with both choice paths', () => {
    const sections: Section[] = [
      {
        numero: 1,
        texte: '',
        carte: { env: 'montagne', chemin: ['N'] },
        choix: [
          { texte: 'Ouest', section: 71, carte: { chemin: ['O'] } },
          { texte: 'Est', section: 278, carte: { chemin: ['E'] } },
        ],
      },
      { numero: 71, texte: '', carte: { chemin: ['N'] }, choix: [] },
      { numero: 278, texte: '', choix: [] },
    ]

    const state = buildCarte(sections, new Set([1, 71]))
    const start = state.cases.get(1)!
    const junction = state.cases.get(state.grid.get('0,1')!)!
    const west = state.cases.get(71)!
    const hiddenEast = state.cases.get(278)!

    expect([start.x, start.y]).toEqual([0, 0])
    expect(start.murs.N).toBe('ouvert')
    expect(junction.isPath).toBe(true)
    expect([junction.x, junction.y]).toEqual([0, 1])
    expect(junction.murs).toMatchObject({ S: 'ouvert', O: 'ouvert', E: 'ouvert' })
    expect([west.x, west.y]).toEqual([-1, 1])
    expect(west.murs).toMatchObject({ E: 'ouvert', N: 'ouvert' })
    expect([hiddenEast.x, hiddenEast.y]).toEqual([1, 1])
    expect(hiddenEast.visible).toBe(false)

    const section71Path = state.cases.get(state.grid.get('-1,2')!)!
    expect(section71Path.isPath).toBe(true)
    expect(getPlayerCase(state, 71)).toBe(west)
  })

  it('keeps the section 1 junction visible with the adventure data', () => {
    const state = buildCarte(adventureSections, new Set([1, 71]))
    const junctionId = state.grid.get('0,1')
    const junction = state.cases.get(junctionId!)
    const section71PathId = state.grid.get('-1,2')
    const section71Path = state.cases.get(section71PathId!)

    expect(junctionId).toBeDefined()
    expect(junction).toMatchObject({ visible: true, x: 0, y: 1 })
    expect(junction?.murs).toMatchObject({ S: 'ouvert', O: 'ouvert', E: 'ouvert' })
    expect(getPlayerCase(state, 71)).toMatchObject({ x: -1, y: 1 })
    expect(section71Path).toMatchObject({ x: -1, y: 2, visible: false })
  })

  it('adds combat escape routes to the map', () => {
    const section8 = adventureSections.find(section => section.numero === 8)!
    const section189 = adventureSections.find(section => section.numero === 189)!
    const sections: Section[] = [
      {
        numero: 1,
        texte: '',
        choix: [{ texte: 'Entrer', section: 8, carte: { chemin: ['N'] } }],
      },
      section8,
      section189,
    ]

    const state = buildCarte(sections)
    const barbarianRoom = state.cases.get(8)!
    const destination = state.cases.get(state.grid.get('0,2')!)!

    expect([barbarianRoom.x, barbarianRoom.y]).toEqual([0, 1])
    expect(barbarianRoom.murs.N).toBe('porte')
    expect(barbarianRoom.passages.N).toEqual(['porte'])
    expect([destination.x, destination.y]).toEqual([0, 2])
    expect(destination.num).toBe(189)
    expect(destination.murs.S).toBe('porte')
  })

  it('renders one passage icon when both adjacent cells describe the same edge', () => {
    const murs = { N: 'ferme', S: 'ferme', E: 'ferme', O: 'ferme' } as const
    const west: CarteCase = {
      num: 1, sectionNum: 1, aliasNums: [], x: 0, y: 0, env: null,
      murs: { ...murs, E: 'porte' }, passages: { E: ['porte'] }, visible: true, isPath: false,
    }
    const east: CarteCase = {
      num: 2, sectionNum: 2, aliasNums: [], x: 1, y: 0, env: null,
      murs: { ...murs, O: 'porte' }, passages: { O: ['porte'] }, visible: true, isPath: false,
    }
    const state: CarteState = {
      cases: new Map([[1, west], [2, east]]),
      grid: new Map([['0,0', 1], ['1,0', 2]]),
      minX: 0, maxX: 1, minY: 0, maxY: 0,
    }
    const container = document.createElement('div')
    const view = new CarteView(container, { showAll: true })

    view.render(state)

    expect([...container.querySelectorAll('text')].filter(node => node.textContent === '🚪')).toHaveLength(0)
    expect(container.querySelectorAll('line[stroke="#c8a040"]')).not.toHaveLength(0)
    expect(container.querySelectorAll('rect[fill="#c8a040"]')).not.toHaveLength(0)
  })

  it('dims path cells only when no section occupies the same position', () => {
    const murs = { N: 'ferme', S: 'ferme', E: 'ferme', O: 'ferme' } as const
    const makeCase = (num: number, x: number, isPath: boolean): CarteCase => ({
      num, sectionNum: num, aliasNums: [], x, y: 0, env: null,
      murs: { ...murs }, passages: {}, visible: true, isPath,
    })
    const state: CarteState = {
      cases: new Map([
        [-1, makeCase(-1, 0, true)],
        [-2, makeCase(-2, 1, true)],
        [2, makeCase(2, 1, false)],
      ]),
      grid: new Map([['0,0', -1], ['1,0', 2]]),
      minX: 0, maxX: 1, minY: 0, maxY: 0,
    }
    const container = document.createElement('div')
    const view = new CarteView(container, { showAll: true })

    view.render(state)

    const cells = [...container.querySelectorAll('rect[width="52"][height="52"]')]
    expect(cells.find(cell => cell.getAttribute('x') === '168')?.getAttribute('opacity')).toBe('0.7')
    expect(cells.filter(cell => cell.getAttribute('x') === '224').map(cell => cell.getAttribute('opacity')))
      .toEqual([null, null])
  })
})