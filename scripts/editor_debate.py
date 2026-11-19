"""Editor interno de los debates (src/data/2026/generales/debates/<slug>.json).

Uso (desde la raíz del proyecto):  python scripts/editor_debate.py [--port 8765]
Después abra http://127.0.0.1:8765/ y elija el debate en la lista.

- Solo escucha en 127.0.0.1: no es accesible desde otros equipos.
- Al guardar: valida, recalcula los campos derivados (cortes, gráficas, temas, tiempo de palabra) con
  `debate_derive.py`, copia el archivo anterior en `.cache/debate-backups/` y escribe el nuevo.
- Después de guardar, compile el sitio (`npm run build`) para publicar los cambios.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from array import array
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from debate_derive import derive, validate  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DEBATES_DIR = ROOT / "src" / "data" / "2026" / "generales" / "debates"
EDITOR_DIR = Path(__file__).resolve().parent / "editor_debate"
# Files of the editor page, served at these paths. Anything else is 404.
STATIC_FILES = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/styles.css": ("styles.css", "text/css; charset=utf-8"),
    "/audio.js": ("audio.js", "text/javascript; charset=utf-8"),
}
BACKUP_DIR = ROOT / ".cache" / "debate-backups"
# The recordings live in the ignored cache folder, so the site build never publishes them.
# A debate's audio is `<slug>.<ext>` in this folder. The first extension of this list that exists is used.
AUDIO_DIR = ROOT / ".cache" / "debate-audio"
AUDIO_TYPES = {".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".opus": "audio/ogg", ".wav": "audio/wav"}
RANGE_CHUNK = 1 << 20
# The waveform: one peak every PEAK_STEP seconds, read from a mono 1 kHz decode of the recording.
PEAK_RATE = 1000
PEAK_STEP = 0.25
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


def debate_path(slug: str) -> Path | None:
    """The file of a debate, or None when the slug is not valid or the debate does not exist."""
    if not SLUG_PATTERN.match(slug):
        return None
    path = DEBATES_DIR / f"{slug}.json"
    return path if path.exists() else None


def audio_path(slug: str) -> Path | None:
    """The recording of a debate, the first format found in AUDIO_TYPES order, or None."""
    for extension in AUDIO_TYPES:
        path = AUDIO_DIR / f"{slug}{extension}"
        if path.exists():
            return path
    return None


def peaks_path(slug: str) -> Path:
    return AUDIO_DIR / f"{slug}.peaks.json"


def build_peaks(recording: Path) -> dict:
    """Decodes the recording with ffmpeg and keeps the highest level of each PEAK_STEP seconds (0 to 255)."""
    command = ["ffmpeg", "-v", "error", "-i", str(recording), "-vn", "-ac", "1", "-ar", str(PEAK_RATE), "-f", "s16le", "-"]
    decoded = subprocess.run(command, capture_output=True, check=True, timeout=900).stdout
    samples = array("h")
    samples.frombytes(decoded[: len(decoded) - len(decoded) % 2])
    per_peak = int(PEAK_RATE * PEAK_STEP)
    values = []
    for offset in range(0, len(samples), per_peak):
        block = samples[offset : offset + per_peak]
        values.append(max(abs(min(block)), abs(max(block))))
    top = max(values) or 1
    return {"step": PEAK_STEP, "values": [round(value * 255 / top) for value in values]}


def get_peaks(slug: str) -> dict | None:
    """The waveform of a debate: read from the cache, or built once with ffmpeg. None when it cannot be built."""
    cached = peaks_path(slug)
    if cached.exists():
        return json.loads(cached.read_text(encoding="utf-8"))
    recording = audio_path(slug)
    if recording is None:
        return None
    try:
        peaks = build_peaks(recording)
    except (OSError, subprocess.SubprocessError):
        return None
    cached.write_text(json.dumps(peaks, separators=(",", ":")), encoding="utf-8")
    return peaks


def editor_files() -> list[Path]:
    """Every file whose change should restart the server or reload the page."""
    return [Path(__file__).resolve(), Path(__file__).resolve().parent / "debate_derive.py", *EDITOR_DIR.glob("*")]


def editor_version() -> str:
    """Changes whenever one of the editor files changes. The page compares it to reload itself."""
    stamps = [path.stat().st_mtime_ns for path in editor_files() if path.exists()]
    return str(max(stamps, default=0))


def list_debates() -> list[dict]:
    debates = []
    for path in sorted(DEBATES_DIR.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        debates.append(
            {
                "slug": path.stem,
                "title": data.get("title") or path.stem,
                "interventions": len(data["interventions"]),
                "audio": audio_path(path.stem) is not None,
            }
        )
    return debates


class EditorHandler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_json(self, status: int, payload: object) -> None:
        self._send(status, json.dumps(payload, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

    def _slug_from_path(self) -> str | None:
        prefix = "/api/debates/"
        if self.path.startswith(prefix) and len(self.path) > len(prefix):
            return self.path[len(prefix):].split("/")[0]
        return None

    def _send_audio(self, path: Path) -> None:
        """Sends the recording. A «Range» request gets only the bytes asked for, so the player can seek at once."""
        size = path.stat().st_size
        start, end, status = 0, size - 1, 200
        requested = self.headers.get("Range", "")
        if requested.startswith("bytes="):
            first, _, last = requested[len("bytes="):].split(",")[0].strip().partition("-")
            try:
                if first == "":
                    start = max(0, size - int(last))
                else:
                    start = int(first)
                    end = min(int(last), size - 1) if last else size - 1
            except ValueError:
                start, end = 0, -1
            if start > end or start >= size:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.end_headers()
                return
            status = 206
        length = end - start + 1
        self.send_response(status)
        self.send_header("Content-Type", AUDIO_TYPES.get(path.suffix, "application/octet-stream"))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(length))
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Cache-Control", "private, max-age=3600")
        self.end_headers()
        try:
            with path.open("rb") as handle:
                handle.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = handle.read(min(RANGE_CHUNK, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass  # the player stopped reading (seek or pause): not an error

    def do_GET(self) -> None:  # noqa: N802 (name fixed by http.server)
        if self.path in STATIC_FILES:
            name, content_type = STATIC_FILES[self.path]
            self._send(200, (EDITOR_DIR / name).read_bytes(), content_type)
        elif self.path == "/api/version":
            self._send_json(200, {"version": editor_version()})
        elif self.path == "/api/debates":
            self._send_json(200, list_debates())
        elif self.path.endswith("/peaks") and self._slug_from_path() is not None:
            peaks = get_peaks(self._slug_from_path())
            if peaks is None:
                self._send_json(503, {"errors": ["No se pudo crear la forma de onda (¿está ffmpeg instalado?)."]})
            else:
                self._send_json(200, peaks)
        elif self.path.endswith("/audio") and self._slug_from_path() is not None:
            recording = audio_path(self._slug_from_path())
            if recording is None:
                self._send_json(404, {"errors": ["Este debate no tiene audio."]})
            else:
                self._send_audio(recording)
        elif self._slug_from_path() is not None:
            path = debate_path(self._slug_from_path())
            if path is None:
                self._send_json(404, {"errors": ["No existe ese debate."]})
            else:
                self._send(200, path.read_bytes(), "application/json; charset=utf-8")
        else:
            self._send(404, b"Not found", "text/plain; charset=utf-8")

    def do_POST(self) -> None:  # noqa: N802
        slug = self._slug_from_path()
        if slug is None:
            self._send(404, b"Not found", "text/plain; charset=utf-8")
            return
        path = debate_path(slug)
        if path is None:
            self._send_json(404, {"errors": ["No existe ese debate."], "warnings": []})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            incoming = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(incoming.get("speakers"), list) or not isinstance(incoming.get("interventions"), list):
                raise ValueError("Faltan la lista de hablantes o la de intervenciones.")
            incoming["slug"] = slug
            errors, warnings = validate(incoming)
        except (ValueError, KeyError, TypeError, AttributeError) as problem:
            self._send_json(400, {"errors": [f"Datos no válidos: {problem}"], "warnings": []})
            return
        if errors:
            self._send_json(400, {"errors": errors, "warnings": warnings})
            return

        try:
            data = derive(incoming)
        except (KeyError, TypeError, ValueError) as problem:
            self._send_json(400, {"errors": [f"No se pudo recalcular: {problem}"], "warnings": warnings})
            return

        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        (BACKUP_DIR / f"{slug}-{stamp}.json").write_bytes(path.read_bytes())
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        self._send_json(
            200,
            {
                "ok": True,
                "warnings": warnings,
                "interventions": len(data["interventions"]),
                "interruptions": len(data["interruptions"]),
            },
        )

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        return


def serve(port: int) -> None:
    """Runs the server in this process, until it is stopped."""
    server = ThreadingHTTPServer(("127.0.0.1", port), EditorHandler)
    print(f"Editor de debates: http://127.0.0.1:{port}/  (Ctrl+C para cerrar)")
    print(f"Carpeta: {DEBATES_DIR}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()


def start_child(port: int) -> subprocess.Popen:
    return subprocess.Popen([sys.executable, str(Path(__file__).resolve()), "--child", "--port", str(port)])


def main() -> None:
    """Starts the server and restarts it by itself when a Python file of the editor changes.
    The page reloads itself when the page or its scripts change: no need to stop or start anything by hand."""
    parser = argparse.ArgumentParser(description="Editor de los debates del sitio.")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--child", action="store_true", help=argparse.SUPPRESS)
    arguments = parser.parse_args()
    if arguments.child:
        serve(arguments.port)
        return

    child = start_child(arguments.port)
    seen = editor_version()
    try:
        while True:
            time.sleep(1)
            current = editor_version()
            if current == seen:
                continue
            seen = current
            print("Cambios en el editor: reiniciando el servidor…")
            child.terminate()
            child.wait()
            child = start_child(arguments.port)
    except KeyboardInterrupt:
        child.terminate()


if __name__ == "__main__":
    main()
