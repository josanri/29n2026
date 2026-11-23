/** Client code of the simulator page (src/pages/simulador/index.astro): Congress & Senate groups, votes, pacts and image/video/GIF export. */
import { ABSOLUTE_MAJORITY, CONGRESS_SEATS, type CongressGroup } from '@eleccion/congreso';
import {
  SENATE_ABSOLUTE_MAJORITY,
  SENATE_AUTONOMOUS_SEATS,
  SENATE_ELECTED_SEATS,
  SENATE_SEATS,
  SENATE_THREE_FIFTHS,
  SENATE_TWO_THIRDS,
  type SenateGroup,
} from '@eleccion/senado';
import { election } from '@eleccion/eleccion';
import { SITE_NAME } from '@/lib/site';
import { HEMICYCLE, SENATE_HEMICYCLE_ROWS, hemicyclePositions, investiture, minimalCoalitions, type Vote } from '@/lib/simulator';
import {
  GIF_SCALE,
  IMAGE_ANIMATION_SECONDS,
  IMAGE_FORMATS,
  drawSimulatorImage,
  loadImageFonts,
  type ImageContent,
  type ImageFormat,
  type ImageInput,
  type ImageTheme,
} from '@/lib/simulator-image';
import { tooltip } from '@/lib/tooltip';

type ChamberId = 'congreso' | 'senado';

type RawGroup = (CongressGroup | SenateGroup) & {
  href?: string;
  seatsAutonomous?: number;
  next?: { acronym: string; name: string; color: string; programId?: string; href?: string };
};

type Group = {
  id: string;
  acronym: string;
  name: string;
  color: string;
  seats: number;
  href?: string;
  custom: boolean;
  seatsNow: number;
  seats2023: number;
  seatsAutonomous: number;
  /** The other name of the same group (Sumar ↔ Frente Amplio). The button of its row swaps the two names. */
  alt?: { acronym: string; name: string; color: string; href?: string };
  /** True when the group uses its name of the new election (Frente Amplio). */
  renamed?: boolean;
};

type SortMode = 'hemicycle' | 'alpha' | 'seats';

interface ChamberConfig {
  id: ChamberId;
  totalSeats: number;
  majority: number;
  hemicycleRows: number;
  pageTitle: string;
  heroTitle: string;
  heroLede: string;
  noun: string;
  articleNoun: string;
  shareSeatsLabel: string;
  shareVoteLabel: string;
  presetNowLabel: string;
  preset2023Label: string;
  hasAutonomousPreset: boolean;
  voteHeading: string;
  voteLead: string;
  candidateLabel: string;
  candidatePlaceholder: string;
  candidateNote: string;
  voteOptionLabel: string;
  voteOptionNote: string;
  voteBarLabel: string;
  kickerSeats: string;
  kickerVote: string;
  voteSubjectLabel: string;
  defaultTitles: Record<ImageContent, string>;
  filePrefix: string;
  fileVoteSlug: string;
  shareTitle: string;
  shareCta: string;
  shareEmptyText: string;
}

const CHAMBERS: Record<ChamberId, ChamberConfig> = {
  congreso: {
    id: 'congreso',
    totalSeats: CONGRESS_SEATS,
    majority: ABSOLUTE_MAJORITY,
    hemicycleRows: HEMICYCLE.rows,
    pageTitle: 'Simulador de Congreso y pactos',
    heroTitle: 'Congreso y pactos',
    heroLede: `Reparte los ${CONGRESS_SEATS} escaños como quieras, crea partidos nuevos y comprueba qué pactos logran investir a un presidente. Los escaños de partida son los del Congreso actual. Los números no son una previsión.`,
    noun: 'Congreso',
    articleNoun: 'el Congreso',
    shareSeatsLabel: 'Compartir este Congreso…',
    shareVoteLabel: 'Compartir esta investidura…',
    presetNowLabel: 'Congreso actual',
    preset2023Label: 'Resultados de 2023',
    hasAutonomousPreset: false,
    voteHeading: 'Prueba una investidura',
    voteLead: `Elige un candidato y decide el voto de cada partido. Con ${ABSOLUTE_MAJORITY} votos a favor se inviste en la primera votación. Si no, a las 48 horas basta con más votos a favor que en contra.`,
    candidateLabel: 'Candidato a la investidura',
    candidatePlaceholder: 'Elige un candidato',
    candidateNote: 'El partido del candidato vota «Sí».',
    voteOptionLabel: 'Investidura',
    voteOptionNote: 'Para la investidura, elige antes un candidato.',
    voteBarLabel: 'Votos de la investidura',
    kickerSeats: 'Congreso',
    kickerVote: 'Investidura',
    voteSubjectLabel: 'CANDIDATO',
    defaultTitles: { seats: 'Mi Congreso', vote: 'Mi investidura' },
    filePrefix: 'congreso',
    fileVoteSlug: 'investidura',
    shareTitle: `Congreso y pactos (${SITE_NAME})`,
    shareCta: `Prueba otros pactos en el simulador de ${SITE_NAME}:`,
    shareEmptyText: 'Reparte los escaños del Congreso y prueba qué pactos logran una investidura.',
  },
  senado: {
    id: 'senado',
    totalSeats: SENATE_SEATS,
    majority: SENATE_ABSOLUTE_MAJORITY,
    hemicycleRows: SENATE_HEMICYCLE_ROWS,
    pageTitle: 'Simulador de Senado y mayorías',
    heroTitle: 'Senado y mayorías',
    heroLede: `Reparte los ${SENATE_SEATS} escaños del Senado (${SENATE_ELECTED_SEATS} electos y ${SENATE_AUTONOMOUS_SEATS} de designación autonómica), crea partidos nuevos y prueba qué pactos logran la mayoría absoluta de ${SENATE_ABSOLUTE_MAJORITY}. Los números no son una previsión.`,
    noun: 'Senado',
    articleNoun: 'el Senado',
    shareSeatsLabel: 'Compartir este Senado…',
    shareVoteLabel: 'Compartir esta votación…',
    presetNowLabel: 'Senado actual',
    preset2023Label: `Electos de 2023 (${SENATE_ELECTED_SEATS})`,
    hasAutonomousPreset: true,
    voteHeading: 'Prueba una votación',
    voteLead: `El Senado no inviste al presidente del Gobierno, pero sus mayorías deciden vetos a leyes (art. 90), el artículo 155, enmiendas y mociones. Elige un partido impulsor y decide el voto de cada grupo: ${SENATE_ABSOLUTE_MAJORITY} escaños dan la mayoría absoluta.`,
    candidateLabel: 'Partido que impulsa la votación',
    candidatePlaceholder: 'Elige un partido',
    candidateNote: 'El partido elegido vota «Sí».',
    voteOptionLabel: 'Votación',
    voteOptionNote: 'Para la votación, elige antes un partido.',
    voteBarLabel: 'Votos del Senado',
    kickerSeats: 'Senado',
    kickerVote: 'Votación del Senado',
    voteSubjectLabel: 'IMPULSOR',
    defaultTitles: { seats: 'Mi Senado', vote: 'Mi votación del Senado' },
    filePrefix: 'senado',
    fileVoteSlug: 'votacion',
    shareTitle: `Senado y mayorías (${SITE_NAME})`,
    shareCta: `Prueba otras mayorías en el simulador de ${SITE_NAME}:`,
    shareEmptyText: 'Reparte los escaños del Senado y prueba qué pactos logran la mayoría absoluta.',
  },
};

const ALL_DEFAULT_TITLES = new Set(Object.values(CHAMBERS).flatMap((chamber) => Object.values(chamber.defaultTitles)));

const root = document.querySelector<HTMLElement>('#sim')!;
const baseDataByChamber: Record<ChamberId, RawGroup[]> = JSON.parse(root.dataset.chambers!);
const baseGroupsFor = (id: ChamberId): Group[] =>
  baseDataByChamber[id].map(({ next, seatsAutonomous, ...group }) => ({
    ...group,
    alt: next,
    seats: group.seatsNow,
    seatsAutonomous: seatsAutonomous ?? 0,
    custom: false,
  }));

// The group takes its other name and color; its seats, its votes and its place stay.
const swapName = (group: Group): Group => {
  if (!group.alt) return group;
  const { acronym, name, color, href } = group;
  return { ...group, ...group.alt, href: group.alt.href, alt: { acronym, name, color, href }, renamed: !group.renamed };
};

