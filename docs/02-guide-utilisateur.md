# Guide utilisateur

## La bibliothèque

Au lancement, l'application affiche la **bibliothèque** : la liste de toutes les aventures disponibles.

### Filtres

En haut de la bibliothèque, plusieurs filtres permettent de trier les aventures :

| Filtre | Description |
|--------|-------------|
| Recherche texte | Filtre par titre, collection ou tags |
| Collection | Filtre par série (ex : "Défis Fantastiques") |
| Statut | Tous / Non commencés / En cours / Terminés |

### Badges sur les cartes

- **En cours** — une sauvegarde existe pour cette aventure
- **Terminé** — l'aventure figure au tableau des scores

### Actions sur une carte

- **Commencer** — démarre une nouvelle partie (efface la sauvegarde existante)
- **Continuer** — reprend la partie sauvegardée (désactivé si aucune sauvegarde)
- **Scores** — affiche le tableau des meilleurs temps (désactivé si aucun score)
- Cliquer sur la **couverture** l'affiche en plein écran

---

## Créer son héros

Avant de commencer une aventure, l'application vous guide pour créer votre personnage :

1. **Lancer les dés** pour chaque statistique (Habileté, Endurance, Chance…)  
   Chaque statistique est tirée selon la formule définie dans l'aventure (ex : `1d6+6`).

2. **Choisir l'équipement de départ** si l'aventure propose un choix initial  
   (ex : choisir une potion parmi trois options).

3. **Lire l'introduction** si l'aventure en possède une.

---

## Jouer

### Navigation dans les sections

Chaque section présente :
- Une **illustration** (si disponible) — cliquer dessus l'affiche en plein écran
- Le **texte** de la section
- Les **choix** disponibles

Cliquer sur un choix navigue vers la section correspondante.

### Barre d'outils

| Bouton | Action |
|--------|--------|
| 💾 Sauvegarder | Sauvegarde la partie et retourne à la bibliothèque |
| 📖 Mode d'emploi | Affiche les règles de l'aventure |
| 🧙 Fiche héros | Affiche les statistiques et l'inventaire du héros |
| 🖼 Images annexes | Affiche les illustrations supplémentaires (cartes, tableaux…) |

> La sauvegarde renvoie à la bibliothèque pour éviter de recharger la partie et de tricher.

### Fiche héros

La fiche héros affiche :
- Les **statistiques** actuelles et initiales
- L'**inventaire** avec les quantités
- L'**historique** des modifications de statistiques

### Combat

Quand une section déclenche un combat :

1. **Lancer les dés de l'ennemi** — détermine sa force d'attaque
2. **Lancer les dés du héros** — détermine votre force d'attaque
3. Le résultat du round s'affiche (qui blesse qui, dégâts)
4. Des **actions spéciales** peuvent être disponibles selon les règles (tenter la chance en attaque, en défense, fuir…)
5. Répéter jusqu'à la victoire ou la défaite

---

## Fin de partie

### Victoire

La section de victoire s'affiche avec son texte et son image. Vous pouvez ensuite :
- Entrer votre nom pour figurer au **tableau des scores**
- Consulter le **classement** (trié par temps de jeu)
- Retourner à la **bibliothèque**

### Défaite

La section de défaite s'affiche. La sauvegarde est automatiquement supprimée. Vous pouvez retourner à la bibliothèque et recommencer.

---

## Préférences d'affichage

Le bouton **Aa** (en haut à gauche) ouvre le panneau d'accessibilité :
- Taille de police
- Contraste
- Autres préférences visuelles

Ces préférences sont sauvegardées localement dans le navigateur.

---

## Données sauvegardées

Toutes les données sont stockées dans le **localStorage** du navigateur :

| Clé | Contenu |
|-----|---------|
| `save:<titre>` | Sauvegarde de partie (section, héros, temps) |
| `leaderboard:<titre>` | Tableau des scores |

Ces données sont locales à votre navigateur et ne sont pas partagées.
