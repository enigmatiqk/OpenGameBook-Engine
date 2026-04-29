"""
Property-based tests for the PDF scanner module.

Property 6 — Validates: Requirements 11.1, 11.2
    For any synthetic text with N numbered sections (N between 1 and 20),
    parse_sections_from_text should return exactly N sections with unique
    numbers and non-empty texts.

Property 1 (Python) — Validates: Requirements 11.7
    For any adventure dict, serialize to JSON and deserialize back — result
    must equal original.
"""

from __future__ import annotations

import json
import sys
import os

import pytest
from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st

# Make the scanner package importable when running from the project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from scanner.pdf_scanner import parse_sections_from_text
from scanner.pretty_printer import PrettyPrinter


# ---------------------------------------------------------------------------
# Helpers / generators
# ---------------------------------------------------------------------------

def _build_synthetic_text(section_numbers: list[int], bodies: list[str]) -> str:
    """
    Build a raw text string that looks like a gamebook with the given sections.
    Each section is rendered as:

        <number>
        <body text>

    A blank line separates sections.
    """
    parts: list[str] = []
    for num, body in zip(section_numbers, bodies):
        # Ensure the body itself does not accidentally contain a standalone
        # number that would be mis-parsed as a section header.
        # We prefix each body line with a space so it never matches the
        # section-header regex (which requires the number to be alone on the line).
        safe_body = "\n".join(" " + line if line.strip().isdigit() else line
                              for line in body.splitlines())
        parts.append(f"{num}\n{safe_body}")
    return "\n\n".join(parts)


# Strategy: a list of N distinct section numbers in [1, 400]
@st.composite
def section_numbers_strategy(draw, min_n: int = 1, max_n: int = 20):
    n = draw(st.integers(min_value=min_n, max_value=max_n))
    numbers = draw(
        st.lists(
            st.integers(min_value=1, max_value=400),
            min_size=n,
            max_size=n,
            unique=True,
        )
    )
    return numbers


# Strategy: non-empty body text that does NOT look like a standalone section header
_safe_text = st.text(
    alphabet=st.characters(
        blacklist_categories=("Cs",),   # no surrogates
        blacklist_characters="\x00",
    ),
    min_size=1,
).filter(lambda t: t.strip() != "" and not t.strip().isdigit())


# ---------------------------------------------------------------------------
# Property 6 — Extraction des sections PDF
# Validates: Requirements 11.1, 11.2
# ---------------------------------------------------------------------------

@given(section_numbers_strategy())
@settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
def test_property6_extract_sections_count_and_uniqueness(section_numbers: list[int]):
    """
    **Validates: Requirements 11.1, 11.2**

    Property 6: For any synthetic text with N numbered sections,
    parse_sections_from_text returns exactly N sections with unique numbers
    and non-empty texts.
    """
    n = len(section_numbers)
    # Generate simple body texts
    bodies = [f"Texte de la section {num}." for num in section_numbers]
    text = _build_synthetic_text(section_numbers, bodies)

    result = parse_sections_from_text(text)

    # Exactly N sections
    assert len(result) == n, (
        f"Expected {n} sections, got {len(result)}. "
        f"Numbers: {section_numbers}"
    )

    # All numbers unique
    result_numbers = [s["numero"] for s in result]
    assert len(result_numbers) == len(set(result_numbers)), (
        f"Duplicate section numbers in result: {result_numbers}"
    )

    # All numbers match the input set
    assert set(result_numbers) == set(section_numbers), (
        f"Section numbers mismatch. Expected {set(section_numbers)}, got {set(result_numbers)}"
    )

    # All texts non-empty
    for sec in result:
        assert sec["texte"].strip() != "", (
            f"Section {sec['numero']} has empty text."
        )


# ---------------------------------------------------------------------------
# Property 1 (Python) — Round-trip de sérialisation d'aventure
# Validates: Requirements 11.7
# ---------------------------------------------------------------------------

# Strategy for a minimal but valid Adventure dict
_stat_def = st.fixed_dictionaries({
    "valeur": st.integers(min_value=0, max_value=30),
    "init": st.sampled_from(["2d6+6", "2d6+12", "1d6+6"]),
    "label": st.text(min_size=1, max_size=20),
})

_choice = st.fixed_dictionaries({
    "texte": st.text(min_size=1, max_size=80),
    "section": st.integers(min_value=1, max_value=400),
})

_section = st.fixed_dictionaries({
    "numero": st.integers(min_value=1, max_value=400),
    "texte": st.text(min_size=1, max_size=500),
    "choix": st.lists(_choice, min_size=0, max_size=5),
})

_personnage = st.fixed_dictionaries({
    "statistiques": st.fixed_dictionaries({
        "habilete": _stat_def,
        "endurance": _stat_def,
        "chance": _stat_def,
    }),
    "inventaire": st.lists(st.text(min_size=1, max_size=30), min_size=0, max_size=10),
})

_regles = st.just({
    "combat": {
        "type": "fighting-fantasy",
        "des_attaque": 2,
        "formule_force_attaque": "habilete + roll",
        "degats_victoire": 2,
        "degats_defaite": 2,
    },
    "victoire": {"sections": [400]},
    "defaite": {"endurance_min": 0},
})

_adventure = st.fixed_dictionaries({
    "titre": st.text(min_size=1, max_size=100),
    "tags": st.lists(st.text(min_size=1, max_size=20), min_size=1, max_size=5),
    "repertoire_images": st.text(min_size=1, max_size=100),
    "image_de_garde": st.text(min_size=1, max_size=50),
    "mode_emploi": st.text(min_size=0, max_size=500),
    "personnage": _personnage,
    "regles": _regles,
    "sections": st.lists(_section, min_size=1, max_size=10),
})


@given(_adventure)
@settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
def test_property1_json_round_trip(adventure: dict):
    """
    **Validates: Requirements 11.7**

    Property 1 (Python): For any adventure dict, serialize to JSON and
    deserialize back — result must equal original.
    """
    printer = PrettyPrinter()
    serialized = printer.format(adventure)
    deserialized = json.loads(serialized)
    assert deserialized == adventure, (
        "Round-trip failed: deserialized object differs from original."
    )
