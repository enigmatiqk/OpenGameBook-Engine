import { defineConfig } from 'vite'
import { resolve } from 'path'
import { devSavePlugin } from './scripts/dev-save-plugin.ts'

/**
 * Content-Security-Policy appliquée en développement.
 *
 * Directives :
 * - default-src 'self'         : toute ressource non couverte doit venir de l'origine courante
 * - script-src 'self'          : pas d'inline scripts, pas de eval()
 * - style-src 'self' 'unsafe-inline' : les styles inline sont nécessaires (Vite HMR + composants)
 * - img-src 'self' data: https: blob: : images locales + distantes HTTPS + data-URLs (preview éditeur)
 * - connect-src 'self' https:  : fetch() vers l'origine courante + toutes URLs HTTPS distantes
 *   (manifests distants, aventures distantes, magic-bytes checks)
 * - font-src 'self'            : polices locales uniquement
 * - object-src 'none'          : interdit <object>, <embed>, <applet>
 * - frame-src 'self'           : iframes autorisées uniquement depuis la même origine
 *   (AdventureTreePanel utilise une iframe avec srcdoc + sandbox)
 * - base-uri 'self'            : empêche l'injection de <base href="...">
 * - form-action 'self'         : formulaires soumis à la même origine seulement
 * - upgrade-insecure-requests  : force HTTPS pour les sous-ressources
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: blob:",
  "connect-src 'self' https:",
  "font-src 'self'",
  "object-src 'none'",
  "frame-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ')

export default defineConfig({
  plugins: [devSavePlugin()],
  base: '/',
  build: {
    rollupOptions: {
      input: {
        app:    resolve(import.meta.dirname, 'index.html'),
        editor: resolve(import.meta.dirname, 'editor.html'),
      },
    },
  },
  server: {
    headers: {
      'Content-Security-Policy': CSP,
      // Empêche le navigateur de dévier du Content-Type déclaré
      'X-Content-Type-Options': 'nosniff',
      // Protège contre le clickjacking
      'X-Frame-Options': 'SAMEORIGIN',
      // Force HTTPS en production (ignoré par le navigateur sur http://localhost)
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    },
  },
  preview: {
    headers: {
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    },
  },
})
