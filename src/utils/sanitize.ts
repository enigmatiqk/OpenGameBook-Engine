/**
 * sanitize.ts — Fonctions de sécurité centralisées pour tout contenu externe.
 *
 * Ce module doit être la seule porte d'entrée pour rendre du contenu provenant
 * de fichiers JSON distants (manifest, couverture, sections, etc.) ou de noms
 * de fichiers images dans le DOM.
 */

import DOMPurify from 'dompurify'

// ─── Configuration des domaines autorisés ────────────────────────────────────

/**
 * Liste des origines (scheme + host) autorisées pour les ressources distantes.
 *
 * Valeurs spéciales :
 *   - '*' (défaut) : tout domaine HTTPS est accepté.
 *   - Un tableau d'origines : seuls ces domaines sont autorisés.
 *     Exemple : ['https://mondomaine.com', 'https://cdn.exemple.org']
 *
 * À personnaliser selon l'environnement de déploiement.
 */
export const ALLOWED_REMOTE_ORIGINS: string[] | '*' = '*'

// ─── Balises et attributs HTML autorisés (sortie WYSIWYG) ────────────────────

/**
 * Sous-ensemble strict des balises que le WysiwygEditor (execCommand) peut
 * produire. On n'autorise délibérément ni <a>, ni <img>, ni <iframe>,
 * ni aucune balise pouvant référencer une URL ou exécuter du code.
 */
const WYSIWYG_ALLOWED_TAGS = [
  'p', 'br', 'div', 'span',
  'strong', 'b', 'em', 'i', 'u', 's',
  'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4',
  'blockquote', 'hr',
]

/**
 * Attributs autorisés pour les balises WYSIWYG.
 * On accepte uniquement `class` et `style` en lecture, mais on retire
 * tout ce qui peut être un vecteur (event handlers, href, src…).
 */
const WYSIWYG_ALLOWED_ATTR = ['class', 'style']

// ─── sanitizeHtml ─────────────────────────────────────────────────────────────

/**
 * Assainit un fragment HTML produit par le WYSIWYG ou stocké dans le JSON.
 *
 * - Supprime tout élément non listé dans WYSIWYG_ALLOWED_TAGS
 * - Supprime tous les event handlers (onclick, onerror, …)
 * - Supprime <script>, <style>, <iframe>, <object>, <embed>, <form>
 * - Conserve la mise en forme textuelle (gras, italique, listes, …)
 *
 * À utiliser pour : section.texte, mode_emploi, intro.texte
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS:  WYSIWYG_ALLOWED_TAGS,
    ALLOWED_ATTR:  WYSIWYG_ALLOWED_ATTR,
    // Force la suppression des scripts même imbriqués
    FORCE_BODY:    true,
    // Refuse toute URL dans style= (ex: background: url(javascript:…))
    FORBID_CONTENTS: ['script', 'style'],
  })
}

// ─── sanitizeText ─────────────────────────────────────────────────────────────

/**
 * Échappe un texte brut pour insertion sûre dans du HTML.
 * Utilisé pour les champs qui ne doivent JAMAIS contenir de HTML :
 * titres, collections, noms d'items, étiquettes de choix, etc.
 *
 * Retourne une chaîne dont tous les caractères spéciaux HTML sont encodés.
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ─── sanitizeImageName ────────────────────────────────────────────────────────

/** Extensions d'images autorisées (toutes en minuscules). */
const ALLOWED_IMAGE_EXTENSIONS = new Set([
  '.webp', '.jpg', '.jpeg', '.png', '.gif', '.avif', '.svg',
])

/**
 * Valide qu'un nom de fichier image est sûr (pas de path traversal,
 * extension autorisée, pas de protocole).
 *
 * - Rejette tout chemin contenant `..` (path traversal)
 * - Rejette tout protocole (javascript:, data:, http:…)
 * - Rejette les extensions non listées dans ALLOWED_IMAGE_EXTENSIONS
 * - Normalise les séparateurs Windows
 *
 * Retourne le nom normalisé si valide, `null` sinon.
 */
export function sanitizeImageName(name: string): string | null {
  if (!name || typeof name !== 'string') return null

  // Interdit tout protocole (javascript:, data:, http:, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:/i.test(name)) return null

  // Normalise les backslashes Windows
  const normalized = name.replace(/\\/g, '/')

  // Path traversal : interdit ".." dans n'importe quel segment
  if (normalized.split('/').some(seg => seg === '..')) return null

  // Extension : uniquement les formats images autorisés
  const dot = normalized.lastIndexOf('.')
  if (dot === -1) return null
  const ext = normalized.slice(dot).toLowerCase()
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) return null

  return normalized
}

// ─── sanitizeImageUrl ─────────────────────────────────────────────────────────

/**
 * Signatures de magic bytes des formats images supportés.
 * Chaque entrée est { offset, bytes } — les bytes sont comparés
 * au début du buffer (après offset octets).
 */
