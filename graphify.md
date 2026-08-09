# Graphify + Kiro

Documentation d'installation et d'utilisation de Graphify dans un projet Kiro.

> **Recommandation pour ce projet :** utiliser le CLI Graphify directement avec `--code-only`.
>
> Cela génère le graphe du code localement, sans appel LLM et sans consommation de tokens Kiro.

---

## 1. Installation de `uv`

Installer `uv` si ce n'est pas déjà fait.

Sous Windows PowerShell :

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Redémarrer PowerShell puis vérifier :

```powershell
uv --version
```

---

## 2. Installer Graphify

Graphify s'installe comme outil global via `uv` :

```powershell
uv tool install --upgrade graphifyy
```

Vérifier :

```powershell
graphify --version
```

Exemple :

```text
graphify 0.9.37
```

### Pourquoi `uv` et pas un venv ?

Graphify est un **outil CLI**, pas une dépendance du projet.

On souhaite donc :

* une installation indépendante du projet ;
* ne pas créer de `.venv` ;
* pouvoir utiliser `graphify` depuis n'importe quel projet ;
* laisser `uv` gérer son environnement Python isolé.

Le projet lui-même n'a donc pas besoin de connaître Graphify comme dépendance Python.

---

## 3. Installer la skill Graphify pour Kiro

Depuis la racine du projet :

```powershell
graphify kiro install
```

Cela crée :

```text
.kiro/
└── skills/
    └── graphify/
        ├── SKILL.md
        └── references/
            ├── add-watch.md
            ├── exports.md
            ├── extraction-spec.md
            ├── github-and-merge.md
            ├── hooks.md
            ├── query.md
            ├── transcribe.md
            └── update.md
```

La skill explique à Kiro comment utiliser Graphify.

Elle **ne génère pas le graphe à elle seule** et sa présence n'implique pas qu'un LLM tourne en permanence.

---

# 4. Génération initiale du graphe — méthode recommandée

Pour un projet principalement constitué de code, utiliser :

```powershell
graphify extract . --code-only --out .
```

### Ce que fait cette commande

Elle :

1. scanne le projet ;
2. détecte les fichiers de code ;
3. extrait leur structure via AST ;
4. construit les nœuds et relations ;
5. génère `graphify-out/graph.json`.

Avec `--code-only` :

* les documents sont ignorés ;
* les PDF sont ignorés ;
* les images sont ignorées ;
* **aucun LLM n'est utilisé pour l'extraction du code** ;
* aucun token Kiro n'est consommé.

Exemple de résultat :

```text
221 code files
967 nodes
2409 edges
109 communities
```

---

# 5. Générer le clustering et le rapport

Après l'extraction :

```powershell
graphify cluster-only .
```

Cela génère notamment :

```text
graphify-out/
├── graph.json
├── GRAPH_REPORT.md
└── ...
```

Le clustering permet notamment d'identifier les groupes fonctionnels du projet.

---

# 6. Générer la visualisation HTML

```powershell
graphify export html
```

Cela ajoute :

```text
graphify-out/
└── graph.html
```

Le fichier peut être ouvert directement dans un navigateur.

---

# 7. Structure finale recommandée

À ce stade, on doit avoir quelque chose de proche de :

```text
Projet/
├── .kiro/
│   └── skills/
│       └── graphify/
│           ├── SKILL.md
│           └── references/
│
├── graphify-out/
│   ├── cache/
│   ├── graph.json
│   ├── graph.html
│   ├── GRAPH_REPORT.md
│   ├── manifest.json
│   ├── cost.json
│   └── ...
│
└── reste du projet
```

Il ne doit normalement **pas** y avoir :

```text
graphify-out/graphify-out/
```

---

# 8. Après des modifications du code

Il n'est pas nécessaire de reconstruire le graphe complet.

Utiliser :

```powershell
graphify update
```

Graphify réanalyse les fichiers modifiés et met à jour le graphe.

Pour le code, cette opération reste locale et ne nécessite pas de LLM.

---

# 9. Utilisation par Kiro

Une fois :

```text
graphify-out/graph.json
```

présent, Kiro peut exploiter le graphe pour répondre aux questions sur le projet.

Par exemple :

```text
/graphify query "Comment fonctionne le système de sauvegarde ?"
```

ou directement depuis Kiro avec une demande naturelle qui implique Graphify.

La skill détecte la présence de :

```text
graphify-out/graph.json
```

et utilise alors le graphe existant au lieu de reconstruire tout le projet.

---

# 10. Vérifier que Kiro utilise bien Graphify

On peut tester directement dans le terminal :

```powershell
graphify query "Comment fonctionne le système de sauvegarde ?"
```

Si Graphify retourne une réponse basée sur les nœuds et relations du graphe, le graphe est fonctionnel.

