# Document de Requirements — Moteur de Gamebook

## Introduction

Ce projet consiste à développer un moteur de jeu interactif de type "Livre dont vous êtes le héros" (gamebook engine), inspiré des collections *Défis Fantastiques* et *Livres dont VOUS êtes le héros*. Le moteur lit des aventures décrites dans des fichiers JSON structurés, propose une bibliothèque d'aventures, gère la progression du joueur (statistiques, inventaire, combats), sauvegarde les parties et enregistre les victoires. Une fonctionnalité bonus permet de scanner un PDF de livre existant pour générer automatiquement le fichier JSON correspondant.

La technologie cible est Python ou HTML/JavaScript, sans serveur complexe, avec une interface simple.

---

## Glossaire

- **Moteur** : Le logiciel principal qui charge, interprète et fait jouer une aventure.
- **Aventure** : Un fichier JSON décrivant un livre-jeu complet (titre, sections, règles, personnage, images).
- **Section** : Une entrée numérotée de l'aventure, composée d'un numéro, d'un texte narratif, d'une image optionnelle et de choix menant à d'autres sections.
- **Héros** : Le personnage joué par l'utilisateur, défini par des statistiques et un inventaire.
- **Statistiques** : Les attributs numériques du Héros (ex. : Habileté, Endurance, Chance).
- **Inventaire** : La liste des objets portés par le Héros.
- **Combat** : Une phase de résolution d'affrontement entre le Héros et un adversaire, selon les règles de l'aventure.
- **Partie** : Une session de jeu associant un joueur, une aventure et un état sauvegardé.
- **Bibliothèque** : L'écran listant toutes les aventures disponibles.
- **Tableau de victoire** : La liste des joueurs ayant terminé une aventure avec succès, triée par temps de jeu.
- **Scanneur PDF** : Le module optionnel qui extrait le contenu d'un PDF de livre-jeu pour produire un fichier JSON d'aventure.
- **Image de garde** : L'image principale représentant la couverture ou l'illustration principale d'une aventure.
- **Images annexes** : Images supplémentaires (cartes, tableaux) consultables à tout moment pendant le jeu.
- **IA d'image** : Un service d'intelligence artificielle gratuit utilisé pour générer des illustrations à partir d'un texte.
- **Joueur** : L'utilisateur humain qui interagit avec le Moteur.

---

## Requirements

### Requirement 1 : Format du fichier d'aventure (JSON)

**User Story :** En tant qu'auteur d'aventure, je veux décrire une aventure complète dans un fichier JSON structuré, afin que le Moteur puisse la charger et la faire jouer sans configuration supplémentaire.

#### Critères d'acceptation

1. THE Moteur SHALL accepter un fichier JSON d'aventure contenant les champs obligatoires suivants : `titre`, `tags`, `repertoire_images`, `image_de_garde`, `mode_emploi`, `personnage`, `regles`, et `sections`.
2. THE Moteur SHALL accepter un champ optionnel `images_annexes` contenant une liste de chemins d'images consultables pendant le jeu.
3. WHEN un fichier JSON d'aventure est chargé, THE Moteur SHALL valider la présence de tous les champs obligatoires et signaler toute erreur de structure avec un message descriptif.
4. IF un fichier JSON d'aventure est invalide ou illisible, THEN THE Moteur SHALL afficher un message d'erreur précisant le nom du fichier et la nature du problème, sans interrompre le chargement des autres aventures.
5. THE Moteur SHALL accepter dans le champ `sections` une liste d'objets, chaque objet contenant au minimum : `numero` (entier), `texte` (chaîne), et `choix` (liste, pouvant être vide).
6. WHERE une section contient un champ `image`, THE Moteur SHALL afficher cette image lors de l'affichage de la section.
7. WHERE une section contient un champ `combat`, THE Moteur SHALL déclencher la phase de combat selon les règles définies dans le champ `regles` de l'aventure.

---

### Requirement 2 : Bibliothèque d'aventures

**User Story :** En tant que Joueur, je veux voir la liste de toutes les aventures disponibles avec leur image de garde et leur titre, afin de choisir celle que je veux jouer.

#### Critères d'acceptation

1. WHEN le Moteur démarre, THE Moteur SHALL afficher la Bibliothèque listant toutes les aventures trouvées dans le répertoire d'aventures configuré.
2. THE Moteur SHALL afficher pour chaque aventure son titre et son image de garde.
3. IF aucune aventure n'est trouvée dans le répertoire configuré, THEN THE Moteur SHALL afficher un message indiquant que le répertoire est vide ou introuvable.
4. WHEN le Joueur sélectionne une aventure dans la Bibliothèque, THE Moteur SHALL proposer deux options : "Commencer une nouvelle partie" et "Continuer une partie sauvegardée" (si une sauvegarde existe pour cette aventure).

---

### Requirement 3 : Démarrage et reprise de partie