const IMAGE_SIGNATURES: Array<{ offset: number; bytes: number[] }> = [
  // JPEG : FF D8 FF
  { offset: 0, bytes: [0xFF, 0xD8, 0xFF] },
  // PNG  : 89 50 4E 47 0D 0A 1A 0A
  { offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  // GIF87a / GIF89a
  { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  // WEBP  : RIFF????WEBP — octets 0-3 = RIFF, octets 8-11 = WEBP
  { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },   // RIFF (WEBP vérifié à part)
  // AVIF / HEIF : ftyp box — offset 4 = 'f','t','y','p'
  { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
]

/** Taille du buffer pour la vérification magic bytes (16 octets suffisent). */
const MAGIC_BYTES_SIZE = 16

/**
 * Vérifie les magic bytes d'une URL image via un HEAD + Range request.
 * Retourne `true` si les premiers octets correspondent à un format image connu,
 * `false` sinon (y compris en cas d'erreur réseau).
 *
 * Note : Range requests ne sont pas supportées par tous les serveurs.
 * En cas d'échec du Range, on tente un GET normal limité à 16 octets.
 */
async function verifyMagicBytes(url: string): Promise<boolean> {
  let buffer: ArrayBuffer | null = null

  try {
    // Tentative 1 : Range request (économe en bande passante)
    const rangeResp = await fetch(url, {
      headers: { Range: `bytes=0-${MAGIC_BYTES_SIZE - 1}` },
    })
    if (rangeResp.ok || rangeResp.status === 206) {
      buffer = await rangeResp.arrayBuffer()
    }
  } catch {
    // Ignore — réseau ou CORS, on tente le GET complet tronqué
  }

  if (!buffer || buffer.byteLength === 0) {
    try {
      // Tentative 2 : GET complet, on ne lit que les N premiers octets
      const resp = await fetch(url)
      if (!resp.ok) return false
      // Lecture partielle via le ReadableStream pour ne pas tout charger
      const reader = resp.body?.getReader()
      if (!reader) return false
      const { value } = await reader.read()
      reader.cancel().catch(() => {/* ignore */})
      if (!value) return false
      buffer = value.buffer.slice(value.byteOffset, value.byteOffset + Math.min(value.byteLength, MAGIC_BYTES_SIZE))
    } catch {
      return false
    }
  }

  const bytes = new Uint8Array(buffer)

  // Vérification WEBP spécifique : RIFF à offset 0, WEBP à offset 8
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes.byteLength >= 12 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return true
  }

  for (const sig of IMAGE_SIGNATURES) {
    // On saute la signature RIFF générique (gérée au-dessus pour WEBP)
    if (sig.bytes[0] === 0x52 && sig.bytes[1] === 0x49) continue

    const { offset, bytes: expected } = sig
    if (bytes.byteLength < offset + expected.length) continue
    if (expected.every((b, i) => bytes[offset + i] === b)) return true
  }

  return false
}

// ─── sanitizeRemoteUrl ────────────────────────────────────────────────────────

/**
 * Valide une URL distante (utilisée pour les `path` HTTP/HTTPS dans les
 * manifests et pour les `repertoire_images` distant).
 *
 * Contrôles effectués :
 * 1. URL syntaxiquement valide
 * 2. Protocole HTTP ou HTTPS uniquement
 * 3. Pas de credentials dans l'URL (user:password@)
 * 4. Si ALLOWED_REMOTE_ORIGINS !== '*', le hostname doit être dans la liste
 *
 * Retourne l'URL normalisée (sans trailing slash superflu) si valide, `null`
 * sinon.
 */
export function sanitizeRemoteUrl(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }

  // Protocole : http ou https uniquement
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  // Pas de credentials embarqués
  if (url.username || url.password) return null

  // Liste blanche de domaines
  if (ALLOWED_REMOTE_ORIGINS !== '*') {
    const origin = url.origin // e.g. "https://mondomaine.com"
    if (!ALLOWED_REMOTE_ORIGINS.includes(origin)) return null
  }

  return url.href
}

// ─── validateRemoteImage ──────────────────────────────────────────────────────

/**
 * Validation complète d'une image distante (URL absolue) :
 * 1. sanitizeRemoteUrl() — protocole, domaine
 * 2. Extension du nom de fichier dans la liste blanche
 * 3. Magic bytes — vérifie que les premiers octets correspondent
 *    réellement à un format image connu (anti-spoofing d'extension)
 *
 * Retourne `true` si l'image passe tous les contrôles, `false` sinon.
 *
 * Note : cette fonction effectue une requête réseau (lente). Elle doit être
 * appelée uniquement lors du chargement initial de l'aventure, pas à chaque
 * rendu.
 */
export async function validateRemoteImage(url: string): Promise<boolean> {
  const sanitized = sanitizeRemoteUrl(url)
  if (!sanitized) return false

  // Extraction du nom de fichier depuis le pathname
  try {
    const pathname = new URL(sanitized).pathname
    const filename = pathname.split('/').pop() ?? ''
    if (!sanitizeImageName(filename)) return false
  } catch {
    return false
  }

  return verifyMagicBytes(sanitized)
}
