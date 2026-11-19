// Reproductor y línea de tiempo del editor. Carga después de app.js y usa sus funciones y datos:
// state, $, el, toast, formatTime, parseTime, round1, markDirty, renderInterventions, audio, lastFollowed.
"use strict";

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 6, 8];
// Seconds visible at each zoom level. null shows the whole debate.
const ZOOMS = [null, 900, 180, 40, 10];
const BAND_HEIGHT = 10; // px at the top of the timeline where the speaker bands are drawn
const SPEAKER_COLORS = ["#1d84ce", "#e30613", "#63be21", "#f03c00", "#6b2d8f", "#7d7468", "#008b8b", "#b8860b"];
const TICK_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800];

const canvas = $("timeline");
const ctx = canvas.getContext("2d");
const view = { zoom: 0, start: 0, following: true, hover: null, dragging: false };
// Keeps the canvas in step with its real size, so the timeline never shrinks or stretches by accident.
new ResizeObserver(() => drawTimeline()).observe(canvas);
let peaks = null; // { step, values } from the editor server, or null when the waveform is not available
let selectedIndex = null;
let frameId = null;

const cssColor = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const duration = () => (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : state.data?.durationSeconds ?? 0);
const viewSpan = () => {
  const zoom = ZOOMS[view.zoom];
  return zoom === null ? duration() || 1 : Math.min(zoom, duration() || zoom);
};
const clampView = () => {
  view.start = Math.max(0, Math.min(view.start, duration() - viewSpan()));
};
const centerView = (seconds) => {
  view.start = seconds - viewSpan() / 2;
  clampView();
};
const timeToX = (seconds, width) => ((seconds - view.start) / viewSpan()) * width;
const xToTime = (x, width) => view.start + (x / width) * viewSpan();
const colorOf = (speakerId) => {
  const index = state.data.speakers.findIndex((speaker) => speaker.id === speakerId);
  return SPEAKER_COLORS[(index < 0 ? 0 : index) % SPEAKER_COLORS.length];
};
const clockShort = (seconds) => {
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const secs = String(total % 60).padStart(2, "0");
  return hours ? `${hours}:${minutes}:${secs}` : `${minutes}:${secs}`;
};
const zoomLabel = () => {
  const zoom = ZOOMS[view.zoom];
  if (zoom === null) return "Todo";
  return zoom >= 60 ? `${zoom / 60} min` : `${zoom} s`;
};

// ---- Drawing ---------------------------------------------------------------------------

function drawTimeline() {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !state.data) return;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const span = viewSpan();
  const ink = cssColor("--ink");
  const muted = cssColor("--ink-muted");
  const line = cssColor("--line-strong");
  const focus = cssColor("--focus");

  // Speaker bands: one block per intervention, in the color of its speaker.
  for (const iv of state.data.interventions) {
    if (iv.end < view.start || iv.start > view.start + span) continue;
    const x0 = timeToX(iv.start, width);
    const x1 = timeToX(iv.end, width);
    ctx.fillStyle = colorOf(iv.speaker);
    ctx.fillRect(x0, 0, Math.max(1, x1 - x0), BAND_HEIGHT);
  }

  // Waveform: the highest peak of each screen column.
  const top = BAND_HEIGHT + 4;
  const bottom = height - 16;
  const middle = (top + bottom) / 2;
  const half = (bottom - top) / 2;
  if (peaks) {
    ctx.fillStyle = line;
    for (let x = 0; x < width; x += 1) {
      const from = Math.max(0, Math.floor(xToTime(x, width) / peaks.step));
      const to = Math.min(peaks.values.length, Math.ceil(xToTime(x + 1, width) / peaks.step) + 1);
      let level = 0;
      for (let i = from; i < to; i += 1) level = Math.max(level, peaks.values[i]);
      const h = (level / 255) * half;
      ctx.fillRect(x, middle - h, 1, Math.max(1, 2 * h));
    }
  }

  // Ruler: a tick every interval that keeps about ten labels on screen.
  const interval = TICK_STEPS.find((step) => span / step <= 10) ?? TICK_STEPS.at(-1);
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillStyle = muted;
  ctx.strokeStyle = line;
  for (let t = Math.ceil(view.start / interval) * interval; t <= view.start + span; t += interval) {
    const x = timeToX(t, width);
    ctx.beginPath();
    ctx.moveTo(x + 0.5, height - 14);
    ctx.lineTo(x + 0.5, height);
    ctx.stroke();
    ctx.fillText(clockShort(t), x + 3, height - 3);
  }

  // Hover line and playhead.
  if (view.hover !== null) {
    const x = timeToX(view.hover, width);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const playX = timeToX(audio.currentTime, width);
  if (playX >= -2 && playX <= width + 2) {
    ctx.fillStyle = focus;
    ctx.fillRect(playX - 1, 0, 2, height);
  }
}