**User Story :** En tant que Joueur, je veux pouvoir commencer une nouvelle partie ou reprendre une partie sauvegardée, afin de ne pas perdre ma progression.

#### Critères d'acceptation

1. WHEN le Joueur choisit "Commencer une nouvelle partie", THE Moteur SHALL initialiser le Héros avec les statistiques et l'inventaire définis dans le champ `personnage` de l'aventure, puis afficher la section numéro 1.
2. WHEN le Joueur choisit "Continuer une partie sauvegardée", THE Moteur SHALL charger l'état sauvegardé et afficher un résumé du statut du Héros (statistiques actuelles, inventaire) ainsi que le temps de jeu cumulé avant de reprendre.
3. IF aucune sauvegarde n'existe pour l'aventure sélectionnée, THEN THE Moteur SHALL désactiver l'option "Continuer une partie sauvegardée" et l'indiquer visuellement au Joueur.
4. THE Moteur SHALL toujours démarrer une nouvelle partie à la section numéro 1.

---

### Requirement 4 : Navigation entre sections

**User Story :** En tant que Joueur, je veux lire le texte de chaque section et choisir parmi les options proposées, afin de progresser dans l'aventure.

#### Critères d'acceptation

1. WHEN une section est affichée, THE Moteur SHALL présenter le texte narratif de la section, l'image associée si elle existe, et la liste des choix disponibles.
2. WHEN le Joueur sélectionne un choix, THE Moteur SHALL naviguer vers la section indiquée par ce choix.
3. IF une section ne contient aucun choix et n'est pas une section de fin, THEN THE Moteur SHALL afficher un message d'erreur indiquant que la section est incomplète.
4. WHILE une partie est en cours, THE Moteur SHALL permettre au Joueur de consulter les images annexes de l'aventure à tout moment.
5. WHILE une partie est en cours, THE Moteur SHALL permettre au Joueur de consulter le mode d'emploi et la fiche du Héros à tout moment.

---

### Requirement 5 : Gestion du Héros (statistiques et inventaire)

**User Story :** En tant que Joueur, je veux voir et gérer les statistiques et l'inventaire de mon Héros, afin de prendre des décisions éclairées pendant l'aventure.

#### Critères d'acceptation

1. THE Moteur SHALL afficher les statistiques actuelles du Héros et son inventaire à tout moment pendant une partie.
2. WHEN une section modifie les statistiques ou l'inventaire du Héros selon les règles de l'aventure, THE Moteur SHALL mettre à jour l'état du Héros en conséquence.
3. IF les points d'Endurance du Héros atteignent zéro ou moins, THEN THE Moteur SHALL afficher un message de fin de partie (défaite) et proposer de recommencer ou de retourner à la Bibliothèque.
4. THE Moteur SHALL conserver l'historique des modifications de statistiques du Héros pendant la session de jeu en cours.

---

### Requirement 6 : Système de combat

**User Story :** En tant que Joueur, je veux résoudre les combats selon les règles de l'aventure, afin de vivre une expérience fidèle au livre-jeu original.

#### Critères d'acceptation

1. WHEN une section déclenche un combat, THE Moteur SHALL lire les paramètres de l'adversaire (nom, statistiques) depuis le champ `combat` de la section.
2. WHEN un combat est déclenché, THE Moteur SHALL appliquer les règles de résolution définies dans le champ `regles` de l'aventure (jets de dés, calcul des dommages, etc.).
3. THE Moteur SHALL afficher le déroulement du combat tour par tour, en indiquant les résultats de chaque round.
4. WHEN le combat se termine, THE Moteur SHALL mettre à jour les statistiques du Héros selon le résultat (victoire ou défaite) et reprendre la narration de la section.
5. IF le Héros est vaincu lors d'un combat, THEN THE Moteur SHALL appliquer le critère d'acceptation 3 du Requirement 5 (fin de partie).

---

### Requirement 7 : Sauvegarde et chargement de partie

**User Story :** En tant que Joueur, je veux sauvegarder ma progression à tout moment, afin de pouvoir reprendre l'aventure plus tard.

#### Critères d'acceptation

1. WHILE une partie est en cours, THE Moteur SHALL permettre au Joueur de sauvegarder sa partie à tout moment.
2. WHEN le Joueur sauvegarde, THE Moteur SHALL enregistrer l'état complet de la Partie : section courante, statistiques du Héros, inventaire, et temps de jeu cumulé.
3. THE Moteur SHALL conserver au minimum une sauvegarde par aventure.
4. WHEN une sauvegarde est chargée, THE Moteur SHALL restaurer exactement l'état enregistré sans perte de données.
5. IF une sauvegarde est corrompue ou illisible, THEN THE Moteur SHALL afficher un message d'erreur et proposer de démarrer une nouvelle partie.

---

### Requirement 8 : Comptabilisation du temps de jeu