// The lights of the voting board (see `.sim` in the styles).
const VOTE_COLORS: Record<Vote, string> = { yes: 'var(--led-yes)', abstain: 'var(--led-abstain)', no: 'var(--led-no)' };
const VOTE_LABELS: Record<Vote, string> = { yes: 'Sí', abstain: 'Abstención', no: 'No' };
const VOTE_CODES: Record<Vote, string> = { yes: 'y', abstain: 'a', no: 'n' };
const MAX_CUSTOM = 8;

// ---- State (kept per chamber during the visit so switching back does not discard edits) ----
interface ChamberState {
  groups: Group[];
  votes: Record<string, Vote>;
  candidate: string;
  nextCustomId: number;
  sortMode: SortMode;
}

const createState = (id: ChamberId): ChamberState => ({
  groups: baseGroupsFor(id),
  votes: {},
  candidate: '',
  nextCustomId: 1,
  sortMode: 'hemicycle',
});

const states: Record<ChamberId, ChamberState> = {
  congreso: createState('congreso'),
  senado: createState('senado'),
};
let activeChamber: ChamberId = 'congreso';

const cfg = () => CHAMBERS[activeChamber];
const state = () => states[activeChamber];

// ---- Elements ----
const $ = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;
const simTitle = $<HTMLElement>('#sim-title');
const simLede = $<HTMLElement>('#sim-lede');
const chamberButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-chamber]')];
const hemiSeats = $<SVGSVGElement>('#hemi-seats');
const hemiVotes = $<SVGSVGElement>('#hemi-votes');
const seatsTotal = $<SVGTextElement>('#seats-total');
const seatsCaption = $<SVGTextElement>('#seats-caption');
const status = $<HTMLElement>('#seats-status');
const exportOpenSeatsLabel = $<HTMLElement>('#export-open-seats-label');
const presetNow = $<HTMLButtonElement>('#preset-now');
const presetAutonomous = $<HTMLButtonElement>('#preset-autonomous');
const preset2023 = $<HTMLButtonElement>('#preset-2023');
const createMissing = $<HTMLButtonElement>('#create-missing');
const seatList = $<HTMLElement>('#seat-list');
const voteList = $<HTMLElement>('#vote-list');
const voteHeading = $<HTMLElement>('#vote-heading');
const voteLead = $<HTMLElement>('#vote-lead');
const candidateLabel = $<HTMLLabelElement>('#candidate-label');
const candidateNote = $<HTMLElement>('#candidate-note');
const select = $<HTMLSelectElement>('#candidate');
const coalitionsTitle = $<HTMLElement>('#coalitions-title');
const boardMajority = $<HTMLElement>('#board-majority');
const bar = $<HTMLElement>('#vote-bar');
const marker = $<HTMLElement>('#vote-marker');
const markerValue = $<HTMLElement>('#vote-marker-value');
const verdictBox = $<HTMLElement>('#verdict');
const verdictTitle = $<HTMLElement>('#verdict-title');
const verdictText = $<HTMLElement>('#verdict-text');
const exportOpenVote = $<HTMLButtonElement>('#export-open-vote');
const exportOpenVoteLabel = $<HTMLElement>('#export-open-vote-label');
const coalitionsLead = $<HTMLElement>('#coalitions-lead');
const coalitionsList = $<HTMLElement>('#coalitions');
const seatTemplate = $<HTMLTemplateElement>('#seat-row-template');
const voteTemplate = $<HTMLTemplateElement>('#vote-row-template');
const partyDetails = $<HTMLDetailsElement>('#party-details');
const partyForm = $<HTMLFormElement>('#party-form');
const partyError = $<HTMLElement>('#party-error');
const partySeats = partyForm.elements.namedItem('seats') as HTMLInputElement;
const partyAcronym = partyForm.elements.namedItem('acronym') as HTMLInputElement;
const partyColor = partyForm.elements.namedItem('color') as HTMLInputElement;
const noteCongreso = $<HTMLElement>('#sim-note-congreso');
const noteSenado = $<HTMLElement>('#sim-note-senado');

// A new party gets a random color. Of 24 random hues it takes the one that is farthest from the colors in use,
// so the new party does not look like another one.
const hueOf = (hex: string) => {
  const [red, green, blue] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const max = Math.max(red, green, blue);
  const delta = max - Math.min(red, green, blue);
  if (delta === 0) return 0;
  const hue = max === red ? ((green - blue) / delta) % 6 : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
  return (hue * 60 + 360) % 360;
};
const hslToHex = (hue: number, saturation: number, lightness: number) => {
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    return Math.round(255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
};
const randomPartyColor = () => {
  const used = state().groups.map((group) => hueOf(group.color));
  let best = Math.random() * 360;
  let bestDistance = -1;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const hue = Math.random() * 360;
    const distance = Math.min(...used.map((other) => Math.min(Math.abs(hue - other), 360 - Math.abs(hue - other))), 180);
    if (distance > bestDistance) {
      best = hue;
      bestDistance = distance;
    }
  }
  return hslToHex(best, 0.72, 0.5);
};

const SVG_NS = 'http://www.w3.org/2000/svg';
const circlesOf = (svg: SVGSVGElement) => [...svg.querySelectorAll<SVGCircleElement>('circle')];
let seatCircles = circlesOf(hemiSeats);
let voteCircles = circlesOf(hemiVotes);
let renderedHemicycleSeats = seatCircles.length;

const rebuildHemicycleSvg = (svg: SVGSVGElement, totalSeats: number, rows: number) => {
  for (const circle of svg.querySelectorAll('circle')) circle.remove();
  const { positions, seatRadius } = hemicyclePositions(totalSeats, rows);
  const fragment = document.createDocumentFragment();
  positions.forEach((position, index) => {
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.dataset.seat = String(index);
    circle.setAttribute('cx', String(position.x));
    circle.setAttribute('cy', String(position.y));
    circle.setAttribute('r', String(seatRadius));
    fragment.append(circle);
  });
  // Insert before the slot <text> nodes so the text stays on top of the circles.
  svg.prepend(fragment);
};

