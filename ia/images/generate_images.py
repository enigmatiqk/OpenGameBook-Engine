#!/usr/bin/env python3
"""
generate_images.py

Pilote ComfyUI (via son API HTTP) pour générer automatiquement une
illustration par section d'une aventure.

Structure attendue :

    <dir>/ia/style_global.txt               -> bloc STYLE_GLOBAL
    <dir>/ia/univers_global.txt             -> bloc UNIVERS_GLOBAL
    <dir>/ia/seeds.txt                      -> une ligne par seed du workflow
                                                ComfyUI (2 lignes attendues :
                                                voir SEED_NODE_TITLES ci-dessous),
                                                vide = seed aléatoire à chaque
                                                génération. Ces seeds sont
                                                globales pour tout l'appel,
                                                pas spécifiques à une section.
    <dir>/ia/context_section_XXX.txt        -> optionnel, contexte spécifique à
                                                la section numéro XXX

    <dir>/livre.json                        -> {"intro": {"texte": "..."}}
    <dir>/sections.json                     -> {"sections": [
                                                    {"numero": 1, "texte": "...",
                                                     "image_ia": "...",      # ajouté par ce script
                                                    }, ...]}
    <dir>/images/                           -> images finales (format/qualité/niveaux
                                                de gris demandés), écrites ici
    <dir>/generated/                        -> PNG bruts tels que produits par
                                                ComfyUI, toujours conservés ici

Usage :
    python generate_images.py /chemin/vers/aventure
    python generate_images.py /chemin/vers/aventure --section 12
    python generate_images.py /chemin/vers/aventure --section 12 --force
    python generate_images.py /chemin/vers/aventure --limit 10
    python generate_images.py /chemin/vers/aventure --start 5 --limit 10
    python generate_images.py /chemin/vers/aventure --format webp --quality 85
    python generate_images.py /chemin/vers/aventure --grayscale
    python generate_images.py /chemin/vers/aventure --section 5 --section-context "texte..."
    python generate_images.py /chemin/vers/aventure --with-heros true
"""

import argparse
import json
import random
import re
import sys
import time
from pathlib import Path

import requests
from PIL import Image


def save_in_format(raw_png_path: Path, dest_path: Path, fmt: str, quality: int, grayscale: bool):
    """Convertit l'image PNG brute (ComfyUI ne produit que du PNG) vers le
    format de sortie demandé, avec conversion optionnelle en niveaux de
    gris. Le fichier PNG brut n'est jamais supprimé (conservé dans
    generated/) — cette fonction ne fait qu'écrire dest_path."""
    img = Image.open(raw_png_path)

    if grayscale:
        img = img.convert("L")

    if fmt == "png":
        img.save(dest_path, format="PNG")
    elif fmt == "jpg":
        img = img.convert("RGB") if not grayscale else img  # JPEG ne supporte pas la transparence
        img.save(dest_path, format="JPEG", quality=quality, optimize=True)
    elif fmt == "webp":
        img.save(dest_path, format="WEBP", quality=quality)
    else:
        raise ValueError(f"Format de sortie non supporté : {fmt}")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

COMFYUI_URL = "http://127.0.0.1:8188"
DEFAULT_WORKFLOW_NAME = "livre_heros_section_image_generator.json"
DEFAULT_IMAGE_NAME = "ia_section_"
# IA_DIR est calculé dans main() à partir de l'argument "dir" (pas une
# constante fixe) : voir plus bas, IA_DIR = args.dir / "ia"
IA_DIR = None
# Titres des nodes "seed" du workflow, dans l'ordre attendu des lignes de
# ia/seeds.txt. Vérifie dans ton workflow_api.json s'il y a bien 2 nodes
# seed distincts (ex: un pour chaque QwenVL) et ajuste cette liste/leurs
# titres si besoin.
SEED_NODE_TITLES = ["INPUT_SEED", "INPUT_SEED_1"]
POLL_INTERVAL_SECONDS = 2
POLL_TIMEOUT_SECONDS = 600  # 10 minutes max par image

# Nom du champ ("input") à modifier pour chaque node, selon son type dans
# ton workflow_api.json réel. À corriger ici si un des noms ne correspond
# pas (ouvre le JSON exporté et regarde la clé sous "inputs" pour le node
# portant ce titre).
NODE_INPUT_KEYS = {
    "INPUT_CONTEXT": "value",
    "INPUT_SECTION_TEXT": "value",
    "INPUT_STYLE_GLOBAL": "value",
    "INPUT_UNIVERS_GLOBAL": "value",
    "INPUT_CONTEXT_SECTION": "value",
    "INPUT_SECTION_NUM": "value",
    "INPUT_IMAGE_NAME": "value",
    "INPUT_WITH_HEROS": "value",
    "INPUT_SEED": "seed",
    "INPUT_SEED_1": "seed",
}


