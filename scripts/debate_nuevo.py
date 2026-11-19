"""Prepara un debate nuevo desde la salida de WhisperX: hablantes, datos, audio para el editor y voces a la vez.

Uso:
  python scripts/debate_nuevo.py <configuracion.json> <transcripcion.json> [--audio grabacion.wav] [--force]

Pasos:
1. Muestra cada etiqueta de WhisperX (SPEAKER_00, SPEAKER_01…): minutos, turnos, frases de ejemplo y los nombres
   que se dicen justo antes de que hable (la moderación suele dar la palabra por el nombre). Con eso, escriba en
   la configuración qué hablante es cada etiqueta (`diarization`).
2. Si falta alguna etiqueta en `diarization`, se detiene. Con `--force`, las que faltan van a «Sin asignar».
3. Genera `src/data/2026/generales/debates/<slug>.json` con `build_debate.py`. Si ya existe, se detiene para no
   borrar ediciones; `--force` lo sobrescribe (queda una copia en `.cache/debate-backups/`).
4. Con `--audio`, deja la grabación en `.cache/debate-audio/<slug>.<ext>` (la que usa el editor) y calcula las
   zonas de voces a la vez con `debate_audio.py`, que mejoran la detección de interrupciones.

Después: `npm run debate:editor` para corregir, y `npm run debate:retime -- <transcripcion.json> <slug>` tras editar.
Mientras la configuración tenga `"published": false`, el debate solo se ve en local (`npm run dev`).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = Path(__file__).resolve().parent
DEBATES_DIR = ROOT / "src" / "data" / "2026" / "generales" / "debates"
AUDIO_DIR = ROOT / ".cache" / "debate-audio"
BACKUP_DIR = ROOT / ".cache" / "debate-backups"
# Seconds before a turn where a name counts as «se lo dicen justo antes».
CUE_SECONDS = 12
SAMPLES = 3

sys.path.insert(0, str(SCRIPTS))
from debate_derive import fold  # noqa: E402


def label_summary(segments: list[dict], speakers: list[dict]) -> dict[str, dict]:
    """For each label: seconds, turns, the longest sentences and the names said just before its turns."""
    names = {}
    for speaker in speakers:
        if not speaker.get("name") or speaker.get("id") == "sin-asignar":
            continue
        surname = fold(speaker["name"]).split()[-1]
        names[speaker["id"]] = re.compile(rf"\b{re.escape(surname)}\b")
    summary: dict[str, dict] = defaultdict(lambda: {"seconds": 0.0, "turns": 0, "texts": [], "cues": Counter()})
    previous_label = None
    for index, segment in enumerate(segments):
        label = segment.get("speaker") or "(sin etiqueta)"
        item = summary[label]
        item["seconds"] += segment["end"] - segment["start"]
        item["texts"].append(segment["text"].strip())
        if label != previous_label:
            item["turns"] += 1
            # Names said by another label in the seconds before this turn.
            for before in reversed(segments[:index]):
                if segment["start"] - before["end"] > CUE_SECONDS:
                    break
                if (before.get("speaker") or "") == label:
                    continue
                for speaker_id, pattern in names.items():
                    if pattern.search(fold(before["text"])):
                        item["cues"][speaker_id] += 1
        previous_label = label
    return summary


def print_summary(summary: dict[str, dict], diarization: dict[str, str]) -> None:
    print("Etiquetas de WhisperX (de más a menos tiempo):\n")
    for label, item in sorted(summary.items(), key=lambda pair: -pair[1]["seconds"]):
        mapped = diarization.get(label)
        print(f"{label}  {item['seconds'] / 60:5.1f} min  {item['turns']:3d} turnos  ->  {mapped or 'SIN ASIGNAR EN LA CONFIGURACIÓN'}")
        if item["cues"]:
            cues = ", ".join(f"{speaker_id} {count}" for speaker_id, count in item["cues"].most_common(3))
            print(f"    Nombres dichos justo antes de que hable: {cues}")
        for text in sorted(item["texts"], key=len, reverse=True)[:SAMPLES]:
            print(f"    «{text[:150]}»")
        print()


def place_audio(source: Path, slug: str) -> Path:
    """The recording at `.cache/debate-audio/<slug><ext>`: a hard link when possible (no copy of 1 GB), else a copy."""
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    target = AUDIO_DIR / f"{slug}{source.suffix.lower()}"
    if target.exists():
        if target.samefile(source):
            return target
        target.unlink()
    try:
        os.link(source, target)
    except OSError:
        shutil.copy2(source, target)
    return target


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("config", type=Path)
    parser.add_argument("transcript", type=Path)
    parser.add_argument("--audio", type=Path, help="La grabación (.wav, .m4a, .mp3…).")
    parser.add_argument("--force", action="store_true", help="Sigue con etiquetas sin asignar y sobrescribe el debate.")
    args = parser.parse_args()

    config = json.loads(args.config.read_text(encoding="utf-8"))
    segments = sorted(json.loads(args.transcript.read_text(encoding="utf-8"))["segments"], key=lambda seg: seg["start"])
    diarization = config.get("diarization", {})
    speaker_ids = {speaker["id"] for speaker in config["speakers"]}

    summary = label_summary(segments, config["speakers"])
    print_summary(summary, diarization)

    wrong = {label: speaker for label, speaker in diarization.items() if speaker not in speaker_ids | {"omitir"}}
    if wrong:
        sys.exit(f"En `diarization` hay hablantes que no están en `speakers`: {wrong}")
    missing = [label for label in summary if label not in diarization]
    if missing and not args.force:
        sys.exit(
            f"Falta asignar {', '.join(missing)} en `diarization` de {args.config}.\n"
            "Escriba, por ejemplo, \"SPEAKER_01\": \"moderacion\" y vuelva a ejecutar. Con --force van a «Sin asignar»."
        )

    slug = config["slug"]
    target = DEBATES_DIR / f"{slug}.json"
    if target.exists():
        if not args.force:
            sys.exit(f"{target} ya existe. Para no borrar ediciones, no lo sobrescribo. Use --force para generarlo de nuevo.")
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(target, BACKUP_DIR / f"{slug}.{datetime.now():%Y%m%d-%H%M%S}.json")

    subprocess.run([sys.executable, str(SCRIPTS / "build_debate.py"), str(args.transcript), str(args.config)], check=True)

    if args.audio:
        placed = place_audio(args.audio, slug)
        print(f"Audio para el editor: {placed}")
        result = subprocess.run([sys.executable, str(SCRIPTS / "debate_audio.py"), slug])
        if result.returncode != 0:
            print("Aviso: no se pudieron calcular las voces a la vez. Las interrupciones usan solo los tiempos.")

    print(
        "\nSiguiente:\n"
        "  1. npm run debate:editor            (corrija hablantes, texto y tiempos)\n"
        f"  2. npm run debate:retime -- {args.transcript.as_posix()} {slug}\n"
        "  3. npm run dev                       (la página sale como borrador en /debates/)\n"
        '  4. Para publicar: "published": true en el JSON del debate.'
    )


if __name__ == "__main__":
    main()
