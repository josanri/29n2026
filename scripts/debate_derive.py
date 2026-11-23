"""Calcula los campos derivados de un debate (src/data/<eleccion>/debates/<slug>.json) a partir de sus intervenciones.

Lo usan `build_debate.py` (la primera generación desde la transcripción), `debate_retime.py` y `editor_debate.py`
(cada vez que se guarda una edición). Las intervenciones son la fuente de verdad: los cortes, las gráficas, los temas
y el tiempo de palabra se recalculan siempre desde ellas, así que no hay que editarlos a mano.

Interrupciones. La transcripción no las marca, así que son una aproximación. Un cambio de hablante es una
interrupción si tiene al menos una de estas señales:
- Habla superpuesta: el turno nuevo empieza antes de que acabe el anterior, o el audio tiene al menos
  `MIN_OVERLAP_SECONDS` de voces a la vez cerca del cambio. Las zonas de voces a la vez (`overlaps`) las calcula
  `debate_audio.py` desde la grabación. Sin ellas, solo cuenta el solape de los tiempos.
- Frase cortada: el turno anterior acaba en «...» y la pausa es corta.
- Interjección: el turno nuevo es corto y después vuelve a hablar quien tenía la palabra.
No es una interrupción:
- Quien tenía la palabra la recupera después de una interjección corta.
- La moderadora hace una pregunta o da la palabra por el nombre, y el candidato responde.
- El turno nuevo es solo un saludo o un asentimiento («Buenas noches», «Gracias», «Sí, sí»).
Una interrupción de la moderadora es de tipo «moderacion»; las demás son de tipo «interrupcion».
La intervención que corta lleva `cut: true` y `kind`; la cortada, `cutOff: true`.

Las gráficas usan bloques de `binSeconds` (por defecto 300 s = 5 min).

Minuto de oro. `golden` es la lista de los cierres de cada candidato (`speaker`, `start`, `end`). Si el debate no la
tiene, se propone sola: en el último cuarto del debate, el último turno de 35 a 100 s de cada candidato que llega
justo después de que la moderación diga «minuto». Corríjala a mano en el JSON si hace falta: una lista escrita no se
vuelve a calcular.
"""

from __future__ import annotations

import re
from collections import Counter

DEFAULT_BIN_SECONDS = 300
PREVIEW_CHARS = 160
CONTEXT_CHARS = 90
# Seconds of overlapped speech, around the change of speaker, that make it an interruption.
MIN_OVERLAP_SECONDS = 0.5
OVERLAP_WINDOW = 0.8
# A new turn that starts this many seconds before the previous one ends overlaps it.
EARLY_START = 0.2
# A pause of this many seconds or less still counts for «frase cortada» and «interjección».
SHORT_GAP = 0.4
# An interjection has this many words or fewer.
INTERJECTION_WORDS = 15
ACKNOWLEDGEMENT = re.compile(
    r"^((muy )?buenas noches|(muchas )?gracias|si|vale|claro|bien|ya|exacto|correcto|de acuerdo|bueno|eh|que tal)([ ,.!?]+(si|claro|gracias|que tal|ana))*[ .,!?]*$"
)

# Temas por palabras clave, en minúsculas y sin tilde. Editable: cambie la expresión regular o añada un tema.
TOPICS = {
    "vivienda": ("Vivienda", r"vivienda|alquiler|desahuci|suelo|hipoteca"),
    "empleo": ("Empleo", r"empleo|salario|paro|huelga|trabajo"),
    "infraestructuras": ("Infraestructuras", r"tren|ferrovia|infraestructur|adif|renfe|vias"),
    "impuestos": ("Impuestos", r"impuest|fiscal|recaudaci|deflacta"),
    "pensiones": ("Pensiones", r"pension"),
    "economia": ("Economía", r"econom|inflaci|precio"),
    "inmigracion": ("Inmigración", r"inmigra|migrante"),
}


def fold(text: str) -> str:
    """Minúsculas y sin tilde, para buscar palabras clave."""
    table = str.maketrans("áéíóúüñÁÉÍÓÚÜÑ", "aeiouunAEIOUUN")
    return text.translate(table).lower()


def preview(text: str, size: int = PREVIEW_CHARS) -> str:
    """El inicio de un texto, cortado en una palabra completa."""
    if len(text) <= size:
        return text
    cut = text[:size].rsplit(" ", 1)[0]
    return f"{cut}…"


def tail(text: str, size: int = CONTEXT_CHARS) -> str:
    """El final de un texto, cortado en una palabra completa."""
    if len(text) <= size:
        return text
    cut = text[-size:].split(" ", 1)[-1]
    return f"…{cut}"


