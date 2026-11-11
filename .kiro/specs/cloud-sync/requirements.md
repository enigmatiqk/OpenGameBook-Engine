# Requirements Document

## Introduction

La fonctionnalité **cloud-sync** ajoute un backend Node.js optionnel au moteur de livre-jeu OpenGameBook. Le frontend (TypeScript + Vite) continue de fonctionner intégralement en mode local via `localStorage`. Lorsqu'un backend est présent, le frontend le détecte automatiquement au démarrage et bascule en mode synchronisé : les sauvegardes de partie et le leaderboard sont alors stockés en base de données, partagés entre appareils et entre joueurs. Le backend est déployable via `npm run build && npm start`, compatible Railway, Render, VPS et auto-hébergement.

## Glossary

- **Frontend** : application TypeScript/Vite déployée en statique, contenant `SaveStore.ts` et toute la logique de jeu.
- **Backend** : serveur Node.js/TypeScript (Express ou Fastify) ajouté par cette fonctionnalité.
- **Mode local** : mode de fonctionnement où toute la persistence passe par `localStorage`, sans backend.
- **Mode serveur** : mode de fonctionnement où le frontend est connecté au backend et synchronise ses données.
- **SyncCoordinator** : module frontend responsable de la détection du backend et du choix du mode actif.
- **SaveStore** : classe frontend existante (`src/engine/SaveStore.ts`) gérant la persistence des sauvegardes en `localStorage`.
- **SyncStore** : abstraction frontend unifiant `SaveStore` (cache local) et les appels API vers le backend.
- **APIClient** : module frontend encapsulant les appels HTTP vers le backend.
- **AuthService** : module backend gérant l'inscription, la génération de token et la connexion.
- **SaveService** : module backend gérant la persistence des `SaveState` en base.
- **LeaderboardService** : module backend gérant les entrées de leaderboard global.
- **SaveState** : interface TypeScript décrivant l'état complet d'une partie en cours (définie dans `src/types.ts`).
- **LeaderboardEntry** : interface TypeScript décrivant une entrée de leaderboard (définie dans `src/types.ts`).
- **Token** : identifiant unique de connexion généré à l'inscription, hashé en base, envoyé par email.
- **Lien magique** : URL contenant le token en clair permettant la connexion sans saisie manuelle.
- **Compte activé** : compte dont le token a été utilisé au moins une fois pour se connecter.
- **Compte non activé** : compte créé mais jamais utilisé pour se connecter depuis son inscription.
- **SQLite** : base de données par défaut (zéro configuration), stockée dans un fichier local.
- **SMTP** : protocole de transport d'email, configurable via variables d'environnement.
- **Health endpoint** : route `GET /api/health` dont la réponse HTTP 200 signale la présence du backend.
- **Bibliothèque** : écran de sélection d'aventure, point de retour après une partie.
- **Point de synchronisation** : moment précis où le frontend synchronise son cache local avec le backend.

---

## Requirements

### Requirement 1: Détection automatique du backend

**User Story:** En tant que joueur, je veux que le frontend détecte automatiquement la présence du backend sans aucune configuration manuelle, afin de bénéficier de la synchronisation cloud dès qu'un backend est disponible.

#### Acceptance Criteria

1. WHEN le Frontend démarre, THE SyncCoordinator SHALL envoyer une requête `GET /api/health` au même origin que la page courante.
2. WHEN le Health endpoint répond avec HTTP 200, THE SyncCoordinator SHALL activer le mode serveur pour toute la session.
3. IF le Health endpoint ne répond pas ou répond avec un code HTTP autre que 200, THEN THE SyncCoordinator SHALL activer le mode local sans afficher d'erreur à l'utilisateur.
4. THE SyncCoordinator SHALL compléter la détection au démarrage en moins de 3 secondes avant d'afficher l'interface au joueur.
5. THE Frontend SHALL fonctionner en mode local sans aucun rebuild, recompilation ou variable d'environnement côté frontend, que le backend soit présent ou absent.

---

### Requirement 2: Indicateur visuel de mode

**User Story:** En tant que joueur, je veux voir un indicateur visuel clair du mode actif (local ou serveur), afin de savoir si mes données sont synchronisées.

#### Acceptance Criteria

1. WHILE le mode local est actif, THE Frontend SHALL afficher une icône non cliquable indiquant le mode local dans l'interface de jeu.
2. WHILE le mode serveur est actif, THE Frontend SHALL afficher une icône non cliquable indiquant la connexion au serveur dans l'interface de jeu.
3. THE Frontend SHALL afficher cet indicateur de mode sans interaction utilisateur requise.

---

### Requirement 3: Comportement hybride cache et synchronisation

**User Story:** En tant que joueur, je veux que le jeu reste fluide pendant la partie et que mes données soient synchronisées aux moments clés, afin de bénéficier des performances du cache local et de la fiabilité de la sauvegarde cloud.

#### Acceptance Criteria