const syncHemicycles = () => {
  const { totalSeats, hemicycleRows } = cfg();
  if (renderedHemicycleSeats === totalSeats) return;
  rebuildHemicycleSvg(hemiSeats, totalSeats, hemicycleRows);
  rebuildHemicycleSvg(hemiVotes, totalSeats, hemicycleRows);
  seatCircles = circlesOf(hemiSeats);
  voteCircles = circlesOf(hemiVotes);
  renderedHemicycleSeats = totalSeats;
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const clampSeats = (value: number) => Math.min(cfg().totalSeats, Math.max(0, Number.isFinite(value) ? Math.trunc(value) : 0));
const byId = (id: string) => state().groups.find((group) => group.id === id) as Group;
const seatsMap = () => Object.fromEntries(state().groups.map((group) => [group.id, group.seats]));
const total = () => state().groups.reduce((sum, group) => sum + group.seats, 0);
const voteOf = (id: string): Vote => (id === state().candidate ? 'yes' : (state().votes[id] ?? 'no'));
const colorVar = (id: string) => `var(--g-${id})`;
const setColor = (group: Group) => root.style.setProperty(`--g-${group.id}`, group.color);

// A group takes a slice of the hemicycle, from the left. The seats that no group takes stay empty.
const paint = (circles: SVGCircleElement[], slices: { count: number; color: string; title: string; line: string }[]) => {
  let index = 0;
  for (const slice of slices) {
    for (let taken = 0; taken < slice.count && index < circles.length; taken += 1, index += 1) {
      circles[index].style.fill = slice.color;
      circles[index].setAttribute('data-tooltip', tooltip(slice.title, slice.line));
    }
  }
  for (; index < circles.length; index += 1) {
    circles[index].style.fill = '';
    circles[index].removeAttribute('data-tooltip');
  }
};

// ---- Rows (built from the templates, one pair for each group) ----
const seatRows = new Map<string, HTMLElement>();
const voteRows = new Map<string, HTMLElement>();

const createRows = (group: Group) => {
  setColor(group);

  const seatRow = (seatTemplate.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
  seatRow.dataset.group = group.id;
  seatRow.style.setProperty('--group', colorVar(group.id));
  const label = seatRow.querySelector<HTMLLabelElement>('.seat-row__label')!;
  const input = seatRow.querySelector<HTMLInputElement>('input')!;
  input.id = `seats-${group.id}`;
  input.max = String(cfg().totalSeats);
  label.htmlFor = input.id;
  const title = document.createElement('b');
  title.textContent = group.acronym;
  if (group.href) {
    const link = document.createElement('a');
    link.href = group.href;
    link.append(title);
    label.append(link);
  } else {
    label.append(title);
  }
  seatRow.querySelector<HTMLElement>('.seat-row__full')!.textContent = group.name;
  const handle = seatRow.querySelector<HTMLButtonElement>('.seat-row__handle')!;
  handle.setAttribute('aria-label', `Mover ${group.acronym} en el hemiciclo. Con las flechas, cambia de sitio con el partido de al lado.`);
  handle.addEventListener('pointerdown', (event) => startRowDrag(event, group, handle));
  handle.addEventListener('keydown', (event) => {
    const step = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : 0;
    if (!step) return;
    event.preventDefault();
    const groups = state().groups;
    const index = groups.findIndex((item) => item.id === group.id);
    const neighbor = groups[index + step];
    if (!neighbor) return;
    swapGroups(group.id, neighbor.id);
    handle.focus();
  });
  const remove = seatRow.querySelector<HTMLButtonElement>('.seat-row__remove')!;
  remove.hidden = !group.custom;
  remove.setAttribute('aria-label', `Quitar el partido ${group.acronym}`);
  seatRow.querySelector('[data-step="-1"]')!.setAttribute('aria-label', `Quitar un escaño a ${group.acronym}`);
  seatRow.querySelector('[data-step="1"]')!.setAttribute('aria-label', `Añadir un escaño a ${group.acronym}`);

  input.addEventListener('input', () => {
    group.seats = clampSeats(input.valueAsNumber);
    renderAll();
  });
  input.addEventListener('blur', () => {
    input.value = String(group.seats);
  });
  for (const button of seatRow.querySelectorAll<HTMLButtonElement>('[data-step]')) {
    button.addEventListener('click', () => {
      group.seats = clampSeats(group.seats + Number(button.dataset.step));
      renderAll();
    });
  }
  const rename = seatRow.querySelector<HTMLButtonElement>('.seat-row__rename')!;
  if (group.alt) {
    rename.hidden = false;
    rename.textContent = `Convertir en ${group.alt.name.replace(/\s*\(.*\)$/, '')}`;
    rename.setAttribute('aria-label', `Convertir ${group.acronym} en ${group.alt.acronym}, con los mismos escaños`);
    rename.addEventListener('click', () => {
      rebuild(state().groups.map((item) => (item.id === group.id ? swapName(item) : item)));
      renderAll();
      seatRows.get(group.id)?.querySelector<HTMLButtonElement>('.seat-row__rename')?.focus();
    });
  }
  remove.addEventListener('click', () => {
    state().groups = state().groups.filter((item) => item.id !== group.id);
    delete state().votes[group.id];
    seatRows.get(group.id)?.remove();
    voteRows.get(group.id)?.remove();
    seatRows.delete(group.id);
    voteRows.delete(group.id);
    renderAll();
  });

  const voteRow = (voteTemplate.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
  voteRow.dataset.voteGroup = group.id;
  voteRow.style.setProperty('--group', colorVar(group.id));
  voteRow.querySelector('b')!.textContent = group.acronym;
  const radios = [...voteRow.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
  const labels = [...voteRow.querySelectorAll<HTMLLabelElement>('label')];
  radios.forEach((radio, index) => {
    radio.name = `vote-${group.id}`;
    radio.id = `vote-${group.id}-${radio.value}`;
    labels[index].htmlFor = radio.id;
    radio.addEventListener('change', () => {
      if (radio.checked) state().votes[group.id] = radio.value as Vote;
      renderAll();
    });
  });

  seatRows.set(group.id, seatRow);
  voteRows.set(group.id, voteRow);
};

// The list of seats follows the sort mode. The list of votes and the hemicycle keep the order of the hemicycle.
const byName = (a: Group, b: Group) => a.acronym.localeCompare(b.acronym, 'es', { sensitivity: 'base' });
const sortedGroups = () => {
  const { groups, sortMode } = state();
  return sortMode === 'alpha' ? [...groups].sort(byName) : sortMode === 'seats' ? [...groups].sort((a, b) => b.seats - a.seats || byName(a, b)) : groups;
};
const placeSeatRows = () => {
  for (const group of sortedGroups()) seatList.append(seatRows.get(group.id)!);
};
const placeRows = () => {
  placeSeatRows();
  for (const group of state().groups) voteList.append(voteRows.get(group.id)!);
};

const sortButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-sort]')];
const renderSort = () => {
  const { sortMode } = state();
  for (const button of sortButtons) button.setAttribute('aria-pressed', String(button.dataset.sort === sortMode));
  // The handles move the groups in the hemicycle: they only make sense in the order of the hemicycle.
  seatList.dataset.sort = sortMode;
};
for (const button of sortButtons) {
  button.addEventListener('click', () => {
    state().sortMode = button.dataset.sort as SortMode;
    renderSort();
    placeSeatRows();
    writeUrl();
  });
}

// ---- Move: swap the position of two groups in the hemicycle ----
const orderStatus = $<HTMLElement>('#order-status');
const swapGroups = (firstId: string, secondId: string) => {
  const groups = state().groups;
  const first = groups.findIndex((group) => group.id === firstId);
  const second = groups.findIndex((group) => group.id === secondId);
  if (first < 0 || second < 0 || first === second) return;
  [groups[first], groups[second]] = [groups[second], groups[first]];
  placeRows();
  renderAll();
  orderStatus.textContent = `${byId(firstId).acronym} pasa a la posición ${groups.findIndex((group) => group.id === firstId) + 1} y ${byId(secondId).acronym} a la ${groups.findIndex((group) => group.id === secondId) + 1} de ${groups.length}.`;
};

// Drag a row by its handle onto another row. The pointer is captured by the handle, so it works with mouse, pen and touch.
const startRowDrag = (event: PointerEvent, group: Group, handle: HTMLElement) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  handle.setPointerCapture(event.pointerId);
  const row = seatRows.get(group.id)!;
  row.classList.add('is-dragging');
  let target: string | null = null;
  const setTarget = (id: string | null) => {
    if (id === target) return;
    if (target) seatRows.get(target)?.classList.remove('is-drop');
    target = id;
    if (target) seatRows.get(target)?.classList.add('is-drop');
  };
  const move = (moveEvent: PointerEvent) => {
    const scroller = seatList.parentElement!;
    const box = scroller.getBoundingClientRect();
    const EDGE = 40;
    if (moveEvent.clientY < box.top + EDGE) scroller.scrollTop -= 14;
    else if (moveEvent.clientY > box.bottom - EDGE) scroller.scrollTop += 14;
    const over = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest<HTMLElement>('.seat-row');
    setTarget(over?.dataset.group && over.dataset.group !== group.id ? over.dataset.group : null);
  };
  const end = (endEvent: PointerEvent) => {
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', end);
    handle.removeEventListener('pointercancel', end);
    row.classList.remove('is-dragging');
    const dropped = endEvent.type === 'pointerup' ? target : null;
    setTarget(null);
    if (dropped) swapGroups(group.id, dropped);
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
};

// Drag the seats of a group, in the hemicycle, onto the seats of another group.
const ownerOfSeat = (index: number) => {
  let end = 0;
  for (const group of state().groups) {
    end += group.seats;
    if (index < end) return group.id;
  }
  return undefined;
};
const markSeats = (id: string | undefined, kind: 'source' | 'target' | null) => {
  if (!id) return;
  seatCircles.forEach((circle, index) => {
    if (ownerOfSeat(index) !== id) return;
    if (kind) circle.dataset.drag = kind;
    else delete circle.dataset.drag;
  });
};
hemiSeats.addEventListener('pointerdown', (event) => {
  const circle = (event.target as Element).closest<SVGCircleElement>('circle');
  if (!circle || (event.pointerType === 'mouse' && event.button !== 0)) return;
  const sourceId = ownerOfSeat(Number(circle.dataset.seat));
  if (!sourceId) return;
  event.preventDefault();
  hemiSeats.setPointerCapture(event.pointerId);
  hemiSeats.classList.add('is-dragging');
  markSeats(sourceId, 'source');
  let targetId: string | undefined;
  const move = (moveEvent: PointerEvent) => {
    const over = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest<SVGCircleElement>('#hemi-seats circle');
    const id = over ? ownerOfSeat(Number(over.dataset.seat)) : undefined;
    const next = id && id !== sourceId ? id : undefined;
    if (next === targetId) return;
    markSeats(targetId, null);
    targetId = next;
    markSeats(targetId, 'target');
  };
  const end = (endEvent: PointerEvent) => {
    hemiSeats.removeEventListener('pointermove', move);
    hemiSeats.removeEventListener('pointerup', end);
    hemiSeats.removeEventListener('pointercancel', end);
    hemiSeats.classList.remove('is-dragging');
    markSeats(sourceId, null);
    markSeats(targetId, null);
    if (endEvent.type === 'pointerup' && targetId) swapGroups(sourceId, targetId);
  };
  hemiSeats.addEventListener('pointermove', move);
  hemiSeats.addEventListener('pointerup', end);
  hemiSeats.addEventListener('pointercancel', end);
});

// Sorting by seats must not move a row while the reader changes its number: the list sorts again when the focus leaves it.
seatList.addEventListener('focusout', (event) => {
  if (state().sortMode === 'seats' && !seatList.contains(event.relatedTarget as Node | null)) placeSeatRows();
});

// ---- Seats ----
const renderSeats = () => {
  const { totalSeats, articleNoun, noun } = cfg();
  const groups = state().groups;
  const sum = total();
  for (const group of groups) {
    const input = seatRows.get(group.id)!.querySelector<HTMLInputElement>('input')!;
    const value = String(group.seats);
    if (input.value !== value && document.activeElement !== input) input.value = value;
  }
  paint(
    seatCircles,
    groups.map((group) => ({ count: group.seats, color: colorVar(group.id), title: group.acronym, line: plural(group.seats, 'escaño', 'escaños') })),
  );
  seatsTotal.textContent = String(sum);
  hemiSeats.setAttribute(
    'aria-label',
    `Hemiciclo del ${noun} con ${sum} escaños: ${groups.filter((group) => group.seats > 0).map((group) => `${group.acronym} ${group.seats}`).join(', ')}`,
  );
  const difference = totalSeats - sum;
  status.textContent =
    difference === 0
      ? `Los ${totalSeats} escaños están repartidos.`
      : difference > 0
        ? `Faltan ${plural(difference, 'escaño', 'escaños')} por repartir.`
        : `Sobran ${plural(-difference, 'escaño', 'escaños')}: ${articleNoun} tiene ${totalSeats}.`;
  status.dataset.state = difference === 0 ? 'ok' : 'warning';
  createMissing.hidden = difference <= 0;
};

// ---- Pacts and votes ----
// A candidate/sponsor whose party has no seats (or no longer exists) goes back to none.
const ensureCandidate = () => {
  const current = state().candidate;
  if (current && (byId(current)?.seats ?? 0) === 0) state().candidate = '';
};

const renderSelect = () => {
  const current = state().candidate;
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = cfg().candidatePlaceholder;
  placeholder.selected = !current;
  select.replaceChildren(
    placeholder,
    ...state()
      .groups.filter((group) => group.seats > 0)
      .map((group) => {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = `${group.acronym} (${group.seats})`;
        option.selected = group.id === current;
        return option;
      }),
  );
};

const renderVoteRows = () => {
  const current = state().candidate;
  for (const group of state().groups) {
    const row = voteRows.get(group.id)!;
    const isCandidate = group.id === current;
    row.hidden = group.seats === 0;
    row.dataset.candidate = String(isCandidate);
    // Without a candidate/sponsor there is nothing to vote: the votes wait.
    row.querySelector('fieldset')!.disabled = !current;
    row.querySelector<HTMLElement>('.vote-row__seats')!.textContent = plural(group.seats, 'escaño', 'escaños');
    const vote = voteOf(group.id);
    for (const radio of row.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
      radio.checked = radio.value === vote;
      radio.disabled = isCandidate;
    }
  }
};

let lastShare = { text: '', yesNames: [] as string[] };

const renderResult = () => {
  const { totalSeats, majority, articleNoun, noun } = cfg();
  const { groups, candidate, votes } = state();
  const sum = total();
  $<HTMLElement>('#tally-total').textContent = String(sum);
  // The mark of the absolute majority stays in its place, also without a candidate.
  marker.style.left = `${Math.min(100, (majority / Math.max(sum, totalSeats)) * 100)}%`;
  if (!candidate) {
    // The board is off until there is a candidate/sponsor.
    paint(
      voteCircles,
      groups.map((group) => ({ count: group.seats, color: '', title: group.acronym, line: plural(group.seats, 'escaño', 'escaños') })),
    );
    hemiVotes.setAttribute('aria-label', `Hemiciclo del ${noun} sin votación activa`);
    for (const part of bar.querySelectorAll<HTMLElement>('[data-part]')) {
      part.hidden = true;
      $<HTMLElement>(`#legend-${part.dataset.part}`).textContent = '–';
    }
    $<HTMLElement>('#vote-rest').style.flexGrow = '1';
    $<HTMLElement>('#vote-rest').hidden = false;
    bar.setAttribute(
      'aria-label',
      activeChamber === 'congreso' ? 'Sin votación: falta elegir un candidato.' : 'Sin votación: falta elegir un partido.',
    );
    verdictTitle.textContent = cfg().candidatePlaceholder;
    verdictText.textContent =
      activeChamber === 'congreso'
        ? 'Elige arriba el candidato a la investidura. Después, decide el voto de cada partido.'
        : 'Elige arriba el partido que impulsa la votación. Después, decide el voto de cada grupo.';
    verdictBox.dataset.outcome = 'none';
    lastShare = { yesNames: [], text: cfg().shareEmptyText };
    renderCoalitions();
    return;
  }
  const result = investiture(seatsMap(), candidate, votes, majority);
  paint(
    voteCircles,
    groups.map((group) => ({
      count: group.seats,
      color: VOTE_COLORS[voteOf(group.id)],
      title: `${group.acronym}: ${VOTE_LABELS[voteOf(group.id)]}`,
      line: plural(group.seats, 'escaño', 'escaños'),
    })),
  );
  hemiVotes.setAttribute('aria-label', `Hemiciclo del ${noun} con el sentido del voto: ${result.yes} sí, ${result.no} no y ${result.abstain} abstenciones`);

  for (const part of bar.querySelectorAll<HTMLElement>('[data-part]')) {
    const kind = part.dataset.part as Vote;
    part.style.flexGrow = String(result[kind]);
    part.hidden = result[kind] === 0;
    // The number goes inside the part only if it fits. The legend always has the name and the number.
    part.textContent = String(result[kind]);
    if (part.scrollWidth > part.clientWidth) part.textContent = '';
    $<HTMLElement>(`#legend-${kind}`).textContent = String(result[kind]);
  }
  // The bar always stands for the whole chamber: the seats not given to any group stay empty at the end.
  const rest = Math.max(0, totalSeats - sum);
  const restPart = $<HTMLElement>('#vote-rest');
  restPart.style.flexGrow = String(rest);
  // With every seat given, the empty part must not take any width.
  restPart.hidden = rest === 0;
  bar.setAttribute('aria-label', `Sí ${result.yes}, abstención ${result.abstain}, no ${result.no}. La mayoría absoluta es ${majority}.`);

  const missing = majority - result.yes;
  if (activeChamber === 'congreso') {
    if (result.outcome === 'first') {
      verdictTitle.textContent = 'Se inviste en la primera votación';
      verdictText.textContent = `${result.yes} votos a favor: supera la mayoría absoluta de ${majority}.`;
    } else if (result.outcome === 'second') {
      verdictTitle.textContent = 'Se inviste en la segunda votación';
      verdictText.textContent = `En la primera faltan ${plural(missing, 'voto', 'votos')} para ${majority}. A las 48 horas basta con más votos a favor que en contra: ${result.yes} sí frente a ${result.no} no.`;
    } else {
      verdictTitle.textContent = 'No se logra la investidura';
      verdictText.textContent = `${result.yes} sí, ${result.no} no y ${plural(result.abstain, 'abstención', 'abstenciones')}. No llega a ${majority} y no supera a los votos en contra. Si pasan dos meses desde la primera votación sin investir a nadie, se disuelven las Cortes.`;
    }
  } else {
    if (result.outcome === 'first') {
      verdictTitle.textContent = 'Se alcanza la mayoría absoluta';
      const reinforced =
        result.yes >= SENATE_TWO_THIRDS
          ? ` También supera los 2/3 (${SENATE_TWO_THIRDS}) para una reforma constitucional agravada.`
          : result.yes >= SENATE_THREE_FIFTHS
            ? ` También supera los 3/5 (${SENATE_THREE_FIFTHS}) para reformas constitucionales y órganos judiciales.`
            : '';
      verdictText.textContent = `${result.yes} votos a favor: supera la mayoría absoluta de ${majority}. Sirve para vetar una ley (art. 90), aplicar el artículo 155 o elegir la Presidencia en primera vuelta.${reinforced}`;
    } else if (result.outcome === 'second') {
      verdictTitle.textContent = 'Se aprueba por mayoría simple';
      verdictText.textContent = `Faltan ${plural(missing, 'voto', 'votos')} para la mayoría absoluta de ${majority}, pero hay más sí que no (${result.yes} frente a ${result.no}). Sirve para enmiendas y mociones, pero no para vetar una ley ni aplicar el artículo 155.`;
    } else {
      verdictTitle.textContent = 'No se aprueba la votación';
      verdictText.textContent = `${result.yes} sí, ${result.no} no y ${plural(result.abstain, 'abstención', 'abstenciones')}. No llega a la mayoría absoluta de ${majority} ni supera a los votos en contra.`;
    }
  }
  if (sum !== totalSeats) verdictText.textContent += ` Atención: has repartido ${sum} escaños y ${articleNoun} tiene ${totalSeats}.`;
  verdictBox.dataset.outcome = result.outcome;

  // The sentence of the message is complete by itself. The call to action goes after it, before the link.
  const yesNames = groups.filter((group) => group.seats > 0 && voteOf(group.id) === 'yes').map((group) => group.acronym);
  lastShare = {
    yesNames,
    text: `${verdictTitle.textContent}: ${yesNames.join(' + ')} ${yesNames.length === 1 ? 'suma' : 'suman'} ${plural(result.yes, 'voto', 'votos')} (${result.no} en contra y ${plural(result.abstain, 'abstención', 'abstenciones')}).`,
  };
  renderCoalitions();
};

const renderCoalitions = () => {
  const { majority } = cfg();
  const { groups, candidate, votes } = state();
  coalitionsList.replaceChildren();
  if (!candidate) {
    coalitionsLead.textContent =
      activeChamber === 'congreso'
        ? `Elige un candidato para ver qué pactos suman ${majority}.`
        : `Elige un partido para ver qué pactos suman ${majority}.`;
    return;
  }
  const found = minimalCoalitions(seatsMap(), candidate, 6, majority);
  const name = byId(candidate).acronym;
  if (found.length === 0) {
    coalitionsLead.textContent =
      activeChamber === 'congreso'
        ? `Con estos escaños, ningún pacto de ${name} suma ${majority}. Queda la segunda votación: más sí que no.`
        : `Con estos escaños, ningún pacto de ${name} suma ${majority}. Queda la mayoría simple: más sí que no.`;
    return;
  }
  if (found[0].partners.length === 0) {
    coalitionsLead.textContent = `${name} tiene mayoría absoluta en solitario.`;
    return;
  }
  coalitionsLead.textContent =
    'Son sumas, no previsiones: no miran si los partidos aceptarían pactar. Salen las combinaciones más cortas, sin ningún partido que sobre. Pulsa una para aplicarla.';
  const yesIds = new Set(groups.filter((group) => group.seats > 0 && voteOf(group.id) === 'yes').map((group) => group.id));
  for (const coalition of found) {
    const members = [candidate, ...coalition.partners];
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'coalition';
    button.setAttribute('aria-pressed', String(members.length === yesIds.size && members.every((id) => yesIds.has(id))));
    button.setAttribute('aria-label', `Aplicar el pacto ${members.map((id) => byId(id).acronym).join(', ')}: ${coalition.seats} escaños`);

    const parties = document.createElement('span');
    parties.className = 'coalition__parties';
    members.forEach((id, index) => {
      if (index > 0) {
        const plus = document.createElement('span');
        plus.className = 'coalition__plus';
        plus.textContent = '+';
        plus.setAttribute('aria-hidden', 'true');
        parties.append(plus);
      }
      const party = document.createElement('span');
      party.className = 'coalition__party';
      const swatch = document.createElement('span');
      swatch.className = 'coalition__swatch';
      swatch.style.background = colorVar(id);
      swatch.setAttribute('aria-hidden', 'true');
      party.append(swatch, byId(id).acronym);
      parties.append(party);
    });

    const sum = document.createElement('span');
    sum.className = 'coalition__sum';
    const strong = document.createElement('strong');
    strong.textContent = String(coalition.seats);
    const margin = document.createElement('small');
    margin.textContent = `+${coalition.seats - majority} sobre ${majority}`;
    sum.append(strong, margin);

    button.append(parties, sum);
    button.addEventListener('click', () => {
      for (const group of state().groups) if (group.id !== candidate) votes[group.id] = coalition.partners.includes(group.id) ? 'yes' : 'no';
      renderAll();
    });
    item.append(button);
    coalitionsList.append(item);
  }
};

// ---- Link of the state: it keeps the chamber, the order, the seats, the custom parties and the votes ----
const CUSTOM_ID = /^x\d+$/;
const HEX = /^[0-9a-f]{6}$/i;
const writeUrl = () => {
  const { groups, candidate, sortMode } = state();
  const url = new URL(location.href);
  if (activeChamber === 'senado') url.searchParams.set('camara', 'senado');
  else url.searchParams.delete('camara');
  url.searchParams.set('e', groups.map((group) => `${group.id}-${group.seats}`).join(','));
  url.searchParams.set('v', groups.map((group) => VOTE_CODES[voteOf(group.id)]).join(''));
  if (candidate) url.searchParams.set('c', candidate);
  else url.searchParams.delete('c');
  if (sortMode === 'hemicycle') url.searchParams.delete('o');
  else url.searchParams.set('o', sortMode);
  const renamed = groups.filter((group) => group.renamed).map((group) => group.id);
  if (renamed.length) url.searchParams.set('r', renamed.join(','));
  else url.searchParams.delete('r');
  const customs = groups.filter((group) => group.custom);
  if (customs.length) {
    url.searchParams.set('x', customs.map((group) => `${group.id}~${encodeURIComponent(group.acronym)}~${group.color.slice(1)}`).join('|'));
  } else {
    url.searchParams.delete('x');
  }
  history.replaceState(null, '', url);
  updateShareLinks(url.href);
};

const readUrl = () => {
  const params = new URLSearchParams(location.search);
  const requestedChamber = params.get('camara');
  if (requestedChamber === 'senado') activeChamber = 'senado';

  const current = state();
  const maxSeats = cfg().totalSeats;
  for (const entry of (params.get('x') ?? '').split('|').slice(0, MAX_CUSTOM)) {
    const [id, acronym, hex] = entry.split('~');
    if (!CUSTOM_ID.test(id ?? '') || !acronym || !HEX.test(hex ?? '')) continue;
    current.groups.push({
      id,
      acronym: decodeURIComponent(acronym).slice(0, 12),
      name: 'Partido creado por ti',
      color: `#${hex}`,
      seats: 0,
      custom: true,
      seatsNow: 0,
      seats2023: 0,
      seatsAutonomous: 0,
    });
    current.nextCustomId = Math.max(current.nextCustomId, Number(id.slice(1)) + 1);
  }
  const renamed = (params.get('r') ?? '').split(',');
  current.groups = current.groups.map((group) => (group.alt && renamed.includes(group.id) ? swapName(group) : group));
  const entries = (params.get('e') ?? '').split(',').map((entry) => entry.split('-'));
  const valid = entries.every(([id, seats]) => byId(id) && /^\d+$/.test(seats ?? '') && Number(seats) <= maxSeats);
  if (params.get('e') && valid) {
    const ordered = entries.map(([id, seats]) => Object.assign(byId(id), { seats: Number(seats) }));
    const rest = current.groups.filter((group) => !ordered.includes(group)).map((group) => Object.assign(group, { seats: 0 }));
    const codes = params.get('v') ?? '';
    const byCode = Object.fromEntries(Object.entries(VOTE_CODES).map(([vote, code]) => [code, vote as Vote]));
    ordered.forEach((group, index) => {
      if (byCode[codes[index]]) current.votes[group.id] = byCode[codes[index]];
    });
    current.groups = [...ordered, ...rest];
  }
  const order = params.get('o');
  if (order === 'alpha' || order === 'seats') current.sortMode = order;
  const requested = params.get('c');
  if (requested && byId(requested)) current.candidate = requested;
};

// ---- Sharing ----
const shareStatus = $<HTMLElement>('#share-status');
const sharePreview = $<HTMLElement>('#share-preview');
const nativeButton = $<HTMLButtonElement>('#share-native');
const networkLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-network]')];
/** The address that each network gives to a shared page. The text and the link are encoded. */
const shareUrls: Record<string, (text: string, href: string) => string> = {
  whatsapp: (text, href) => `https://wa.me/?text=${encodeURIComponent(`${text}\n\n${cfg().shareCta} ${href}`)}`,
  telegram: (text, href) => `https://t.me/share/url?url=${encodeURIComponent(href)}&text=${encodeURIComponent(`${text}\n${cfg().shareCta}`)}`,
  x: (text, href) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${text} ${cfg().shareCta}`)}&url=${encodeURIComponent(href)}`,
  facebook: (_text, href) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(href)}`,
  linkedin: (_text, href) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(href)}`,
  email: (text, href) => `mailto:?subject=${encodeURIComponent(cfg().shareTitle)}&body=${encodeURIComponent(`${text}\n\n${cfg().shareCta}\n${href}`)}`,
};
let statusTimer = 0;
const say = (message: string) => {
  shareStatus.textContent = message;
  clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => (shareStatus.textContent = ''), 4000);
};
const updateShareLinks = (href: string) => {
  for (const link of networkLinks) link.href = shareUrls[link.dataset.network!](lastShare.text, href);
  sharePreview.textContent = lastShare.text;
};

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Without the clipboard API (an old browser, or a page without HTTPS), select a text field and copy it.
    const field = document.createElement('textarea');
    field.value = text;
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.append(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    return copied;
  }
};