// ---- Moving through the debate ------------------------------------------------------------

function updateZoomControls() {
  $("zoom-label").textContent = zoomLabel();
  $("zoom-range").value = String(view.zoom);
}

function setZoom(index) {
  view.zoom = Math.max(0, Math.min(ZOOMS.length - 1, index));
  updateZoomControls();
  clampView();
  if (view.following) centerView(audio.currentTime);
  drawTimeline();
}

// Zooms so that the whole intervention fits, with a margin, and centers the view on it.
function focusOn(index) {
  const iv = state.data?.interventions[index];
  if (!iv) return;
  const needed = Math.max(iv.end - iv.start, 1) * 1.5 + 2;
  let level = 0; // the whole debate, when nothing smaller fits
  for (let i = ZOOMS.length - 1; i >= 1; i -= 1) {
    if (ZOOMS[i] >= needed) {
      level = i;
      break;
    }
  }
  view.zoom = level;
  updateZoomControls();
  centerView((iv.start + iv.end) / 2);
  drawTimeline();
}

// Moves the playhead. When the timeline is zoomed and follows, the view moves to the new place.
function seek(seconds) {
  const target = Math.max(0, Math.min(seconds, duration()));
  audio.currentTime = target;
  if (view.following && ZOOMS[view.zoom] !== null) centerView(target);
  updateTime();
  drawTimeline();
}

