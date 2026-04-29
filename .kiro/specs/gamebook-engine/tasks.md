# Plan d'implémentation : Moteur de Gamebook

## Vue d'ensemble

Implémentation d'un moteur de livre-jeu interactif en HTML/JavaScript (TypeScript), sans serveur, avec un module Python optionnel pour le scan de PDF. L'architecture suit la séparation définie dans le design : `GameEngine`, `LibraryManager`, `CombatResolver`, `SaveStore`, `PlayTimer`, `ImageGenerator`, et `PDFScanner`.

## Tâches

- [x] 1. Mettre en place la structure du projet et les types de base
  - Créer l'arborescence : `src/`, `src/engine/`, `src/ui/`, `adventures/`, `tests/`
  - Définir tous les types TypeScript dans `src/types.ts` : `Adventure`, `Section`, `Choice`, `Hero`, `StatChange`, `SaveState`, `LeaderboardEntry`, `ValidationResult`, `CombatResult`, `CombatRound`, `CombatRules`, `Regles`, `PersonnageTemplate`
  - Configurer Vitest et fast-check dans `package.json`
  - _Requirements : 1.1, 1.5, 5.1, 6.1_

- [x] 2. Implémenter `LibraryManager` — chargement et validation des aventures
  - [x] 2.1 Implémenter `validateAdventure(data: unknown): ValidationResult`
    - Vérifier la présence de chaque champ obligatoire (`titre`, `tags`, `repertoire_images`, `image_de_garde`, `mode_emploi`, `personnage`, `regles`, `sections`)
    - Collecter toutes les erreurs sans s'arrêter au premier problème
    - Vérifier la cohérence sémantique : les `section` dans les `choix` pointent vers des numéros existants
    - _Requirements : 1.1, 1.3, 1.4, 1.5_

  - [x] 2.2 Écrire le test de propriété pour `validateAdventure` (Property 2)
    - **Property 2 : Validation des champs obligatoires**
    - **Validates : Requirements 1.1, 1.3, 1.4, 1.5**
    - Générateur : objets JSON valides avec un ou plusieurs champs obligatoires retirés aléatoirement
    - Assertion : `validateAdventure(obj).valid === false` et `errors` contient le nom du champ manquant

  - [x] 2.3 Implémenter `loadAdventure(path: string): Promise<Adventure>` et `scanDirectory(path: string): Promise<AdventureMetadata[]>`
    - Charger et parser le JSON, appeler `validateAdventure`, afficher un message d'erreur descriptif si invalide sans bloquer les autres aventures
    - _Requirements : 1.3, 1.4, 2.1, 2.2, 2.3_

  - [x] 2.4 Écrire le test de propriété pour la sérialisation d'aventure (Property 1)
    - **Property 1 : Round-trip de sérialisation d'aventure**
    - **Validates : Requirements 11.7**
    - Générateur : `fc.record({ titre: fc.string(), sections: fc.array(...), ... })`
    - Assertion : `deserialize(serialize(adventure))` équivalent à `adventure`

- [x] 3. Implémenter `PlayTimer`
  - [x] 3.1 Implémenter `PlayTimer` avec `start()`, `pause()`, `resume()`, `getElapsedMs()`, `reset()`
    - Utiliser `Date.now()` pour mesurer les intervalles actifs
    - Accumuler le temps uniquement pendant les phases actives
    - _Requirements : 8.1, 8.2, 8.3, 8.4_

  - [x] 3.2 Écrire le test de propriété pour `PlayTimer` (Property 4)
    - **Property 4 : Invariant du chronomètre**
    - **Validates : Requirements 8.1, 8.2**
    - Générateur : séquences d'intervalles start/pause avec durées aléatoires (simulées via mock de `Date.now`)
    - Assertion : temps cumulé strictement croissant pendant les phases actives, constant pendant les pauses

