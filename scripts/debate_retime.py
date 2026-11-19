"""Corrige los tiempos de un debate ya editado con los tiempos por palabra de su transcripción (WhisperX).

Uso: python scripts/debate_retime.py <transcripcion.json> <slug> [--dry-run]

Por qué: el editor (`editor_debate.py`) calcula el tiempo de un párrafo por su parte de caracteres de la
intervención. Al partir una intervención o dar un párrafo a otro hablante, los tiempos se desplazan varios
segundos, y una interjección puede quedar antes que la frase a la que responde.

Qué hace:
1. Busca cada párrafo en la lista de palabras de la transcripción, cerca de su tiempo actual. Cada palabra de la
   transcripción se usa una sola vez: los párrafos largos se buscan primero, y un «Buenas noches» corto no puede
   tomar las palabras de la moderadora.
2. Un párrafo encontrado toma el inicio de su primera palabra y el fin de la última. Un párrafo que no está en la
   transcripción (lo añadió una persona al escuchar el audio) conserva su tiempo, dentro de los límites de los
   párrafos vecinos de su intervención.
3. Ordena todos los párrafos por tiempo y une los párrafos seguidos del mismo hablante en una intervención. Así, una
   interjección dentro de un turno largo parte ese turno en el párrafo correcto.
4. Recalcula los campos derivados con `debate_derive.py` y guarda una copia del archivo anterior en
   `.cache/debate-backups/`.

El texto y los hablantes no cambian. Después de editar con el editor, ejecute este script de nuevo.
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from debate_derive import derive  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DEBATES_DIR = ROOT / "src" / "data" / "2026" / "generales" / "debates"
BACKUP_DIR = ROOT / ".cache" / "debate-backups"
# A paragraph is searched in the words of this many seconds around its current time.
SEARCH_MARGIN = 25.0
# Part of the words of a paragraph that must match for the match to count.
MIN_RATIO = 0.6
# A paragraph of this many words or fewer must match all its words.
SHORT_WORDS = 3

FOLD = str.maketrans("áéíóúüñ", "aeiouun")


def token(word: str) -> str:
    return re.sub(r"[^a-z0-9]", "", word.lower().translate(FOLD))


def tokens(text: str) -> list[str]:
    return [t for t in (token(w) for w in text.split()) if t]


def load_words(path: Path) -> list[tuple[str, float, float]]:
    """The words of the transcription with their times. A word without a time takes the time of its neighbours."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    words = []
    for segment in raw["segments"]:
        for word in segment.get("words", []):
            text = token(word.get("word", ""))
            if not text:
                continue
            start = word.get("start")
            end = word.get("end")
            if start is None or end is None:
                previous_end = words[-1][2] if words else segment["start"]
                start, end = previous_end, previous_end
            words.append((text, float(start), float(end)))
    words.sort(key=lambda item: item[1])
    return words


def find(paragraph: list[str], words, used: list[bool], low: float, high: float):
    """The best place of a paragraph among the unused words between `low` and `high`: (ratio, first, last) or None."""
    candidates = [i for i, (_, start, _) in enumerate(words) if low <= start <= high and not used[i]]
    if not candidates or not paragraph:
        return None
    size = len(paragraph)
    best = None
    for offset in range(len(candidates)):
        window = candidates[offset : offset + size + 2]
        # The window must be contiguous in the free words: a gap of used words means another speaker in between.
        stream = [words[i][0] for i in window]
        matcher = difflib.SequenceMatcher(None, paragraph, stream, autojunk=False)
        blocks = [block for block in matcher.get_matching_blocks() if block.size]
        matched = sum(block.size for block in blocks)
        ratio = matched / size
        if best is None or ratio > best[0] + 1e-9:
            first = window[blocks[0].b] if blocks else None
            last = window[blocks[-1].b + blocks[-1].size - 1] if blocks else None
            best = (ratio, first, last)
        if ratio == 1.0:
            break
    return best


