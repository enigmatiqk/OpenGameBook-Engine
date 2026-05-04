"""
PDFScanner — extracts gamebook content from a PDF file and produces
an Adventure-compatible dict (matching the TypeScript Adventure type).

Uses:
  - pdfplumber  for text extraction
  - PyMuPDF (fitz) for image extraction
"""

from __future__ import annotations

import os
import re
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Regex patterns for section / choice detection
# ---------------------------------------------------------------------------

# Strict: number ALONE on its line (most common in well-formatted PDFs)
_SECTION_HEADER_RE = re.compile(r"^\s*([1-9]\d{0,2})\s*[.:]?\s*$")

# Inline: number at start of line followed by text on the same line
# e.g. "42 Vous entrez dans la pièce..." or "3. La cloche tinte..."
# Group 1 = number, Group 2 = inline text
# Must start with a capital letter to avoid matching things like "50 Pièces d'Or"
_SECTION_HEADER_INLINE_RE = re.compile(r"^\s*([1-9]\d{0,2})[.:\s]\s*([A-Z].{5,})$")

# Choice patterns (French gamebook conventions)
# Handles:
#   - "Rendez-vous au 42"
#   - "Rendez-vous dans ce cas au 272"  (with filler words)
#   - "rendez-vouis au 367"             (OCR typo)
#   - "Tournez au paragraphe 17"
#   - "Allez au 99", "Passez au 12", "Reportez-vous au 5"
#   - "vous irez alors au 127"          (indirect reference)
#   - "vous rendre au 267"              (alternative form)
#   - "en vous rendant au 177"          (gerund form)
_CHOICE_RE = re.compile(
    r"(?:"
    r"[Rr]endez-vou[a-z]*\s+(?:\w+\s+){0,4}?au\s+(\d+)"
    r"|[Vv]ous\s+rendre?\s+(?:\w+\s+){0,3}?au\s+(\d+)"
    r"|en\s+vous\s+rendant\s+(?:\w+\s+){0,3}?au\s+(\d+)"
    r"|[Tt]ournez\s+(?:au\s+paragraphe\s+|à\s+la\s+section\s+)?(\d+)"
    r"|[Aa]llez\s+(?:au\s+|en\s+)?(?:paragraphe\s+)?(\d+)"
    r"|[Pp]assez\s+au\s+(?:paragraphe\s+)?(\d+)"
    r"|[Rr]eportez-vous\s+au\s+(?:paragraphe\s+)?(\d+)"
    r"|(?:irez|allez|aller)\s+(?:\w+\s+){0,3}?au\s+(\d+)"
    r")",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _first_group(m: re.Match) -> Optional[int]:
    """Return the first non-None captured group as int."""
    for g in m.groups():
        if g is not None:
            return int(g)
    return None


def _detect_section_end(text: str) -> Optional[str]:
    """Detect if a section is a final section (victoire or defaite)."""
    # Normalize text for matching
    normalized = text.lower().strip()
    
    # Victory patterns
    victory_patterns = [
        r"vous avez gagn",
        r"vous avez réussi",
        r"vous avez triomph",
        r"vous êtes devenu",
        r"vous devenez le maître",
        r"vous avez obtenu le trésor",
        r"vous avez trouvé le trésor",
        r"fin heureuse",
        r"victoire",
    ]
    
    # Defeat patterns
    defeat_patterns = [
        r"votre aventure est termin",
        r"vous êtes mort",
        r"vous avez échou",
        r"vous avez perdu",
        r"fin tragique",
        r"défaite",
        r"vous ne reverrez jamais",
    ]
    
    for pattern in victory_patterns:
        if re.search(pattern, normalized):
            return "victoire"
    
    for pattern in defeat_patterns:
        if re.search(pattern, normalized):
            return "defaite"
    
    return None


def parse_sections_from_text(text: str) -> list[dict]:
    """
    Parse raw text into a list of section dicts: {numero, texte, choix, type?}.

    Handles two common formats found in French gamebook PDFs:
      1. Number alone on its line, text on following lines:
            "1\\nVos deux jours de marche..."
      2. Number at start of line followed by text on the same line:
            "42 Vous entrez dans la pièce..."

    Also handles hyphenated line breaks (e.g. "Rendez-\\nvous au 96").

    This function is also used directly by the property tests.
    """
    # Pre-process: join hyphenated line breaks BEFORE splitting into lines.
    # e.g. "Rendez-\nvous au 96" -> "Rendez-vous au 96"
    text = re.sub(r"-\n(\S)", r"-\1", text)

    # Also join lines ending with "au" (without a number) with the next line
    # when the next line starts with a number followed by text.
    # e.g. "rendez-vous au\n322. Vous entendez..." -> "rendez-vous au 322. Vous entendez..."
    # This prevents the number from being mis-parsed as a section header.
    text = re.sub(r"\bau\n([1-9]\d{0,2}[.:\s])", r"au \1", text)

    lines = text.splitlines()
    sections: list[dict] = []
    current_numero: Optional[int] = None
    current_lines: list[str] = []

    def _flush():
        nonlocal current_numero, current_lines
        if current_numero is None:
            return
        body = "\n".join(current_lines).strip()
        choix = _extract_choices(body)
        effets = _extract_effects(body)
        combat = _extract_combat(body)
        section_dict = {
            "numero": current_numero,
            "texte": body,
            "choix": choix,
        }
        if effets:
            section_dict["effets"] = effets
        if combat:
            section_dict["combat"] = combat
            # Si le combat a une section_victoire, retirer ce choix des choix normaux
            sv = combat.get("victoire", {}).get("section") or combat.get("section_victoire")
            if sv:
                section_dict["choix"] = [c for c in choix if c.get("section") != sv]
        # Detect if this is a final section
        section_end = _detect_section_end(body)
        if section_end:
            section_dict["end"] = section_end
        sections.append(section_dict)
        current_numero = None
        current_lines = []

    for line in lines:
        # Try strict match first (number alone on line)
        m = _SECTION_HEADER_RE.match(line)
        if m:
            num = int(m.group(1))
            if 1 <= num <= 400:
                _flush()
                current_numero = num
                continue

        # Try inline match (number + text on same line)
        # Reject if the line contains a choice reference (e.g. "rendez-vous au 42")
        # to avoid treating choice lines as section headers.
        m2 = _SECTION_HEADER_INLINE_RE.match(line)
        if m2 and not _CHOICE_RE.search(line):
            num = int(m2.group(1))
            inline_text = m2.group(2).strip()
            # Only treat as section if it starts with a typical section starter
            # (verb or pronoun, not a noun like "Pièces")
            starts_with_verb_or_pronoun = any(
                inline_text.startswith(w) for w in [
                    'Vous', 'Il', 'Elle', 'Après', 'Devant', 'Au', 'En', 'Le', 'La', 'Les',
                    'Un', 'Une', 'Des', 'Tandis', 'Alors', 'Soudain', 'Tout', 'Ici', 'Là',
                    'Loin', 'Près', 'Quand', 'Pendant', 'Avant', 'Depuis', 'Jusqu', 'Vers',
                    'Contre', 'Sous', 'Sur', 'Entre', 'Parmi', 'Avec', 'Sans', 'Pour', 'Par',
                    'Grâce', 'Malgré', 'Bien', 'Mal', 'Très', 'Trop', 'Peu', 'Beaucoup',
                    'Assez', 'Plutôt', 'Surtout', 'Notamment', 'Particulièrement',
                    'Généralement', 'Habituellement', 'Normalement', 'Finalement', 'Enfin',
                    'Bref', 'Donc', 'Ainsi', 'Cependant', 'Toutefois', 'Néanmoins',
                    'Pourtant', 'Cela', 'Ceci', 'C\'', 'Ç', 'Qu', 'Qui', 'Que', 'Quoi',
                    'Où', 'Comment', 'Pourquoi', 'Combien', 'Quel', 'Quelle', 'Quels',
                    'Quelles', 'Lequel', 'Laquelle', 'Lesquels', 'Lesquelles', 'Celui',
                    'Celle', 'Ceux', 'Celles', 'Ce', 'Cet', 'Cette', 'Ces', 'Mon', 'Ma',
                    'Mes', 'Ton', 'Ta', 'Tes', 'Son', 'Sa', 'Ses', 'Notre', 'Nos',
                    'Votre', 'Vos', 'Leur', 'Leurs', 'Je', 'Tu', 'On', 'Nous', 'Aucun',
                    'Aucune', 'Nul', 'Nulle', 'Quelque', 'Quelques', 'Certain', 'Certaine',
                    'Certains', 'Certaines', 'Divers', 'Diverse', 'Différent', 'Différente',
                    'Différents', 'Différentes', 'Autre', 'Autres', 'Autrui', 'Même',
                    'Mêmes', 'Propre', 'Propres', 'Seul', 'Seule', 'Seuls', 'Seules',
                    'Toute', 'Tous', 'Toutes', 'Chaque', 'Chacun', 'Chacune', 'Tel',
                    'Telle', 'Tels', 'Telles'
                ]
            )
            if starts_with_verb_or_pronoun and 1 <= num <= 400:
                _flush()
                current_numero = num
                current_lines = [inline_text]
                continue

        if current_numero is not None:
            current_lines.append(line)

    _flush()

    # Deduplicate: keep first occurrence of each numero
    seen: set[int] = set()
    unique: list[dict] = []
    for s in sections:
        if s["numero"] not in seen:
            seen.add(s["numero"])
            unique.append(s)

    return unique


def _extract_effects(text: str) -> list[dict]:
    """Extract effects (stat changes, item additions) from section text."""
    effects: list[dict] = []
    normalized = ' '.join(text.split())

    # +N points de STAT : "3 points de CHANCE", "1 point d'HABILETÉ"
    for m in re.finditer(r'(\d+)\s+points?\s+d[e\']\s*(HABILETÉ|ENDURANCE|CHANCE)', normalized, re.IGNORECASE):
        effects.append({"type": "stat", "stat": m.group(2).lower(), "delta": int(m.group(1)), "raison": m.group(0).strip()})

    # "Ajoutez(-vous) N point(s) de STAT" / "Ajoutez N à votre STAT"
    for m in re.finditer(r'[Aa]joutez(?:-vous)?\s+(\d+)\s+points?\s+(?:de\s+|à\s+votre\s+)?(HABILETÉ|ENDURANCE|CHANCE)', normalized, re.IGNORECASE):
        effects.append({"type": "stat", "stat": m.group(2).lower(), "delta": int(m.group(1)), "raison": m.group(0).strip()})

    # "Ajoutez-vous un point de STAT"
    for m in re.finditer(r'[Aa]joutez(?:-vous)?\s+un\s+point\s+(?:de\s+|à\s+votre\s+)?(HABILETÉ|ENDURANCE|CHANCE)', normalized, re.IGNORECASE):
        effects.append({"type": "stat", "stat": m.group(1).lower(), "delta": 1, "raison": m.group(0).strip()})

    # "Perdez N point(s) de STAT" / "vous perdez N points de STAT"
    for m in re.finditer(r'[Pp]erdez(?:-vous)?\s+(\d+)\s+points?\s+d[e\']\s*(HABILETÉ|ENDURANCE|CHANCE)', normalized, re.IGNORECASE):
        effects.append({"type": "stat", "stat": m.group(2).lower(), "delta": -int(m.group(1)), "raison": m.group(0).strip()})

    # Clés numérotées : "une clé ... chiffre X" ou "clé numéro X" ou "clé couleur ... chiffre X"
    for m in re.finditer(r'(?:une\s+)?cl[eé][^\d]{0,40}(?:chiffre|numéro|numérotée?)\s+(\d+)', normalized, re.IGNORECASE):
        effects.append({"type": "item", "item": f"Clé {m.group(1)}", "raison": m.group(0).strip()[:100]})

    # Items génériques : "vous pouvez prendre/prenez/ramassez ... un/une X"
    item_pattern = r'(?:vous\s+(?:pouvez\s+)?(?:prenez?|ramassez?|récupérez?|obtenez?|trouvez?|gagnez?))\s+(?:cette?\s+|cet\s+|un\s+|une\s+|des\s+|la\s+|le\s+|les\s+)?([a-zàâäéèêëïîôöùûüœæç][a-zàâäéèêëïîôöùûüœæç\s\-\']{2,30}?)(?:\s*[\.,;(]|\s+et\s|\s+puis\s|$)'
    for m in re.finditer(item_pattern, normalized, re.IGNORECASE):
        item = m.group(1).strip()
        # Filtre les faux positifs
        skip = ('de ', 'du ', 'des ', 'la ', 'le ', 'les ', 'cette ', 'votre ', 'son ', 'sa ')
        if len(item) > 2 and not any(item.lower().startswith(s) for s in skip):
            # Évite les doublons avec les clés déjà détectées
            if not re.search(r'cl[eé]', item, re.IGNORECASE):
                effects.append({"type": "item", "item": item, "raison": m.group(0).strip()[:100]})

    return effects


def _extract_combat(text: str) -> Optional[dict]:
    """
    Détecte un ou plusieurs combats dans le texte d'une section.
    Supporte multi-monstres, mode séquentiel, bonus attaque, fuite.
    """
    normalized = ' '.join(text.split())

    monstres = []

    # ── Détection multi-monstres via tableau HABILETÉ ENDURANCE ─────────────
    table_header = re.search(r'HABILET[EÉ]\s+ENDURANCE', normalized, re.IGNORECASE)
    if table_header:
        after = normalized[table_header.end():]
        row_re = re.compile(r'([A-ZÀÂÄÉÈÊËÎÏÔÙÛÜŒÆ][A-ZÀÂÄÉÈÊËÎÏÔÙÛÜŒÆ\s\-\']{1,40}?)\s+(\d+)\s+(\d+)')
        for m in row_re.finditer(after[:400]):
            nom = m.group(1).strip()
            if len(nom) >= 3 and not re.match(r'^(si|vous|le|la|les|un|une|des|et|ou|au|du)$', nom, re.IGNORECASE):
                monstres.append({'nom': nom, 'habilete': int(m.group(2)), 'endurance': int(m.group(3))})

    # ── Détection combat simple NOM HABILETÉ: X ENDURANCE: Y ────────────────
    if not monstres:
        combat_re = re.compile(
            r'([A-ZÀÂÄÉÈÊËÎÏÔÙÛÜŒÆ][A-ZÀÂÄÉÈÊËÎÏÔÙÛÜŒÆ\s\-\']{1,40}?)\s+'
            r'HABILET[EÉ]\s*:?\s*(\d+)\s+ENDURANCE\s*:?\s*(\d+)',
            re.IGNORECASE
        )
        m = combat_re.search(normalized)
        if m:
            monstres.append({'nom': m.group(1).strip(), 'habilete': int(m.group(2)), 'endurance': int(m.group(3))})

    if not monstres:
        return None

    result: dict = {'monstres': monstres}

    # ── Mode séquentiel ──────────────────────────────────────────────────────
    if re.search(r'un par un|l\'un après l\'autre|attaquer.*séparément|séparément', normalized, re.IGNORECASE):
        result['mode'] = 'sequentiel'

    # ── Bonus attaque héros ──────────────────────────────────────────────────
    m_bonus = re.search(
        r'(?:vous\s+(?:pouvez|pourrez)\s+ajouter|ajoutez)\s+(\d+)\s+points?\s+au\s+total',
        normalized, re.IGNORECASE
    )
    if m_bonus:
        result['attaque_hero'] = f"+{m_bonus.group(1)}"

    m_malus = re.search(
        r'(?:vous\s+devez\s+(?:soustraire|retrancher)|soustrayez|retranchez)\s+(\d+)\s+points?\s+(?:au|de votre)\s+total',
        normalized, re.IGNORECASE
    )
    if m_malus:
        result['attaque_hero'] = f"-{m_malus.group(1)}"

    # ── Bonus attaque monstre ────────────────────────────────────────────────
    m_monstre_bonus = re.search(
        r'(?:le monstre|la créature|il|elle)\s+(?:ajoute|bénéficie de)\s+(\d+)\s+points?\s+(?:supplémentaires?\s+)?(?:à|au)',
        normalized, re.IGNORECASE
    )
    if m_monstre_bonus:
        result['attaque_monstre'] = f"+{m_monstre_bonus.group(1)}"

    # ── Section victoire ─────────────────────────────────────────────────────
    victoire_re = re.compile(
        r'(?:si vous (?:parvenez|avez vaincu|tuez|battez|êtes vainqueur|avez tué|sortez vainqueur)'
        r'|après (?:avoir vaincu|avoir tué|la victoire)|en cas de victoire)'
        r'.{0,80}?(?:rendez-vous|allez|passez)[^\d]{0,20}(\d+)',
        re.IGNORECASE
    )
    search_start = normalized.rfind(monstres[-1]['nom']) if monstres else 0
    mv = victoire_re.search(normalized[search_start:]) or victoire_re.search(normalized)
    if mv:
        result['victoire'] = {'section': int(mv.group(1))}

    # ── Section fuite ────────────────────────────────────────────────────────
    # Vérifie d'abord si la fuite est explicitement impossible
    fuite_impossible_re = re.compile(
        r'(?:ne\s+pouvez\s+pas\s+(?:fuir|prendre la fuite|vous enfuir)'
        r'|impossible\s+(?:de\s+fuir|de\s+prendre la fuite)'
        r'|sans\s+(?:possibilité\s+de\s+)?fuite'
        r'|ne\s+peut\s+pas\s+fuir)',
        re.IGNORECASE
    )
    if not fuite_impossible_re.search(normalized):
        # Cherche la mention de fuite possible + prochain numéro de section
        fuite_possible_re = re.compile(
            r'(?:vous\s+pouvez\s+(?:fuir|vous\s+enfuir|prendre\s+la\s+fuite)'
            r'|si\s+vous\s+(?:voulez|souhaitez|décidez\s+de)\s+(?:fuir|prendre\s+la\s+fuite)'
            r'|possibilité\s+de\s+(?:fuir|fuite)'
            r'|prendre\s+la\s+fuite)'
            r'.{0,100}?(\d+)',
            re.IGNORECASE
        )
        mf = fuite_possible_re.search(normalized)
        if mf:
            result['fuite'] = {'section': int(mf.group(1))}

    return result


def _extract_choices(text: str) -> list[dict]:
    """Extract choice dicts from a section body text."""
    choices: list[dict] = []
    seen_targets: set[int] = set()
    # Normalize whitespace (replace newlines with spaces) to handle multi-line patterns
    normalized_text = ' '.join(text.split())
    for m in _CHOICE_RE.finditer(normalized_text):
        target = _first_group(m)
        if target is not None and target not in seen_targets:
            seen_targets.add(target)
            matched_text = m.group(0).strip()
            choices.append({
                "texte": matched_text,
                "section": target,
            })
    return choices


# ---------------------------------------------------------------------------
# Section overrides
# ---------------------------------------------------------------------------


def _build_detect_rules(overrides: dict) -> list[tuple[str, str, dict]]:
    """
    Parcourt les règles de l'override et retourne une liste de
    (phrase_detect_lower, nom_regle, regle_dict) pour toutes les règles
    qui ont une propriété "detect".
    """
    result = []
    for nom, regle in overrides.get("regles", {}).items():
        if not isinstance(regle, dict):
            continue
        for phrase in regle.get("detect", []):
            result.append((phrase.lower(), nom, regle))
    return result


def _find_section_for_resultat(text: str, mot_resultat: str, after_pos: int) -> Optional[int]:
    """
    Dans le texte d'une section, cherche le mot-résultat (ex: "chanceux")
    APRÈS after_pos, suivi d'une référence de section.
    Retourne le numéro de section trouvé, ou None.
    """
    normalized = ' '.join(text.split())
    # Cherche le mot-résultat après la position de la phrase detect
    search_text = normalized[after_pos:]
    pattern = re.compile(
        re.escape(mot_resultat) + r'.{0,120}?(?:rendez-vous|allez|passez|tournez)[^\d]{0,20}(\d+)',
        re.IGNORECASE
    )
    m = pattern.search(search_text)
    if m:
        return int(m.group(1))
    return None


def _apply_detect_rules(sections: list[dict], detect_rules: list[tuple[str, str, dict]]) -> list[dict]:
    """
    Pour chaque section, si son texte contient une phrase detect d'une règle,
    remplace les choix par un choix action avec si_reussi/si_echoue dérivés
    des mots-résultats trouvés APRÈS la phrase detect.
    """
    for sec in sections:
        texte = sec.get("texte", "")
        normalized = ' '.join(texte.split())
        normalized_lower = normalized.lower()

        for phrase_lower, nom_regle, regle in detect_rules:
            pos = normalized_lower.find(phrase_lower)
            if pos == -1:
                continue

            # Position après la phrase detect
            after_pos = pos + len(phrase_lower)

            resultats = regle.get("resultats", {})
            if not resultats:
                continue

            # Cherche la section cible pour chaque résultat APRÈS la phrase detect
            sections_par_resultat: dict[str, int] = {}
            for cle_resultat, mot in resultats.items():
                target = _find_section_for_resultat(normalized, mot, after_pos)
                if target is not None:
                    sections_par_resultat[cle_resultat] = target

            if not sections_par_resultat:
                continue

            choix_action: dict = {
                "texte": next(iter(regle.get("detect", [phrase_lower])), phrase_lower),
                "section": 0,
                "action": nom_regle,
            }

            succes_section = sections_par_resultat.get("succes")
            echec_section  = sections_par_resultat.get("echec")

            if succes_section is not None:
                choix_action["si_reussi"] = {"choix": {"texte": "", "section": succes_section}}
            if echec_section is not None:
                choix_action["si_echoue"] = {"choix": {"texte": "", "section": echec_section}}

            # Sections déjà couvertes par le choix action (éviter les doublons)
            action_sections = set()
            if succes_section: action_sections.add(succes_section)
            if echec_section:  action_sections.add(echec_section)

            # Garde les choix existants qui ne pointent pas vers les sections de l'action
            choix_existants = [c for c in sec.get("choix", []) if c.get("section") not in action_sections]

            sec["choix"] = choix_existants + [choix_action]
            logger.info(
                "Section %d : détection '%s' → action '%s' (succes→%s, echec→%s)",
                sec["numero"], phrase_lower, nom_regle,
                succes_section, echec_section
            )
            break

    return sections


def _load_overrides(pdf_path: str) -> dict:
    """Load overrides from overrides directory based on PDF filename."""
    pdf_name = os.path.splitext(os.path.basename(pdf_path))[0]
    overrides_dir = os.path.join(os.path.dirname(__file__), "overrides")
    overrides_path = os.path.join(overrides_dir, f"{pdf_name}.json")

    if not os.path.isfile(overrides_path):
        return {}

    try:
        with open(overrides_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"Failed to load overrides from {overrides_path}: {e}")
        return {}


def _apply_overrides(sections: list[dict], pdf_path: str) -> list[dict]:
    """Apply section overrides and detect-rule substitutions."""
    overrides = _load_overrides(pdf_path)

    # 1. Overrides manuels de sections
    section_overrides = overrides.get("sections", {})
    for sec in sections:
        sec_num = str(sec["numero"])
        if sec_num in section_overrides:
            override = section_overrides[sec_num]
            logger.warning(f"Section {sec_num} is using overrides (forced data)")
            if "end" in override:
                sec["end"] = override["end"]
            if "choix" in override:
                sec["choix"] = override["choix"]
            if "effets" in override:
                sec["effets"] = override.get("effets", [])
            if "combat" in override:
                sec["combat"] = override["combat"]
            if "texte" in override:
                sec["texte"] = override["texte"]
            if "image" in override:
                sec["image"] = override["image"]

    # 2. Détection automatique via les règles "detect"
    detect_rules = _build_detect_rules(overrides)
    if detect_rules:
        sections = _apply_detect_rules(sections, detect_rules)

    return sections


def _apply_adventure_overrides(adventure: dict, pdf_path: str) -> dict:
    """Apply top-level adventure overrides (personnage, regles, etc.)."""
    overrides = _load_overrides(pdf_path)

    # Fusion profonde de "personnage"
    if "personnage" in overrides:
        for key, value in overrides["personnage"].items():
            if key in adventure["personnage"] and isinstance(adventure["personnage"][key], dict) and isinstance(value, dict):
                adventure["personnage"][key].update(value)
            else:
                adventure["personnage"][key] = value

    # Fusion clé par clé de "regles"
    if "regles" in overrides:
        for key, value in overrides["regles"].items():
            adventure["regles"][key] = value

    # Champs de premier niveau (collection, titre, tags...)
    for key in ("collection", "titre", "tags", "mode_emploi"):
        if key in overrides and overrides[key]:  # seulement si non-vide
            adventure[key] = overrides[key]

    # Fusion de "intro"
    if "intro" in overrides:
        if isinstance(overrides["intro"], dict):
            if "intro" not in adventure or not isinstance(adventure.get("intro"), dict):
                adventure["intro"] = {}
            adventure["intro"].update(overrides["intro"])
        else:
            adventure["intro"] = overrides["intro"]

    # Champs listes optionnels
    for key in ("images_victoire", "images_defaite", "images_annexes"):
        if key in overrides:
            adventure[key] = overrides[key]

    return adventure


# ---------------------------------------------------------------------------
# PDFScanner
# ---------------------------------------------------------------------------


class PDFScanner:
    """Scan a gamebook PDF and produce an Adventure-compatible dict."""

    def scan(self, pdf_path: str, output_dir: str = "output") -> dict:
        """
        Main entry point. Reads *pdf_path* and returns an Adventure dict.
        Raises RuntimeError with a descriptive message if the PDF cannot
        be read or does not look like a gamebook.
        """
        import pdfplumber

        if not os.path.isfile(pdf_path):
            raise RuntimeError(f"PDF introuvable : {pdf_path}")

        try:
            pdf = pdfplumber.open(pdf_path)
        except Exception as exc:
            raise RuntimeError(f"Impossible d'ouvrir le PDF '{pdf_path}' : {exc}") from exc

        # Keep the PDF open for the entire extraction — pages become invalid after close()
        try:
            pages = list(pdf.pages)
            if not pages:
                pdf.close()
                raise RuntimeError(f"Le PDF '{pdf_path}' ne contient aucune page.")

            adventure_name = os.path.splitext(os.path.basename(pdf_path))[0]
            adventure_name = re.sub(r"[^\w\-]", "_", adventure_name)

            images_dir = os.path.join(output_dir, adventure_name, "images")
            section_images = self.extract_images(pages, pdf_path, images_dir)
            intro = self.extract_intro_pages(pages)
            sections = self.extract_sections(pages, pdf_path)
        finally:
            pdf.close()

        if not sections:
            raise RuntimeError(
                f"Aucune section numérotée trouvée dans '{pdf_path}'. "
                "Le PDF ne semble pas être un livre-jeu au format attendu."
            )

        for sec in sections:
            img = section_images.get(sec["numero"])
            if img:
                sec["image"] = img

        # Detect cover image filename (may be .jpeg, .png, etc.)
        cover_filename = next(
            (f for f in os.listdir(images_dir) if f.startswith("cover.") if os.path.isfile(os.path.join(images_dir, f))),
            "cover.jpeg"
        ) if os.path.isdir(images_dir) else "cover.jpeg"

        adventure = {
            "collection": "",
            "titre": intro.get("titre", adventure_name),
            "tags": ["gamebook", "fighting-fantasy"],
            "repertoire_images": f"adventures/{adventure_name}/images/",
            "image_de_garde": cover_filename,
            "mode_emploi": intro.get("mode_emploi", ""),
            "personnage": intro.get("personnage", _default_personnage()),
            "regles": _default_regles(),
            "sections": sections,
        }

        return _apply_adventure_overrides(adventure, pdf_path)

    def extract_sections(self, pages: list, pdf_path: str = "") -> list[dict]:
        """
        Extract numbered sections from pdfplumber Page objects.

        Strategy:
        1. Find the first page that starts with section number 1 (the real
           start of the adventure, not the intro/rules pages).
        2. From that page onward, merge continuation pages: if a page does NOT
           start with a section number, its content belongs to the previous page.
        3. Parse the merged text to extract sections and choices.
        """
        # Step 1: find the first page that starts with "1" (the adventure start)
        adventure_start_idx = 0
        for idx, page in enumerate(pages):
            try:
                text = page.extract_text() or ""
            except Exception:
                text = ""
            first_line = next((l for l in text.splitlines() if l.strip()), "")
            if _SECTION_HEADER_RE.match(first_line) and int(_SECTION_HEADER_RE.match(first_line).group(1)) == 1:
                adventure_start_idx = idx
                break

        game_pages = pages[adventure_start_idx:]

        # Step 2: extract raw text per page
        raw_pages: list[str] = []
        for page in game_pages:
            try:
                t = page.extract_text() or ""
            except Exception:
                t = ""
            raw_pages.append(t)

        # Step 3: merge continuation pages
        # A page is a "continuation" if its first non-empty line is NOT a
        # standalone section number — its content belongs to the previous page.
        merged_chunks: list[str] = []
        for text in raw_pages:
            first_line = next((l for l in text.splitlines() if l.strip()), "")
            is_new_section = bool(_SECTION_HEADER_RE.match(first_line))
            if not is_new_section and merged_chunks:
                merged_chunks[-1] = merged_chunks[-1] + "\n" + text
            else:
                merged_chunks.append(text)

        # Step 4: parse all merged chunks
        full_text = "\n".join(merged_chunks)
        sections = parse_sections_from_text(full_text)

        # Apply section overrides BEFORE checking for warnings
        if pdf_path:
            sections = _apply_overrides(sections, pdf_path)

        if sections:
            last_num = max(s["numero"] for s in sections)
            for sec in sections:
                # Check if any choice has "libre": true
                has_libre_choice = any(c.get("libre") for c in sec.get("choix", []))
                has_combat = sec.get("combat") is not None
                if not sec["choix"] and sec["numero"] != last_num and not sec.get("end") and not has_libre_choice and not has_combat:
                    logger.warning("Section %d n'a aucun choix.", sec["numero"])

        return sections

    def extract_images(self, pages: list, pdf_path: str, images_dir: str) -> dict[int, str]:
        """Extract images via PyMuPDF, save to images_dir, return section->filename map."""
        import fitz

        # Minimum size to keep an image (ignore decorative small images)
        MIN_WIDTH_PT  = 150
        MIN_HEIGHT_PT = 150

        section_images: dict[int, str] = {}

        try:
            doc = fitz.open(pdf_path)
        except Exception as exc:
            logger.warning("Impossible d'ouvrir le PDF avec PyMuPDF : %s", exc)
            return section_images

        os.makedirs(images_dir, exist_ok=True)

        # Build page_idx -> list of (y_position, section_number) sorted by y
        page_to_sections: dict[int, list[tuple[float, int]]] = {}
        for page_idx, page in enumerate(pages):
            entries: list[tuple[float, int]] = []
            try:
                words = page.extract_words() or []
            except Exception:
                words = []

            lines_by_y: dict[float, list[str]] = {}
            for w in words:
                y = round(w.get("top", 0), 0)
                lines_by_y.setdefault(y, []).append(w.get("text", ""))

            for y, tokens in sorted(lines_by_y.items()):
                line = " ".join(tokens).strip()
                m = _SECTION_HEADER_RE.match(line)
                if not m:
                    m = _SECTION_HEADER_INLINE_RE.match(line)
                    if m and _CHOICE_RE.search(line):
                        m = None
                if m:
                    num = int(m.group(1))
                    if 1 <= num <= 400:
                        entries.append((y, num))

            if entries:
                page_to_sections[page_idx] = sorted(entries)

        # Build ordered list of (page_idx, y, section_num) for positional lookup
        all_positions: list[tuple[int, float, int]] = [
            (p, y, n)
            for p, entries in sorted(page_to_sections.items())
            for y, n in entries
        ]

        def _section_for_image(img_page_idx: int, img_y: float, img_h: float) -> Optional[int]:
            """
            Find the section that owns this image.
            - If the image is on a page with no section numbers → take the first
              section on the NEXT page (illustration page before the section).
            - If the image is on a page with sections → take the section whose
              header is closest AFTER the image (image precedes its section text).
            """
            if img_page_idx not in page_to_sections:
                # Page dédiée à l'illustration : prendre la 1ère section de la page suivante
                for p, y, n in all_positions:
                    if p > img_page_idx:
                        return n
                # Fallback : dernière section avant cette page
                best = None
                for p, y, n in all_positions:
                    if p < img_page_idx:
                        best = n
                return best
            else:
                # Page avec sections : prendre la section dont le header suit l'image
                for p, y, n in all_positions:
                    if p == img_page_idx and y >= img_y:
                        return n
                # Image après tous les headers de la page → première section page suivante
                for p, y, n in all_positions:
                    if p > img_page_idx:
                        return n
                return None

        saved_xrefs: set[int] = set()

        for page_idx in range(len(doc)):
            fitz_page = doc[page_idx]
            for img_idx, img_info in enumerate(fitz_page.get_images(full=True)):
                xref = img_info[0]
                if xref in saved_xrefs:
                    continue

                try:
                    base_image = doc.extract_image(xref)
                    img_bytes = base_image["image"]
                    img_ext = base_image["ext"]
                except Exception as exc:
                    logger.warning("Erreur extraction image page %d xref %d : %s", page_idx, xref, exc)
                    continue

                # Get image position and size
                img_y = 0.0
                img_w = 0.0
                img_h = 0.0
                try:
                    rects = fitz_page.get_image_rects(xref)
                    if rects:
                        img_y = rects[0].y0
                        img_w = rects[0].width
                        img_h = rects[0].height
                except Exception:
                    pass

                # Skip decorative small images
                if img_w < MIN_WIDTH_PT or img_h < MIN_HEIGHT_PT:
                    logger.debug("Image ignorée (trop petite) page %d xref %d : %.0fx%.0f pt", page_idx, xref, img_w, img_h)
                    continue

                section_num = _section_for_image(page_idx, img_y, img_h)

                if section_num is None:
                    base_name = "cover" if page_idx == 0 else f"intro_page{page_idx:03d}_img{img_idx:02d}"
                elif section_num not in section_images:
                    base_name = f"section_{section_num:03d}"
                else:
                    base_name = f"section_{section_num:03d}_img{img_idx:02d}"

                filename = f"{base_name}.{img_ext}"
                filepath = os.path.join(images_dir, filename)
                try:
                    with open(filepath, "wb") as f:
                        f.write(img_bytes)
                    saved_xrefs.add(xref)
                except Exception as exc:
                    logger.warning("Impossible d'écrire l'image %s : %s", filepath, exc)
                    continue

                if section_num is not None and section_num not in section_images:
                    section_images[section_num] = filename

        doc.close()
        return section_images

    def extract_intro_pages(self, pages: list) -> dict:
        """Extract metadata from pages before section 1."""
        intro_texts: list[str] = []

        for page in pages:
            try:
                text = page.extract_text() or ""
            except Exception:
                text = ""

            reached_section = False
            for line in text.splitlines():
                m = _SECTION_HEADER_RE.match(line)
                if not m:
                    m2 = _SECTION_HEADER_INLINE_RE.match(line)
                    if m2 and not _CHOICE_RE.search(line) and int(m2.group(1)) == 1:
                        reached_section = True
                        break
                elif int(m.group(1)) == 1:
                    reached_section = True
                    break

            intro_texts.append(text)
            if reached_section:
                break

        full_intro = "\n".join(intro_texts)

        titre = ""
        for line in full_intro.splitlines():
            stripped = line.strip()
            if stripped and len(stripped) > 3:
                titre = stripped
                break

        return {
            "titre": titre,
            "mode_emploi": full_intro.strip(),
            "personnage": _default_personnage(),
        }


# ---------------------------------------------------------------------------
# Defaults for Défis Fantastiques / Fighting Fantasy
# ---------------------------------------------------------------------------

def _default_personnage() -> dict:
    return {
        "statistiques": {
            "habilete":  {"valeur": 0, "init": "1d6+6",  "max": "start", "label": "Habileté"},
            "endurance": {"valeur": 0, "init": "2d6+12", "max": "start", "label": "Endurance"},
            "chance":    {"valeur": 0, "init": "1d6+6",  "max": "start", "label": "Chance"},
        },
        "inventaire": [
            "Épée",
            "Bouclier",
            {"id": "pieces_or", "label": "Pièces d'or", "quantite": 10},
        ],
    }


def _default_regles() -> dict:
    return {
        "combat": {
            "stat_attaque": "habilete+2d6",
            "stat_vie": "endurance",
            "attaque": ">",
            "degats_victoire": 2,
            "degats_defaite": 2,
        },
        "victoire": {"sections": [400]},
        "defaite": {"endurance_min": 0},
    }