- [x] 4. Implémenter `SaveStore` — sauvegarde, chargement et tableau de victoire
  - [x] 4.1 Implémenter `save()`, `load()`, `hasSave()`, `deleteSave()` via `localStorage`
    - Clés : `save:{adventureId}` et `leaderboard:{adventureId}`
    - Gérer la corruption (try/catch sur `JSON.parse`) et proposer une nouvelle partie
    - _Requirements : 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 4.2 Écrire le test de propriété pour l'intégrité de sauvegarde (Property 3)
    - **Property 3 : Intégrité de la sauvegarde (round-trip)**
    - **Validates : Requirements 7.2, 7.4, 9.4**
    - Générateur : `fc.record({ sectionCourante: fc.integer({min:1}), hero: ..., tempsJeuMs: fc.nat() })`
    - Assertion : `load(save(state))` équivalent à `state`

  - [x] 4.3 Implémenter `getLeaderboard()` et `addLeaderboardEntry()` avec tri par `tempsJeuMs` croissant
    - Persister le tableau de victoire dans `localStorage`
    - _Requirements : 9.2, 9.3, 9.4_

  - [x] 4.4 Écrire le test de propriété pour le tableau de victoire (Property 7)
    - **Property 7 : Tableau de victoire — enregistrement et tri**
    - **Validates : Requirements 9.2, 9.3, 9.4**
    - Générateur : listes d'entrées `{nom: fc.string(), tempsJeuMs: fc.nat()}` dans un ordre aléatoire
    - Assertion : `getLeaderboard()` contient toutes les entrées et est trié par `tempsJeuMs` croissant

- [x] 5. Point de contrôle — vérifier que les tests passent
  - S'assurer que tous les tests unitaires et de propriété écrits jusqu'ici passent. Poser des questions si nécessaire.

- [x] 6. Implémenter `CombatResolver`
  - [x] 6.1 Implémenter `rollDice(sides: number, count: number): number[]` et `resolve(hero, enemy, rules): CombatResult`
    - Appliquer la formule `forceAttaque = habilete + somme_des_dés`
    - Calculer les dégâts selon les règles de l'aventure (`degats_victoire`, `degats_defaite`)
    - Retourner le détail de chaque round dans `CombatResult.rounds`
    - _Requirements : 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 6.2 Écrire le test de propriété pour les règles de combat (Property 9)
    - **Property 9 : Règles de combat**
    - **Validates : Requirements 6.2, 6.4**
    - Générateur : héros et ennemis avec `habilete` et `endurance` aléatoires, résultats de dés mockés
    - Assertion : `forceAttaque === habilete + rollTotal` et dégâts correspondent aux règles de l'aventure

- [x] 7. Implémenter `ImageGenerator`
  - [x] 7.1 Implémenter `buildPrompt(adventure, section): string`
    - Construire le prompt à partir du titre, des tags et du texte de la section
    - _Requirements : 10.2_

  - [x] 7.2 Écrire le test de propriété pour la construction du prompt (Property 5)
    - **Property 5 : Construction du prompt IA**
    - **Validates : Requirements 10.2**
    - Générateur : aventures et sections aléatoires (titre non vide, tags non vides, texte non vide)
    - Assertion : prompt contient `adventure.titre`, au moins un tag, et une portion de `section.texte`

  - [x] 7.3 Implémenter `generateForSection(adventure, section): Promise<string>`
    - Appeler Pollinations.ai avec le prompt construit
    - Enregistrer l'image dans `repertoire_images` et associer à la section
    - Gérer les erreurs réseau (service indisponible) avec message d'erreur sans bloquer le jeu
    - _Requirements : 10.1, 10.3, 10.4_

