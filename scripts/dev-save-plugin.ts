/**
 * Plugin Vite : sauvegarde directe sur disque (mode dev uniquement).
 *
 * Expose deux endpoints via le serveur Vite :
 *   GET  /api/dev-save/ping          → 200 OK si le plugin tourne
 *   POST /api/dev-save/:adventure    → écrit les fichiers JSON dans adventures/<adventure>/
 *
 * Le plugin est déclaré avec `apply: 'serve'` — il n'est donc jamais inclus
 * dans le bundle de production.
 */

import type { Plugin } from 'vite'
import fs from 'fs'
import path from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

// Fichiers autorisés à être écrasés par le plugin (liste d'autorisation explicite)
const ALLOWED_FILES = new Set([
  'sections.json',
  'couverture.json',
  'livre.json',
  'personnage.json',
  'regles.json',
  'cartefix.json',
])

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

export function devSavePlugin(): Plugin {
  return {
    name: 'dev-save',
    apply: 'serve', // jamais actif lors du build

    configureServer(server) {
      server.middlewares.use(
        '/api/dev-save',
        (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          const url = req.url ?? '/'

          // ── GET /api/dev-save/ping ─────────────────────────────────────────
          if (req.method === 'GET' && url === '/ping') {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true }))
            return
          }

          // ── POST /api/dev-save/:adventure ──────────────────────────────────
          if (req.method === 'POST') {
            // url = "/<adventurePath>" où adventurePath peut contenir des /
            // ex. "/Defis_Fantastiques_01_.../sections.json"
            // On attend : /<adventureDir>/<filename>
            const parts = url.replace(/^\//, '').split('/')
            if (parts.length < 2) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'URL invalide. Attendu : /<adventure>/<fichier>.json' }))
              return
            }

            const filename    = parts[parts.length - 1]
            const adventureDir = parts.slice(0, -1).join('/')

            // Sécurité : seuls les fichiers listés dans ALLOWED_FILES sont acceptés
            if (!ALLOWED_FILES.has(filename)) {
              res.writeHead(403, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: `Fichier non autorisé : ${filename}` }))
              return
            }

            // Sécurité : pas de traversée de répertoire
            // adventureDir est un chemin relatif depuis la racine du projet
            // ex. "adventures/Defis_Fantastiques_01_..."
            const projectRoot    = path.resolve(process.cwd())
            const adventuresRoot = path.resolve(projectRoot, 'adventures')
            const targetDir      = path.resolve(projectRoot, adventureDir)
            if (!targetDir.startsWith(adventuresRoot)) {
              res.writeHead(403, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Chemin non autorisé' }))
              return
            }

            const targetPath = path.join(targetDir, filename)

            // Lecture du corps de la requête puis écriture asynchrone
            readBody(req)
              .then(body => {
                // Valide que le body est du JSON valide avant d'écrire
                JSON.parse(body)
                fs.writeFileSync(targetPath, body, 'utf-8')
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true, path: targetPath }))
                console.log(`[dev-save] ✅ ${targetPath}`)
              })
              .catch((err: unknown) => {
                console.error('[dev-save] ❌ Erreur écriture :', err)
                res.writeHead(500, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: String(err) }))
              })

            return
          }

          next()
        },
      )
    },
  }
}
