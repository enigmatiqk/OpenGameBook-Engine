# Génération d'images par IA

Les scripts de génération d'images permettent de créer automatiquement des illustrations pour les sections d'une aventure qui n'en ont pas, ainsi que les images de couverture de fin, de victoire et de défaite.

---

## Vue d'ensemble

Le workflow se déroule en deux étapes :

```
1. ia_build_queue.py   →  image_ia_queue.json  (liste des images à générer)
2. ia_generate_images.py  →  télécharge les images + met à jour le JSON
```

---

## Prérequis

Python 3.10+, aucune dépendance externe (stdlib uniquement).

---

## Étape 1 — Construire la queue

```bash
python scripts/ia_build_queue.py <chemin_adventure.json>
```

**Exemple :**

```bash
python scripts/ia_build_queue.py adventures/MonAventure/MonAventure.json
```

Le script analyse le JSON de l'aventure et génère `image_ia_queue.json` **dans le même dossier que le JSON** :

```
adventures/MonAventure/image_ia_queue.json
```

### Ce qui est détecté comme manquant

| Type | Condition |
|------|-----------|
| Section | Le champ `image` est absent **ou** le fichier n'existe pas sur disque |
| `finish.jpeg` | Le fichier n'existe pas dans le dossier images |
| Images victoire | `images_victoire` est vide **ou** les fichiers listés n'existent pas |
| Images défaite | `images_defaite` est vide **ou** les fichiers listés n'existent pas |

### Format de la queue

```json
{
  "adventure_path": "adventures/MonAventure/MonAventure.json",
  "total": 42,
  "tasks": [
    {
      "type":     "section",
      "numero":   17,
      "filename": "section_017.jpeg",
      "prompt":   "Illustration for 'Mon Aventure' [gamebook, fantasy]. Scene: ..."
    },
    {
      "type":     "finish",
      "filename": "finish.jpeg",
      "prompt":   "Victory scene for 'Mon Aventure' [gamebook, fantasy]. ..."
    }
  ]
}
```

### Option `--output`

Pour spécifier un emplacement différent pour la queue :

```bash
python scripts/ia_build_queue.py MonAventure.json --output ma_queue.json
```

---

## Étape 2 — Générer les images

```bash
python scripts/ia_generate_images.py <chemin_queue.json> [options]
```

**Exemple :**

```bash
python scripts/ia_generate_images.py adventures/MonAventure/image_ia_queue.json
```

### Options

| Option | Défaut | Description |
|--------|--------|-------------|
| `--batch N` | `1` | Nombre d'images par lot (`0` = tout, `1` = une par une) |
| `--provider NOM` | *(config)* | Provider IA à utiliser (écrase `ia_config.ini`) |
| `--extra-prompt TEXTE` | *(vide)* | Texte ajouté à la fin de chaque prompt |

### Mode interactif (défaut, `--batch 1`)

Le script affiche la prochaine image et demande confirmation :

```
Prochaine : [section 17] section_017.jpeg
  Prompt : Illustration for 'Mon Aventure'...
  Générer ? [O/n/q]
```

- `O` ou Entrée → génère l'image
- `n` → passe à la suivante
- `q` → arrête le script

### Mode lot (`--batch N`)

```bash
# Générer 10 images, puis demander si continuer
python scripts/ia_generate_images.py queue.json --batch 10

# Tout générer sans interruption
python scripts/ia_generate_images.py queue.json --batch 0
```

### Prompt supplémentaire

Permet d'imposer un style visuel cohérent sur toute l'aventure :

```bash
python scripts/ia_generate_images.py queue.json \
  --extra-prompt "dark fantasy, pen and ink, 1980s gamebook illustration style"
```

Le texte est ajouté à la fin de chaque prompt généré automatiquement.

### Ce que fait le script pour chaque image