Pour une question de chemin entre deux éléments :

```powershell
graphify path "AuthModule" "Database"
```

Pour examiner un nœud :

```powershell
graphify explain "GameEngine"
```

Pour voir les principaux hubs architecturaux :

```powershell
graphify god-nodes
```

---

# 11. `/graphify .` dans Kiro

Kiro fournit également une commande :

```text
/graphify .
```

Cette commande est **beaucoup plus complète** que :

```powershell
graphify extract . --code-only --out .
```

Elle peut notamment :

* analyser le code ;
* analyser les documents ;
* analyser les PDF ;
* analyser les images ;
* effectuer une extraction sémantique ;
* utiliser des agents Kiro pour cette extraction ;
* créer des relations sémantiques supplémentaires ;
* effectuer le clustering ;
* générer le rapport ;
* générer la visualisation ;
* éventuellement produire d'autres exports.

La skill Kiro indique notamment :

```text
Semantic extraction (LLM, costs tokens)
```

et demande aux agents de traiter les fichiers non-code par groupes.

---

# 12. Pourquoi `/graphify .` est déconseillé ici

Le problème n'est pas que `/graphify` fonctionne mal.

C'est simplement **beaucoup plus lourd que nécessaire pour un projet de code**.

Dans notre projet, on avait par exemple :

```text
221 fichiers de code
86 fichiers non-code
49 documents
37 images
```

Avec :

```text
/graphify .
```

Kiro a donc commencé à envoyer les fichiers non-code vers l'extraction sémantique.

Cela entraîne des appels LLM et donc une consommation de tokens.

On peut notamment rencontrer :

```text
Too many requests, please wait before trying again.
```

La skill demande même explicitement de lancer plusieurs agents en parallèle pour accélérer cette extraction.

---

# 13. Ce que `--code-only` évite

Avec :

```powershell
graphify extract . --code-only --out .
```

Graphify fait essentiellement :

```text
Code
 │
 ▼
AST extraction
 │
 ▼
Graph
 │
 ├── nodes
 └── edges
```

Pas de :

```text
Documents ──┐
PDF ────────┤
Images ─────┼──► LLM / agents Kiro
            │
            └──► extraction sémantique
```

C'est donc **beaucoup plus prévisible**, rapide et économique en tokens.

---

# 14. Quand utiliser `/graphify .` malgré tout ?

La commande Kiro peut être intéressante si l'objectif est d'avoir un **knowledge graph complet**, et pas uniquement un graphe du code.

Par exemple si le projet contient des documents importants décrivant :

* l'architecture ;
* les règles métier ;
* des spécifications ;
* des PDF techniques ;
* des diagrammes/images ;
* de la documentation externe.

Dans ce cas, l'extraction sémantique peut apporter des relations que l'AST ne peut pas connaître.

Mais il faut accepter :

* davantage de consommation de tokens ;
* davantage de temps ;
* des appels LLM ;
* un risque de limitation de requêtes ;
* une extraction plus lourde.

Pour un projet où l'objectif principal est de permettre à Kiro de **comprendre la structure du code**, `--code-only` est préférable.

---

# 15. Nettoyer une ancienne génération

Si `/graphify .` a été lancé auparavant et a laissé une génération incomplète, repartir proprement.

Depuis la racine du projet :

```powershell
Remove-Item -Recurse -Force .\graphify-out
```

Puis :

```powershell
graphify extract . --code-only --out .
graphify cluster-only .
graphify export html
```

**Ne pas supprimer :**

```text
.kiro/skills/graphify/
```

C'est l'installation de la skill Kiro.

---

# 16. Workflow recommandé

### Première installation

```powershell
uv tool install --upgrade graphifyy
graphify kiro install
```

### Première génération

```powershell
graphify extract . --code-only --out .
graphify cluster-only .
graphify export html
```

### Après modification du code

```powershell
graphify update
```

### Question sur le code

Depuis le terminal :

```powershell
graphify query "Ma question"
```

ou depuis Kiro :

```text
/graphify query "Ma question"
```

### À retenir

```text
                ┌─────────────────────────┐
                │       Projet Kiro       │
                └────────────┬────────────┘
                             │
                    première génération
                             │
                             ▼
              graphify extract . --code-only
                             │
                             ▼
                    graphify-out/graph.json
                             │
               ┌─────────────┴─────────────┐
               │                           │
               ▼                           ▼
        graphify update              Kiro / query
        après modifications          questions sur le code
```

**Commande à privilégier :**

```powershell
graphify extract . --code-only --out .
```

**Commande complète mais déconseillée par défaut :**

```text
/graphify .
```

car elle ajoute l'extraction sémantique LLM des documents/images et peut donc consommer beaucoup plus de tokens.
