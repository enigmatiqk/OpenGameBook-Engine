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

## Réécriture de messages de commit existants

Quand l'utilisateur demande de corriger d'anciens messages de commit, utiliser `git filter-branch --msg-filter` sur la plage concernée. Voici les problèmes rencontrés et leurs solutions.

### Procédure

1. Lister les commits concernés : `git log --oneline -N`
2. Proposer les nouveaux messages à l'utilisateur et attendre validation
3. Identifier le SHA du parent du plus ancien commit à réécrire
4. Générer le script de remplacement **via Python** (voir ci-dessous)
5. Stasher le working tree si nécessaire : `git stash --include-untracked`
6. Lancer `git filter-branch -f --msg-filter '...' <parent>..HEAD`
7. Force push : `git push --force-with-lease origin main`
8. Restaurer le stash : `git stash pop`
9. Nettoyer les fichiers temporaires dans `.git/`

### Problème 1 — BOM UTF-8 dans les scripts écrits par PowerShell

**Symptôme** : bash échoue avec `command not found` sur la première ligne (`$'\357\273\277case'`).

**Cause** : PowerShell écrit les fichiers `.sh` avec un BOM UTF-8 (octets `EF BB BF`) que bash interprète comme du contenu.

**Solution** : toujours écrire les scripts bash via Python avec `open(..., encoding='utf-8', newline='\n')` et `UTF8Encoding(False)` — jamais avec `Set-Content` PowerShell.

```python
with open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
```

Vérification : les 3 premiers octets doivent être `99 97 115` (`c`, `a`, `s` de `case`), pas `239 187 191`.

### Problème 2 — Apostrophes perdues dans les messages bash

**Symptôme** : les apostrophes (`l'arbre`, `l'éditeur`) disparaissent du message final.

**Cause** : les apostrophes dans un `echo '...'` terminent la chaîne bash. Il faut utiliser des double-quotes : `echo "..."`.

**Solution** : toujours utiliser `echo "message"` ou `printf '%s' "message"` dans le script `--msg-filter`. Les apostrophes dans des double-quotes passent sans problème.

### Problème 3 — Accents perdus dans les messages bash

**Symptôme** : `améliorer` devient `ameliorer`, `décisions` devient `decisions` dans les messages commités.

**Cause** : PowerShell encode mal les caractères accentués quand il écrit un fichier `.sh` (même sans BOM, l'encodage de sortie de la console peut corrompre les octets).

**Solution** : générer le script bash **exclusivement via Python**, qui gère l'UTF-8 correctement :

```python
# Exemple de script généré
messages = {
    "abc1234": "fix(editor): corriger l'arbre de décisions",
    "def5678": "feat(carte): améliorer le rendu de la carte",
}
lines = ['case "$GIT_COMMIT" in']
for sha, msg in messages.items():
    lines.append(f"  {sha}*) printf '%s' \"{msg}\" ;;")
lines.append('  *) cat ;;')
lines.append('esac')
with open('.git/msg_filter.sh', 'w', encoding='utf-8', newline='\n') as f:
    f.write('\n'.join(lines) + '\n')
```

Tester avant de lancer : `& bash -c "GIT_COMMIT=abc1234; source '.git/msg_filter.sh'"` — doit afficher le message avec accents.

### Problème 4 — Affichage sans accents dans `git log --oneline`

**Symptôme** : le terminal PowerShell affiche `ameliorer` alors que git stocke bien `améliorer`.

**Cause** : problème d'encodage de la console PowerShell, pas du contenu git.

**Solution** : vérifier avec Python pour avoir l'encodage réel :

```powershell
python -c "import subprocess; r = subprocess.run(['git','log','--format=%s','-3'], capture_output=True); print(r.stdout.decode('utf-8'))"
```

### Problème 5 — Working tree sale bloque filter-branch

**Symptôme** : `Cannot rewrite branches: You have unstaged changes.`

**Solution** : `git stash --include-untracked` avant, `git stash pop` après. Les warnings CRLF sont inoffensifs.

### Problème 6 — filter-branch ne modifie rien (SHAs identiques)

**Symptôme** : les SHAs restent identiques après un 2e ou 3e passage de filter-branch.

**Cause** : git détecte que le contenu produit par le filtre est identique à ce qui est déjà stocké (si les accents étaient déjà corrects mais l'affichage trompeur, voir Problème 4).

**Solution** : vérifier avec Python si les messages sont déjà corrects avant de relancer inutilement.
