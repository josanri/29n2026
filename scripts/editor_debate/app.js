// Editor interno de debates. Lo sirve scripts/editor_debate.py; los datos viven en
// src/data/2026/generales/debates/<slug>.json. Este archivo no sabe nada del debate concreto.
"use strict";

const state = {
  slug: null,
  data: null,
  dirty: 0, // number of edits since the last load or save
  changed: new Set(), // indexes of interventions edited since the last load (highlighted)
  filter: { speaker: "", from: "", to: "", text: "", cutsOnly: false },
  debates: [],
};
const audio = document.getElementById("audio");
let lastFollowed = null;

const PARTY_IDS = ["psoe", "pp", "vox", "fa", "sumar", "podemos", "salf", "erc", "junts", "bildu", "pnv"];
const $ = (id) => document.getElementById(id);

// ---- Times ----------------------------------------------------------------

// 1:02:03.5 or 02:03.5. Hours are shown only when there are some.
function formatTime(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(total / 3600);
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const secs = (total % 60).toFixed(1).padStart(4, "0");
  return hours ? `${hours}:${minutes}:${secs}` : `${minutes}:${secs}`;
}

// Accepts 1:02:03.5, 02:03.5 or plain seconds. Returns NaN when the text is not a time.
function parseTime(text) {
  const value = String(text).trim();
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
  const parts = value.split(":");
  if (parts.length < 2 || parts.length > 3) return NaN;
  const numbers = parts.map((part) => (/^\d+(\.\d+)?$/.test(part) ? Number(part) : NaN));
  if (numbers.some((number) => Number.isNaN(number))) return NaN;
  return numbers.reduce((total, number) => total * 60 + number, 0);
}

const round1 = (value) => Math.round(value * 10) / 10;

// ---- DOM helpers -------------------------------------------------------------

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "text") node.textContent = value;
    else if (key === "class") node.className = value;
    else if (key === "on") for (const [event, handler] of Object.entries(value)) node.addEventListener(event, handler);
    else if (key === "value") node.value = value;
    else if (key === "checked") node.checked = value;
    else if (key === "disabled") node.disabled = value;
    else if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, value);
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

function setStatus(text, kind = "") {
  const status = $("status");
  status.textContent = text;
  status.className = `status ${kind}`;
}

function toast(text, kind = "ok") {
  const box = el("div", { class: `toast is-${kind}`, text });
  $("toasts").append(box);
  setTimeout(() => box.remove(), kind === "error" ? 9000 : 5000);
}

function markDirty() {
  state.dirty += 1;
  $("save").disabled = false;
  setStatus(`${state.dirty} ${state.dirty === 1 ? "cambio" : "cambios"} sin guardar`, "is-dirty");
}

function usageOf(speakerId) {
  return state.data.interventions.filter((iv) => iv.speaker === speakerId).length;
}

function speakerOptions(selectedId) {
  return state.data.speakers.map((speaker) =>
    el("option", { value: speaker.id, text: speaker.name, selected: speaker.id === selectedId }),
  );
}

// Time for each paragraph boundary, spread evenly by paragraph count.
function boundaries(iv, count) {
  return Array.from({ length: count + 1 }, (_, index) => iv.start + ((iv.end - iv.start) * index) / count);
}

// ---- Operations on the data ------------------------------------------------------

function setSpeaker(index, speakerId) {
  state.data.interventions[index].speaker = speakerId;
  state.changed.add(index);
  markDirty();
  renderInterventions();
}

function setTime(index, field, text) {
  const value = parseTime(text);
  if (Number.isNaN(value)) return false;
  state.data.interventions[index][field] = round1(value);
  state.changed.add(index);
  markDirty();
  return true;
}

function moveIntervention(index, delta) {
  const list = state.data.interventions;
  const target = index + delta;
  if (target < 0 || target >= list.length) return;
  [list[index], list[target]] = [list[target], list[index]];
  markDirty();
  renderInterventions();
}

function deleteIntervention(index) {
  if (!confirm(`¿Borrar la intervención ${index + 1} con todo su texto?`)) return;
  state.data.interventions.splice(index, 1);
  markDirty();
  renderInterventions();
}

