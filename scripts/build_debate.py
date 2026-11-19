"""Genera un debate (src/data/2026/generales/debates/<slug>.json) desde su transcripción (WhisperX con diarización).

Uso: python scripts/build_debate.py <transcripcion.json> <configuracion.json>

- La configuración (ver scripts/debates/*.json) dice el identificador, el título, la fecha, la cadena y el enlace a
  la fuente (`date`, `channel`, `url`, opcionales), los hablantes, la relación entre
  las etiquetas SPEAKER_XX y los hablantes, y los segmentos asignados a mano (`overrides`, por segundo de inicio).
- Cada segmento es un turno. Los turnos seguidos del mismo hablante forman una intervención.
- Los campos derivados (cortes, gráficas, temas, tiempo de palabra) los calcula `debate_derive.py`.
- Generar de nuevo sobrescribe las ediciones hechas con `scripts/editor_debate.py`. Hágalo solo para empezar de cero.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEBATES_DIR = ROOT / "src" / "data" / "2026" / "generales" / "debates"
sys.path.insert(0, str(Path(__file__).resolve().parent))
from debate_derive import derive  # noqa: E402


def main(transcript_path: str, config_path: str) -> None:
    with open(config_path, encoding="utf-8") as handle:
        config = json.load(handle)
    with open(transcript_path, encoding="utf-8") as handle:
        segments = sorted(json.load(handle)["segments"], key=lambda seg: seg["start"])

    overrides = {round(float(start), 3): speaker_id for start, speaker_id in config.get("overrides", {}).items()}
    interventions = []
    for seg in segments:
        label = seg.get("speaker") or "SPEAKER_00"
        speaker_id = overrides.get(round(seg["start"], 3), config["diarization"][label])
        text = seg["text"].strip()
        if interventions and interventions[-1]["speaker"] == speaker_id:
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

    data = derive(
        {
            "slug": config["slug"],
            "title": config["title"],
            **{key: config[key] for key in ("date", "channel", "url") if key in config},
            "durationSeconds": round(segments[-1]["end"]),
            "speakers": config["speakers"],
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