$('#share-copy').addEventListener('click', async () => {
  say((await copyText(location.href)) ? 'Enlace copiado.' : 'No se pudo copiar. Copia la dirección de la barra del navegador.');
});
if (typeof navigator.share === 'function') {
  nativeButton.hidden = false;
  nativeButton.addEventListener('click', async () => {
    try {
      await navigator.share({ title: cfg().shareTitle, text: `${lastShare.text}\n${cfg().shareCta}`, url: location.href });
    } catch {
      /* The reader closed the share sheet. */
    }
  });
}

// ---- The image: a picture of the simulation to post anywhere, made in a dialog with a live preview ----
const resolveColor = (value: string) => {
  const probe = document.createElement('span');
  probe.style.color = value;
  root.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
};
const exportDialog = $<HTMLDialogElement>('#export-dialog');
const exportForm = $<HTMLFormElement>('#export-form');
const exportCanvas = $<HTMLCanvasElement>('#export-canvas');
const exportSize = $<HTMLElement>('#export-size');
const exportStatus = $<HTMLElement>('#export-status');
const exportShare = $<HTMLButtonElement>('#export-share');
const exportCopy = $<HTMLButtonElement>('#export-copy');
const voteOption = exportForm.querySelector<HTMLInputElement>('input[name="content"][value="vote"]')!;
const seatsOption = exportForm.querySelector<HTMLInputElement>('input[name="content"][value="seats"]')!;
const exportVoteLabel = $<HTMLElement>('#export-vote-label');
const voteNote = $<HTMLElement>('#export-vote-note');
const titleInput = exportForm.elements.namedItem('title') as HTMLInputElement;