// Joins this intervention to the previous one. The previous speaker keeps the floor.
function mergeWithPrevious(index) {
  const list = state.data.interventions;
  if (index === 0) return;
  const previous = list[index - 1];
  const current = list[index];
  previous.paragraphs.push(...current.paragraphs);
  previous.end = current.end;
  list.splice(index, 1);
  markDirty();
  renderInterventions();
}

function insertAfter(index) {
  const list = state.data.interventions;
  const current = list[index];
  list.splice(index + 1, 0, { speaker: current.speaker, start: current.end, end: current.end, paragraphs: [""] });
  state.changed.add(index + 1);
  markDirty();
  renderInterventions();
}

function addAtEnd() {
  const list = state.data.interventions;
  const last = list[list.length - 1];
  const start = last ? last.end : 0;
  list.push({ speaker: state.data.speakers[0]?.id ?? "", start, end: start, paragraphs: [""] });
  state.changed.add(list.length - 1);
  markDirty();
  renderInterventions();
}

// Paragraphs k.. move to a new intervention with the same speaker.
function splitAt(index, k) {
  const list = state.data.interventions;
  const iv = list[index];
  const at = round1(boundaries(iv, iv.paragraphs.length)[k]);
  const first = { speaker: iv.speaker, start: iv.start, end: at, paragraphs: iv.paragraphs.slice(0, k) };
  const second = { speaker: iv.speaker, start: at, end: iv.end, paragraphs: iv.paragraphs.slice(k) };
  list.splice(index, 1, first, second);
  markDirty();
  renderInterventions();
}

// Gives paragraph k to another speaker. The paragraphs before and after keep the old speaker.
function reassignParagraph(index, k, speakerId) {
  const list = state.data.interventions;
  const iv = list[index];
  if (speakerId === iv.speaker) return;
  const paragraphs = iv.paragraphs;
  const pieces = [];
  if (k > 0) pieces.push({ speaker: iv.speaker, paragraphs: paragraphs.slice(0, k) });
  pieces.push({ speaker: speakerId, paragraphs: [paragraphs[k]] });
  if (k < paragraphs.length - 1) pieces.push({ speaker: iv.speaker, paragraphs: paragraphs.slice(k + 1) });
  const times = boundaries(iv, paragraphs.length);
  let counted = 0;
  const made = pieces.map((piece) => {
    const from = counted;
    counted += piece.paragraphs.length;
    return { speaker: piece.speaker, start: round1(times[from]), end: round1(times[counted]), paragraphs: piece.paragraphs };
  });
  list.splice(index, 1, ...made);
  markDirty();
  renderInterventions();
}

function deleteParagraph(index, k) {
  const iv = state.data.interventions[index];
  if (iv.paragraphs.length === 1) return deleteIntervention(index);
  iv.paragraphs.splice(k, 1);
  markDirty();
  renderInterventions();
}

// ---- Speakers ----------------------------------------------------------------

function renderSpeakers() {
  const body = $("speakers");
  body.replaceChildren();
  state.data.speakers.forEach((speaker, index) => {
    const used = usageOf(speaker.id);
    const name = el("input", {
      value: speaker.name,
      on: {
        change: (event) => {
          speaker.name = event.target.value;
          markDirty();
          renderInterventions();
        },
      },
    });
    const role = el("input", {
      value: speaker.role ?? "",
      on: {
        change: (event) => {
          speaker.role = event.target.value;
          markDirty();
        },
      },
    });
    const party = el("input", {
      value: speaker.partyId ?? "",
      list: "party-ids",
      on: {
        change: (event) => {
          speaker.partyId = event.target.value.trim() || null;
          markDirty();
          renderInterventions();
        },
      },
    });
    const remove = el("button", {
      class: "button button--small button--danger",
      type: "button",
      text: "Borrar",
      disabled: used > 0,
      title: used > 0 ? "Tiene intervenciones: reasígnelas antes" : "Borrar este hablante",
      on: {
        click: () => {
          if (!confirm(`¿Borrar a ${speaker.name}?`)) return;
          state.data.speakers.splice(index, 1);
          markDirty();
          renderSpeakers();
          renderFilters();
        },
      },
    });
    body.append(
      el("tr", {}, [
        el("td", {}, [el("code", { text: speaker.id })]),
        el("td", {}, [name]),
        el("td", {}, [role]),
        el("td", {}, [party]),
        el("td", { class: "num", text: String(used) }),
        el("td", {}, [remove]),
      ]),
    );
  });
}

