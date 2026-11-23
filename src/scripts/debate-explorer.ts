/** Client code of the page of one debate (src/pages/debates/[slug].astro): the shared filter, the search and the details on hover. */
// No import: this line keeps the file a module, so its names stay out of the global scope.
export {};
const root = document.getElementById('debate-explorador') as HTMLElement;
const binSeconds = Number(root.dataset.binSeconds);
const turns = Array.from(root.querySelectorAll<HTMLElement>('.turn'));
const countEl = document.getElementById('debate-count') as HTMLElement;
const emptyEl = document.getElementById('debate-empty') as HTMLElement;
const chipsEl = document.getElementById('debate-chips') as HTMLElement;
const searchEl = document.getElementById('debate-search') as HTMLInputElement;
const fromEl = document.getElementById('range-from') as HTMLInputElement;
const toEl = document.getElementById('range-to') as HTMLInputElement;
const hintEl = document.getElementById('range-hint') as HTMLElement;
const filtersEl = document.getElementById('debate-filters') as HTMLDetailsElement;
const tip = document.getElementById('chart-tip') as HTMLElement;
const tipTitle = tip.querySelector('.chart-tip__title') as HTMLElement;
const tipBody = tip.querySelector('.chart-tip__body') as HTMLElement;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// On a narrow screen the filters start closed, so the transcript is near the top.
const narrow = window.matchMedia('(max-width: 899px)');
const sideEl = filtersEl.closest('.reader__side') as HTMLElement;
if (narrow.matches) filtersEl.open = false;
// Open on a narrow screen, the panel leaves the sticky bar and takes its place above the transcript: bring it into
// view, so the filters appear where the reader is looking and not somewhere above.
const syncSide = () => sideEl.classList.toggle('is-open', filtersEl.open);
syncSide();
filtersEl.addEventListener('toggle', () => {
  syncSide();
  if (narrow.matches && filtersEl.open && sideEl.getBoundingClientRect().top < 0) {
    sideEl.scrollIntoView({ block: 'start', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  }
});

type Kind = '' | 'any' | 'interrupcion' | 'moderacion' | 'golden';
type State = {
  kind: Kind;
  speaker: string | null;
  topic: string | null;
  bin: number | null;
  pair: string | null;
  from: number | null;
  to: number | null;
  query: string;
};
const state: State = { kind: '', speaker: null, topic: null, bin: null, pair: null, from: null, to: null, query: '' };

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const texts = turns.map((turn) => fold(turn.querySelector('.turn__body')?.textContent ?? ''));

const clock = (seconds: number) => {
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const secs = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${minutes}:${secs}` : `${minutes}:${secs}`;
};
const binLabel = (index: number) => `${clock(index * binSeconds)}–${clock((index + 1) * binSeconds)}`;
const topicsOf = (element: HTMLElement | SVGElement) => (element.dataset.topics ?? '').split(' ').filter(Boolean);
const nameOf = (speakerId: string) =>
  root.querySelector(`.pill[data-speaker-filter="${speakerId}"]`)?.textContent?.trim() ?? speakerId;
const topicName = (topicId: string) => root.querySelector(`.pill[data-topic="${topicId}"]`)?.textContent?.trim() ?? topicId;
const kindLabels: Record<string, string> = { any: 'Con corte', interrupcion: 'Interrupciones', moderacion: 'Cortes de la moderación', golden: 'Minuto de oro' };

const hasFilter = () =>
  state.kind !== '' ||
  state.speaker !== null ||
  state.topic !== null ||
  state.bin !== null ||
  state.pair !== null ||
  state.from !== null ||
  state.to !== null ||
  state.query.length > 0;

// Accepts 1:02:03, 02:03, 02:03.5 or seconds. Empty means no limit (null). Anything else is NaN.
const parseTime = (text: string): number | null => {
  const value = text.trim();
  if (value === '') return null;
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
  const parts = value.split(':');
  if (parts.length < 2 || parts.length > 3) return NaN;
  if (!parts.every((part) => /^\d+(\.\d+)?$/.test(part))) return NaN;
  return parts.map(Number).reduce((total, part) => total * 60 + part, 0);
};

const matchesKind = (turn: HTMLElement) => {
  const own = turn.dataset.kind ?? '';
  const received = turn.dataset.cutbyKind ?? '';
  if (state.kind === '') return true;
  if (state.kind === 'golden') return turn.dataset.golden === 'true';
  if (state.kind === 'any') return own !== '' || received !== '';
  return own === state.kind || received === state.kind;
};
const matchesPair = (turn: HTMLElement) => {
  if (state.pair === null) return true;
  const [by, of] = state.pair.split('|');
  return (turn.dataset.speaker === by && turn.dataset.of === of) || (turn.dataset.speaker === of && turn.dataset.cutby === by);
};

const renderChips = () => {
  chipsEl.replaceChildren();
  const add = (label: string, key: string) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.dataset.clear = key;
    chip.textContent = `${label} ×`;
    chip.setAttribute('aria-label', `Quitar el filtro ${label}`);
    chipsEl.append(chip);
  };
  if (state.query) add(`«${searchEl.value.trim()}»`, 'query');
  if (state.kind) add(kindLabels[state.kind], 'kind');
  if (state.pair) {
    const [by, of] = state.pair.split('|');
    add(`${nameOf(by)} → ${nameOf(of)}`, 'pair');
  }
  if (state.speaker) add(nameOf(state.speaker), 'speaker');
  if (state.topic) add(topicName(state.topic), 'topic');
  if (state.bin !== null) add(binLabel(state.bin), 'bin');
  if (state.from !== null || state.to !== null) {
    add(`${state.from !== null ? clock(state.from) : '0:00'} – ${state.to !== null ? clock(state.to) : 'final'}`, 'range');
  }
  if (hasFilter()) {
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'chip chip--reset';
    reset.dataset.reset = '';
    reset.textContent = 'Quitar todos los filtros';
    chipsEl.append(reset);
  }
};

// The search words are marked with the CSS Custom Highlight API, which does not change the text. Without it, the
// search still filters.
const highlights = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
const markQuery = () => {
  if (!highlights || typeof (window as unknown as { Highlight?: unknown }).Highlight !== 'function') return;
  highlights.delete('debate-search');
  if (state.query.length < 2) return;
  const ranges: Range[] = [];
  turns.forEach((turn) => {
    if (turn.hidden) return;
    turn.querySelectorAll('.turn__text').forEach((paragraph) => {
      const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const text = fold(node.textContent ?? '');
        let at = text.indexOf(state.query);
        while (at !== -1 && ranges.length < 2000) {
          const range = new Range();
          range.setStart(node, at);
          range.setEnd(node, at + state.query.length);
          ranges.push(range);
          at = text.indexOf(state.query, at + state.query.length);
        }
        node = walker.nextNode();
      }
    });
  });
  const HighlightCtor = (window as unknown as { Highlight: new (...ranges: Range[]) => unknown }).Highlight;
  highlights.set('debate-search', new HighlightCtor(...ranges));
};

const apply = () => {
  let shown = 0;
  turns.forEach((turn, index) => {
    const start = Number(turn.dataset.start);
    const visible =
      matchesKind(turn) &&
      matchesPair(turn) &&
      (state.speaker === null || turn.dataset.speaker === state.speaker) &&
      (state.topic === null || topicsOf(turn).includes(state.topic)) &&
      (state.bin === null || Math.floor(start / binSeconds) === state.bin) &&
      (state.from === null || start >= state.from) &&
      (state.to === null || start <= state.to) &&
      (state.query === '' || texts[index].includes(state.query));
    turn.hidden = !visible;
    if (visible) shown += 1;
  });
  countEl.textContent = `${shown.toLocaleString('es-ES')} de ${turns.length.toLocaleString('es-ES')} intervenciones`;
  emptyEl.hidden = shown > 0;

  root.querySelectorAll<HTMLElement>('[data-kind-filter]').forEach((button) =>
    button.setAttribute('aria-pressed', String(button.dataset.kindFilter === state.kind)),
  );
  root.querySelectorAll<HTMLElement>('[data-speaker-filter]').forEach((button) =>
    button.setAttribute('aria-pressed', String(button.dataset.speakerFilter === state.speaker)),
  );
  root.querySelectorAll<HTMLElement>('[data-topic]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.topic === state.topic)));
  root.querySelectorAll<HTMLElement>('[data-pair]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.pair === state.pair)));
  root.querySelectorAll<HTMLElement>('button[data-bin]').forEach((element) => {
    element.setAttribute('aria-pressed', String(state.bin !== null && Number(element.dataset.bin) === state.bin));
  });
  root.querySelectorAll<HTMLElement>('[data-topic-bin]').forEach((cell) => {
    const [topic, binIndex] = (cell.dataset.topicBin ?? '').split(':');
    cell.classList.toggle('is-selected', state.topic === topic && state.bin === Number(binIndex));
  });

  // The marks of the charts that do not match the filter fade out.
  root.querySelectorAll<HTMLElement>('[data-event]').forEach((mark) => {
    const [by, of] = state.pair ? state.pair.split('|') : [null, null];
    const matches =
      (state.speaker === null || mark.dataset.by === state.speaker || mark.dataset.of === state.speaker) &&
      (state.topic === null || topicsOf(mark).includes(state.topic)) &&
      (state.bin === null || Number(mark.dataset.bin) === state.bin) &&
      (state.kind === '' || state.kind === 'any' || mark.dataset.kind === state.kind) &&
      (by === null || (mark.dataset.by === by && mark.dataset.of === of));
    mark.classList.toggle('is-dim', !matches);
  });

  renderChips();
  markQuery();
};

const scrollToTranscript = () => {
  document.getElementById('debate-transcripcion')?.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
};
const scrollToTurn = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
};

const toggle = <K extends 'speaker' | 'topic' | 'bin' | 'pair'>(key: K, value: State[K]) => {
  state[key] = (state[key] === value ? null : value) as State[K];
};

const resetAll = () => {
  state.kind = '';
  state.speaker = null;
  state.topic = null;
  state.bin = null;
  state.pair = null;
  state.from = null;
  state.to = null;
  state.query = '';
  fromEl.value = '';
  toEl.value = '';
  searchEl.value = '';
};

root.addEventListener('click', (event) => {
  const target = event.target as Element;

  // A mark or a line of «el momento más tenso»: show its block and go to the intervention.
  const link = target.closest<HTMLAnchorElement>('a[data-event]');
  if (link) {
    event.preventDefault();
    resetAll();
    state.bin = Number(link.dataset.bin);
    apply();
    scrollToTurn(link.getAttribute('href')?.slice(1) ?? '');
    return;
  }
  // A turn of a lane: go to that intervention, with no filter.
  const turnMark = target.closest<HTMLElement | SVGElement>('[data-goto]');
  if (turnMark) {
    event.preventDefault();
    resetAll();
    apply();
    scrollToTurn(`intervencion-${turnMark.dataset.goto}`);
    return;
  }
  // A cell of a topic strip: that topic in that block.
  const cell = target.closest<HTMLElement>('[data-topic-bin]');
  if (cell) {
    const [topic, binIndex] = (cell.dataset.topicBin ?? '').split(':');
    const same = state.topic === topic && state.bin === Number(binIndex);
    state.topic = same ? null : topic;
    state.bin = same ? null : Number(binIndex);
    apply();
    if (!same) scrollToTranscript();
    return;
  }

  const control = target.closest<HTMLElement>('[data-reset], [data-kind-filter], [data-speaker-filter], [data-topic], [data-bin], [data-pair], [data-clear]');
  if (!control) return;
  const fromChart = control.closest('.reader') === null;

  if (control.hasAttribute('data-reset')) {
    resetAll();
  } else if (control.dataset.kindFilter !== undefined) {
    state.kind = control.dataset.kindFilter as Kind;
  } else if (control.dataset.speakerFilter !== undefined) {
    toggle('speaker', control.dataset.speakerFilter);
  } else if (control.dataset.topic !== undefined) {
    toggle('topic', control.dataset.topic);
  } else if (control.dataset.pair !== undefined) {
    toggle('pair', control.dataset.pair);
  } else if (control.dataset.bin !== undefined && control.dataset.bin !== '') {
    toggle('bin', Number(control.dataset.bin));
  } else if (control.dataset.clear !== undefined) {
    const key = control.dataset.clear;
    if (key === 'kind') state.kind = '';
    if (key === 'speaker') state.speaker = null;
    if (key === 'topic') state.topic = null;
    if (key === 'bin') state.bin = null;
    if (key === 'pair') state.pair = null;
    if (key === 'query') {
      state.query = '';
      searchEl.value = '';
    }
    if (key === 'range') {
      state.from = null;
      state.to = null;
      fromEl.value = '';
      toEl.value = '';
    }
  }
  apply();
  if (fromChart && hasFilter()) scrollToTranscript();
});

// Keyboard: an element with role="button" works with Enter and Space.
root.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const element = event.target as HTMLElement;
  if (element.getAttribute('role') === 'button') {
    event.preventDefault();
    element.click();
  }
});

// The search filters while the reader types, after a short pause.
let searchTimer = 0;
searchEl.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    state.query = fold(searchEl.value.trim());
    apply();
  }, 180);
});

// The time range: «Desde» and «Hasta», in the same format as the transcript times.
const readRange = (input: HTMLInputElement, key: 'from' | 'to') => {
  const value = parseTime(input.value);
  if (Number.isNaN(value)) {
    input.setAttribute('aria-invalid', 'true');
    hintEl.textContent = 'Tiempo no válido. Escríbalo como 1:02:03 o 02:03.';
    state[key] = null;
  } else {
    input.removeAttribute('aria-invalid');
    hintEl.textContent = 'Como 1:02:03 o 02:03. Vacío: sin límite.';
    state[key] = value;
  }
  apply();
};
fromEl.addEventListener('change', () => readRange(fromEl, 'from'));
toEl.addEventListener('change', () => readRange(toEl, 'to'));

// The tooltip: shown for each mark, bar, turn and cell that carries data-tip-title.
const showTip = (element: Element, x: number | null, y: number | null) => {
  const data = (element as HTMLElement).dataset;
  tipTitle.textContent = data.tipTitle ?? '';
  tipBody.textContent = data.tipBody ?? '';
  tip.hidden = false;
  const box = root.getBoundingClientRect();
  const anchor = element.getBoundingClientRect();
  const left = x !== null ? x - box.left + 14 : anchor.left - box.left;
  const top = y !== null ? y - box.top + 18 : anchor.bottom - box.top + 6;
  tip.style.left = `${Math.max(4, Math.min(left, box.width - tip.offsetWidth - 4))}px`;
  tip.style.top = `${top}px`;
};
const hideTip = () => {
  tip.hidden = true;
};
root.addEventListener('pointerover', (event) => {
  const element = (event.target as Element).closest('[data-tip-title]');
  if (element) showTip(element, event.clientX, event.clientY);
});
root.addEventListener('pointermove', (event) => {
  const element = (event.target as Element).closest('[data-tip-title]');
  if (element && !tip.hidden) showTip(element, event.clientX, event.clientY);
});
root.addEventListener('pointerout', (event) => {
  if ((event.target as Element).closest('[data-tip-title]')) hideTip();
});
root.addEventListener('focusin', (event) => {
  const element = (event.target as Element).closest('[data-tip-title]');
  if (element) showTip(element, null, null);
});
root.addEventListener('focusout', hideTip);

// The map of the debate beside the transcript: the marker follows the reading position, and a click goes to the
// first visible intervention from that moment.
const minimap = document.getElementById('debate-minimap') as HTMLElement;
const nowEl = document.getElementById('debate-now') as HTMLElement;
const span = Number(minimap.dataset.span);
let ticking = false;
const follow = () => {
  ticking = false;
  if (minimap.offsetParent === null) return;
  const line = window.innerHeight * 0.3;
  const current = turns.find((turn) => !turn.hidden && turn.getBoundingClientRect().bottom > line);
  if (!current) return;
  const start = Number(current.dataset.start);
  nowEl.style.top = `${(start / span) * 100}%`;
  (nowEl.firstElementChild as HTMLElement).textContent = clock(start);
};
window.addEventListener(
  'scroll',
  () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(follow);
    }
  },
  { passive: true },
);
minimap.addEventListener('click', (event) => {
  const box = minimap.getBoundingClientRect();
  const seconds = ((event.clientY - box.top) / box.height) * span;
  const target = turns.find((turn) => !turn.hidden && Number(turn.dataset.start) >= seconds) ?? turns.filter((turn) => !turn.hidden).pop();
  if (target) target.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
});

apply();
follow();