// ---- The kinds of file. PNG always; the video and the GIF only where this browser can make them ----
type FileKind = 'png' | 'video' | 'gif';
// The video: MP4 with H.264 first, because WhatsApp and Instagram need it. Without H.264, WebM. A plain «video/mp4»
// comes last (Safari): Chromium without H.264 accepts it too, but it puts VP9 inside, and the networks reject that file.
const videoType = [
  'video/mp4;codecs=avc1.640028',
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4;codecs=avc1',
  'video/webm;codecs=vp9',
  'video/webm',
  'video/mp4',
].find((type) => typeof MediaRecorder === 'function' && MediaRecorder.isTypeSupported(type));
const videoExtension = videoType?.startsWith('video/mp4') ? 'mp4' : 'webm';
// The GIF is encoded in JavaScript: it needs only to read the pixels of a canvas.
const canReadPixels = (() => {
  try {
    return !!document.createElement('canvas').getContext('2d')?.getImageData(0, 0, 1, 1);
  } catch {
    return false;
  }
})();
const FILES: Record<FileKind, { extension: string; type: string; noun: string; can: boolean; why: string }> = {
  png: { extension: 'png', type: 'image/png', noun: 'imagen', can: true, why: '' },
  video: {
    extension: videoExtension,
    type: videoType?.split(';')[0] ?? 'video/mp4',
    noun: 'vídeo',
    can: !!videoType && typeof exportCanvas.captureStream === 'function',
    why: 'Este navegador no puede grabar vídeo.',
  },
  gif: { extension: 'gif', type: 'image/gif', noun: 'GIF', can: canReadPixels, why: 'Este navegador no puede crear el GIF.' },
};
const fileInputs = [...exportForm.querySelectorAll<HTMLInputElement>('input[name="file"]')];
for (const input of fileInputs) input.disabled = !FILES[input.value as FileKind].can;
$<HTMLElement>('#export-video-detail').textContent = FILES.video.can
  ? `${videoExtension.toUpperCase()}, ${Math.round(IMAGE_ANIMATION_SECONDS)} s`
  : 'No disponible';