- [x] 8. Implémenter `GameEngine` — orchestration de la session de jeu
  - [x] 8.1 Implémenter `loadAdventure()`, `startNewGame()`, `resumeGame()`
    - Initialiser le `Hero` depuis `personnage` de l'aventure (lancer les dés d'init)
    - Démarrer `PlayTimer` au démarrage ou à la reprise
    - _Requirements : 3.1, 3.2, 3.3, 3.4_

  - [x] 8.2 Implémenter `navigateTo()` et `applyChoice()`
    - Afficher le texte, l'image et les choix de la section
    - Déclencher `CombatResolver` si la section contient un champ `combat`
    - Gérer les sections sans choix (message d'erreur "section incomplète")
    - Mettre à jour `hero.historique` à chaque modification de statistique
    - _Requirements : 4.1, 4.2, 4.3, 5.2, 5.4_

  - [x] 8.3 Écrire le test unitaire pour l'historique des modifications de statistiques (Property 8)
    - **Property 8 : Historique des modifications de statistiques**
    - **Validates : Requirements 5.4**
    - Générateur : séquences de modifications `{stat: fc.string(), delta: fc.integer(), raison: fc.string()}`
    - Assertion : `hero.historique.length === modifications.length` et ordre préservé

  - [x] 8.4 Implémenter `saveGame()` et `endGame(victory: boolean)`
    - Mettre en pause `PlayTimer` lors de la sauvegarde
    - En cas de victoire : afficher l'écran de félicitations, saisir le nom du joueur (défaut "Anonyme"), enregistrer dans le leaderboard
    - En cas de défaite (endurance ≤ 0) : afficher l'écran de défaite, proposer de recommencer ou retourner à la bibliothèque
    - _Requirements : 5.3, 7.1, 7.2, 8.2, 8.4, 9.1, 9.2, 9.5_

- [x] 9. Construire l'interface HTML/CSS/JS
  - [x] 9.1 Créer `index.html` et la vue Bibliothèque
    - Afficher la liste des aventures avec titre et image de garde
    - Afficher le message "répertoire vide ou introuvable" si aucune aventure
    - Proposer "Commencer une nouvelle partie" et "Continuer" (désactivé si pas de sauvegarde)
    - _Requirements : 2.1, 2.2, 2.3, 2.4, 3.3, 12.1, 12.2, 12.3_

  - [x] 9.2 Créer la vue de jeu (section courante)
    - Afficher texte narratif, image de section, liste des choix
    - Afficher les statistiques et l'inventaire du héros en permanence
    - Boutons d'accès aux images annexes, au mode d'emploi et à la fiche héros
    - Bouton de sauvegarde accessible à tout moment
    - _Requirements : 4.1, 4.4, 4.5, 5.1, 7.1, 12.3, 12.4_

  - [x] 9.3 Créer la vue de combat (résolution tour par tour)
    - Afficher chaque round avec les jets de dés et les dégâts
    - Mettre à jour les statistiques du héros après le combat
    - _Requirements : 6.3, 6.4_

  - [x] 9.4 Créer les vues de fin de partie (victoire et défaite) et le tableau de victoire
    - Écran de victoire : félicitations, saisie du nom, affichage du tableau trié
    - Écran de défaite : message, boutons "Recommencer" et "Bibliothèque"
    - _Requirements : 5.3, 9.1, 9.2, 9.3, 9.5_

- [x] 10. Point de contrôle final — vérifier que tous les tests passent
  - S'assurer que tous les tests unitaires, de propriété et d'intégration passent. Poser des questions si nécessaire.

- [x] 11. Implémenter le module Python `PDFScanner` (optionnel)
  - [x] 11.1 Implémenter `PDFScanner.scan()`, `extract_sections()`, `extract_images()`, `extract_intro_pages()`
    - Utiliser `pdfplumber` ou `PyMuPDF` pour l'extraction du texte et des images
    - Identifier les sections numérotées et les choix associés
    - Extraire les pages introductives (règles, personnage, mode d'emploi)
    - Afficher un message d'erreur descriptif si le PDF est illisible ou non conforme, sans produire de JSON partiel
    - _Requirements : 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 11.2 Implémenter `PrettyPrinter.format()` — export JSON indenté
    - Produire un JSON lisible et indenté conforme au format défini dans le Requirement 1
    - _Requirements : 11.6_

  - [x] 11.3 Écrire le test de propriété pour l'extraction des sections PDF (Property 6)
    - **Property 6 : Extraction des sections PDF**
    - **Validates : Requirements 11.1, 11.2**
    - Bibliothèque : Hypothesis (Python)
    - Générateur : PDFs synthétiques avec N sections numérotées (N entre 1 et 400)
    - Assertion : `len(scanner.extract_sections(pages)) == N`, numéros uniques, textes non vides

  - [x] 11.4 Écrire le test de propriété pour le round-trip JSON du scanner (Property 1 — Python)
    - **Property 1 : Round-trip de sérialisation d'aventure (côté Python)**
    - **Validates : Requirements 11.7**
    - Assertion : charger → ré-exporter → recharger produit un objet équivalent à l'original

## Notes

- Les tâches marquées `*` sont optionnelles et peuvent être ignorées pour un MVP rapide
- Chaque tâche référence les requirements correspondants pour la traçabilité
- Les points de contrôle (tâches 5 et 10) permettent une validation incrémentale
- Les tests de propriété utilisent **fast-check** (JavaScript) et **Hypothesis** (Python)
- Les tests unitaires utilisent **Vitest**