function addSpeaker() {
  let id = "nuevo";
  let counter = 1;
  while (state.data.speakers.some((speaker) => speaker.id === id)) id = `nuevo-${counter++}`;
  state.data.speakers.push({ id, name: "Nuevo hablante", role: "", partyId: null, minutes: 0, words: 0, cutsMade: 0, cutsReceived: 0 });
  markDirty();
  renderSpeakers();
  renderFilters();
}

// ---- Filters -------------------------------------------------------------------

function renderFilters() {
  const select = $("filter-speaker");
  select.replaceChildren(el("option", { value: "", text: "Todos" }));
  for (const speaker of state.data.speakers) {
    select.append(el("option", { value: speaker.id, text: speaker.name, selected: speaker.id === state.filter.speaker }));
  }
  $("party-ids").replaceChildren(...PARTY_IDS.map((id) => el("option", { value: id })));
  $("bin-minutes").value = String(Math.round((state.data.binSeconds || 300) / 60));
  $("duration").value = formatTime(state.data.durationSeconds || 0);
}

function visibleIndices() {
  const { speaker, from, to, text, cutsOnly } = state.filter;
  const fromSeconds = from ? parseTime(from) : -Infinity;
  const toSeconds = to ? parseTime(to) : Infinity;
  const needle = text.trim().toLowerCase();
  const indices = [];
  state.data.interventions.forEach((iv, index) => {
    if (speaker && iv.speaker !== speaker) return;
    if (iv.start < fromSeconds || iv.start > toSeconds) return;
    if (cutsOnly && !iv.cut && !iv.cutOff) return;
    if (needle && !iv.paragraphs.some((paragraph) => paragraph.toLowerCase().includes(needle))) return;
    indices.push(index);
  });
  return indices;
}

// ---- Interventions ---------------------------------------------------------------

function timeInput(index, field, label) {
  const input = el("input", { class: "time", value: formatTime(state.data.interventions[index][field]), "aria-label": label });
  input.addEventListener("change", () => {
    if (!setTime(index, field, input.value)) {
      toast(`Tiempo no válido: «${input.value}». Use 1:02:03.5 o 02:03.5.`, "error");
    }
    renderInterventions();
  });
  return input;
}

function paragraphRow(index, k, iv) {
  const text = el("textarea", { rows: 1, "aria-label": `Párrafo ${k + 1}` });
  text.value = iv.paragraphs[k];
  text.addEventListener("input", () => {
    iv.paragraphs[k] = text.value;
    state.changed.add(index);
    if (state.dirty === 0) markDirty();
  });
  const reassign = el(
    "select",
    { "aria-label": "Pasar este párrafo a otro hablante", title: "Pasar este párrafo a otro hablante" },
    [
      el("option", { value: "", text: "Pasar a…" }),
      ...state.data.speakers
        .filter((speaker) => speaker.id !== iv.speaker)
        .map((speaker) => el("option", { value: speaker.id, text: speaker.name })),
    ],
  );
  reassign.addEventListener("change", () => {
    if (reassign.value) reassignParagraph(index, k, reassign.value);
  });
  const tools = el("div", { class: "paragraph__tools" }, [
    k > 0
      ? el("button", {
          class: "button button--small",
          type: "button",
          text: "Separar aquí",
          title: "Este párrafo y los siguientes pasan a una intervención nueva",
          on: { click: () => splitAt(index, k) },
        })
      : null,
    reassign,
    el("button", {
      class: "button button--small button--danger",
      type: "button",
      text: "Borrar párrafo",
      on: { click: () => deleteParagraph(index, k) },
    }),
    iv.paragraphs.length > 1 ? el("span", { class: "move", text: `Párrafo ${k + 1} de ${iv.paragraphs.length}` }) : null,
  ]);
  return el("div", { class: "paragraph", "data-k": k }, [text, tools]);
}