# ---------------------------------------------------------------------------
# Chargement des fichiers du projet
# ---------------------------------------------------------------------------

def load_book_dir(book_dir: Path):
    livre_path = book_dir / "livre.json"
    sections_path = book_dir / "sections.json"
    style_path = IA_DIR / "style_global.txt"
    univers_path = IA_DIR / "univers_global.txt"

    for p in (livre_path, sections_path, style_path, univers_path):
        if not p.exists():
            sys.exit(f"[ERREUR] Fichier manquant : {p}")

    livre = json.loads(livre_path.read_text(encoding="utf-8"))
    sections_data = json.loads(sections_path.read_text(encoding="utf-8"))
    style_global = style_path.read_text(encoding="utf-8").strip()
    univers_global = univers_path.read_text(encoding="utf-8").strip()

    context = livre.get("intro", {}).get("texte", "")
    if not context:
        sys.exit("[ERREUR] livre.json ne contient pas intro.texte")

    if "sections" not in sections_data:
        sys.exit("[ERREUR] sections.json ne contient pas la clé 'sections'")

    return context, style_global, univers_global, sections_data, sections_path


def save_sections(sections_data, sections_path: Path):
    sections_path.write_text(
        json.dumps(sections_data, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def load_seeds():
    """
    Retourne un dict {titre_du_node_seed: seed_ou_None}, lu depuis
    ia/seeds.txt : la ligne 1 correspond à SEED_NODE_TITLES[0], la ligne 2 à
    SEED_NODE_TITLES[1], etc. Ligne vide ou absente = None (une seed
    aléatoire sera générée à chaque génération pour ce node). Ces seeds
    sont globales : les mêmes valeurs sont utilisées pour TOUTES les
    sections traitées dans cet appel.
    """
    seeds_path = IA_DIR / "seeds.txt"
    seeds = {title: None for title in SEED_NODE_TITLES}
    if not seeds_path.exists():
        return seeds

    lines = seeds_path.read_text(encoding="utf-8").splitlines()
    for i, title in enumerate(SEED_NODE_TITLES):
        if i < len(lines) and lines[i].strip():
            try:
                seeds[title] = int(lines[i].strip())
            except ValueError:
                print(f"[AVERTISSEMENT] Ligne {i + 1} de seeds.txt invalide pour {title}, seed aléatoire utilisée.")
                seeds[title] = None
    return seeds


def load_context_section(numero: int, cli_override: str | None):
    """
    Priorité : option --section-context (cli_override) > fichier
    ia/context_section_XXX.txt > chaîne vide.
    """
    if cli_override is not None:
        return cli_override
    file_path = IA_DIR / f"context_section_{str(numero).zfill(3)}.txt"
    if file_path.exists():
        return file_path.read_text(encoding="utf-8").strip()
    return ""


# ---------------------------------------------------------------------------
# Pilotage de ComfyUI via l'API
# ---------------------------------------------------------------------------

def load_workflow(workflow_path: Path):
    if not workflow_path.exists():
        sys.exit(f"[ERREUR] Workflow API introuvable : {workflow_path}")
    return json.loads(workflow_path.read_text(encoding="utf-8"))


def find_node_id_by_title(workflow, title):
    for node_id, node in workflow.items():
        if node.get("_meta", {}).get("title") == title:
            return node_id
    raise ValueError(
        f"Node '{title}' introuvable dans le workflow. "
        f"Vérifie que ce titre exact a bien été donné au node dans ComfyUI."
    )


def set_node_input(workflow, title, value, optional=False):
    """Met à jour un input du node portant ce titre. Si optional=False
    (par défaut), une erreur explicite est levée si le titre est
    introuvable — pour ne JAMAIS échouer silencieusement sur un
    branchement essentiel (style, univers, contexte...)."""
    try:
        node_id = find_node_id_by_title(workflow, title)
    except ValueError:
        if optional:
            return
        raise
    key = NODE_INPUT_KEYS.get(title, "text")
    if key not in workflow[node_id]["inputs"]:
        print(f"  [AVERTISSEMENT] Le node '{title}' n'a pas de clé '{key}' dans "
              f"ses inputs. Clés disponibles : {list(workflow[node_id]['inputs'].keys())}")
    workflow[node_id]["inputs"][key] = value


def queue_prompt(workflow):
    resp = requests.post(f"{COMFYUI_URL}/prompt", json={"prompt": workflow})
    resp.raise_for_status()
    return resp.json()["prompt_id"]


def wait_for_completion(prompt_id):
    start = time.time()
    while True:
        if time.time() - start > POLL_TIMEOUT_SECONDS:
            raise TimeoutError(f"Timeout en attendant le prompt {prompt_id}")
        resp = requests.get(f"{COMFYUI_URL}/history/{prompt_id}")
        resp.raise_for_status()
        history = resp.json()
        if prompt_id in history:
            return history[prompt_id]
        time.sleep(POLL_INTERVAL_SECONDS)


def extract_image_info(history_entry):
    """Cherche la première image produite dans les outputs de l'historique."""
    status = history_entry.get("status", {})
    status_str = status.get("status_str")
    messages = status.get("messages", [])

    if status_str == "error" or any(m[0] == "execution_error" for m in messages):
        error_details = json.dumps(messages, ensure_ascii=False, indent=2)
        raise RuntimeError(
            f"Le workflow a échoué côté ComfyUI (status={status_str}).\n"
            f"Détails :\n{error_details}"
        )

    outputs = history_entry.get("outputs", {})
    for node_output in outputs.values():
        images = node_output.get("images")
        if images:
            return images[0]

    raise RuntimeError(
        "Aucune image trouvée dans les outputs du workflow, et aucune erreur "
        "explicite détectée. Contenu brut de l'historique pour diagnostic :\n"
        + json.dumps(history_entry, ensure_ascii=False, indent=2)
    )


def download_image(image_info, dest_path: Path):
    params = {
        "filename": image_info["filename"],
        "subfolder": image_info.get("subfolder", ""),
        "type": image_info.get("type", "output"),
    }
    resp = requests.get(f"{COMFYUI_URL}/view", params=params, stream=True)
    resp.raise_for_status()
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    with open(dest_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)


# ---------------------------------------------------------------------------
# Génération d'une section
# ---------------------------------------------------------------------------

def generate_section_image(
    workflow_template,
    context,
    style_global,
    univers_global,
    section,
    image_name_prefix,
    images_dir: Path,
    generated_dir: Path,
    seeds: dict,
    with_heros,
    section_context_override,
    output_format,
    quality,
    grayscale,
):
    numero = section["numero"]
    texte = section.get("texte", "")
    contexte_section = load_context_section(numero, section_context_override)

    resolved_seeds = {}
    for title, seed in seeds.items():
        if seed is None:
            seed = random.randint(0, 2**32 - 1)
        resolved_seeds[title] = seed

    workflow = json.loads(json.dumps(workflow_template))  # copie profonde

    set_node_input(workflow, "INPUT_CONTEXT", context)
    set_node_input(workflow, "INPUT_SECTION_TEXT", texte)
    set_node_input(workflow, "INPUT_STYLE_GLOBAL", style_global)
    set_node_input(workflow, "INPUT_UNIVERS_GLOBAL", univers_global)
    set_node_input(workflow, "INPUT_CONTEXT_SECTION", contexte_section)
    # set_node_input(workflow, "INPUT_SECTION_NUM", numero)
    # set_node_input(workflow, "INPUT_IMAGE_NAME", image_name_prefix)
    set_node_input(workflow, "INPUT_WITH_HEROS", with_heros)
    for title, seed in resolved_seeds.items():
        set_node_input(workflow, title, seed, optional=True)

    print(f"  -> envoi à ComfyUI (section {numero}, seeds={resolved_seeds}, with_heros={with_heros})...")
    prompt_id = queue_prompt(workflow)

    print(f"  -> attente de la génération (prompt_id={prompt_id})...")
    history_entry = wait_for_completion(prompt_id)

    image_info = extract_image_info(history_entry)

    base_name = f"{image_name_prefix}{str(numero).zfill(3)}"
    raw_png_path = generated_dir / f"{base_name}.png"
    download_image(image_info, raw_png_path)
    print(f"  -> PNG brut conservé : {raw_png_path}")

    # Pas de conversion nécessaire si format=png ET pas de niveaux de gris :
    # on copie simplement le PNG brut tel quel dans images/.
    needs_conversion = (output_format != "png") or grayscale
    ext = "jpg" if output_format == "jpg" else output_format
    final_name = f"{base_name}.{ext}"
    dest_path = images_dir / final_name

    if needs_conversion:
        save_in_format(raw_png_path, dest_path, output_format, quality, grayscale)
    else:
        dest_path.write_bytes(raw_png_path.read_bytes())

    print(f"  -> image finale sauvegardée : {dest_path}")
    return final_name


# ---------------------------------------------------------------------------
# Programme principal
# ---------------------------------------------------------------------------

def parse_bool(value):
    if value.lower() in ("true", "1", "yes", "oui"):
        return True
    if value.lower() in ("false", "0", "no", "non"):
        return False
    raise argparse.ArgumentTypeError(f"Valeur booléenne invalide : {value}")


def main():
    parser = argparse.ArgumentParser(
        description="Génère les illustrations d'une aventure via ComfyUI."
    )
    parser.add_argument(
        "dir", type=Path,
        help="Dossier de l'aventure (contenant livre.json, sections.json, "
             "et un sous-dossier ia/ avec style_global.txt, univers_global.txt, "
             "seeds.txt, context_section_XXX.txt)",
    )
    parser.add_argument(
        "--workflow", type=Path, default=None,
        help="Chemin vers le workflow API JSON (par défaut : "
             f"{DEFAULT_WORKFLOW_NAME} à côté de ce script)",
    )
    parser.add_argument(
        "--section", type=int, default=None,
        help="Ne traiter que ce numéro de section précis",
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Regénérer même si sections[].image_ia est déjà renseigné",
    )
    parser.add_argument(
        "--start", type=int, default=None,
        help="Ne traiter que les sections dont le numéro est >= à cette "
             "valeur (combinable avec --limit). Ignoré si --section est utilisé.",
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Nombre maximum d'images à générer sur cet appel",
    )
    parser.add_argument(
        "--image-name", type=str, default=DEFAULT_IMAGE_NAME,
        help=f"Préfixe du nom de fichier image (défaut : {DEFAULT_IMAGE_NAME})",
    )
    parser.add_argument(
        "--section-context", type=str, default=None,
        help="Force le contexte local de la section (prioritaire sur "
             "context_section_XXX.txt). À utiliser typiquement avec --section.",
    )
    parser.add_argument(
        "--with-heros", type=parse_bool, default=None,
        help="Force INPUT_WITH_HEROS à true/false pour toutes les sections "
             "traitées dans cet appel. Par défaut : true uniquement pour la "
             "section numéro 1, false pour toutes les autres.",
    )
    parser.add_argument(
        "--format", type=str, choices=["png", "jpg", "webp"], default="png",
        help="Format de sortie des images (défaut : png, sans perte)",
    )
    parser.add_argument(
        "--quality", type=int, default=90,
        help="Qualité de compression 1-100 pour jpg/webp (ignoré pour png, "
             "qui est sans perte). Défaut : 90.",
    )
    parser.add_argument(
        "--grayscale", action="store_true",
        help="Convertir les images finales en niveaux de gris. Le PNG brut "
             "couleur reste conservé tel quel dans generated/.",
    )
    args = parser.parse_args()

    book_dir = args.dir
    if not book_dir.is_dir():
        sys.exit(f"[ERREUR] Dossier introuvable : {book_dir}")

    global IA_DIR
    IA_DIR = book_dir / "ia"

    workflow_path = args.workflow or (Path(__file__).parent / DEFAULT_WORKFLOW_NAME)
    workflow_template = load_workflow(workflow_path)

    context, style_global, univers_global, sections_data, sections_path = load_book_dir(book_dir)
    images_dir = book_dir / "images"
    generated_dir = book_dir / "generated"
    images_dir.mkdir(parents=True, exist_ok=True)
    generated_dir.mkdir(parents=True, exist_ok=True)

    sections = sections_data["sections"]
    seeds = load_seeds()

    if args.section is not None:
        sections_to_check = [s for s in sections if s.get("numero") == args.section]
        if not sections_to_check:
            sys.exit(f"[ERREUR] Section {args.section} introuvable dans sections.json")
    else:
        sections_to_check = sorted(sections, key=lambda s: s.get("numero", 0))
        if args.start is not None:
            sections_to_check = [s for s in sections_to_check if s.get("numero", 0) >= args.start]

    pending = []
    for s in sections_to_check:
        if s.get("redirection"):
            continue
        already_done = bool(s.get("image_ia"))
        if already_done and not args.force:
            continue
        pending.append(s)

    if args.limit is not None:
        pending = pending[: args.limit]

    if not pending:
        print("Rien à générer (toutes les sections concernées ont déjà une image).")
        return

    print(f"{len(pending)} section(s) à générer.\n")

    generated_count = 0
    failed = []

    for section in pending:
        numero = section["numero"]

        if args.with_heros is not None:
            with_heros = args.with_heros
        else:
            with_heros = (numero == 1)

        print(f"[Section {numero}] Génération en cours...")
        try:
            final_name = generate_section_image(
                workflow_template,
                context,
                style_global,
                univers_global,
                section,
                args.image_name,
                images_dir,
                generated_dir,
                seeds,
                with_heros,
                args.section_context,
                args.format,
                args.quality,
                args.grayscale,
            )
            section["image_ia"] = final_name
            save_sections(sections_data, sections_path)  # sauvegarde après CHAQUE image
            generated_count += 1
        except Exception as e:
            print(f"  [ERREUR] Section {numero} : {e}")
            failed.append(numero)

    print(f"\nTerminé. {generated_count} image(s) générée(s).")
    if failed:
        print(f"Sections en échec (à revoir) : {failed}")


if __name__ == "__main__":
    main()