const fileNote = $<HTMLElement>('#export-file-note');
const unsupported = Object.values(FILES).filter((file) => !file.can);
fileNote.hidden = unsupported.length === 0;
fileNote.textContent = unsupported.map((file) => file.why).join(' ');
if (!FILES.video.can) {
  // Without video, the dialog makes images (a GIF is an image too). `data-export-label` has the name without video.
  for (const label of document.querySelectorAll<HTMLElement>('[data-export-label]')) label.textContent = label.dataset.exportLabel!;
}
// The kind of file, the size and the background of the last image are kept in this browser.
// Without storage, the defaults stay. A kind of file that this browser can not make is not restored.
const EXPORT_STORAGE_KEY = 'simulador-imagen';
try {
  const saved = JSON.parse(localStorage.getItem(EXPORT_STORAGE_KEY) ?? '{}') as { file?: string; format?: string; theme?: string };
  for (const [name, value] of Object.entries(saved)) {
    const input = exportForm.querySelector<HTMLInputElement>(`input[name="${CSS.escape(name)}"][value="${CSS.escape(String(value))}"]`);
    if (input && !input.disabled) input.checked = true;
  }
  if (!saved.theme) {
    const pageTheme = document.documentElement.dataset.theme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    exportForm.querySelector<HTMLInputElement>(`input[name="theme"][value="${pageTheme === 'dark' ? 'dark' : 'light'}"]`)!.checked = true;
  }
} catch {
  /* No storage: the defaults stay. */
}

const exportOptions = () => {
  const data = new FormData(exportForm);
  const { candidate } = state();
  return {
    file: (fileInputs.find((input) => input.checked && !input.disabled)?.value ?? 'png') as FileKind,
    content: (data.get('content') === 'vote' && candidate ? 'vote' : 'seats') as ImageContent,
    format: String(data.get('format')) as ImageFormat,
    theme: (data.get('theme') === 'dark' ? 'dark' : 'light') as ImageTheme,
    title: String(data.get('title') ?? ''),
  };
};

