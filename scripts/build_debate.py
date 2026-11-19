"""Genera un debate (src/data/2026/generales/debates/<slug>.json) desde su transcripción (WhisperX con diarización).

Uso: python scripts/build_debate.py <transcripcion.json> <configuracion.json>

- La configuración (ver scripts/debates/*.json) dice el identificador, el título, la fecha, la cadena y el enlace a
  la fuente (`date`, `channel`, `url`, opcionales), los hablantes, la relación entre
  las etiquetas SPEAKER_XX y los hablantes, y los segmentos asignados a mano (`overrides`, por segundo de inicio).
- Las pausas publicitarias no entran: `skip` es una lista de rangos [inicio, fin] en segundos, y una etiqueta con el
  valor «omitir» en `diarization` se descarta entera.
- `textFixes`: lista de [expresión regular, sustitución] para los nombres que la transcripción escribe mal.
- `splits`: una frase de otro hablante dentro de un segmento ({"start", "text", "speaker"}). Se corta con los tiempos
  de cada palabra.
- Cada segmento es un turno. Los turnos seguidos del mismo hablante forman una intervención.
- Los campos derivados (cortes, gráficas, temas, tiempo de palabra) los calcula `debate_derive.py`.
- Generar de nuevo sobrescribe las ediciones hechas con `scripts/editor_debate.py`. Hágalo solo para empezar de cero.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEBATES_DIR = ROOT / "src" / "data" / "2026" / "generales" / "debates"
sys.path.insert(0, str(Path(__file__).resolve().parent))
from debate_derive import derive  # noqa: E402


UNASSIGNED = "sin-asignar"
SKIPPED = "omitir"
# Two segments of the same speaker with a longer silence between them are two turns.
MAX_JOIN_GAP = 30.0


def fold_token(word: str) -> str:
    """A word without accents, case or punctuation, to compare a phrase with the words of a segment."""
    word = unicodedata.normalize("NFD", word.lower()).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", word)


def split_segment(seg: dict, rules: list[dict]) -> list[dict]:
    """Cuts a segment where a phrase of another speaker starts and ends, with the times of its words.

    Each rule is {"text": phrase, "speaker": id}. The words outside every phrase keep the speaker of the segment
    (`speaker` None). A phrase that is not found leaves the segment as it is, with a warning.
    """
    words = [w for w in seg.get("words", []) if fold_token(w.get("word", ""))]
    tokens = [fold_token(w["word"]) for w in words]
    owner: list[str | None] = [None] * len(words)
    for rule in rules:
        phrase = [t for t in (fold_token(w) for w in rule["text"].split()) if t]
        at = next((i for i in range(len(tokens) - len(phrase) + 1) if tokens[i : i + len(phrase)] == phrase), None)
        if at is None:
            print(f"Aviso: no encuentro «{rule['text']}» en el segmento de {seg['start']:.2f} s.")
            continue
        for i in range(at, at + len(phrase)):
            owner[i] = rule["speaker"]
    # Words with no time take the time of their neighbours.
    last = seg["start"]
    for w in words:
        w.setdefault("start", last)
        w.setdefault("end", w["start"])
        last = w["end"]
    pieces: list[dict] = []
    for w, who in zip(words, owner):
        if pieces and pieces[-1]["forced"] == who:
            pieces[-1]["end"] = w["end"]
            pieces[-1]["text"] += f" {w['word']}"
        else:
            pieces.append({"start": w["start"], "end": w["end"], "text": w["word"], "forced": who, "speaker": seg.get("speaker")})
    if pieces:
        pieces[0]["start"] = seg["start"]  # the first piece keeps the start, so an override still finds it
    return pieces or [seg]


def main(transcript_path: str, config_path: str) -> None:
    with open(config_path, encoding="utf-8") as handle:
        config = json.load(handle)
    with open(transcript_path, encoding="utf-8") as handle:
        segments = sorted(json.load(handle)["segments"], key=lambda seg: seg["start"])

    overrides = {round(float(start), 3): speaker_id for start, speaker_id in config.get("overrides", {}).items()}
    diarization = config.get("diarization", {})
    speakers = list(config["speakers"])
    interventions = []
    # Advertising breaks and other parts that are not the debate: time ranges (`skip`) or a label mapped to «omitir».
    skip = [(float(start), float(end)) for start, end in config.get("skip", [])]
    # Names that the transcription writes wrong: [regular expression, replacement], in order.
    text_fixes = [(re.compile(pattern), replacement) for pattern, replacement in config.get("textFixes", [])]
    # A phrase of another speaker inside a segment: {"start": start of the segment, "text": phrase, "speaker": id}.
    rules_by_start: dict[float, list[dict]] = {}
    for rule in config.get("splits", []):
        rules_by_start.setdefault(round(float(rule["start"]), 2), []).append(rule)
    pieces = []
    for seg in segments:
        rules = rules_by_start.pop(round(seg["start"], 2), None)
        pieces.extend(split_segment(seg, rules) if rules else [seg])
    for start in rules_by_start:
        print(f"Aviso: ningún segmento empieza en {start} s (splits).")
    for seg in pieces:
        if any(start <= seg["start"] < end for start, end in skip):
            continue
        # A segment with no label, or with a label missing from the map, goes to «Sin asignar»: fix it in the editor.
        speaker_id = seg.get("forced") or overrides.get(round(seg["start"], 3), diarization.get(seg.get("speaker") or "", UNASSIGNED))
        if speaker_id == SKIPPED:
            continue
        text = seg["text"].strip()
        for pattern, replacement in text_fixes:
            text = pattern.sub(replacement, text)
        # The same speaker continues the turn, unless a skipped break or a long silence lies in between.
        previous_end = interventions[-1]["end"] if interventions else None
        joined = previous_end is not None and seg["start"] - previous_end <= MAX_JOIN_GAP and not any(
            previous_end <= start < seg["start"] for start, _ in skip
        )
        if interventions and interventions[-1]["speaker"] == speaker_id and joined:
            interventions[-1]["end"] = round(seg["end"], 1)
            interventions[-1]["paragraphs"].append(text)
        else:
            interventions.append(
                {
                    "speaker": speaker_id,
                    "start": round(seg["start"], 1),
                    "end": round(seg["end"], 1),
                    "paragraphs": [text],
                }
            )

    if any(item["speaker"] == UNASSIGNED for item in interventions) and all(sp["id"] != UNASSIGNED for sp in speakers):
        speakers.append({"id": UNASSIGNED, "name": "Sin asignar", "role": "", "partyId": None})
    data = derive(
        {
            "slug": config["slug"],
            "title": config["title"],
            **{key: config[key] for key in ("date", "channel", "url", "urlLabel", "published", "golden") if key in config},
            # The skipped ranges are the advertising breaks: the page marks them as «Pausa».
            **({"breaks": [[float(start), float(end)] for start, end in config["skip"]]} if config.get("skip") else {}),
            "durationSeconds": round(segments[-1]["end"]),
            "speakers": speakers,
            "interventions": interventions,
        }
    )
    DEBATES_DIR.mkdir(parents=True, exist_ok=True)
    target = DEBATES_DIR / f"{config['slug']}.json"
    target.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(interventions)} intervenciones, {len(data['interruptions'])} interrupciones -> {target}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Uso: python scripts/build_debate.py <transcripcion.json> <configuracion.json>")
    main(sys.argv[1], sys.argv[2])
