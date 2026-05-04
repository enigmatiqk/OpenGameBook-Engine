"""
CLI entry point for the PDF scanner.

Usage:
    python scanner/main.py <pdf_path> [output_dir]

Scans a gamebook PDF and writes the resulting Adventure JSON to:
    <output_dir>/<adventure_name>/<adventure_name>.json

Default output_dir is "output".
"""

from __future__ import annotations

import os
import sys

# Allow running as `python scanner/main.py` from the project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scanner.pdf_scanner import PDFScanner
from scanner.pretty_printer import PrettyPrinter


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python scanner/main.py <pdf_path> [output_dir]", file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "output"

    scanner = PDFScanner()
    printer = PrettyPrinter()

    try:
        adventure = scanner.scan(pdf_path, output_dir=output_dir)
    except RuntimeError as exc:
        print(f"Erreur : {exc}", file=sys.stderr)
        sys.exit(1)

    # Determine output path
    import re
    adventure_name = re.sub(
        r"[^\w\-]", "_", os.path.splitext(os.path.basename(pdf_path))[0]
    )
    out_dir = os.path.join(output_dir, adventure_name)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{adventure_name}.json")

    printer.save(adventure, out_path)
    print(f"Aventure exportée : {out_path}")
    print(f"  Sections extraites : {len(adventure['sections'])}")


if __name__ == "__main__":
    main()
