# Convention de commit Git

## Format

```
type(scope): description courte en français
```

La description doit être en minuscules, sans majuscule initiale, sans point final.

## Types

| type | usage |
|------|-------|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `refactor` | Réécriture/restructuration sans changement de comportement |
| `style` | Changements CSS/UI sans impact fonctionnel |
| `test` | Ajout ou correction de tests |
| `docs` | Documentation uniquement |
| `chore` | Tâches techniques (config, dépendances, scripts) |

## Scopes

| scope | usage |
|-------|-------|
| `engine` | Moteur de jeu (`src/engine/`) |
| `editor` | Éditeur d'aventure (`src/editor/`) |
| `carte` | Carte et navigation (`src/carte/`) |
| `ui` | Interface joueur (`src/ui/`) |
| `config` | Configuration build/vite/tsconfig |
| `tests` | Fichiers de tests uniquement |
| `types` | Fichier `types.ts` |
| `adventure` | Données de l'aventure (`adventures/`) |

## Exemples valides

```
feat(engine): ajouter le support des conditions de type "ou"
fix(carte): corriger le calcul du chemin le plus court
refactor(editor): extraire CarteFixeEditor dans son propre fichier
style(ui): améliorer l'affichage de l'inventaire
test(engine): ajouter les cas limites pour le combat
docs(engine): documenter les propriétés de section
chore(config): ajouter le plugin de sauvegarde JSON en dev
```

## Règles pour Kiro

- **Toujours** utiliser cette convention quand tu génères un `git commit`
- Si plusieurs scopes sont touchés, choisir le scope principal du changement
- Pas de majuscule, pas de point final dans la description
- La description est en **français** (les tags `type` et `scope` restent en anglais)
- Limiter la description à ~70 caractères
- Si le commit contient aussi des corrections mineures, les mentionner dans le corps du message (ligne vide après la description, puis détails)

## Workflow de commit automatique

Après **toute implémentation ou correction de code** demandée par l'utilisateur, Kiro doit **systématiquement** :

1. Stager uniquement les fichiers liés à la tâche (`git add <fichiers>` — jamais `git add .` sans vérification)
2. Committer avec un message conforme à la convention ci-dessus
3. **Ne jamais supprimer ou réécrire des commits existants** sans permission explicite de l'utilisateur

Les seules exceptions où Kiro ne commit pas automatiquement :
- L'utilisateur a explicitement dit de ne pas committer
- Les changements sont expérimentaux / work-in-progress explicitement mentionné
- Il n'y a aucun fichier modifié à stager