def retime(data: dict, words) -> tuple[dict, dict]:
    used = [False] * len(words)
    units = []  # one per paragraph: speaker, text, old times, new times
    for index, intervention in enumerate(data["interventions"]):
        count = len(intervention["paragraphs"])
        span = intervention["end"] - intervention["start"]
        for k, text in enumerate(intervention["paragraphs"]):
            units.append(
                {
                    "speaker": intervention["speaker"],
                    "text": text,
                    "intervention": index,
                    "k": k,
                    "guess": intervention["start"] + span * k / max(count, 1),
                    "low": intervention["start"],
                    "high": intervention["end"],
                    "start": None,
                    "end": None,
                }
            )

    # Long paragraphs first: they are found with certainty and keep their words from the short ones.
    order = sorted(range(len(units)), key=lambda i: -len(tokens(units[i]["text"])))
    stats = {"found": 0, "missing": 0}
    for position in order:
        unit = units[position]
        paragraph = tokens(unit["text"])
        reach = len(paragraph) * 0.5
        result = find(paragraph, words, used, unit["guess"] - SEARCH_MARGIN, unit["guess"] + reach + SEARCH_MARGIN)
        needed = 1.0 if len(paragraph) <= SHORT_WORDS else MIN_RATIO
        if result and result[1] is not None and result[0] >= needed:
            _, first, last = result
            unit["start"], unit["end"] = round(words[first][1], 2), round(words[last][2], 2)
            for i in range(first, last + 1):
                used[i] = True
            stats["found"] += 1
        else:
            stats["missing"] += 1

    # A paragraph that was not found keeps its time, between the found paragraphs before and after it.
    by_intervention: dict[int, list[dict]] = {}
    for unit in units:
        by_intervention.setdefault(unit["intervention"], []).append(unit)
    for group in by_intervention.values():
        for k, unit in enumerate(group):
            if unit["start"] is not None:
                continue
            before = next((u["end"] for u in reversed(group[:k]) if u["end"] is not None), None)
            after = next((u["start"] for u in group[k + 1 :] if u["start"] is not None), None)
            start = unit["guess"]
            if before is not None:
                start = max(start, before)
            if after is not None:
                start = min(start, after)
            length = max(0.4, len(tokens(unit["text"])) * 0.35)
            end = start + length if after is None else min(start + length, max(after, start))
            unit["start"], unit["end"] = round(start, 2), round(end, 2)

    # All paragraphs in time order. Paragraphs of one intervention keep their order.
    units.sort(key=lambda u: (u["start"], u["intervention"], u["k"]))
    interventions = []
    for unit in units:
        if interventions and interventions[-1]["speaker"] == unit["speaker"]:
            interventions[-1]["paragraphs"].append(unit["text"])
            interventions[-1]["end"] = max(interventions[-1]["end"], unit["end"])
        else:
            interventions.append({"speaker": unit["speaker"], "start": unit["start"], "end": unit["end"], "paragraphs": [unit["text"]]})
    for intervention in interventions:
        intervention["start"] = round(intervention["start"], 1)
        intervention["end"] = round(max(intervention["end"], intervention["start"]), 1)

    result = dict(data)
    result["interventions"] = interventions
    stats["interventions"] = (len(data["interventions"]), len(interventions))
    return result, stats


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("transcript", type=Path)
    parser.add_argument("slug")
    parser.add_argument("--dry-run", action="store_true", help="Muestra el resultado sin guardar.")
    args = parser.parse_args()

    target = DEBATES_DIR / f"{args.slug}.json"
    data = json.loads(target.read_text(encoding="utf-8"))
    retimed, stats = retime(data, load_words(args.transcript))
    derived = derive(retimed)
    before, after = stats["interventions"]
    print(f"Párrafos encontrados: {stats['found']}. Sin encontrar (conservan su tiempo): {stats['missing']}.")
    print(f"Intervenciones: {before} -> {after}. Interrupciones: {len(derived['interruptions'])}.")
    if args.dry_run:
        return
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(target, BACKUP_DIR / f"{args.slug}.{datetime.now():%Y%m%d-%H%M%S}.json")
    target.write_text(json.dumps(derived, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Guardado: {target}")


if __name__ == "__main__":
    main()
