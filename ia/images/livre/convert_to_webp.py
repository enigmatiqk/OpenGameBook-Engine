#!/usr/bin/env python3
"""
convert_to_webp.py

À placer et exécuter DEPUIS le dossier d'une aventure (celui qui contient
generated/, images/, sections.json), généré par generate_images.py.

Convertit chaque PNG de generated/ vers images/<meme_nom>.webp, et met à
jour sections[].image_ia dans sections.json avec le nouveau nom de fichier.

Le numéro de section est déduit du nom de fichier PNG (les derniers
chiffres avant ".png"), par exemple "ia_section_007.png" -> section 7.

Usage :
    python convert_to_webp.py --dry-run
    python convert_to_webp.py
    python convert_to_webp.py --quality 85
"""

import argparse
import json
import re
import sys
from pathlib import Path

from PIL import Image

GENERATED_DIR = Path("generated")
IMAGES_DIR = Path("images")
SECTIONS_PATH = Path("sections.json")

NUMERO_RE = re.compile(r"(\d+)\.png$", re.IGNORECASE)


def extract_numero(filename: str):
    match = NUMERO_RE.search(filename)
    if not match:
        return None
    return int(match.group(1))


def main():
    parser = argparse.ArgumentParser(
        description="Convertit generated/*.png en webp dans images/, met à jour sections.json."
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="N'écrit rien : liste seulement les images trouvées et le numéro "
             "de section détecté pour chacune.",
    )
    parser.add_argument(
        "--quality", type=int, default=90,
        help="Qualité de compression webp, 1-100 (défaut : 90).",
    )
    parser.add_argument(
        "--grayscale", action="store_true",
        help="Convertir les images finales en niveaux de gris. Le PNG brut "
             "couleur reste conservé tel quel dans generated/.",
    )
    args = parser.parse_args()

    if not GENERATED_DIR.is_dir():
        sys.exit(f"[ERREUR] Dossier introuvable : {GENERATED_DIR} "
                  f"(lance ce script depuis le dossier de l'aventure)")
    if not SECTIONS_PATH.exists():
        sys.exit(f"[ERREUR] Fichier introuvable : {SECTIONS_PATH}")

    sections_data = json.loads(SECTIONS_PATH.read_text(encoding="utf-8"))
    sections_by_numero = {s["numero"]: s for s in sections_data.get("sections", [])}

    png_files = sorted(GENERATED_DIR.glob("*.png"))
    if not png_files:
        print(f"Aucun PNG trouvé dans {GENERATED_DIR}/")
        return

    print(f"{len(png_files)} image(s) trouvée(s) dans {GENERATED_DIR}/\n")

    if not args.dry_run:
        IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    converted_count = 0
    skipped = []

    for png_path in png_files:
        numero = extract_numero(png_path.name)

        if numero is None:
            print(f"  [IGNORÉ] {png_path.name} : numéro de section introuvable dans le nom.")
            skipped.append(png_path.name)
            continue

        if numero not in sections_by_numero:
            print(f"  [IGNORÉ] {png_path.name} -> section {numero} introuvable dans sections.json.")
            skipped.append(png_path.name)
            continue

        webp_name = png_path.stem + ".webp"
        dest_path = IMAGES_DIR / webp_name

        if args.dry_run:
            print(f"  [DRY-RUN] {png_path.name} -> section {numero} -> {dest_path}")
            continue

        img = Image.open(png_path)

        if args.grayscale:
            img = img.convert("L")

        img.save(dest_path, format="WEBP", quality=args.quality)

        sections_by_numero[numero]["image_ia"] = webp_name
        converted_count += 1
        print(f"  -> {png_path.name} -> section {numero} -> {dest_path}")

    if args.dry_run:
        print(f"\n[DRY-RUN] {len(png_files) - len(skipped)} image(s) seraient converties, "
              f"{len(skipped)} ignorée(s). Aucun fichier n'a été modifié.")
        return

    SECTIONS_PATH.write_text(
        json.dumps(sections_data, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"\nTerminé. {converted_count} image(s) convertie(s) et sections.json mis à jour.")
    if skipped:
        print(f"Ignorées ({len(skipped)}) : {skipped}")


if __name__ == "__main__":
    main()
