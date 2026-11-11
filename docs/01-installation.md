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
├── server/              # Backend Node.js/Express (synchronisation cloud)
│   ├── db/              # Couche base de données (SQLite / PostgreSQL / MariaDB)
│   ├── middleware/      # Auth JWT, rate limiting, en-têtes sécurité
│   ├── routes/          # Endpoints API REST
│   ├── services/        # Logique métier (auth, saves, leaderboard, email)
│   ├── config.ts        # Variables d'environnement
│   └── server.ts        # Point d'entrée Express
├── scripts/             # Scripts IA et utilitaires (Python)
├── src/                 # Code source TypeScript (frontend)
│   ├── engine/          # Moteur de jeu
│   ├── ui/              # Interface utilisateur
│   ├── main.ts          # Point d'entrée
│   └── types.ts         # Types TypeScript
├── tests/               # Tests unitaires
├── index.html           # Page HTML principale
├── package.json
├── tsconfig.json        # Config TypeScript frontend
└── tsconfig.server.json # Config TypeScript backend
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

## Mode production — Frontend seul (localStorage)

Le frontend fonctionne entièrement dans le navigateur sans backend. Les sauvegardes et le leaderboard sont stockés localement dans le navigateur de chaque joueur.

### 1. Compiler

```bash
npm run build
```

Le résultat est dans `dist/`. C'est un site statique pur (HTML + JS + CSS).

### 2. Prévisualiser le build

```bash
npm run preview
```

### 3. Déployer

Copier ou pointer le dossier `dist/` sur n'importe quel hébergement statique :

- **Nginx / Apache** : copier `dist/` dans le répertoire web
- **GitHub Pages** : pousser `dist/` sur la branche `gh-pages`
- **Cloudflare Pages / Vercel** : connecter le repo, commande de build `npm run build`, dossier de sortie `dist`

> Le dossier `adventures/` doit être accessible depuis la racine du serveur, car les aventures sont chargées via `fetch()` au runtime.

---

## Mode production — Frontend + Backend (synchronisation cloud)

Avec le backend activé, les joueurs peuvent créer un compte et retrouver leur progression sur n'importe quel appareil. Le leaderboard devient global et partagé.

Le frontend **détecte automatiquement** la présence du backend au démarrage (ping sur `/api/health`). Aucun rebuild du frontend n'est nécessaire pour basculer entre les deux modes.

### Variables d'environnement

Créer un fichier `.env` à la racine (ou configurer les variables sur la plateforme d'hébergement) :

```env
# Obligatoire en production
JWT_SECRET=une_chaine_aleatoire_longue_et_secrete

# Port d'écoute (défaut : 3000)
PORT=3000

# URL publique du serveur (utilisée dans les liens magiques envoyés par email)
APP_BASE_URL=https://ton-domaine.com

# SMTP — obligatoire pour les inscriptions
# Sans ces 4 variables, le serveur démarre mais les inscriptions sont désactivées (HTTP 503)
SMTP_HOST=smtp.ton-fournisseur.com
SMTP_PORT=587
SMTP_USER=ton@email.com
SMTP_PASS=mot_de_passe_smtp
SMTP_FROM=noreply@ton-domaine.com

# Base de données — SQLite par défaut (aucune config nécessaire)
# Pour PostgreSQL ou MariaDB :
# DATABASE_URL=postgresql://user:pass@host:5432/dbname
# DATABASE_URL=mysql://user:pass@host:3306/dbname

# Dossier du frontend statique à servir (optionnel)
# Si défini, le backend sert aussi le frontend sur le même port
STATIC_DIR=dist
```

**Comportement si une variable est manquante :**

| Variable | Si absente | Impact |
|---|---|---|
| `JWT_SECRET` | Secret temporaire (dev) / arrêt immédiat (prod) | Sessions perdues au redémarrage en dev |
| `SMTP_*` (un manquant) | Inscriptions désactivées (HTTP 503) | Comptes existants toujours utilisables |
| `DATABASE_URL` | SQLite automatique (`game.db`) | Aucun |
| `APP_BASE_URL` | `http://localhost:PORT` | Liens magiques cassés en prod |
| `STATIC_DIR` | Frontend non servi par le backend | Déployer `dist/` séparément |

### Déployer

```bash
npm run build   # compile frontend (dist/) + backend (dist-server/)
npm start       # démarre Express sur $PORT
```

Le serveur sert à la fois l'API (`/api/*`) et optionnellement le frontend statique si `STATIC_DIR=dist` est défini.

**Plateformes compatibles :** Railway, Render, VPS, serveur auto-hébergé — tout ce qui peut exécuter `node`.

### Migration progressive

Il est possible de déployer le frontend seul d'abord, puis d'ajouter le backend plus tard. Le frontend bascule automatiquement en mode cloud dès que le backend répond — sans rebuild ni modification.

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