def word_count(paragraphs: list[str]) -> int:
    return sum(len(paragraph.split()) for paragraph in paragraphs)


def is_moderator(speaker: dict | None) -> bool:
    return bool(speaker) and fold(speaker.get("role", "")).startswith("moderad")


def validate(data: dict) -> list[str]:
    """Problemas que impiden guardar (errores) y avisos que no lo impiden. Devuelve (errores, avisos)."""
    errors, warnings = [], []
    speaker_ids = {speaker["id"] for speaker in data.get("speakers", [])}
    previous_start = None
    for index, intervention in enumerate(data.get("interventions", [])):
        label = f"Intervención {index + 1}"
        if intervention.get("speaker") not in speaker_ids:
            errors.append(f"{label}: el hablante «{intervention.get('speaker')}» no existe en la lista de hablantes.")
        if intervention["end"] < intervention["start"]:
            errors.append(f"{label}: el fin es anterior al inicio.")
        if previous_start is not None and intervention["start"] < previous_start:
            warnings.append(f"{label}: empieza antes que la intervención anterior.")
        previous_start = intervention["start"]
    ids = [speaker["id"] for speaker in data.get("speakers", [])]
    if len(ids) != len(set(ids)):
        errors.append("Hay dos hablantes con el mismo identificador.")
    return errors, warnings


def overlap_seconds(overlaps: list[list[float]], start: float, end: float) -> float:
    return sum(max(0.0, min(end, b) - max(start, a)) for a, b in overlaps)


def classify(interventions: list[dict], index: int, speakers: dict, overlaps: list) -> str | None:
    """The kind of the change of speaker before intervention `index`: "interrupcion", "moderacion" or None."""
    previous, current = interventions[index - 1], interventions[index]
    if previous["speaker"] == current["speaker"]:
        return None
    gap = current["start"] - previous["end"]
    first = fold(current["paragraphs"][0]).strip()
    last = previous["paragraphs"][-1].strip()
    words = word_count(current["paragraphs"])
    resumes = index + 1 < len(interventions) and interventions[index + 1]["speaker"] == previous["speaker"]

    early = gap < -EARLY_START
    overlapped = gap <= SHORT_GAP and overlap_seconds(overlaps, current["start"] - OVERLAP_WINDOW, current["start"] + OVERLAP_WINDOW) >= MIN_OVERLAP_SECONDS
    trailing = last.endswith(("...", "…")) and gap <= SHORT_GAP
    interjection = words <= INTERJECTION_WORDS and resumes and gap <= SHORT_GAP and not last.endswith("?")
    if not (early or overlapped or trailing or interjection):
        return None

    # A greeting or a «sí, sí» is not an interruption, unless it starts over the other voice.
    if ACKNOWLEDGEMENT.match(re.sub(r"[¿¡]", "", first)) and not early:
        return None
    # The floor holder takes the floor back after a short interjection.
    if index >= 2:
        before = interventions[index - 2]
        if before["speaker"] == current["speaker"] and previous.get("cut") and word_count(previous["paragraphs"]) <= INTERJECTION_WORDS:
            return None
    # The moderator asks or gives the floor by name (or handover cue), and the candidate answers.
    if is_moderator(speakers.get(previous["speaker"])) and gap >= -1.0:
        surname = fold(speakers.get(current["speaker"], {}).get("name", "")).split()[-1:] or [""]
        role = fold(speakers.get(current["speaker"], {}).get("role", ""))
        turn_text = fold(" ".join(previous["paragraphs"]))
        handover = re.search(r"\b(prosiga|adelante|su turno|cuando quiera)\b", fold(last))
        if last.endswith("?") or handover or (surname[0] and surname[0] in turn_text) or (role and re.search(rf"\b{re.escape(role)}\b", turn_text)):
            return None
    return "moderacion" if is_moderator(speakers.get(current["speaker"])) else "interrupcion"


GOLDEN_MIN_SECONDS = 35
GOLDEN_MAX_SECONDS = 100


def suggest_golden(interventions: list[dict], speakers: dict, duration: float) -> list[dict]:
    """The closing minute of each candidate: see «Minuto de oro» above. Ordered by time."""
    found: dict[str, dict] = {}
    for index in range(1, len(interventions)):
        current, previous = interventions[index], interventions[index - 1]
        length = current["end"] - current["start"]
        if (
            current["start"] >= duration * 0.75
            and GOLDEN_MIN_SECONDS <= length <= GOLDEN_MAX_SECONDS
            and not is_moderator(speakers.get(current["speaker"]))
            and current["speaker"] in speakers
            and is_moderator(speakers.get(previous["speaker"]))
            and "minuto" in fold(" ".join(previous["paragraphs"]))
        ):
            found[current["speaker"]] = {"speaker": current["speaker"], "start": current["start"], "end": current["end"]}
    return sorted(found.values(), key=lambda item: item["start"])


