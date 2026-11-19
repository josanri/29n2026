"""Analiza la grabación de un debate: zonas de voces a la vez y comprobación de hablantes por la voz.

Uso: python scripts/debate_audio.py <slug> [--voices]

- La grabación es `.cache/debate-audio/<slug>.<ext>` (la misma que usa el editor). No se publica.
- Zonas de voces a la vez: el modelo `pyannote/segmentation-3.0` las detecta. Se guardan en el campo `overlaps` del
  debate, y `debate_derive.py` las usa para marcar las interrupciones. Después se recalculan los campos derivados.
- `--voices`: compara la voz de cada intervención con la voz media de cada hablante (`pyannote/wespeaker-voxceleb-
  resnet34-LM`) y lista las que se parecen más a otro hablante. No cambia nada: revise cada caso en el editor. En las
  interjecciones cortas y en las zonas de voces a la vez, la voz más fuerte gana, así que hay falsos avisos.

Necesita pyannote.audio, torch y ffmpeg, y los modelos en la caché local (no los descarga).
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

os.environ.setdefault("HF_HUB_OFFLINE", "1")
# The cached pyannote checkpoints are pickles of the official models; torch 2.6+ refuses them by default.
os.environ.setdefault("TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD", "1")

sys.path.insert(0, str(Path(__file__).resolve().parent))
from debate_derive import derive  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DEBATES_DIR = ROOT / "src" / "data" / "2026" / "generales" / "debates"
AUDIO_DIR = ROOT / ".cache" / "debate-audio"
AUDIO_EXTENSIONS = (".m4a", ".mp3", ".ogg", ".opus", ".wav")
# Interventions this long or longer make the reference voice of each speaker.
REFERENCE_SECONDS = 15


def recording(slug: str) -> Path:
    for extension in AUDIO_EXTENSIONS:
        path = AUDIO_DIR / f"{slug}{extension}"
        if path.exists():
            return path
    sys.exit(f"No hay grabación en {AUDIO_DIR} para «{slug}».")


def to_mono_16k(source: Path, target: Path) -> None:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(source), "-ac", "1", "-ar", "16000", str(target)], check=True)


def detect_overlaps(audio: Path, device) -> list[list[float]]:
    from pyannote.audio import Model
    from pyannote.audio.pipelines import OverlappedSpeechDetection

    pipeline = OverlappedSpeechDetection(segmentation=Model.from_pretrained("pyannote/segmentation-3.0"))
    pipeline.instantiate({"min_duration_on": 0.1, "min_duration_off": 0.1})
    pipeline.to(device)
    timeline = pipeline(str(audio)).get_timeline().support()
    return [[round(segment.start, 2), round(segment.end, 2)] for segment in timeline]


def check_voices(audio: Path, data: dict, device) -> None:
    import numpy as np
    from pyannote.audio import Inference, Model
    from pyannote.core import Segment

    inference = Inference(Model.from_pretrained("pyannote/wespeaker-voxceleb-resnet34-LM"), window="whole")
    inference.to(device)
    duration = data["durationSeconds"]

    def embed(start: float, end: float):
        if end - start < 1.0:
            middle = (start + end) / 2
            start, end = middle - 0.5, middle + 0.5
        vector = np.asarray(inference.crop(str(audio), Segment(max(0, start), min(duration, end)))).ravel()
        return vector / np.linalg.norm(vector)

    samples: dict[str, list] = {}
    for intervention in data["interventions"]:
        start, end = intervention["start"], intervention["end"]
        if end - start >= REFERENCE_SECONDS:
            middle = (start + end) / 2
            samples.setdefault(intervention["speaker"], []).append(embed(max(start + 2, middle - 10), min(end - 2, middle + 10)))
    references = {speaker: np.mean(vectors, 0) / np.linalg.norm(np.mean(vectors, 0)) for speaker, vectors in samples.items()}

    print("Intervenciones con una voz más parecida a otro hablante (revíselas en el editor):")
    for index, intervention in enumerate(data["interventions"]):
        vector = embed(intervention["start"], intervention["end"])
        scores = {speaker: float(vector @ reference) for speaker, reference in references.items()}
        best = max(scores, key=scores.get)
        if best != intervention["speaker"]:
            text = " ".join(intervention["paragraphs"])[:70]
            print(
                f"  {index + 1:4d}  {intervention['start']:8.1f} s  {intervention['speaker']} -> {best}"
                f"  ({scores[best]:.2f} frente a {scores.get(intervention['speaker'], 0):.2f})  {text}"
            )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("slug")
    parser.add_argument("--voices", action="store_true", help="Compara también la voz de cada intervención.")
    args = parser.parse_args()

    import torch

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    target = DEBATES_DIR / f"{args.slug}.json"
    data = json.loads(target.read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory() as folder:
        audio = Path(folder) / "debate16k.wav"
        to_mono_16k(recording(args.slug), audio)
        data["overlaps"] = detect_overlaps(audio, device)
        print(f"Zonas de voces a la vez: {len(data['overlaps'])} ({sum(b - a for a, b in data['overlaps']):.0f} s).")
        derived = derive(data)
        target.write_text(json.dumps(derived, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"Interrupciones: {len(derived['interruptions'])}. Guardado: {target}")
        if args.voices:
            check_voices(audio, derived, device)


if __name__ == "__main__":
    main()