const imageInput = (): ImageInput => {
  const { file: _file, ...options } = exportOptions();
  const chamber = cfg();
  const { groups, candidate, votes } = state();
  const isVote = options.content === 'vote';
  return {
    ...options,
    kicker: `${isVote ? chamber.kickerVote : chamber.kickerSeats} · ${election.shortName}`,
    parties: groups.map((group) => ({ acronym: group.acronym, color: group.color, seats: group.seats, vote: voteOf(group.id) })),
    candidate: candidate ? byId(candidate).acronym : undefined,
    result: isVote ? investiture(seatsMap(), candidate, votes, chamber.majority) : undefined,
    verdict: isVote ? (verdictTitle.textContent ?? '') : undefined,
    voteColors: { yes: resolveColor(VOTE_COLORS.yes), no: resolveColor(VOTE_COLORS.no), abstain: resolveColor(VOTE_COLORS.abstain) },
    brand: SITE_NAME,
    address: `${location.host.replace(/^www\./, '')}${location.pathname}`.replace(/\/$/, ''),
    totalSeats: chamber.totalSeats,
    majority: chamber.majority,
    hemicycleRows: chamber.hemicycleRows,
    defaultTitle: chamber.defaultTitles[options.content],
    voteSubjectLabel: chamber.voteSubjectLabel,
  };
};

// The preview is the image itself, at its full size: the download is the canvas that the reader sees.
let drawn: Promise<void> = Promise.resolve();
const renderExport = () => {
  drawn = loadImageFonts().then(() => {
    const input = imageInput();
    drawSimulatorImage(exportCanvas, input);
    const format = IMAGE_FORMATS[input.format];
    const { file } = exportOptions();
    // The GIF is at half size, so that the file stays small.
    exportSize.textContent =
      file === 'gif'
        ? `GIF de ${Math.round(format.width * GIF_SCALE)} × ${Math.round(format.height * GIF_SCALE)} píxeles`
        : `${file === 'video' ? `Vídeo ${videoExtension.toUpperCase()}` : 'Imagen PNG'} de ${format.width} × ${format.height} píxeles`;
    exportCanvas.setAttribute(
      'aria-label',
      input.content === 'vote'
        ? `Vista previa: ${lastShare.text}`
        : `Vista previa: hemiciclo del ${cfg().noun} con ${state().groups.filter((group) => group.seats > 0).map((group) => `${group.acronym} ${group.seats}`).join(', ')}`,
    );
  });
  return drawn;
};

// The default title follows the content and chamber. A title that the reader wrote stays.
const syncDefaultTitle = (content: ImageContent) => {
  const current = titleInput.value.trim();
  if (!current || ALL_DEFAULT_TITLES.has(current)) titleInput.value = cfg().defaultTitles[content];
};

exportForm.addEventListener('input', (event) => {
  const target = event.target as HTMLInputElement;
  if (target.name === 'content') syncDefaultTitle(target.value as ImageContent);
  renderExport();
  if (target.name !== 'file' && target.name !== 'format' && target.name !== 'theme') return;
  const { file, format, theme } = exportOptions();
  try {
    localStorage.setItem(EXPORT_STORAGE_KEY, JSON.stringify({ file, format, theme }));
  } catch {
    /* No storage: the choice is kept only in this visit. */
  }
});
exportForm.addEventListener('submit', (event) => event.preventDefault());

let exportTimer = 0;
const exportSay = (message: string) => {
  exportStatus.textContent = message;
  clearTimeout(exportTimer);
  exportTimer = window.setTimeout(() => (exportStatus.textContent = ''), 4000);
};
const exportBlob = async () => {
  await drawn;
  return new Promise<Blob | null>((resolve) => exportCanvas.toBlob(resolve, 'image/png'));
};
const exportFileName = () => {
  const { content, format, file } = exportOptions();
  const { filePrefix, fileVoteSlug } = cfg();
  return `${filePrefix}-${election.shortName.toLowerCase()}-${content === 'vote' ? fileVoteSlug : 'escanos'}-${format}.${FILES[file].extension}`;
};
const saveFile = (blob: Blob, name: string) => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};
const canShareType = (kind: FileKind) =>
  typeof navigator.canShare === 'function' &&
  navigator.canShare({ files: [new File([new Blob()], `prueba.${FILES[kind].extension}`, { type: FILES[kind].type })] });
const canCopy = typeof ClipboardItem === 'function' && typeof navigator.clipboard?.write === 'function';

// A video or a GIF takes some seconds to make. The page keeps the last one, so the reader can share it
// with a new tap (a share sheet needs a tap of its own). A change of the options makes it old.
let made: { key: string; file: File } | null = null;
const optionsKey = () => JSON.stringify({ chamber: activeChamber, ...exportOptions() });
let busy = false;
let cancelled = false;

// The buttons follow the kind of file.
const renderActions = () => {
  const { file } = exportOptions();
  const fresh = made?.key === optionsKey() ? made.file : null;
  $<HTMLElement>('#export-download-label').textContent =
    file === 'png' ? 'Descargar imagen' : file === 'video' ? `Crear vídeo (${videoExtension.toUpperCase()})` : 'Crear GIF';
  $<HTMLElement>('#export-share-label').textContent = `Compartir ${FILES[file].noun}`;
  exportShare.hidden = !canShareType(file) || (file !== 'png' && !fresh);
  exportCopy.hidden = !(canCopy && file === 'png');
};
const setBusy = (value: boolean) => {
  busy = value;
  const { candidate } = state();
  for (const control of exportDialog.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, .export__actions button')) {
    // A kind of file that the browser can not make, and the vote without a candidate, stay off.
    const off = (control.name === 'file' && !FILES[(control as HTMLInputElement).value as FileKind].can) || (control === voteOption && !candidate);
    control.disabled = value || off;
  }
};
exportForm.addEventListener('input', renderActions);

// Three buttons open the dialog: the one of the hemicycle (on the seats), the one of the result (on the vote)
// and the one of the section «Comparte» (on the last choice).
const openExport = (content?: ImageContent) => {
  const { candidate } = state();
  // Without a candidate/sponsor there is no vote to draw: the image shows the seats.
  voteOption.disabled = !candidate;
  voteNote.hidden = !!candidate;
  const wanted = !candidate ? (voteOption.checked ? 'seats' : undefined) : content;
  if (wanted) {
    (wanted === 'vote' ? voteOption : seatsOption).checked = true;
    syncDefaultTitle(wanted);
  } else {
    syncDefaultTitle(voteOption.checked && candidate ? 'vote' : 'seats');
  }
  exportStatus.textContent = '';
  renderActions();
  exportDialog.showModal();
  renderExport();
};
for (const opener of document.querySelectorAll<HTMLButtonElement>('[data-export-open]')) {
  // «seats» or «vote»; any other value («last») keeps the last choice.
  const content = opener.dataset.exportOpen;
  opener.addEventListener('click', () => openExport(content === 'seats' || content === 'vote' ? content : undefined));
}
exportDialog.querySelector('[data-export-close]')!.addEventListener('click', () => exportDialog.close());
// A click on the backdrop (outside the box) closes it.
exportDialog.addEventListener('click', (event) => {
  if (event.target === exportDialog) exportDialog.close();
});
// Closing the dialog stops a video or a GIF that is in progress, and nothing is saved.
exportDialog.addEventListener('close', () => {
  if (busy) cancelled = true;
});

// The video: the browser records the canvas while it plays the animation, in real time.
const recordVideo = async (input: ImageInput) => {
  // The first frame sets the size of the canvas before the stream starts.
  drawSimulatorImage(exportCanvas, input, 0);
  const stream = exportCanvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: videoType, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size) chunks.push(event.data);
  });
  const stopped = new Promise((resolve) => recorder.addEventListener('stop', resolve));
  recorder.start(250);
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const seconds = (performance.now() - start) / 1000;
      if (cancelled || seconds >= IMAGE_ANIMATION_SECONDS) return resolve();
      drawSimulatorImage(exportCanvas, input, seconds);
      exportStatus.textContent = `Grabando el vídeo: faltan ${Math.ceil(IMAGE_ANIMATION_SECONDS - seconds)} s. Deja esta pestaña abierta.`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  // The last frame is the final image.
  drawSimulatorImage(exportCanvas, input);
  recorder.stop();
  await stopped;
  for (const track of stream.getTracks()) track.stop();
  return chunks.length ? new Blob(chunks, { type: FILES.video.type }) : null;
};

// The GIF: its module loads only now. It draws the frames one by one, so it does not need real time.
const makeGif = async (input: ImageInput) => {
  const { makeSimulatorGif } = await import('@/lib/simulator-gif');
  return makeSimulatorGif(
    exportCanvas,
    input,
    (share) => (exportStatus.textContent = `Creando el GIF: ${Math.round(share * 100)} %.`),
    () => cancelled,
  );
};

