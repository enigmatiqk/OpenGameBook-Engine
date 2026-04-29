#!/usr/bin/env python3
"""
Script 1 : parse le JSON d'une aventure et génère une queue de tâches
de génération d'images pour les sections sans image, la cover finish,
les images de victoire et de défaite manquantes.

Usage:
    python scripts/build_image_queue.py <chemin_vers_adventure.json> [--output queue.json]
"""

import argparse
import json
import os
import sys


# ── Prompt builder (miroir de ImageGeneratorImpl.buildPrompt) ─────────────────

def build_section_prompt(adventure: dict, section: dict) -> str:
    tags = ", ".join(adventure.get("tags", []))
    titre = adventure.get("titre", "")
    excerpt = section.get("texte", "")[:300].replace("\n", " ")
    return f"Illustration for '{titre}' [{tags}]. Scene: {excerpt}"


def build_special_prompt(adventure: dict, kind: str) -> str:
    tags = ", ".join(adventure.get("tags", []))
    titre = adventure.get("titre", "")
    labels = {
        "finish":  f"Victory scene for '{titre}' [{tags}]. The hero triumphs, epic fantasy illustration.",
        "victoire": f"Victory screen for '{titre}' [{tags}]. Glorious win, fantasy art.",
        "defaite":  f"Defeat screen for '{titre}' [{tags}]. The hero falls, dark fantasy illustration.",
    }
    return labels.get(kind, f"Illustration for '{titre}' [{tags}].")


# ── Helpers ───────────────────────────────────────────────────────────────────

def image_exists(images_dir: str, filename: str | None) -> bool:
    if not filename:
        return False
    return os.path.isfile(os.path.join(images_dir, filename))


def images_list_missing(images_dir: str, filenames: list[str]) -> list[str]:
    """Retourne les noms de fichiers absents de la liste."""
    return [f for f in filenames if not os.path.isfile(os.path.join(images_dir, f))]


# ── Main ──────────────────────────────────────────────────────────────────────

def build_queue(adventure_path: str) -> list[dict]:
    with open(adventure_path, encoding="utf-8") as f:
        adventure = json.load(f)

    images_dir = adventure.get("repertoire_images", "").rstrip("/")
    # Résoudre le chemin relatif depuis la racine du projet
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    abs_images_dir = os.path.join(base_dir, images_dir)

    queue: list[dict] = []

    # ── 1. Sections sans image ────────────────────────────────────────────────
    for section in adventure.get("sections", []):
        num = section.get("numero")
        img = section.get("image")
        if not image_exists(abs_images_dir, img):
            expected_filename = f"section_{num:03d}.jpeg"
            queue.append({
                "type":     "section",
                "numero":   num,
                "filename": expected_filename,
                "prompt":   build_section_prompt(adventure, section),
            })

    # ── 2. Image finish ───────────────────────────────────────────────────────
    finish_img = "finish.jpeg"
    if not image_exists(abs_images_dir, finish_img):
        queue.append({
            "type":     "finish",
            "filename": finish_img,
            "prompt":   build_special_prompt(adventure, "finish"),
        })

    # ── 3. Images victoire ────────────────────────────────────────────────────
    victoire_imgs: list[str] = adventure.get("images_victoire", [])
    if not victoire_imgs:
        # Aucune définie → on en propose une
        queue.append({
            "type":     "victoire",
            "filename": "victoire.jpeg",
            "prompt":   build_special_prompt(adventure, "victoire"),
        })
    else:
        for missing in images_list_missing(abs_images_dir, victoire_imgs):
            queue.append({
                "type":     "victoire",
                "filename": missing,
                "prompt":   build_special_prompt(adventure, "victoire"),
            })

    # ── 4. Images défaite ─────────────────────────────────────────────────────
    defaite_imgs: list[str] = adventure.get("images_defaite", [])
    if not defaite_imgs:
        queue.append({
            "type":     "defaite",
            "filename": "defaite.jpeg",
            "prompt":   build_special_prompt(adventure, "defaite"),
        })
    else:
        for missing in images_list_missing(abs_images_dir, defaite_imgs):
            queue.append({
                "type":     "defaite",
                "filename": missing,
                "prompt":   build_special_prompt(adventure, "defaite"),
            })

    return queue


def main() -> None:
    parser = argparse.ArgumentParser(description="Génère la queue de tâches de génération d'images IA.")
    parser.add_argument("adventure", help="Chemin vers le fichier JSON de l'aventure")
    parser.add_argument("--output", default=None, help="Fichier de sortie (défaut: images_ia_queue.json au même niveau que le JSON)")
    args = parser.parse_args()

    if not os.path.isfile(args.adventure):
        print(f"[ERREUR] Fichier introuvable : {args.adventure}", file=sys.stderr)
        sys.exit(1)

    queue = build_queue(args.adventure)

    output = args.output or os.path.join(os.path.dirname(os.path.abspath(args.adventure)), "images_ia_queue.json")

    with open(output, "w", encoding="utf-8") as f:
        json.dump({
            "adventure_path": args.adventure,
            "total":          len(queue),
            "tasks":          queue,
        }, f, ensure_ascii=False, indent=2)

    print(f"[OK] {len(queue)} tâche(s) écrites dans {output}")
    sections = sum(1 for t in queue if t["type"] == "section")
    specials = len(queue) - sections
    print(f"     {sections} section(s) sans image, {specials} image(s) spéciale(s) manquante(s)")


if __name__ == "__main__":
    main()
