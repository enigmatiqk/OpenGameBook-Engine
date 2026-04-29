"""
PrettyPrinter — formats an Adventure dict as indented, human-readable JSON.
"""

from __future__ import annotations

import json
import os


class PrettyPrinter:
    """Format and save Adventure dicts as pretty-printed JSON."""

    def format(self, adventure: dict) -> str:
        """Return an indented JSON string for *adventure*."""
        return json.dumps(adventure, ensure_ascii=False, indent=2)

    def save(self, adventure: dict, output_path: str) -> None:
        """Write the pretty-printed JSON to *output_path*, creating dirs as needed."""
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(self.format(adventure))
            f.write("\n")