// Index of the intervention that contains a time, or the last one that started before it. -1 if none.
function indexAt(seconds) {
  const list = state.data?.interventions ?? [];
  let low = 0;
  let high = list.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (list[middle].start <= seconds) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

function selectCard(index) {
  document.querySelector(".card.is-selected")?.classList.remove("is-selected");
  selectedIndex = index;
  focusOn(index);
  const card = document.getElementById(`iv-${index}`);
  if (!card) {
    toast("Esa intervención está oculta por los filtros. Quite los filtros para verla.", "warning");
    return;
  }
  card.classList.add("is-selected");
  revealElement(card, "smooth");
}

// Goes to a moment: the playhead, the timeline and, if asked, the intervention that contains it.
function goTo(seconds, { select = false } = {}) {
  seek(seconds);
  if (select) {
    const index = indexAt(seconds);
    if (index >= 0) selectCard(index);
  }
}

// Sets the start or the end of an intervention to the playhead position.
function setBoundaryAtPlayhead(index, field) {
  if (index === null || index === undefined || !state.data.interventions[index]) {
    toast("Seleccione primero una intervención (clic en su tarjeta o en una banda de la línea de tiempo).", "warning");
    return;
  }
  const iv = state.data.interventions[index];
  const value = round1(audio.currentTime);
  if (field === "start" && value > iv.end) return toast("El inicio no puede ser posterior al fin.", "error");
  if (field === "end" && value < iv.start) return toast("El fin no puede ser anterior al inicio.", "error");
  iv[field] = value;
  state.changed.add(index);
  markDirty();
  renderInterventions();
  selectCard(index);
  toast(`${field === "start" ? "Inicio" : "Fin"} de la intervención ${index + 1}: ${formatTime(value)}`);
}

// Scrolls so that an element sits in the middle of the space the page leaves free:
// below the top bar and above the player. Exact, unlike scrollIntoView with a fixed player.
function revealElement(element, behavior = "auto") {
  if (!element) return;
  const topBar = document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0;
  const playerHeight = $("player").hidden ? 0 : $("player").getBoundingClientRect().height;
  const middle = (topBar + (window.innerHeight - playerHeight)) / 2;
  const rect = element.getBoundingClientRect();
  const delta = rect.top + rect.height / 2 - middle;
  if (Math.abs(delta) < 4) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollBy({ top: delta, behavior: reduced ? "auto" : behavior });
}

// Index of the paragraph heard at a time. The paragraphs share the time of the intervention by their word count,
// because the transcript has no time for each paragraph.
function paragraphAt(iv, seconds) {
  const count = iv.paragraphs.length;
  if (count <= 1) return 0;
  const words = iv.paragraphs.map((paragraph) => Math.max(1, paragraph.split(/\s+/).filter(Boolean).length));
  const total = words.reduce((sum, value) => sum + value, 0);
  const position = ((seconds - iv.start) / Math.max(iv.end - iv.start, 0.001)) * total;
  let accumulated = 0;
  for (let k = 0; k < count; k += 1) {
    accumulated += words[k];
    if (position < accumulated) return k;
  }
  return count - 1;
}

let lastFragment = null; // "index:paragraph" of the fragment outlined now

// Outlines the card and the paragraph that are playing. When «Seguir en la lista» is on, scrolls the list to the
// paragraph (once per change), so the list follows the audio.
function highlightPlaying(seconds) {
  const found = indexAt(seconds);
  const current = found >= 0 && seconds < state.data.interventions[found].end + 0.5 ? found : null;
  const previous = lastFollowed;
  if (previous !== null && previous !== current) document.getElementById(`iv-${previous}`)?.classList.remove("is-playing");
  lastFollowed = current;
  if (current === null) {
    document.querySelector(".paragraph.is-current")?.classList.remove("is-current");
    lastFragment = null;
    return;
  }
  const card = document.getElementById(`iv-${current}`);
  if (!card) return;
  card.classList.add("is-playing");
  const k = paragraphAt(state.data.interventions[current], seconds);
  const key = `${current}:${k}`;
  const paragraph = card.querySelector(`.paragraph[data-k="${k}"]`);
  // The outline is set on every call, because the list may have been drawn again since the last one.
  document.querySelector(".paragraph.is-current")?.classList.remove("is-current");
  paragraph?.classList.add("is-current");
  // The scroll happens only when the fragment changes.
  if (key !== lastFragment && paragraph && $("list-follow").checked) revealElement(paragraph, "auto");
  lastFragment = key;
}

function updateTime() {
  $("player-time").textContent = formatTime(audio.currentTime);
  $("player-play").textContent = audio.paused ? "▶" : "❚❚";
  highlightPlaying(audio.currentTime);
}

// One frame per screen refresh while the audio plays. Pauses by itself when the audio stops.
function animate() {
  if (view.following && ZOOMS[view.zoom] !== null && !audio.paused) centerView(audio.currentTime);
  updateTime();
  drawTimeline();
  frameId = audio.paused ? null : requestAnimationFrame(animate);
}

function playAt(seconds, index) {
  seek(seconds);
  if (index !== undefined) selectCard(index);
  audio.play().catch(() => toast("No se pudo reproducir el audio.", "error"));
}

function togglePlay() {
  if (audio.paused) audio.play().catch(() => toast("No se pudo reproducir el audio.", "error"));
  else audio.pause();
}

function setRate(index) {
  const rate = RATES[Math.max(0, Math.min(RATES.length - 1, index))];
  audio.playbackRate = rate;
  $("player-rate").value = String(rate);
  toast(`Velocidad ${String(rate).replace(".", ",")}×`);
}

// ---- Loading ----------------------------------------------------------------------------------

async function loadPeaks(slug) {
  peaks = null;
  try {
    const response = await fetch(`/api/debates/${encodeURIComponent(slug)}/peaks`);
    if (slug !== state.slug) return; // the user changed debate meanwhile
    if (response.ok) peaks = await response.json();
    else toast("La línea de tiempo se muestra sin forma de onda (falta ffmpeg).", "warning");
  } catch {
    peaks = null;
  }
  drawTimeline();
}

// The recording is served by the editor server, with byte ranges, so seeking does not download the whole file.
function setupPlayer(debate) {
  state.audio = Boolean(debate?.audio);
  $("player").hidden = !state.audio;
  if (!state.audio) {
    audio.removeAttribute("src");
    return;
  }
  if (audio.dataset.slug !== state.slug) {
    audio.dataset.slug = state.slug;
    audio.src = `/api/debates/${encodeURIComponent(state.slug)}/audio`;
    audio.load();
    view.start = 0;
    loadPeaks(state.slug);
  }
  drawTimeline();
}

// ---- Wiring ------------------------------------------------------------------------------------

$("player-rate").replaceChildren(
  ...RATES.map((rate) => el("option", { value: String(rate), text: `${String(rate).replace(".", ",")}×`, selected: rate === 1 })),
);

audio.addEventListener("play", () => {
  updateTime();
  if (frameId === null) frameId = requestAnimationFrame(animate);
});
audio.addEventListener("pause", () => { updateTime(); drawTimeline(); });
audio.addEventListener("ended", () => { updateTime(); drawTimeline(); });
audio.addEventListener("loadedmetadata", () => { clampView(); drawTimeline(); });
audio.addEventListener("seeked", () => { updateTime(); drawTimeline(); });
window.addEventListener("resize", drawTimeline);

// Pointer: a click or a drag moves the playhead. A click on a speaker band selects that intervention.
function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  return { seconds: xToTime(x, rect.width), x, y: event.clientY - rect.top, width: rect.width };
}

