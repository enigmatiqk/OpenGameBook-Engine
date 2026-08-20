---
inclusion: always
---

# jsonnav

Avant de lire un fichier `<nom>.json`, vérifier si un fichier `<nom>.jsonnav.json` existe au même niveau. Si oui, utiliser jsonnav **immédiatement et sans demander de validation** plutôt que de lire le JSON directement. Lancer les commandes jsonnav directement, sans demander de confirmation à l'utilisateur.

## Règle de déclenchement

- Fichier cible : `path/to/sections.json`
- Vérifier : `path/to/sections.jsonnav.json` existe ?
- Si oui → utiliser jsonnav avec la config correspondante
- Si non → lire le fichier normalement

## Workflow automatique

1. Si le numéro de section est connu → aller directement à `jsonnav structure <source> <section>`
2. Puis `jsonnav get <source> <section> <propriété>` pour récupérer uniquement ce qui est nécessaire
3. Ne pas faire de `list` si la source et la section sont déjà connues

Ne pas ouvrir le fichier JSON directement quand un index jsonnav existe. Ne pas demander de validation avant de lancer les commandes jsonnav.

## Projet courant

- Config : `adventures/jsonnav.config.yaml`
- Source principale : `sorcier-montagne`
- Fichier source : `adventures/Defis_Fantastiques_01_-_Le_Sorcier_de_la_Montagne_de_feu/sections.json`
- Index : `adventures/Defis_Fantastiques_01_-_Le_Sorcier_de_la_Montagne_de_feu/sections.jsonnav.json`