1. Vérifie que le fichier n'existe pas déjà (idempotent — relançable sans risque)
2. Construit le prompt final (prompt auto + extra-prompt)
3. Appelle le provider IA configuré
4. Sauvegarde l'image dans `repertoire_images/`
5. Met à jour le JSON de l'aventure (ajoute le champ `image` sur la section)
6. Retire la tâche de la queue

---

## Configuration des providers — `ia_config.ini`

Le fichier `scripts/ia_config.ini` définit les providers disponibles et le provider actif.

```ini
[default]
active_provider = pollinations
delay_between_requests = 2.0
timeout = 60
output_format = jpeg
```

### Changer de provider

Modifier `active_provider` dans `[default]`, ou utiliser `--provider` en ligne de commande :

```bash
python scripts/ia_generate_images.py queue.json --provider openai_dalle
```

---

## Providers disponibles

### Pollinations (défaut)

Gratuit, sans clé API, sans inscription.

```ini
[pollinations]
type         = url_template
url_template = https://image.pollinations.ai/prompt/{prompt}?width={width}&height={height}&nologo=true&model=flux
width        = 768
height       = 768
api_key      =
```

**Limites :** throttling possible si trop de requêtes rapides. Le délai `delay_between_requests` (2 secondes par défaut) évite ce problème.

### OpenAI DALL-E 3

Nécessite une clé API OpenAI.

```ini
[openai_dalle]
type    = openai
model   = dall-e-3
width   = 1024
height  = 1024
quality = standard
api_key = sk-votre-clé-ici
```

### Stability AI

Nécessite une clé API Stability AI.

```ini
[stability]
type    = stability
model   = stable-diffusion-xl-1024-v1-0
width   = 1024
height  = 1024
steps   = 30
api_key = sk-votre-clé-ici
```

### Automatic1111 (local)

Instance locale de Stable Diffusion via l'API Automatic1111. Pas de clé API.

```ini
[automatic1111]
type      = automatic1111
base_url  = http://127.0.0.1:7860
model     = v1-5-pruned-emaonly
width     = 512
height    = 512
steps     = 20
cfg_scale = 7
api_key   =
```

### ComfyUI (local)

Instance locale ComfyUI. Pas de clé API.

```ini
[comfyui]
type     = comfyui
base_url = http://127.0.0.1:8188
model    = v1-5-pruned-emaonly.safetensors
width    = 512
height   = 512
steps    = 20
api_key  =
```

---

## Construction des prompts

Les prompts sont générés automatiquement à partir du contenu de l'aventure :

**Sections :**
```
Illustration for '<titre>' [<tags>]. Scene: <200 premiers caractères du texte>
```

**Images spéciales :**
```
Victory scene for '<titre>' [<tags>]. The hero triumphs, epic fantasy illustration.
Defeat screen for '<titre>' [<tags>]. The hero falls, dark fantasy illustration.
```

Le `--extra-prompt` est ajouté à la fin, séparé par un point.

---

## Workflow complet — exemple

```bash
# 1. Construire la queue
python scripts/ia_build_queue.py adventures/MonAventure/MonAventure.json
# → adventures/MonAventure/image_ia_queue.json (ex: 42 tâches)

# 2. Générer par lots de 20 avec un style imposé
python scripts/ia_generate_images.py \
  adventures/MonAventure/image_ia_queue.json \
  --batch 20 \
  --extra-prompt "dark fantasy, pen and ink, highly detailed, 1980s style"

# 3. Relancer si interrompu — les images déjà générées sont ignorées
python scripts/ia_generate_images.py \
  adventures/MonAventure/image_ia_queue.json \
  --batch 0
```

---

## Notes

- La queue est mise à jour après chaque session : les tâches terminées sont retirées.
- Le script est **idempotent** : si un fichier image existe déjà, la tâche est ignorée.
- Les images sont sauvegardées au format JPEG dans le dossier `repertoire_images` de l'aventure.
- Le JSON de l'aventure est mis à jour en temps réel — pas besoin de rescanner.
