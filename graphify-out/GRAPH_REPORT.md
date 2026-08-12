# Graph Report - OpenGameBook-Engine  (2026-08-12)

## Corpus Check
- 328 files · ~701,963 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1825 nodes · 3587 edges · 143 communities (101 shown, 42 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 140 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `84a42ed2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- screenshotOnFailure
- testChoiceButtons
- CombatState
- Hero
- commonTests.ts
- testSection
- GameEngine
- types.ts
- scripts
- ._buildSectionContent
- ia_generate_images.py
- compilerOptions
- testStat
- .getRegle
- pdf_scanner.py
- extract_pdf-to-json.py
- main.ts
- Effets de Section
- debugPanel.ts
- .getLeaderboard
- Système d'acquisition d'items
- test_property6_extract_sections_count_and_uniqueness
- Adventure
- GameEngineNavigation
- LibraryView
- 📖 Guides principaux
- Effets de Section
- imagePreferences.ts
- .scan
- accessibility.ts
- PrettyPrinter
- testNavigation
- Champs racine
- GameEngine.ts
- sectionNotes.ts
- ui/schema-choices.ts
- scripts/convert.py
- Correctness Properties
- compare_sections_structure.py
- migrate_effets.py
- _first_group
- Créer une aventure
- Tests E2E - Guide complet
- Requirements
- Règles (`regles`)
- Choix
- Scanner PDF
- Génération d'images par IA
- Schéma JSON pour IA
- graphify.md
- What You Must Do When Invoked
- Système d'acquisition d'items
- Tests E2E - Guide d'utilisation
- Système d'acquisition d'items
- Conditions
- parseDiceFormula
- `sections` ★ obligatoire
- Guide utilisateur
- Règle `duel_de` — Paris
- Section Overrides
- Installation, build et configuration
- Combat
- `regles` ★ obligatoire
- Champs racine
- Paramètres disponibles
- serialization.property.test.ts
- Personnage (`personnage.json`)
- Exemples
- Effets
- Défense par item équipé (`combat_defense`)
- Jeter un équipement (`equipement_dropable`)
- graphify reference: extra exports and benchmark
- ui/schema-conditions.ts
- graphify reference: query, path, explain
- Effets d'items
- Plan d'implémentation : Moteur de Gamebook
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- extraction-spec.md
- README.md
- 142fff5de42f11ba7b6fa5ff5cd29ddefdd4e3e5.md
- 92d9b878f7448b624dcd394dcefd8b0fd8851466.md
- adventures-Defis_Fantastiq-586d3-mbat-affichage-bouton-fuite-chromium/error-context.md
- adventures-Defis_Fantastiq-82530-61-Section-061-Combat-fuite-chromium/error-context.md
- adventures-Defis_Fantastiq-bfc0f-053-Si-réussi---section-155-chromium/error-context.md
- Stratégies de remplacement
- b302f02c894a2b207ed45074571c8e8bb79443d9.md
- d83f49d7bdda7832cc2c72cf4adb49ebf00d6569.md
- adventures-Defis_Fantastiq-5966e-ection-066-Section-et-texte-chromium/error-context.md
- adventures-Defis_Fantastiq-f594d-Section-061-Combat-victoire-chromium/error-context.md
- section-011.spec.ts
- section-031.spec.ts
- section-045.spec.ts
- section-046.spec.ts
- section-048.spec.ts
- section-049.spec.ts
- section-057.spec.ts
- section-059.spec.ts
- section-062.spec.ts
- section-066.spec.ts
- section-067.spec.ts
- section-069.spec.ts
- section-088.spec.ts
- section-095.spec.ts
- section-099.spec.ts
- section-100.spec.ts
- section-101.spec.ts
- section-103.spec.ts
- section-104.spec.ts
- section-107.spec.ts
- section-115.spec.ts
- section-117.spec.ts
- section-121.spec.ts
- section-122.spec.ts
- section-129.spec.ts
- section-157.spec.ts
- section-165.spec.ts
- section-167.spec.ts
- section-176.spec.ts
- section-189.spec.ts
- section-191.spec.ts
- section-197.spec.ts
- section-200.spec.ts
- Action avec dés (test de stat)
- ia_sections/convert.py
- adventures/manifest.json
- serve.sh script

## God Nodes (most connected - your core abstractions)
1. `testSection()` - 202 edges
2. `screenshotOnFailure()` - 200 edges
3. `testChoiceButtons()` - 183 edges
4. `navigationTests()` - 133 edges
5. `GameEngine` - 100 edges
6. `Hero` - 64 edges
7. `Adventure` - 49 edges
8. `CombatState` - 39 edges
9. `testNavigation()` - 27 edges
10. `GameView` - 26 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `PDFScanner`  [INFERRED]
  scannerPDF/main.py → scannerPDF/pdf_scanner.py
- `test_property1_json_round_trip()` --calls--> `PrettyPrinter`  [INFERRED]
  scannerPDF/tests/test_pdf_scanner.py → scannerPDF/pretty_printer.py
- `main()` --calls--> `PrettyPrinter`  [INFERRED]
  scannerPDF/main.py → scannerPDF/pretty_printer.py
- `test_property6_extract_sections_count_and_uniqueness()` --calls--> `parse_sections_from_text()`  [INFERRED]
  scannerPDF/tests/test_pdf_scanner.py → scannerPDF/pdf_scanner.py
- `resolveItemDelta()` --calls--> `parseDiceFormula()`  [EXTRACTED]
  src/engine/schema-effects.ts → src/engine/CombatResolver.ts

## Import Cycles
- None detected.

## Communities (143 total, 42 thin omitted)

### Community 0 - "screenshotOnFailure"
Cohesion: 0.04
Nodes (26): SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES (+18 more)

### Community 1 - "testChoiceButtons"
Cohesion: 0.02
Nodes (62): SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES (+54 more)

### Community 2 - "CombatState"
Cohesion: 0.09
Nodes (20): applyMonstreEffets(), buildEnemy(), CombatResolver, evaluateMonstreCondition(), findItemCombatDefense(), parseAttackFormula(), resolveDeltaResultat(), resolveLancerDeFormule() (+12 more)

### Community 3 - "Hero"
Cohesion: 0.20
Nodes (7): GameEngineEquipement, GameEngineHero, GameEngineInventaire, ChoixInitialOption, Hero, InventaireItem, ItemGain

### Community 4 - "commonTests.ts"
Cohesion: 0.10
Nodes (17): SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES (+9 more)

### Community 5 - "testSection"
Cohesion: 0.04
Nodes (25): SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES (+17 more)

### Community 7 - "types.ts"
Cohesion: 0.06
Nodes (35): Action, ActionLancerDe, ActionOutcome, ActionRegle, ChoixInitial, CombatEvent, CombatEventChoix, CombatModifier (+27 more)

### Community 8 - "scripts"
Cohesion: 0.07
Nodes (28): fast-check, jsdom, description, devDependencies, fast-check, jsdom, @playwright/test, typescript (+20 more)

### Community 10 - "ia_generate_images.py"
Cohesion: 0.18
Nodes (22): ConfigParser, build_prompt(), compress_image(), download_automatic1111(), download_comfyui(), download_image(), download_openai_dalle(), download_pollinations() (+14 more)

### Community 11 - "compilerOptions"
Cohesion: 0.09
Nodes (21): dist, DOM, ES2020, node_modules, src/**/*, tests, compilerOptions, lib (+13 more)

### Community 12 - "testStat"
Cohesion: 0.06
Nodes (19): SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES (+11 more)

### Community 13 - ".getRegle"
Cohesion: 0.14
Nodes (6): newRollId(), GameEngineActions, Choice, Effet, PendingRoll, Regle

### Community 14 - "pdf_scanner.py"
Cohesion: 0.13
Nodes (19): _apply_adventure_overrides(), _apply_detect_rules(), _apply_overrides(), _build_detect_rules(), _detect_section_end(), _extract_combat(), _extract_effects(), _find_section_for_resultat() (+11 more)

### Community 15 - "extract_pdf-to-json.py"
Cohesion: 0.17
Nodes (19): _build_couverture(), _build_livre(), _build_sections(), detect_first_section_page(), _extract_section_headers(), _find_section_for_image(), main(), pdf_to_text() (+11 more)

### Community 16 - "main.ts"
Cohesion: 0.24
Nodes (12): initDefeatView(), initLibrary(), initVictoryView(), launchGameView(), showHeroCreationAndLaunch(), showIntroScreen(), showLeaderboardModal(), showView() (+4 more)

### Community 17 - "Effets de Section"
Cohesion: 0.18
Nodes (11): Dépasser la limite avec `ignore_max`, Effet d'item, Effet de stat, Effets de Section, Exemple complet, Historique des modifications, `ignore_stat_limit=1`, Limites de stat (+3 more)

### Community 18 - "debugPanel.ts"
Cohesion: 0.19
Nodes (15): DebugConditions, initDebugConditions(), initDebugNavHistory(), isDevMode(), addRow(), AdventureEntry, buildUrl(), DebugParams (+7 more)

### Community 19 - ".getLeaderboard"
Cohesion: 0.38
Nodes (3): LEADERBOARD_KEY(), LeaderboardEntry, LeaderboardView

### Community 20 - "Système d'acquisition d'items"
Cohesion: 0.15
Nodes (13): Définition d'un item à gagner, Exemple complet, Gain d'item via un choix, Gain d'items avec conditions, Gain d'items multiples, Gain d'items suite à une action réussie, Gain d'items à l'arrivée dans une section, Intégration avec le moteur (+5 more)

### Community 21 - "test_property6_extract_sections_count_and_uniqueness"
Cohesion: 0.18
Nodes (13): composite, given, parse_sections_from_text(), Parse raw text into a list of section dicts: {numero, texte, choix, type?}.…, _build_synthetic_text(), Property-based tests for the PDF scanner module. Property 6 — Validates:…, **Validates: Requirements 11.7** Property 1 (Python): For any adventure dict,…, Build a raw text string that looks like a gamebook with the given sections.… (+5 more)

### Community 22 - "Adventure"
Cohesion: 0.13
Nodes (12): ImageGenerator, ImageGeneratorImpl, Adventure, Section, EquipementView, GameViewCallbacks, getInventaireItems(), getMonnaiInfo() (+4 more)

### Community 23 - "GameEngineNavigation"
Cohesion: 0.13
Nodes (12): GameEngineNavigation, applyChoiceCost(), isChoiceAvailable(), resolveChoice(), checkCondition(), checkConditions(), applyEffect(), applyEffects() (+4 more)

### Community 24 - "LibraryView"
Cohesion: 0.17
Nodes (8): LibraryManager, REQUIRED_FIELDS, AdventureMetadata, ValidationResult, FilterState, LibraryCallbacks, LibraryView, validAdventure

### Community 25 - "📖 Guides principaux"
Cohesion: 0.05
Nodes (39): [01 - Installation](01-installation.md), [02 - Guide utilisateur](02-guide-utilisateur.md), [03 - Créer une aventure](03-creer-une-aventure.md), [04 - Scanner PDF](04-scanner-pdf.md), [05 - Génération d'images IA](05-generation-images-ia.md), [06 - Mode debug (développement)](06-debug-mode-dev.md), [07 - Items et gains](07-items-gain.md), [08 - Effets de section](08-effets-section.md) (+31 more)

### Community 26 - "Effets de Section"
Cohesion: 0.18
Nodes (11): Dépasser la limite avec `ignore_max`, Effet d'item, Effet de stat, Effets de Section, Exemple complet, Historique des modifications, `ignore_stat_limit=1`, Limites de stat (+3 more)

### Community 27 - "imagePreferences.ts"
Cohesion: 0.27
Nodes (11): DEFAULTS, ImageDisplayMode, ImagePrefs, initImagePrefsButton(), loadImagePrefs(), MODE_CYCLE, resolveImagePath(), saveImagePrefs() (+3 more)

### Community 28 - ".scan"
Cohesion: 0.23
Nodes (8): _default_personnage(), _default_regles(), PDFScanner, Scan a gamebook PDF and produce an Adventure-compatible dict., Main entry point. Reads *pdf_path* and returns an Adventure dict. Raises…, Extract numbered sections from pdfplumber Page objects. Strategy: 1. Find the…, Extract images via PyMuPDF, save to images_dir, return section->filename map., Extract metadata from pages before section 1.

### Community 29 - "accessibility.ts"
Cohesion: 0.24
Nodes (11): A11yPrefs, applyPrefs(), COLORS, DEFAULTS, FONTS, initA11y(), loadPrefs(), S (+3 more)

### Community 30 - "PrettyPrinter"
Cohesion: 0.20
Nodes (7): main(), CLI entry point for the PDF scanner. Usage: python scanner/main.py <pdf_path>…, PrettyPrinter, PrettyPrinter — formats an Adventure dict as indented, human-readable JSON., Format and save Adventure dicts as pretty-printed JSON., Return an indented JSON string for *adventure*., Write the pretty-printed JSON to *output_path*, creating dirs as needed.

### Community 31 - "testNavigation"
Cohesion: 0.05
Nodes (22): SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES, SECTION_CHOICES (+14 more)

### Community 32 - "Champs racine"
Cohesion: 0.18
Nodes (11): Champs racine, `collection` — optionnel, `image_de_garde` ★ obligatoire, `images_annexes` — optionnel, `images_defaite` — optionnel, `images_victoire` — optionnel, `intro` — optionnel, `mode_emploi` ★ obligatoire (+3 more)

### Community 33 - "GameEngine.ts"
Cohesion: 0.11
Nodes (9): GameEngineSave, PlayTimer, SAVE_KEY(), SaveStore, EffetMonstreStat, SaveState, leaderboardEntryArb, heroArb (+1 more)

### Community 34 - "sectionNotes.ts"
Cohesion: 0.60
Nodes (4): _esc(), initSectionNotesButton(), showNotesPanel(), updateSectionNotes()

### Community 35 - "ui/schema-choices.ts"
Cohesion: 0.46
Nodes (6): createChoiceButton(), renderChoice(), renderChoices(), formatEffect(), formatEffects(), renderEffects()

### Community 36 - "scripts/convert.py"
Cohesion: 0.48
Nodes (6): convert_section(), main(), normalize_json_response(), Path, Nettoie les résultats JSON qui contiennent des octets UTF-8 échappés en décimal., resolve_output_path()

### Community 37 - "Correctness Properties"
Cohesion: 0.06
Nodes (34): Architecture, CombatResolver, Composants et Interfaces, Correctness Properties, Document de Design Technique — Moteur de Gamebook, Flux principal, Format JSON d'aventure, GameEngine (+26 more)

### Community 38 - "compare_sections_structure.py"
Cohesion: 0.53
Nodes (4): compare_section(), diff_keys(), load_json(), main()

### Community 39 - "migrate_effets.py"
Cohesion: 0.53
Nodes (5): migrate_effet(), migrate_effets_list(), migrate_file(), migrate_section(), Migre les effets du format plat vers le format imbriqué : Avant : { "type":…

### Community 40 - "_first_group"
Cohesion: 0.40
Nodes (5): Match, _extract_choices(), _first_group(), Extract choice dicts from a section body text., Return the first non-None captured group as int.

### Community 41 - "Créer une aventure"
Cohesion: 0.20
Nodes (8): Ajouter l'aventure à la bibliothèque, `choix_initial` — optionnel, Créer une aventure, Exemple minimal complet, `inventaire` — optionnel, `personnage` ★ obligatoire, `statistiques` ★ obligatoire, Structure générale

### Community 42 - "Tests E2E - Guide complet"
Cohesion: 0.06
Nodes (31): Bonnes pratiques, Boutons, Dépannage, Exemple : Tester un choix conditionnel, Exemple : Tester un combat, Exemple : Tester une augmentation de stat, Exécution des tests, `habilete=X`, `endurance=X`, `chance=X` (+23 more)

### Community 43 - "Requirements"
Cohesion: 0.07
Nodes (28): Critères d'acceptation, Critères d'acceptation, Critères d'acceptation, Critères d'acceptation, Critères d'acceptation, Critères d'acceptation, Critères d'acceptation, Critères d'acceptation (+20 more)

### Community 44 - "Règles (`regles`)"
Cohesion: 0.07
Nodes (28): Architecture moteur, Champs, Champs, Champs, Champs, `combat` ★ obligatoire, Comme `action` d'un choix, Comme `usage` d'un item d'inventaire (+20 more)

### Community 45 - "Choix"
Cohesion: 0.09
Nodes (22): Action `lancer_de`, Champs, Champs, Champs de `lancer_de`, Choix, Choix libre (`libre`), Choix local (`local`), Comportement moteur (+14 more)

### Community 46 - "Scanner PDF"
Cohesion: 0.08
Nodes (24): 1. Détection des sections, 2. Extraction des choix, 3. Détection des fins de section, 4. Extraction des images, Ajout d'objet, Avertissements lors du scan, Ce que fait le scanner, Champ `choix` (+16 more)

### Community 47 - "Génération d'images par IA"
Cohesion: 0.08
Nodes (24): Automatic1111 (local), Ce que fait le script pour chaque image, Ce qui est détecté comme manquant, Changer de provider, ComfyUI (local), Configuration des providers — `ia_config.ini`, Construction des prompts, Format de la queue (+16 more)

### Community 48 - "Schéma JSON pour IA"
Cohesion: 0.08
Nodes (25): `choix`, `combat`, `combat`, Conseils de qualité de génération, Consignes de génération, `defaite`, `effets`, Exemple de message système (+17 more)

### Community 49 - "graphify.md"
Cohesion: 0.08
Nodes (24): 10. Vérifier que Kiro utilise bien Graphify, 11. `/graphify .` dans Kiro, 12. Pourquoi `/graphify .` est déconseillé ici, 13. Ce que `--code-only` évite, 14. Quand utiliser `/graphify .` malgré tout ?, 15. Nettoyer une ancienne génération, 16. Workflow recommandé, 1. Installation de `uv` (+16 more)

### Community 50 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 51 - "Système d'acquisition d'items"
Cohesion: 0.08
Nodes (23): Comportement des effets, Définition d'un item à gagner, Effets d'items, Exemple complet, Exemple complet, Exemples, Gain d'item via un choix, Gain d'items avec conditions (+15 more)

### Community 52 - "Tests E2E - Guide d'utilisation"
Cohesion: 0.09
Nodes (21): Boutons de choix, Exemple de test complet, `habilete=X`, `endurance=X`, `chance=X`, `ignore_stat_limit=1`, Installation des dépendances Playwright, `lance_de=X`, Lancer les tests d'un livre spécifique, Lancer les tests d'une section spécifique (+13 more)

### Community 53 - "Système d'acquisition d'items"
Cohesion: 0.10
Nodes (21): Comportement des effets, Définition d'un item à gagner, Effets d'items, Exemple complet, Exemple complet, Exemple — gain de pièces d'or par 2d6, Exemples, Intégration avec le moteur (+13 more)

### Community 54 - "Conditions"
Cohesion: 0.10
Nodes (21): `action_resolved` — action déjà tentée, `and` / `or` — conditions composées, `and` — toutes les conditions doivent être vraies, Cas de jeu, `combat_degats_heros` — dégâts reçus par le héros, `combat_degats_monstre` — dégâts infligés au monstre, `combat_victoire` — victoire au combat, Conditions (+13 more)

### Community 55 - "parseDiceFormula"
Cohesion: 0.20
Nodes (10): parseDiceFormula(), rollDice(), HeroInitState, RollResult, _buildPendingCard(), _buildResolvedCard(), _esc(), _render() (+2 more)

### Community 56 - "`sections` ★ obligatoire"
Cohesion: 0.22
Nodes (9): Choix, Combat dans une section, `condition`, `cout`, Effet d'item, Effet de stat, Effets de section, `sections` ★ obligatoire (+1 more)

### Community 57 - "Guide utilisateur"
Cohesion: 0.12
Nodes (16): Actions sur une carte, Badges sur les cartes, Barre d'outils, Combat, Créer son héros, Données sauvegardées, Défaite, Fiche héros (+8 more)

### Community 58 - "Règle `duel_de` — Paris"
Cohesion: 0.13
Nodes (14): Ce qu'il faut implémenter, Concept, Expressions supportées dans `conditions.succes`, Flux d'exécution, `GameEngineActions`, Point non trivial — deux jets séparés, Proposition JSON, Propriétés (+6 more)

### Community 59 - "Section Overrides"
Cohesion: 0.13
Nodes (14): Avantages de cette approche, Avertissements, Champs du choix, Champs supportés, `choix` (optionnel), `effets` (optionnel), `end` (optionnel), Exemple: Section 118 (Défaite simple) (+6 more)

### Community 60 - "Installation, build et configuration"
Cohesion: 0.14
Nodes (13): 1. Compiler et bundler, 1. Installer les dépendances, 2. Lancer le serveur de développement, 2. Prévisualiser le build, 3. Déployer, 3. Lancer les tests, Configuration des aventures, Dépendances Python (scanner et scripts IA) (+5 more)

### Community 61 - "Combat"
Cohesion: 0.11
Nodes (19): Action `btn_fuite`, Champs, Champs d'un event, Choix multiples, Combat, Défense avec lancer de dé (`defense`), Effets sur un monstre (`effets`), Exemple complet (+11 more)

### Community 62 - "`regles` ★ obligatoire"
Cohesion: 0.25
Nodes (8): `combat` ★ obligatoire, `composite`, `defaite` ★ obligatoire, `regles` ★ obligatoire, `restaurer_stat`, Règles personnalisées — optionnel, `test_stat`, `victoire` ★ obligatoire

### Community 63 - "Champs racine"
Cohesion: 0.10
Nodes (21): Ajouter l'aventure à la bibliothèque, Champs racine, `collection` — optionnel, Créer une aventure, Exemple minimal complet, `image_de_garde_ia` — optionnel, `image_de_garde` ★ obligatoire, `images_annexes` — optionnel (+13 more)

### Community 64 - "Paramètres disponibles"
Cohesion: 0.15
Nodes (12): Aventure, Combat et Dés, Exemples, `ignore_stat_limit`, Inventaire, `lance_de`, Mode debug (développement uniquement), Notes importantes (+4 more)

### Community 65 - "serialization.property.test.ts"
Cohesion: 0.15
Nodes (12): PersonnageTemplate, Regles, StatDefinition, arbAdventure, arbChoice, arbCombatData, arbCombatRules, arbEffet (+4 more)

### Community 66 - "Personnage (`personnage.json`)"
Cohesion: 0.17
Nodes (12): `choix_initial`, Comportement des armes 2 mains, `emplacements_equipement`, `equipement`, Exemple complet — Défis Fantastiques, `image` / `image_ia`, `inventaire`, `monnaie` (+4 more)

### Community 68 - "Exemples"
Cohesion: 0.20
Nodes (9): Champs, Exemples, Section avec combat, Section avec image et effets, Section de victoire, Section simple avec choix, Sous-documents, Structure d'une section (+1 more)

### Community 69 - "Effets"
Cohesion: 0.20
Nodes (10): Effets, Effets conditionnels, Exemple complet — section avec plusieurs effets, Limite de stat, Où les effets peuvent apparaître, Trigger (`trigger`), Triggers disponibles, Type `item` — ajouter un item à l'inventaire (+2 more)

### Community 70 - "Défense par item équipé (`combat_defense`)"
Cohesion: 0.20
Nodes (9): Champs, Comportement en combat, Défense par item équipé (`combat_defense`), Exemple complet — Bouclier rond en fer (section 155), Format de la valeur, Format des clés de `resultats`, Notes, Priorité (+1 more)

### Community 71 - "Jeter un équipement (`equipement_dropable`)"
Cohesion: 0.22
Nodes (8): Activation, Comportement, Condition `no_droppable_equip`, Dans la section, Dans `regles.json`, Exemple complet — Section 155, Jeter un équipement (`equipement_dropable`), Utilisation avec un choix conditionné

### Community 72 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 73 - "ui/schema-conditions.ts"
Cohesion: 0.60
Nodes (4): ChoiceCondition, formatConditionReason(), renderConditionsList(), renderConditionStatus()

### Community 74 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 75 - "Effets d'items"
Cohesion: 0.33
Nodes (6): Comportement des effets, Effets d'items, Exemple complet, Exemples, Structure d'un effet d'item, Types d'effets

### Community 76 - "Plan d'implémentation : Moteur de Gamebook"
Cohesion: 0.40
Nodes (4): Notes, Plan d'implémentation : Moteur de Gamebook, Tâches, Vue d'ensemble

### Community 77 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 78 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 79 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 85 - "142fff5de42f11ba7b6fa5ff5cd29ddefdd4e3e5.md"
Cohesion: 0.40
Nodes (4): Error details, Instructions, Test info, Test source

### Community 86 - "92d9b878f7448b624dcd394dcefd8b0fd8851466.md"
Cohesion: 0.40
Nodes (4): Error details, Instructions, Test info, Test source

### Community 87 - "adventures-Defis_Fantastiq-586d3-mbat-affichage-bouton-fuite-chromium/error-context.md"
Cohesion: 0.40
Nodes (4): Error details, Instructions, Test info, Test source

### Community 88 - "adventures-Defis_Fantastiq-82530-61-Section-061-Combat-fuite-chromium/error-context.md"
Cohesion: 0.40
Nodes (4): Error details, Instructions, Test info, Test source

### Community 89 - "adventures-Defis_Fantastiq-bfc0f-053-Si-réussi---section-155-chromium/error-context.md"
Cohesion: 0.40
Nodes (4): Error details, Instructions, Test info, Test source

### Community 90 - "Stratégies de remplacement"
Cohesion: 0.50
Nodes (4): `remplace: false` (défaut), `remplace: "item_id"`, `remplace: true`, Stratégies de remplacement

### Community 91 - "b302f02c894a2b207ed45074571c8e8bb79443d9.md"
Cohesion: 0.50
Nodes (3): Error details, Instructions, Test info

### Community 92 - "d83f49d7bdda7832cc2c72cf4adb49ebf00d6569.md"
Cohesion: 0.50
Nodes (3): Error details, Instructions, Test info

### Community 93 - "adventures-Defis_Fantastiq-5966e-ection-066-Section-et-texte-chromium/error-context.md"
Cohesion: 0.50
Nodes (3): Error details, Instructions, Test info

### Community 94 - "adventures-Defis_Fantastiq-f594d-Section-061-Combat-victoire-chromium/error-context.md"
Cohesion: 0.50
Nodes (3): Error details, Instructions, Test info

### Community 128 - "Action avec dés (test de stat)"
Cohesion: 0.50
Nodes (4): Action avec dés (test de stat), Champs de `action`, Champs de `ActionOutcome` (`si_reussi` / `si_echoue`), Exemple avec effets et items sur si_reussi

## Knowledge Gaps
- **835 isolated node(s):** `adventures`, `name`, `version`, `description`, `type` (+830 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **42 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GameEngine` connect `GameEngine` to `GameEngine.ts`, `CombatState`, `Hero`, `._buildSectionContent`, `.getRegle`, `main.ts`, `debugPanel.ts`, `GameEngineNavigation`, `Adventure`, `parseDiceFormula`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `testSection()` connect `testSection` to `screenshotOnFailure`, `testChoiceButtons`, `commonTests.ts`, `testStat`, `testNavigation`, `section-011.spec.ts`, `section-031.spec.ts`, `section-045.spec.ts`, `section-046.spec.ts`, `section-048.spec.ts`, `section-049.spec.ts`, `section-057.spec.ts`, `section-059.spec.ts`, `section-062.spec.ts`, `section-066.spec.ts`, `section-067.spec.ts`, `section-069.spec.ts`, `section-088.spec.ts`, `section-095.spec.ts`, `section-099.spec.ts`, `section-100.spec.ts`, `section-101.spec.ts`, `section-103.spec.ts`, `section-104.spec.ts`, `section-107.spec.ts`, `section-115.spec.ts`, `section-117.spec.ts`, `section-121.spec.ts`, `section-122.spec.ts`, `section-129.spec.ts`, `section-157.spec.ts`, `section-165.spec.ts`, `section-167.spec.ts`, `section-176.spec.ts`, `section-189.spec.ts`, `section-191.spec.ts`, `section-197.spec.ts`, `section-200.spec.ts`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `adventures`, `name`, `version` to the rest of the system?**
  _835 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `screenshotOnFailure` be split into smaller, more focused modules?**
  _Cohesion score 0.0392156862745098 - nodes in this community are weakly interconnected._
- **Should `testChoiceButtons` be split into smaller, more focused modules?**
  _Cohesion score 0.023574041457797047 - nodes in this community are weakly interconnected._
- **Should `CombatState` be split into smaller, more focused modules?**
  _Cohesion score 0.08649912331969609 - nodes in this community are weakly interconnected._
- **Should `commonTests.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09595959595959595 - nodes in this community are weakly interconnected._