def derive(data: dict) -> dict:
    """Devuelve `data` con los campos derivados recalculados. No cambia el texto ni los tiempos."""
    bin_seconds = int(data.get("binSeconds") or DEFAULT_BIN_SECONDS)
    overlaps = data.get("overlaps") or []
    speaker_by_id = {speaker["id"]: speaker for speaker in data.get("speakers", [])}
    interventions = data["interventions"]
    for intervention in interventions:
        intervention["start"] = round(float(intervention["start"]), 1)
        intervention["end"] = round(float(intervention["end"]), 1)
        intervention["cut"] = False
        intervention["cutOff"] = False
        intervention.pop("kind", None)
        intervention["topics"] = [
            topic_id for topic_id, (_, pattern) in TOPICS.items() if re.search(pattern, fold(" ".join(intervention["paragraphs"])))
        ]

    interruptions = []
    for index in range(1, len(interventions)):
        kind = classify(interventions, index, speaker_by_id, overlaps)
        if not kind:
            continue
        previous, current = interventions[index - 1], interventions[index]
        current["cut"] = True
        current["kind"] = kind
        previous["cutOff"] = True
        interruptions.append(
            {
                "start": current["start"],
                "kind": kind,
                "by": current["speaker"],
                "of": previous["speaker"],
                "text": preview(" ".join(current["paragraphs"])),
                "before": tail(previous["paragraphs"][-1]),
                "intervention": index,
                "topics": current["topics"],
            }
        )

    duration = max(round(float(data.get("durationSeconds", 0))), round(max(i["end"] for i in interventions)))
    bin_count = duration // bin_seconds + 1
    density = [0] * bin_count
    moderation = [0] * bin_count
    for event in interruptions:
        target = density if event["kind"] == "interrupcion" else moderation
        target[int(event["start"] // bin_seconds)] += 1

    topics = []
    for topic_id, (label, pattern) in TOPICS.items():
        regex = re.compile(pattern)
        mentions = [0] * bin_count
        for intervention in interventions:
            for paragraph in intervention["paragraphs"]:
                mentions[int(intervention["start"] // bin_seconds)] += len(regex.findall(fold(paragraph)))
        topics.append(
            {
                "id": topic_id,
                "label": label,
                "mentions": mentions,
                "total": sum(mentions),
                "interruptions": sum(1 for event in interruptions if topic_id in event["topics"]),
            }
        )

    seconds, words, turns, longest = Counter(), Counter(), Counter(), Counter()
    made, received, moderations_made, moderations_received = Counter(), Counter(), Counter(), Counter()
    for intervention in interventions:
        length = intervention["end"] - intervention["start"]
        seconds[intervention["speaker"]] += length
        words[intervention["speaker"]] += word_count(intervention["paragraphs"])
        turns[intervention["speaker"]] += 1
        longest[intervention["speaker"]] = max(longest[intervention["speaker"]], length)
    for event in interruptions:
        if event["kind"] == "interrupcion":
            made[event["by"]] += 1
            received[event["of"]] += 1
        else:
            moderations_made[event["by"]] += 1
            moderations_received[event["of"]] += 1

    speakers = []
    for speaker in data.get("speakers", []):
        speaker_id = speaker["id"]
        speakers.append(
            {
                "id": speaker_id,
                "name": speaker["name"],
                "role": speaker.get("role", ""),
                "partyId": speaker.get("partyId"),
                "minutes": round(seconds[speaker_id] / 60, 1),
                "words": words[speaker_id],
                "turns": turns[speaker_id],
                "longestSeconds": round(longest[speaker_id]),
                "cutsMade": made[speaker_id],
                "cutsReceived": received[speaker_id],
                "moderationsMade": moderations_made[speaker_id],
                "moderationsReceived": moderations_received[speaker_id],
            }
        )

    result = {
        "slug": data.get("slug", ""),
        "title": data.get("title", ""),
        "durationSeconds": duration,
        "binSeconds": bin_seconds,
        "speakers": speakers,
        "interventions": interventions,
        "interruptions": interruptions,
        "density": density,
        "moderationDensity": moderation,
        "topics": topics,
    }
    result["golden"] = data.get("golden") or suggest_golden(interventions, speaker_by_id, duration)
    for key in ("date", "channel", "url", "urlLabel", "published", "breaks", "overlaps"):
        if key in data:
            result[key] = data[key]
    return result