1. WHILE une partie est en cours en mode serveur, THE SyncStore SHALL écrire chaque `SaveState` dans `localStorage` comme cache de performance.
2. WHEN le joueur quitte une partie pour retourner à la bibliothèque, THE SyncStore SHALL synchroniser le `SaveState` du cache local vers le backend avant d'effectuer la navigation.
3. WHEN le joueur lance l'action "Continuer" (reprise de partie), THE SyncStore SHALL charger le `SaveState` depuis le backend et écraser le cache local avec ce `SaveState`.
4. WHEN le joueur termine une partie (victoire ou défaite), THE SyncStore SHALL soumettre la `LeaderboardEntry` au backend avant d'afficher l'écran de fin.
5. IF la synchronisation échoue lors du retour à la bibliothèque, THEN THE Frontend SHALL afficher un message d'erreur au joueur et lui proposer de réessayer ou de rester sur la page courante.
6. IF le joueur choisit de réessayer après un échec de synchronisation, THEN THE SyncStore SHALL relancer la synchronisation vers le backend.
7. THE SyncStore SHALL ne pas naviguer vers la bibliothèque tant que la synchronisation n'a pas réussi.

---

### Requirement 4: Leaderboard local et global

**User Story:** En tant que joueur, je veux accéder à un leaderboard personnel en mode local et à un leaderboard global partagé en mode serveur, afin de comparer mes performances.

#### Acceptance Criteria

1. WHILE le mode local est actif, THE SyncStore SHALL lire et écrire le leaderboard exclusivement depuis `localStorage`.
2. WHILE le mode serveur est actif, THE SyncStore SHALL lire le leaderboard depuis le backend, qui consolide les entrées de tous les joueurs.
3. WHILE le mode serveur est actif et qu'un joueur est authentifié, THE LeaderboardService SHALL associer automatiquement le pseudo du compte à chaque nouvelle `LeaderboardEntry` soumise.
4. THE Backend SHALL exposer un endpoint `GET /api/leaderboard/:adventureId` retournant les entrées triées par `tempsJeuMs` croissant.
5. THE Backend SHALL exposer un endpoint `POST /api/leaderboard/:adventureId` acceptant une `LeaderboardEntry` conforme à l'interface TypeScript définie dans `src/types.ts`.

---

### Requirement 5: Inscription utilisateur

**User Story:** En tant que joueur souhaitant utiliser le mode serveur, je veux créer un compte avec un email et un pseudo, afin d'avoir une identité persistante et de participer au leaderboard global.

#### Acceptance Criteria

1. THE AuthService SHALL exposer un endpoint `POST /api/auth/register` acceptant un email et un pseudo.
2. WHEN un email ou un pseudo est soumis à l'inscription et qu'un compte activé avec cet email ou ce pseudo existe déjà, THE AuthService SHALL retourner HTTP 409 avec un message d'erreur indiquant le champ en conflit.
3. WHEN un email ou un pseudo est soumis à l'inscription et qu'un compte non activé avec cet email ou ce pseudo existe, THE AuthService SHALL supprimer le compte non activé existant avant de créer le nouveau compte.
4. WHEN un compte est créé, THE AuthService SHALL générer un token unique de 256 bits ou plus via un algorithme cryptographiquement sûr.
5. WHEN un token est généré, THE AuthService SHALL stocker en base uniquement le hash SHA-256 du token, jamais le token en clair.
6. WHEN un token est généré, THE AuthService SHALL envoyer par email un lien magique contenant le token en clair à l'adresse fournie à l'inscription.
7. IF l'envoi d'email échoue, THEN THE AuthService SHALL retourner HTTP 500 et ne pas créer le compte.

---

### Requirement 6: Connexion par token (lien magique)

**User Story:** En tant que joueur ayant un compte, je veux me connecter via un lien magique reçu par email, afin de me connecter facilement depuis n'importe quel appareil sans mémoriser de mot de passe.

#### Acceptance Criteria

1. THE AuthService SHALL exposer un endpoint `GET /api/auth/login?token=<token>` pour la connexion par lien magique.
2. WHEN un token est reçu sur cet endpoint, THE AuthService SHALL comparer le hash SHA-256 du token reçu avec le hash stocké en base.
3. WHEN le hash correspond à un compte existant, THE AuthService SHALL retourner une session valide identifiant ce compte.
4. WHEN un compte est utilisé pour la première fois via son token, THE AuthService SHALL marquer ce compte comme activé.
5. IF le token reçu ne correspond �� aucun hash en base, THEN THE AuthService SHALL retourner HTTP 401.
6. THE AuthService SHALL exposer un endpoint `POST /api/auth/request-login` acceptant un email et envoyant un nouveau lien magique à cette adresse.
7. IF l'email fourni à `POST /api/auth/request-login` ne correspond à aucun compte, THEN THE AuthService SHALL retourner HTTP 404.

---

### Requirement 7: Expiration des comptes non activés