$('#export-download').addEventListener('click', async () => {
  const { file } = exportOptions();
  if (file === 'png') {
    const blob = await exportBlob();
    if (!blob) return exportSay('No se pudo crear la imagen.');
    saveFile(blob, exportFileName());
    return exportSay('Imagen descargada.');
  }
  if (busy) return;
  await loadImageFonts();
  // Read the options before the controls turn off: a form does not give the values of controls that are off.
  const key = optionsKey();
  const name = exportFileName();
  const input = imageInput();
  cancelled = false;
  setBusy(true);
  let blob: Blob | null = null;
  try {
    blob = await (file === 'video' ? recordVideo : makeGif)(input);
  } catch (error) {
    console.error(error);
    blob = null;
  }
  setBusy(false);
  renderExport();
  if (cancelled) {
    exportStatus.textContent = '';
    return;
  }
  if (!blob) return exportSay(`No se pudo crear el ${FILES[file].noun}.`);
  made = { key, file: new File([blob], name, { type: FILES[file].type }) };
  saveFile(blob, name);
  renderActions();
  exportSay(`${file === 'video' ? 'Vídeo' : 'GIF'} descargado.${exportShare.hidden ? '' : ' También puedes compartirlo.'}`);
});

// Share the file itself (phones). A video or a GIF is the one that the reader made last.
exportShare.addEventListener('click', async () => {
  const { file } = exportOptions();
  let shared: File | null = null;
  if (file === 'png') {
    const blob = await exportBlob();
    if (blob) shared = new File([blob], exportFileName(), { type: 'image/png' });
  } else if (made?.key === optionsKey()) {
    shared = made.file;
  }
  if (!shared) return exportSay('No se pudo compartir el archivo.');
  try {
    await navigator.share({ files: [shared], title: cfg().shareTitle, text: `${lastShare.text}\n${cfg().shareCta} ${location.href}` });
  } catch {
    /* The reader closed the share sheet. */
  }
});
exportCopy.addEventListener('click', async () => {
  try {
    // Safari needs the item at once, with the promise of the image inside it.
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': exportBlob().then((blob) => blob ?? Promise.reject(new Error('Sin imagen'))) }),
    ]);
    exportSay('Imagen copiada. Pégala en un mensaje o una publicación.');
  } catch {
    exportSay('No se pudo copiar la imagen. Descárgala.');
  }
});

// ---- Chamber switching ----
const applyChamberChrome = () => {
  const chamber = cfg();
  document.title = `${chamber.pageTitle} · ${SITE_NAME}`;
  simTitle.textContent = chamber.heroTitle;
  simLede.textContent = chamber.heroLede;
  for (const button of chamberButtons) button.setAttribute('aria-pressed', String(button.dataset.chamber === activeChamber));

  seatsCaption.textContent = `de ${chamber.totalSeats} escaños`;
  exportOpenSeatsLabel.textContent = chamber.shareSeatsLabel;
  presetNow.textContent = chamber.presetNowLabel;
  presetAutonomous.hidden = !chamber.hasAutonomousPreset;
  preset2023.textContent = chamber.preset2023Label;
  partySeats.max = String(chamber.totalSeats);

  voteHeading.textContent = chamber.voteHeading;
  voteLead.textContent = chamber.voteLead;
  candidateLabel.textContent = chamber.candidateLabel;
  candidateNote.textContent = chamber.candidateNote;
  coalitionsTitle.textContent = `Pactos que suman ${chamber.majority}`;
  boardMajority.textContent = String(chamber.majority);
  markerValue.textContent = String(chamber.majority);
  bar.setAttribute('aria-label', chamber.voteBarLabel);
  exportOpenVoteLabel.textContent = chamber.shareVoteLabel;
  exportVoteLabel.textContent = chamber.voteOptionLabel;
  voteNote.textContent = chamber.voteOptionNote;

  noteCongreso.hidden = activeChamber !== 'congreso';
  noteSenado.hidden = activeChamber !== 'senado';

  syncDefaultTitle(voteOption.checked && state().candidate ? 'vote' : 'seats');
  syncHemicycles();
};

for (const button of chamberButtons) {
  button.addEventListener('click', () => {
    const next = button.dataset.chamber as ChamberId;
    if (next === activeChamber) return;
    activeChamber = next;
    made = null;
    partyDetails.open = false;
    partyError.textContent = '';
    applyChamberChrome();
    renderSort();
    rebuild(state().groups);
    partyColor.value = randomPartyColor();
    renderAll();
  });
}

// ---- Presets and new parties ----
const rebuild = (next: Group[]) => {
  state().groups = next;
  seatRows.clear();
  voteRows.clear();
  seatList.replaceChildren();
  voteList.replaceChildren();
  for (const group of next) createRows(group);
  placeRows();
};

presetNow.addEventListener('click', () => {
  rebuild(baseGroupsFor(activeChamber));
  renderAll();
});
// Senate only: keep the 58 autonomous senators and leave the 208 elected seats of 29N free to distribute.
presetAutonomous.addEventListener('click', () => {
  rebuild(
    baseGroupsFor(activeChamber).map((group) => ({
      ...(group.alt && !group.renamed ? swapName(group) : group),
      seats: group.seatsAutonomous,
    })),
  );
  renderAll();
});
preset2023.addEventListener('click', () => {
  rebuild(baseGroupsFor(activeChamber).map((group) => ({ ...group, seats: group.seats2023 })));
  renderAll();
});
// «Todo a cero» starts the chamber of the new election: a group that changes its name (Sumar → Frente Amplio)
// takes the new name and color. The presets of the old chamber keep the old ones.
$('#preset-zero').addEventListener('click', () => {
  rebuild(
    state().groups.map((group) => ({ ...(group.alt && !group.renamed ? swapName(group) : group), seats: 0 })),
  );
  renderAll();
});
createMissing.addEventListener('click', () => {
  partySeats.value = String(Math.max(0, cfg().totalSeats - total()));
  partyDetails.open = true;
  partyAcronym.focus();
});

partyForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const current = state();
  const data = new FormData(partyForm);
  const acronym = String(data.get('acronym') ?? '').trim().replace(/[~|]/g, '');
  const fail = (message: string) => {
    partyError.textContent = message;
  };
  if (!acronym) return fail('Escribe las siglas del partido.');
  if (current.groups.some((group) => group.acronym.toLowerCase() === acronym.toLowerCase())) return fail('Ya hay un partido con esas siglas.');
  if (current.groups.filter((group) => group.custom).length >= MAX_CUSTOM) return fail(`Puedes crear hasta ${MAX_CUSTOM} partidos.`);
  partyError.textContent = '';

  const group: Group = {
    id: `x${current.nextCustomId++}`,
    acronym: acronym.slice(0, 12),
    name: 'Partido creado por ti',
    color: String(data.get('color') ?? '#7a5af8'),
    seats: clampSeats(Number(data.get('seats'))),
    custom: true,
    seatsNow: 0,
    seats2023: 0,
    seatsAutonomous: 0,
  };
  const position = String(data.get('position'));
  const index = position === 'left' ? 0 : position === 'center' ? Math.floor(current.groups.length / 2) : current.groups.length;
  current.groups.splice(index, 0, group);
  createRows(group);
  placeRows();
  partyForm.reset();
  partyColor.value = randomPartyColor();
  partyDetails.open = false;
  renderAll();
  say(`Partido ${group.acronym} creado.`);
});
partyDetails.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !partyDetails.open) return;
  partyDetails.open = false;
  partyDetails.querySelector('summary')!.focus();
});
partyForm.addEventListener('input', () => {
  partyError.textContent = '';
});

select.addEventListener('change', () => {
  state().candidate = select.value;
  renderAll();
});

const renderAll = () => {
  ensureCandidate();
  exportOpenVote.hidden = !state().candidate;
  renderSeats();
  renderSelect();
  renderVoteRows();
  renderResult();
  writeUrl();
};

// The link can pick the chamber, add parties and change the order: read it first, then build the rows from the final list.
readUrl();
applyChamberChrome();
renderSort();
rebuild(state().groups);
partyColor.value = randomPartyColor();
renderAll();