**User Story :** En tant que Joueur, je veux que mon temps de jeu soit mesuré, afin de pouvoir comparer mes performances avec d'autres joueurs.

#### Critères d'acceptation

1. WHEN une partie démarre ou reprend, THE Moteur SHALL démarrer ou reprendre le chronomètre de temps de jeu.
2. WHEN une partie est mise en pause ou sauvegardée, THE Moteur SHALL arrêter le chronomètre et conserver le temps cumulé.
3. THE Moteur SHALL afficher le temps de jeu cumulé dans l'écran de résumé de partie sauvegardée.
4. THE Moteur SHALL enregistrer le temps de jeu final lors d'une victoire.

---

### Requirement 9 : Condition de victoire et tableau de victoire

**User Story :** En tant que Joueur, je veux que ma victoire soit enregistrée avec mon nom et mon temps de jeu, afin de figurer dans le tableau de victoire de l'aventure.

#### Critères d'acceptation

1. WHEN le Joueur atteint une section de victoire (définie dans l'aventure), THE Moteur SHALL afficher un écran de félicitations et inviter le Joueur à saisir son nom.
2. WHEN le Joueur valide son nom, THE Moteur SHALL enregistrer l'entrée (nom du joueur, temps de jeu) dans le tableau de victoire de l'aventure.
3. THE Moteur SHALL afficher le tableau de victoire de l'aventure, trié par temps de jeu croissant.
4. THE Moteur SHALL conserver le tableau de victoire de manière persistante entre les sessions.
5. IF le Joueur ne saisit pas de nom, THEN THE Moteur SHALL enregistrer l'entrée avec le nom "Anonyme".

---

### Requirement 10 : Génération d'images par IA

**User Story :** En tant qu'auteur d'aventure, je veux pouvoir générer automatiquement des illustrations pour les sections sans image, afin d'enrichir visuellement l'aventure.

#### Critères d'acceptation

1. WHERE l'option de génération d'images par IA est activée dans l'aventure, THE Moteur SHALL proposer de générer une image pour les sections ne possédant pas d'image associée.
2. WHEN une génération d'image est demandée, THE Moteur SHALL construire un prompt à partir du titre de l'aventure, des tags et du texte de la section, puis appeler un service d'IA gratuit.
3. WHEN une image est générée avec succès, THE Moteur SHALL l'enregistrer dans le répertoire d'images de l'aventure et l'associer à la section correspondante.
4. IF le service d'IA est indisponible ou retourne une erreur, THEN THE Moteur SHALL afficher un message d'erreur et continuer sans image pour cette section.

---

### Requirement 11 : Scannage de PDF pour génération de fichier JSON (fonctionnalité bonus)

**User Story :** En tant qu'auteur d'aventure, je veux scanner un PDF de livre-jeu existant pour générer automatiquement le fichier JSON d'aventure, afin de numériser rapidement un livre physique.

#### Critères d'acceptation

1. THE Scanneur_PDF SHALL accepter un fichier PDF en entrée et produire un fichier JSON d'aventure conforme au format défini dans le Requirement 1.
2. WHEN un PDF est scanné, THE Scanneur_PDF SHALL extraire le texte de chaque section numérotée et les choix associés.
3. WHEN un PDF est scanné, THE Scanneur_PDF SHALL identifier et extraire les images présentes dans le PDF et les associer aux sections correspondantes.
4. THE Scanneur_PDF SHALL extraire les règles du jeu, la description du personnage et le mode d'emploi depuis les pages introductives du PDF.
5. IF le PDF ne peut pas être lu ou ne correspond pas à la structure attendue d'un livre-jeu, THEN THE Scanneur_PDF SHALL afficher un message d'erreur descriptif et ne pas produire de fichier JSON partiel sans avertissement.
6. THE Pretty_Printer SHALL formater le fichier JSON produit de manière lisible et indentée.
7. FOR ALL fichiers JSON produits par le Scanneur_PDF, charger puis ré-exporter puis recharger le fichier JSON SHALL produire un objet équivalent à l'original (propriété de round-trip).

---

### Requirement 12 : Interface utilisateur

**User Story :** En tant que Joueur, je veux une interface simple et agréable, afin de me concentrer sur l'aventure sans être distrait par la complexité technique.

#### Critères d'acceptation

1. THE Moteur SHALL fonctionner sans serveur complexe, en local sur la machine du Joueur.
2. THE Moteur SHALL être utilisable via un navigateur web (HTML/JavaScript) ou une application Python avec interface graphique légère.
3. THE Moteur SHALL afficher les textes de manière lisible, avec une mise en forme adaptée à la lecture narrative.
4. WHEN le Joueur navigue entre les sections, THE Moteur SHALL afficher la nouvelle section en moins de 500 ms sur une machine standard.
5. THE Moteur SHALL être utilisable sans connexion internet, à l'exception de la fonctionnalité de génération d'images par IA.