function interventionCard(index) {
  const iv = state.data.interventions[index];
  const words = iv.paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
  const flags = [];
  if (iv.cut) flags.push(el("span", { class: "flag", text: "Interrumpe" }));
  if (iv.cutOff) flags.push(el("span", { class: "flag", text: "Interrumpido" }));

  const head = el("div", { class: "card__head" }, [
    el("button", {
      class: "button button--small play",
      type: "button",
      text: "▶ Oír",
      title: "Reproducir desde el inicio de esta intervención",
      disabled: !state.audio,
      on: { click: () => playAt(iv.start, index) },
    }),
    el("select", { "aria-label": "Hablante", on: { change: (event) => setSpeaker(index, event.target.value) } }, speakerOptions(iv.speaker)),
    el("div", { class: "card__times" }, [
      timeInput(index, "start", "Inicio"),
      el("span", { class: "arrow", text: "→" }),
      timeInput(index, "end", "Fin"),
    ]),
    ...flags,
    el("span", { class: "card__words", text: `${words} palabras` }),
  ]);

  const actions = el("div", { class: "card__actions" }, [
    el("button", { class: "button button--small", type: "button", text: "↑ Subir", on: { click: () => moveIntervention(index, -1) } }),
    el("button", { class: "button button--small", type: "button", text: "↓ Bajar", on: { click: () => moveIntervention(index, 1) } }),
    el("button", {
      class: "button button--small",
      type: "button",
      text: "Unir con la anterior",
      disabled: index === 0,
      on: { click: () => mergeWithPrevious(index) },
    }),
    el("button", { class: "button button--small", type: "button", text: "Inicio = reproducción", title: "Pone el inicio en el momento que suena (tecla I)", disabled: !state.audio, on: { click: () => setBoundaryAtPlayhead(index, "start") } }),
    el("button", { class: "button button--small", type: "button", text: "Fin = reproducción", title: "Pone el fin en el momento que suena (tecla O)", disabled: !state.audio, on: { click: () => setBoundaryAtPlayhead(index, "end") } }),
    el("button", { class: "button button--small", type: "button", text: "Insertar después", on: { click: () => insertAfter(index) } }),
    el("button", {
      class: "button button--small button--danger",
      type: "button",
      text: "Borrar intervención",
      on: { click: () => deleteIntervention(index) },
    }),
  ]);

  const classes = ["card"];
  if (iv.cut) classes.push("is-cut");
  if (state.changed.has(index)) classes.push("is-changed");

  return el("article", { class: classes.join(" "), id: `iv-${index}`, "data-index": index, "aria-label": `Intervención ${index + 1}` }, [
    el("div", { class: "card__index" }, [el("span", { text: `#${index + 1}` })]),
    el("div", { class: "card__body" }, [
      head,
      el("div", { class: "paragraphs" }, iv.paragraphs.map((_, k) => paragraphRow(index, k, iv))),
      actions,
    ]),
  ]);
}

function renderInterventions() {
  const indices = visibleIndices();
  $("interventions").replaceChildren(...indices.map((index) => interventionCard(index)));
  $("count").textContent = `${indices.length} de ${state.data.interventions.length} intervenciones`;
  $("save").disabled = state.dirty === 0;
  highlightPlaying(audio.currentTime);
  drawTimeline();
}

// ---- Load and save ------------------------------------------------------------------

function selectedDebateFromUrl() {
  return new URLSearchParams(location.search).get("debate");
}

async function loadDebateList() {
  const response = await fetch("/api/debates");
  const debates = await response.json();
  state.debates = debates;
  const select = $("debate-select");
  select.replaceChildren(...debates.map((debate) => el("option", { value: debate.slug, text: `${debate.title} (${debate.interventions})` })));
  const wanted = selectedDebateFromUrl();
  state.slug = debates.some((debate) => debate.slug === wanted) ? wanted : debates[0]?.slug ?? null;
  select.value = state.slug ?? "";
  return debates.length;
}

async function load() {
  setStatus("Cargando…");
  if (!state.slug && (await loadDebateList()) === 0) {
    setStatus("No hay debates en la carpeta.", "is-error");
    return;
  }
  const response = await fetch(`/api/debates/${state.slug}`);
  if (!response.ok) {
    setStatus("No se pudo cargar el debate.", "is-error");
    return;
  }
  state.data = await response.json();
  setupPlayer(state.debates.find((debate) => debate.slug === state.slug));
  state.dirty = 0;
  state.changed.clear();
  $("save").disabled = true;
  renderFilters();
  renderInterventions();
  setStatus("Sin cambios", "is-ok");
}

