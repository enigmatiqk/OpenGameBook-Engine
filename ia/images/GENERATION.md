# Génération des images IA d'un livre

Ce document décrit la chaîne complète pour produire automatiquement une
illustration par section d'un livre-jeu (type « Défis Fantastiques ») :
un LLM vision (Qwen2.5-VL) lit le texte de la section et en extrait une
description visuelle structurée, puis le modèle de diffusion **Qwen-Image**
génère l'illustration correspondante, le tout piloté par ComfyUI.

---

## 1. Architecture de la chaîne

```
Section (texte)  ─►  Qwen2.5-VL  ─►  description de scène (JSON)
                     (extraction)        │
                                         ▼
                                  Qwen2.5-VL  ─►  JSON corrigé
                                  (relecture)        │
                                                     ▼
                                          prompt image (positif/négatif)
                                                     │
                                                     ▼
                          Qwen-Image (UNET + VAE + CLIP)  ─►  image
                          + LoRA Lightning (8 étapes rapides)
```

- **Qwen2.5-VL-7B-Instruct** (2 nodes) : transforme le texte narratif de la
  section en un prompt visuel. Premier passage = extraction, second
  passage = relecture/correction du JSON.
- **Qwen-Image** : modèle de diffusion texte→image (UNET fp8 + VAE +
  encodeur de texte Qwen2.5-VL 7B).
- **Qwen-Image-Lightning** (LoRA) : distillation permettant l'échantillonnage
  en 8 étapes au lieu de 28, via un booléen `Enable Lightning LoRA`.

---

## 2. Pré-requis

### 2.1 Python & environnement

- Python 3.10+ recommandé.
- Un venv nommé **`ia`** (créé via `pyenv-win-venv.ps1 activate ia` sur
  Windows, ou `python -m venv` ailleurs).
- Dépendances du pilote (`ia/images/generate_images.py` et
  `ia/images/livre/convert_to_webp.py`) :

  ```bash
  pip install requests Pillow
  ```

### 2.2 ComfyUI

- Installation de ComfyUI (le dossier contenant `main.py`).
- Le venv `ia` doit contenir ComfyUI et ses dépendances ; on le lance avec :

  ```bash
  # depuis le dossier d'installation de ComfyUI
  bash ia/images/start.sh          # = python main.py --listen --port 8188
  ```

  L'API HTTP de ComfyUI doit répondre sur `http://127.0.0.1:8188` (l'URL est
  constante dans `generate_images.py` : `COMFYUI_URL`).

---

## 3. Modèles à télécharger pour ComfyUI

Placer les fichiers dans les dossiers de `ComfyUI/models/` correspondants.
Les noms ci-dessous sont **exactement** ceux référencés par le workflow
`livre_heros_section_image_generator.json` — ils ne doivent pas être renommés.

| Rôle | Fichier | Dossier ComfyUI | Source |
|------|---------|-----------------|--------|
| Diffusion (UNET) | `qwen_image_fp8_e4m3fn.safetensors` | `models/diffusion_models/` | Qwen-Image (fp8) — dépôt officiel `Qwen/Qwen-Image`, version fp8 habituellement mirée par `comfyanonymous` |
| VAE | `qwen_image_vae.safetensors` | `models/vae/` | `Qwen/Qwen-Image` |
| Encodeur de texte (CLIP) | `qwen_2.5_vl_7b_fp8_scaled.safetensors` | `models/clip/` (type `qwen_image`) | `Qwen/Qwen-Image` (text encoder = Qwen2.5-VL-7B, version fp8 scaled) |
| LoRA accélération | `Qwen-Image-Lightning-8steps-V1.0.safetensors` | `models/loras/` | « Qwen-Image-Lightning » (recherche HF) |
| LLM vision | `Qwen2.5-VL-7B-Instruct` (quantization 8-bit) | géré par le node `AILab_QwenVL` | `Qwen/Qwen2.5-VL-7B-Instruct` |

> Les versions fp8/scaled des fichiers Qwen-Image sont des quants adaptés à
> ComfyUI. Si un nom de fichier ne se retrouve pas sur le dépôt officiel
> `Qwen/Qwen-Image`, chercher le miroir `comfyanonymous/Qwen-Image`. En cas
> de doute, vérifier les noms attendus en ouvrant le workflow JSON
> (`livre_heros_section_image_generator.json`) et en regardant les champs
> `unet_name`, `vae_name`, `clip_name`, `lora_name`, `model_name`.