**User Story:** En tant qu'administrateur du service, je veux que les comptes jamais utilisés expirent automatiquement après 7 jours, afin de libérer les emails et pseudos réservés par des inscriptions abandonnées.

#### Acceptance Criteria

1. THE AuthService SHALL supprimer automatiquement tout compte non activé dont la date de création est antérieure de plus de 7 jours à la date courante.
2. THE AuthService SHALL exécuter ce nettoyage de manière périodique sans intervention manuelle.
3. WHEN un compte non activé est supprimé, THE AuthService SHALL libérer l'email et le pseudo associés pour permettre une nouvelle inscription.
4. THE AuthService SHALL conserver indéfiniment tout compte activé, sans suppression automatique.

---

### Requirement 8: Persistence des sauvegardes en mode serveur

**User Story:** En tant que joueur connecté, je veux que mes sauvegardes de partie soient stockées sur le serveur et accessibles depuis n'importe quel appareil, afin de reprendre mes parties sur un autre appareil sans perte de progression.

#### Acceptance Criteria

1. THE SaveService SHALL exposer un endpoint `PUT /api/saves/:adventureId` acceptant un `SaveState` conforme à l'interface TypeScript définie dans `src/types.ts`, et l'associer à l'utilisateur authentifié.
2. THE SaveService SHALL exposer un endpoint `GET /api/saves/:adventureId` retournant le dernier `SaveState` associé à l'utilisateur authentifié pour cette aventure.
3. THE SaveService SHALL exposer un endpoint `DELETE /api/saves/:adventureId` supprimant la sauvegarde de l'utilisateur authentifié pour cette aventure.
4. IF l'utilisateur authentifié n'a pas de sauvegarde pour l'aventure demandée, THEN THE SaveService SHALL retourner HTTP 404.
5. THE SaveService SHALL isoler les sauvegardes de chaque utilisateur : un utilisateur authentifié ne peut accéder qu'à ses propres sauvegardes.

---

### Requirement 9: Base de données et déploiement

**User Story:** En tant qu'opérateur déployant le service, je veux un backend zéro-configuration par défaut et flexible pour les déploiements avancés, afin de pouvoir lancer le service sans configuration spécifique tout en gardant la possibilité d'utiliser un SGBD dédié.

#### Acceptance Criteria

1. THE Backend SHALL utiliser SQLite comme base de données par défaut, sans aucune variable d'environnement requise.
2. WHERE la variable d'environnement `DATABASE_URL` est définie avec un DSN MariaDB ou PostgreSQL, THE Backend SHALL se connecter à cette base de données à la place de SQLite.
3. THE Backend SHALL créer les tables nécessaires automatiquement au démarrage si elles n'existent pas.
4. WHEN la commande `npm run build && npm start` est exécutée à la racine du dépôt, THE Backend SHALL démarrer et être prêt à recevoir des requêtes.
5. WHERE la variable d'environnement `STATIC_DIR` est définie, THE Backend SHALL servir les fichiers statiques du frontend depuis ce répertoire.
6. THE Backend SHALL être compatible avec les environnements Railway, Render, VPS Linux et auto-hébergement sans configuration spécifique à ces plateformes.

---

### Requirement 10: Configuration email (SMTP)

**User Story:** En tant qu'opérateur du service, je veux configurer l'envoi d'emails via mon propre serveur SMTP, afin d'utiliser le fournisseur d'email de mon choix (Gmail, OVH, Mailgun, auto-hébergé, etc.).

#### Acceptance Criteria

1. THE AuthService SHALL lire la configuration SMTP depuis les variables d'environnement `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` et `SMTP_FROM`.
2. IF une ou plusieurs variables SMTP obligatoires sont absentes au démarrage, THEN THE Backend SHALL démarrer en mode dégradé sans envoi d'email et journaliser un avertissement.
3. THE AuthService SHALL utiliser TLS pour les connexions SMTP sur le port 465, et STARTTLS pour le port 587.

---

### Requirement 11: Sécurité

**User Story:** En tant que joueur, je veux que mes données personnelles et ma session soient protégées contre les attaques courantes, afin d'utiliser le service en toute confiance.

#### Acceptance Criteria

1. THE Backend SHALL appliquer un rate limiting sur les endpoints `POST /api/auth/register` et `POST /api/auth/request-login`, limité à 5 requêtes par IP par tranche de 15 minutes.
2. THE Backend SHALL utiliser des requêtes paramétrées ou un ORM pour toutes les interactions avec la base de données, sans concaténation de chaînes SQL.
3. THE SaveService SHALL vérifier que l'utilisateur authentifié est bien propriétaire de la ressource avant tout accès ou modification.
4. THE LeaderboardService SHALL valider que la `LeaderboardEntry` soumise est conforme à l'interface TypeScript avant de la persister.
5. WHERE le Backend est déployé derrière HTTPS, THE Backend SHALL positionner les en-têtes de sécurité HTTP (`Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`).