canvas.addEventListener("pointerdown", (event) => {
  if (!state.audio) return;
  canvas.setPointerCapture(event.pointerId);
  view.dragging = true;
  const { seconds, y } = pointerPosition(event);
  if (y < BAND_HEIGHT) {
    // A click on a speaker band goes to the start of that intervention and shows it.
    const index = indexAt(seconds);
    if (index >= 0) {
      seek(state.data.interventions[index].start);
      selectCard(index);
    }
  } else {
    seek(seconds);
  }
});
canvas.addEventListener("pointermove", (event) => {
  if (!state.audio) return;
  const { seconds, x, width } = pointerPosition(event);
  view.hover = Math.max(0, Math.min(seconds, duration()));
  const tip = $("timeline-tip");
  tip.hidden = false;
  tip.textContent = formatTime(view.hover);
  tip.style.left = `${Math.max(40, Math.min(x + 16, width - 40))}px`;
  if (view.dragging) seek(seconds);
  else drawTimeline();
});
const endDrag = (event) => {
  view.dragging = false;
  if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
};
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener("pointerleave", () => {
  view.hover = null;
  $("timeline-tip").hidden = true;
  drawTimeline();
});

$("player-play").addEventListener("click", togglePlay);
$("player-back").addEventListener("click", (event) => seek(audio.currentTime - (event.shiftKey ? 1 : 5)));
$("player-forward").addEventListener("click", (event) => seek(audio.currentTime + (event.shiftKey ? 1 : 5)));
$("player-rate").addEventListener("change", (event) => { audio.playbackRate = Number(event.target.value); });
$("zoom-in").addEventListener("click", () => setZoom(view.zoom + 1));
$("zoom-range").addEventListener("input", (event) => setZoom(Number(event.target.value)));
// Ctrl + wheel zooms around the pointer, as in a map.
canvas.addEventListener("wheel", (event) => {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  const anchor = xToTime(event.offsetX, canvas.clientWidth);
  setZoom(view.zoom + (event.deltaY < 0 ? 1 : -1));
  if (!view.following) {
    view.start = anchor - (event.offsetX / canvas.clientWidth) * viewSpan();
    clampView();
    drawTimeline();
  }
}, { passive: false });
$("zoom-out").addEventListener("click", () => setZoom(view.zoom - 1));
$("player-follow").addEventListener("change", (event) => {
  view.following = event.target.checked;
  if (view.following) centerView(audio.currentTime);
  drawTimeline();
});
$("goto-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const seconds = parseTime($("goto-input").value);
  if (Number.isNaN(seconds)) return toast("Tiempo no válido. Use 12:34.5 o 1:02:03.", "error");
  goTo(seconds, { select: true });
});

// Keys for the player. They do nothing while the user types in a field.
//   Espacio: reproducir o pausar · ←/→: 5 s (con Mayús, 1 s) · [ ]: velocidad · - +: zoom
//   I / O: poner el inicio / el fin de la intervención seleccionada en el momento que suena
document.addEventListener("keydown", (event) => {
  if (!state.audio || event.ctrlKey || event.metaKey || event.altKey) return;
  const tag = event.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  const rateIndex = RATES.indexOf(audio.playbackRate);
  const jump = event.shiftKey ? 1 : 5;
  const actions = {
    " ": togglePlay,
    ArrowLeft: () => seek(audio.currentTime - jump),
    ArrowRight: () => seek(audio.currentTime + jump),
    "]": () => setRate(rateIndex + 1),
    "[": () => setRate(rateIndex - 1),
    "+": () => setZoom(view.zoom + 1),
    "=": () => setZoom(view.zoom + 1),
    "-": () => setZoom(view.zoom - 1),
    i: () => setBoundaryAtPlayhead(selectedIndex ?? lastFollowed, "start"),
    o: () => setBoundaryAtPlayhead(selectedIndex ?? lastFollowed, "end"),
  };
  const action = actions[event.key];
  if (!action) return;
  event.preventDefault();
  action();
});