---

## 4. Nodes personnalisés ComfyUI à installer

Via **ComfyUI Manager → Install Custom Nodes**, rechercher puis installer :

| Node (class_type) | Usage |
|-------------------|-------|
| `AILab_QwenVL` | Inference Qwen2.5-VL (extraction + relecture de la scène) |
| `ExecutePython` (clé hachée) | Parse/repair le JSON produit par QwenVL |
| `ComfySwitchNode` | Aiguillage `Enable Lightning LoRA` (8 vs 28 étapes) |
| `ModelSamplingAuraFlow` | Sampling « flow » pour Qwen-Image |
| `PrimitiveStringMultiline`, `PrimitiveBoolean`, `PrimitiveInt`, `PrimitiveFloat` | Primitive texte/bool/int/float (souvent natifs ou via un pack « primitives ») |

Dépendances Python à installer **dans le venv `ia`** (ComfyUI) pour le node
`ExecutePython` :

```bash
pip install json-repair
```

Le node `ExecutePython` est désactivé par défaut pour des raisons de
sécurité (il exécute du code arbitraire). L'activer dans les paramètres de
ComfyUI avant de charger le workflow.

---

## 5. Structure du dossier d'un livre

Le pilote `generate_images.py` prend en argument un **`<book_dir>`** :
le chemin vers le dossier de travail d'une aventure. Dans ce dépôt,
`ia/images/livre/` est le dossier template/exemple qui correspond à ce
`<book_dir>` pour Le Sorcier de la Montagne de Feu.

Structure attendue :

```
<book_dir>/                     # ex. ia/images/livre/ dans ce dépôt
├── ia/
│   ├── style_global.txt        # directives de style (communes à tout le livre)
│   ├── univers_global.txt      # description de l'univers (commune)
│   ├── seeds.txt               # 2 lignes = seeds des 2 nodes QwenVL (vide = aléatoire)
│   └── context_section_XXX.txt # optionnel : contexte local de la section XXX
├── generated/                  # créé — PNG bruts ComfyUI (conservés)
└── images/                     # créé — images finales (format/qualité demandés)
```

> **`livre.json` et `sections.json` ne sont pas des fichiers physiques de
> ce dossier.** Ils proviennent du répertoire de l'aventure (source de
> vérité, ex. `adventures/Defis_Fantastiques_01_-_Le_Sorcier_de_la_Montagne_de_feu/`)
> et ne doivent ni être dupliqués ni utilisés tels quels comme copies
> locales dans le workspace de génération. Le pilote les lit depuis le
> répertoire de l'aventure — voir § 5.2.

### 5.1 Fichiers de prompts (`ia/`)

- **`style_global.txt`** — directives de composition/style applicables à
  toutes les sections (ex. : composition épurée, peu de décor).
- **`univers_global.txt`** — univers global (ex. : heroic fantasy
  sombre médiéval, créatures grotesques). Des variantes existent :
  `style_global_realiste.txt`, `univers_global_realiste.txt` (style plus
  réaliste), et `.new_style` (brouillons d'itération).
- **`seeds.txt`** — une ligne par node seed QwenVL (2 attendues), dans
  l'ordre de `SEED_NODE_TITLES` (`INPUT_SEED`, `INPUT_SEED_1`). Une ligne
  vide = seed aléatoire à chaque génération. Les seeds sont **globales**
  (mêmes valeurs pour toutes les sections d'un même appel).
- **`context_section_XXX.txt`** — optionnel, contexte spécifique à la
  section numérotée `XXX` (surchargeable via `--section-context`).

### 5.2 Données (`livre.json`, `sections.json`) — issues de l'aventure

`livre.json` et `sections.json` appartiennent au **répertoire de
l'aventure** (ex. `adventures/Defis_Fantastiques_01_-_Le_Sorcier_de_la_Montagne_de_feu/`),
qui est la source de vérité du livre. Le pipeline de génération les lit
depuis là.

- Ils **ne doivent pas être dupliqués physiquement** dans le workspace de
  génération (`<book_dir>`, ex. `ia/images/livre/`), ni utilisés tels quels
  comme copies locales autonomes : une copie figerait une version qui dérive
  de l'aventure réelle. Pour les mettre à disposition du pilote sans les
  copier, les référencer depuis le répertoire de l'aventure (par ex. un
  lien/symlink `<book_dir>/livre.json` → `adventures/.../livre.json`,
  ou pointer le pilote directement vers le dossier de l'aventure comme
  `<book_dir>`).
- `livre.json` doit contenir `intro.texte` (contexte global du livre, servi
  au LLM).
- `sections.json` doit contenir un tableau `sections` dont chaque entrée a
  au moins `numero` et `texte`. Le champ `image_ia` est **ajouté** par le
  pilote, directement dans le `sections.json` de l'aventure (via la
  référence), avec le nom du fichier image généré.

