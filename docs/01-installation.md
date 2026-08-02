# Installation, build et configuration

## Prérequis

| Outil | Version minimale |
|-------|-----------------|
| Node.js | 18+ |
| npm | 9+ |
| Python | 3.10+ (scanner et scripts IA uniquement) |

---

## Structure du projet

```
gamebook-engine/
├── adventures/          # Aventures JSON + images
│   └── manifest.json    # Liste des aventures disponibles
├── docs/                # Documentation
│   └── 10-json-schema-ia.md  # Guide de structure JSON pour génération IA
├── scanner/             # Scanner PDF (Python)
├── scripts/             # Scripts IA (Python)
├── src/                 # Code source TypeScript
│   ├── engine/          # Moteur de jeu
│   ├── ui/              # Interface utilisateur
│   ├── main.ts          # Point d'entrée
│   └── types.ts         # Types TypeScript
├── tests/               # Tests unitaires
├── index.html           # Page HTML principale
├── package.json
└── tsconfig.json
```

---

## Mode développement

### 1. Installer les dépendances

```bash
npm install
```

### 2. Lancer le serveur de développement

```bash
npm run dev
```

Vite démarre un serveur local avec hot-reload, accessible par défaut sur `http://localhost:5173`.

### 3. Lancer les tests

```bash
# Exécution unique
npm test

# Mode watch (relance à chaque modification)
npm run test:watch
```

---

## Mode production

### 1. Compiler et bundler

```bash
npm run build
```

Cela exécute `tsc` (vérification TypeScript) puis `vite build`. Le résultat est dans le dossier `dist/`.

### 2. Prévisualiser le build

```bash
npm run preview
```

Lance un serveur local sur le contenu de `dist/` pour vérifier le build avant déploiement.

### 3. Déployer

Le contenu de `dist/` est un site statique pur (HTML + JS + CSS). Il peut être servi par n'importe quel serveur web statique :

- **Nginx / Apache** : copier `dist/` dans le répertoire web
- **GitHub Pages** : pousser `dist/` sur la branche `gh-pages`
- **Netlify / Vercel** : pointer sur le dossier `dist/` avec la commande de build `npm run build`

> Le dossier `adventures/` doit être accessible depuis la racine du serveur, car les aventures sont chargées via `fetch()` au runtime.

---

## Configuration des aventures

Le fichier `adventures/manifest.json` liste les aventures disponibles dans la bibliothèque :

```json
{
  "adventures": [
    "demo/demo.json",
    "MonAventure/MonAventure.json"
  ]
}
```

Les chemins sont relatifs au dossier `adventures/`. Chaque entrée pointe vers le fichier JSON de l'aventure.

---

## Dépendances Python (scanner et scripts IA)

Les scripts Python n'ont **aucune dépendance externe** (`argparse`, `configparser`, `json`, `urllib` sont dans la stdlib).

Le scanner PDF nécessite en revanche des bibliothèques tierces :

```bash
pip install -r scanner/requirements.txt
```

Voir `scanner/requirements.txt` pour la liste complète (`pdfplumber`, `PyMuPDF`).