async function save() {
  setStatus("Guardando…");
  const response = await fetch(`/api/debates/${state.slug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state.data),
  });
  const result = await response.json();
  if (!response.ok) {
    for (const error of result.errors) toast(error, "error");
    setStatus("No se guardó", "is-error");
    return;
  }
  for (const warning of result.warnings) toast(warning, "warning");
  toast(`Guardado: ${result.interventions} intervenciones, ${result.interruptions} interrupciones. Compile el sitio para publicarlo.`);
  await load();
}

// ---- Wiring ---------------------------------------------------------------------------

function showTab(name) {
  document.querySelectorAll(".tab").forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.tab === name)));
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.hidden = panel.id !== `tab-${name}`;
  });
  if (name === "speakers") renderSpeakers();
}

document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => showTab(tab.dataset.tab)));

$("filter-speaker").addEventListener("change", (event) => { state.filter.speaker = event.target.value; renderInterventions(); });
$("filter-from").addEventListener("change", (event) => { state.filter.from = event.target.value; renderInterventions(); });
$("filter-to").addEventListener("change", (event) => { state.filter.to = event.target.value; renderInterventions(); });
// The text filter waits for a pause in typing, so long lists do not redraw on every key.
let textTimer = null;
$("filter-text").addEventListener("input", (event) => {
  clearTimeout(textTimer);
  textTimer = setTimeout(() => {
    state.filter.text = event.target.value;
    renderInterventions();
  }, 180);
});
$("filter-cuts").addEventListener("change", (event) => { state.filter.cutsOnly = event.target.checked; renderInterventions(); });
$("filter-clear").addEventListener("click", () => {
  state.filter = { speaker: "", from: "", to: "", text: "", cutsOnly: false };
  for (const id of ["filter-speaker", "filter-from", "filter-to", "filter-text"]) $(id).value = "";
  $("filter-cuts").checked = false;
  renderInterventions();
});

$("add-end").addEventListener("click", addAtEnd);
$("add-speaker").addEventListener("click", addSpeaker);

$("bin-minutes").addEventListener("change", (event) => {
  state.data.binSeconds = Number(event.target.value) * 60;
  markDirty();
});
$("duration").addEventListener("change", (event) => {
  const value = parseTime(event.target.value);
  if (Number.isNaN(value)) {
    toast("Duración no válida.", "error");
    event.target.value = formatTime(state.data.durationSeconds);
    return;
  }
  state.data.durationSeconds = value;
  markDirty();
});

$("save").addEventListener("click", save);
$("reload").addEventListener("click", () => {
  if (state.dirty > 0 && !confirm("Hay cambios sin guardar. ¿Recargar y perderlos?")) return;
  load();
});

$("debate-select").addEventListener("change", (event) => {
  if (state.dirty > 0 && !confirm("Hay cambios sin guardar. ¿Cambiar de debate y perderlos?")) {
    event.target.value = state.slug;
    return;
  }
  state.slug = event.target.value;
  history.replaceState(null, "", `?debate=${encodeURIComponent(state.slug)}`);
  load();
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    if (state.data && state.dirty > 0) save();
  }
});

window.addEventListener("beforeunload", (event) => {
  if (state.dirty > 0) event.preventDefault();
});

// The editor reloads itself when its files change (the server reports a version). Unsaved edits are never lost:
// the reload waits until everything is saved.
let editorVersion = null;
let waitingNotice = false;
async function checkEditorVersion() {
  try {
    const response = await fetch("/api/version", { cache: "no-store" });
    if (!response.ok) return;
    const { version } = await response.json();
    if (editorVersion === null) {
      editorVersion = version;
      return;
    }
    if (version === editorVersion) return;
    if (state.dirty === 0) {
      location.reload();
    } else if (!waitingNotice) {
      waitingNotice = true;
      toast("Hay cambios nuevos en el editor. Se recargará al guardar.", "warning");
    }
  } catch {
    // The server is restarting: try again on the next tick.
  }
}
setInterval(checkEditorVersion, 1000);

loadDebateList().then(load).catch((problem) => setStatus(`No se pudo cargar: ${problem}`, "is-error"));