---

## 6. Le workflow ComfyUI

Le fichier `ia/images/livre_heros_section_image_generator.json` est le
workflow **exporté au format API** de ComfyUI. C'est lui que le pilote
envoie à `/prompt`.

Les nodes d'entrée attendus par le pilote (reconnus par leur `_meta.title`) :

| Title du node | Rôle | Rempli par |
|---------------|------|-----------|
| `INPUT_CONTEXT` | intro du livre | `livre.json → intro.texte` (depuis l'aventure) |
| `INPUT_SECTION_TEXT` | texte de la section | `sections.json` (depuis l'aventure) |
| `INPUT_STYLE_GLOBAL` | style global | `ia/style_global.txt` |
| `INPUT_UNIVERS_GLOBAL` | univers global | `ia/univers_global.txt` |
| `INPUT_CONTEXT_SECTION` | contexte local | `ia/context_section_XXX.txt` ou `--section-context` |
| `INPUT_WITH_HEROS` | présence du héros dans l'image | true pour la section 1, false sinon (sauf `--with-heros`) |
| `INPUT_SEED`, `INPUT_SEED_1` | seeds QwenVL | `ia/seeds.txt` (ou aléatoire) |

Pour adapter à un autre modèle ou modifier les nodes : exporter ton propre
workflow depuis l'UI ComfyUI (menu **Save (API Format)**) et le passer via
`--workflow <fichier.json>`. Vérifier alors la cohérence des titres de nodes
et des clés d'inputs (`NODE_INPUT_KEYS` en haut de `generate_images.py`).

---

## 7. Étapes de génération

### 7.1 Lancer ComfyUI

```bash
# depuis le dossier d'installation de ComfyUI
bash ia/images/start.sh
```

Vérifier que `http://127.0.0.1:8188` répond.

### 7.2 Générer les images

Depuis `ia/images/` :

```bash
# tout générer (sections sans image_ia), en PNG sans perte
python generate_images.py livre

# ne générer qu'une section (avec regénération forcée)
python generate_images.py livre --section 12 --force

# une plage de sections
python generate_images.py livre --start 5 --limit 10

# directement en webp qualité 70 (≈ qualité déployée dans le moteur)
python generate_images.py livre --format webp --quality 70

# niveaux de gris
python generate_images.py livre --grayscale

# forcer la présence du héros sur toutes les sections de l'appel
python generate_images.py livre --with-heros true

# contexte local ponctuel pour une section
python generate_images.py livre --section 5 --section-context "Le héros franchit une rivière en bac"
```

> L'argument `livre` dans les exemples ci-dessus désigne `<book_dir>`,
> c'est-à-dire le dossier template/exemple `ia/images/livre/` dans ce dépôt.
> Remplacer par le chemin réel du `<book_dir>` cible pour une autre aventure.
> Ce dossier doit fournir `livre.json` et `sections.json` **sourcés du
> répertoire de l'aventure** (cf. § 5.2) — pas des copies physiques.

Comportement important :
- Les sections déjà pourvues d'un `image_ia` sont **ignorées** sauf `--force`.
- Les sections marquées `redirection` sont ignorées.
- Le PNG brut est toujours conservé dans `<book_dir>/generated/`, l'image
  finale dans `<book_dir>/images/`.
- `sections.json` est sauvegardé **après chaque image** (reprise sûre) —
  l'écriture se fait dans le `sections.json` de l'aventure via la référence.

### 7.3 Convertir en webp (si généré en PNG)

`generate_images.py` peut sortir directement en webp (`--format webp`).
Sinon, convertir a posteriori (depuis `<book_dir>/`, ex. `ia/images/livre/`) :

```bash
# aperçu sans rien écrire
python convert_to_webp.py --dry-run

# conversion qualité 70 + mise à jour de sections.json
python convert_to_webp.py --quality 70

# conversion en niveaux de gris (le PNG couleur reste dans generated/)
python convert_to_webp.py --quality 70 --grayscale
```

`convert_to_webp.py` lit `generated/*.png`, écrit `images/*.webp` et met à
jour `image_ia` dans `sections.json` (celui de l'aventure, via la référence).

### 7.4 Déployer dans l'aventure du moteur

Les images finales utilisées par le moteur vivent dans le dossier de
l'aventure, qui est aussi la source de vérité des données :

```
adventures/Defis_Fantastiques_01_-_Le_Sorcier_de_la_Montagne_de_feu/
├── livre.json           # source de vérité (intro, etc.)
├── sections.json        # mis à jour par le pilote : image_ia = "ia_section_001.webp" …
└── images/              # les webp (qualité 70) à y placer
```

`sections.json` est mis à jour **directement dans le dossier de
l'aventure** par le pilote (via la référence, cf. § 5.2) — aucune recopie
depuis le workspace. Pour les images, si elles n'ont pas été générées
directement dans le dossier `images/` de l'aventure, les y copier :

```bash
cp <dossier_images_generees>/ia_section_*.webp \
   adventures/Defis_Fantastiques_01_-_Le_Sorcier_de_la_Montagne_de_feu/images/
```

> Vérifier la cohérence : le moteur référence `image_ia` par nom de fichier
> relatif dans `images/` de l'aventure. La qualité effectivement déployée
> dans ce projet est **70**.

---

## 8. Astuces

- **Reprise** : le pilote saute les sections déjà illustrées ; relancer la
  même commande ne régénère que les manquantes (sauf `--force`).
- **Seeds** : pour reproduire une illustration exactement, fixer les deux
  lignes de `seeds.txt`. Mettre une ligne vide pour varier.
- **Héros** : par défaut le héros est présent uniquement sur la section 1
  (`with_heros = (numero == 1)`). `--with-heros true/false` force pour tout
  l'appel.
- **Coût/temps** : avec la LoRA Lightning (8 étapes), une image prend ~15–30 s
  selon le GPU ; sans Lightning (28 étapes), ~2–4× plus lent.
- **Diagnostic** : si une section échoue, le pilote la liste en fin de run
  (« Sections en échec »). Consuler l'historique ComfyUI (`/history`) pour
  le détail ; `extract_image_info` affiche le JSON brut en cas d'absence
  d'image.

---

## 9. Récapitulatif des fichiers

| Fichier | Rôle |
|---------|------|
| `ia/images/start.sh` | Lance ComfyUI (équivalent bash de `start.ps1`) |
| `ia/images/start.ps1` | Lance ComfyUI (Windows / PowerShell) |
| `ia/images/generate_images.py` | Pilote ComfyUI → 1 image/section |
| `ia/images/livre_heros_section_image_generator.json` | Workflow ComfyUI (API format) |
| `ia/images/livre/convert_to_webp.py` | PNG → webp + maj `sections.json` |
| `ia/images/livre/ia/*.txt` | Prompts (style, univers, seeds, contextes) |
| `adventures/.../livre.json` | Données du livre (intro, etc.) — source de vérité, non dupliquée |
| `adventures/.../sections.json` | Sections + champ `image_ia` — source de vérité, non dupliquée |

> Note : le dossier `ia/` est gitignoré (`ia` dans `.gitignore`). La chaîne
> de génération et les sorties lourdes (`generated/`, webp, `tests/`,
> anciennes configs) vivent dans `ia/images/` (actifs) et `ia/images_old/`
> (archive). Ce document lui-même n'est pas versionné tant qu'il reste
> dans `ia/images/` — le déplacer dans `docs/` pour le partager via git.
