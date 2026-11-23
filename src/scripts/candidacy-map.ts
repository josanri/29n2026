/** Client code of the candidacies map (src/components/candidacies/CandidacyMap.astro): the province, the chamber and the lists. */
import { routes } from '@/lib/routes';
import { setupProvinceMap } from '@/lib/province-map';
import { normalizeForSearch } from '@/lib/format';
import { tooltip } from '@/lib/tooltip';

// Shapes of `candidaturas.json`. Its keys are Spanish because a Python script writes the file.
type Chamber = 'Congreso' | 'Senado';
type RawPerson = { numero: number; nombre: string; suplentes?: RawPerson[] };
type RawCandidacy = {
  camara: Chamber;
  circunscripcion: string;
  orden: number;
  partido: string;
  titulares: RawPerson[];
  suplentes: RawPerson[];
};
type RawProvince = { codigo: string; nombre: string; candidaturas: RawCandidacy[] };
type RawData = { provincias: RawProvince[] };
type PartyMeta = { acronym: string; name: string; color: string; href: string; hasProgram: boolean };
type PartiesData = { meta: Record<string, PartyMeta>; byProvince: Record<string, string[]> };

const provinceSelect = document.querySelector<HTMLSelectElement>('#province-select')!;
const emptyBox = document.querySelector<HTMLElement>('#candidacies-empty')!;
const content = document.querySelector<HTMLElement>('#candidacies-content')!;
const map = document.querySelector<SVGSVGElement>('.candidacies .province-map')!;
const summary = document.querySelector<HTMLElement>('#candidacies-summary')!;
const partiesNav = document.querySelector<HTMLElement>('#candidacies-parties')!;
const partiesData: PartiesData = JSON.parse(partiesNav.dataset.parties ?? '{"meta":{},"byProvince":{}}');
const provinceName = document.querySelector<HTMLElement>('#candidacies-name')!;
const list = document.querySelector<HTMLElement>('#candidacies-list')!;
const chamberButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-chamber]')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const ANIMATION_MS = 260;

const compactText = (text: string) => normalizeForSearch(text).replace(/[^a-z0-9]+/g, '');
const cleanWords = (text: string) => normalizeForSearch(text).replace(/[^a-z0-9]+/g, ' ').trim();

// Match one candidacy name against the parties known to run in the same province.
const matchPartyInProvince = (candidacyName: string, provinceCode: string): PartyMeta | undefined => {
  const ids = partiesData.byProvince[provinceCode] ?? [];
  const candidates = ids.map((id) => ({ id, ...partiesData.meta[id] }));
  const words = cleanWords(candidacyName);
  const compact = compactText(candidacyName);
  const padded = ` ${words} `;
  // Coalition disambiguators first, so a coalition does not match a single member.
  const coalitions: [RegExp, string][] = [
    [/(eh bildu|euskal herria bildu).*(erc|esquerra)|(erc|esquerra).*(eh bildu|euskal herria bildu)/, 'eh-bildu-erc'],
    [/senado de progreso|\bsdp\b/, 'sdp'],
  ];
  for (const [pattern, id] of coalitions) {
    if (pattern.test(words) && ids.includes(id)) return partiesData.meta[id];
  }
  // Pass 1: full party name, longest first.
  for (const party of [...candidates].sort((a, b) => b.name.length - a.name.length)) {
    const nameWords = cleanWords(party.name);
    if (nameWords && words.includes(nameWords)) return party;
  }
  // Pass 2: acronym match, longest first.
  for (const party of [...candidates].sort((a, b) => b.acronym.length - a.acronym.length)) {
    const acronymWords = cleanWords(party.acronym);
    if (acronymWords && (words === acronymWords || padded.includes(` ${acronymWords} `))) return party;
    const acronymCompact = compactText(party.acronym);
    if (acronymCompact.length >= 3 && compact.includes(acronymCompact)) return party;
  }
  // Pass 3: regional spelling variants (e.g. «Front Ampli», «Escaños en Branco», «ELAK»).
  const aliases: [RegExp, string][] = [
    [/escanos en (blanco|branco)/, 'escanos-en-blanco'],
    [/elak/, 'elak-pcte'],
    [/frente ampli|front ampli|fronte ampla/, 'fa'],
    [/coalicion canaria/, 'cc'],
    [/mundo.*(justo|xusto)/, 'mundo-mas-justo'],
  ];
  for (const [pattern, id] of aliases) {
    if (pattern.test(words) && ids.includes(id)) return partiesData.meta[id];
  }
  return undefined;
};

const renderProvinceParties = (provinceCode: string) => {
  const ids = partiesData.byProvince[provinceCode] ?? [];
  partiesNav.replaceChildren();
  partiesNav.hidden = ids.length === 0;
  for (const id of ids) {
    const party = partiesData.meta[id];
    if (!party) continue;
    const link = document.createElement('a');
    link.className = party.hasProgram ? 'candidacies__party' : 'candidacies__party candidacies__party--empty';
    link.href = party.href;
    link.dataset.tooltip = tooltip(party.name, party.hasProgram ? 'Ver programa' : 'Sin programa publicado · Ver ficha');
    const swatch = document.createElement('span');
    swatch.className = 'candidacies__party-swatch';
    swatch.style.background = party.color;
    swatch.setAttribute('aria-hidden', 'true');
    link.append(swatch, document.createTextNode(party.acronym));
    partiesNav.append(link);
  }
};

let data: RawData | undefined;
let activeChamber: Chamber = 'Congreso';
type SortOrder = 'original' | 'asc' | 'desc';
let activeSort: SortOrder = 'original';
const sortButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-sort]')];
const collator = new Intl.Collator('es', { sensitivity: 'base', ignorePunctuation: true });
const sortCandidacies = (items: RawCandidacy[]) => {
  const sorted = [...items];
  if (activeSort === 'original') return sorted.sort((a, b) => a.orden - b.orden);
  sorted.sort((a, b) => collator.compare(a.partido, b.partido));
  return activeSort === 'desc' ? sorted.reverse() : sorted;
};
let renderId = 0;

const loadData = async () => {
  if (data) return data;
  const response = await fetch(routes.asset('/datos-electorales/candidaturas.json'));
  if (!response.ok) throw new Error(`No se pudieron cargar las candidaturas (${response.status}).`);
  data = (await response.json()) as RawData;
  return data;
};

const createPeopleList = (people: RawPerson[]) => {
  const ol = document.createElement('ol');
  for (const person of people) {
    const li = document.createElement('li');
    li.value = person.numero;
    li.append(document.createTextNode(person.nombre));
    ol.append(li);
  }
  return ol;
};

const animations = new WeakMap<HTMLElement, Animation>();

// Open or close a disclosure by animating the height of its body. If the reader clicks
// during the animation, the new animation starts from the height it had reached.
const toggleDisclosure = (disclosure: HTMLDetailsElement, body: HTMLElement) => {
  const willOpen = !disclosure.open || disclosure.classList.contains('is-closing');
  const startHeight = disclosure.open ? body.getBoundingClientRect().height : 0;
  animations.get(body)?.cancel();
  if (reducedMotion.matches) {
    disclosure.classList.remove('is-closing');
    disclosure.open = willOpen;
    return;
  }
  disclosure.classList.toggle('is-closing', !willOpen);
  disclosure.open = true;
  body.style.overflow = 'hidden';
  const animation = body.animate(
    [
      { height: `${startHeight}px`, opacity: startHeight ? 1 : 0 },
      { height: `${willOpen ? body.scrollHeight : 0}px`, opacity: willOpen ? 1 : 0 },
    ],
    { duration: ANIMATION_MS, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
  );
  animations.set(body, animation);
  animation.onfinish = () => {
    animations.delete(body);
    body.style.overflow = '';
    if (!willOpen) {
      disclosure.open = false;
      disclosure.classList.remove('is-closing');
    }
  };
};

const createDisclosure = (className: string, label: string, content: Node[]) => {
  const disclosure = document.createElement('details');
  disclosure.className = `disclosure ${className}`;
  const summaryElement = document.createElement('summary');
  const text = document.createElement('span');
  text.className = 'disclosure__text';
  text.textContent = label;
  const icon = document.createElement('span');
  icon.className = 'disclosure__icon';
  icon.setAttribute('aria-hidden', 'true');
  summaryElement.append(text, icon);
  const body = document.createElement('div');
  body.className = 'disclosure__body';
  body.append(...content);
  disclosure.append(summaryElement, body);
  summaryElement.addEventListener('click', (event) => {
    event.preventDefault();
    toggleDisclosure(disclosure, body);
  });
  return disclosure;
};

const countPeople = (candidacies: RawCandidacy[]) =>
  candidacies.reduce(
    (total, candidacy) =>
      total +
      candidacy.titulares.length +
      candidacy.suplentes.length +
      candidacy.titulares.reduce((sum, holder) => sum + (holder.suplentes?.length ?? 0), 0),
    0,
  );

let disclosureSeq = 0;

// Toggle a button-controlled disclosure (used for candidacies so a sibling link stays valid HTML).
const togglePanelDisclosure = (container: HTMLElement, trigger: HTMLButtonElement, body: HTMLElement) => {
  const isOpen = container.hasAttribute('data-open') && !container.classList.contains('is-closing');
  const willOpen = !isOpen;
  const startHeight = !body.hidden ? body.getBoundingClientRect().height : 0;
  animations.get(body)?.cancel();
  trigger.setAttribute('aria-expanded', String(willOpen));
  if (reducedMotion.matches) {
    container.classList.remove('is-closing');
    container.toggleAttribute('data-open', willOpen);
    body.hidden = !willOpen;
    return;
  }
  container.classList.toggle('is-closing', !willOpen);
  container.toggleAttribute('data-open', true);
  body.hidden = false;
  body.style.overflow = 'hidden';
  const animation = body.animate(
    [
      { height: `${startHeight}px`, opacity: startHeight ? 1 : 0 },
      { height: `${willOpen ? body.scrollHeight : 0}px`, opacity: willOpen ? 1 : 0 },
    ],
    { duration: ANIMATION_MS, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
  );
  animations.set(body, animation);
  animation.onfinish = () => {
    animations.delete(body);
    body.style.overflow = '';
    if (!willOpen) {
      body.hidden = true;
      container.removeAttribute('data-open');
      container.classList.remove('is-closing');
    }
  };
};

const renderCandidacy = (candidacy: RawCandidacy, provinceCode: string) => {
  const content: Node[] = [];
  if (candidacy.titulares.length) {
    content.push(createPeopleList(candidacy.titulares));
  } else {
    const empty = document.createElement('p');
    empty.className = 'candidacy__empty';
    empty.textContent = 'La proclamación no incluye personas candidatas nominales en esta lista.';
    content.push(empty);
  }

  if (activeChamber === 'Congreso' && candidacy.suplentes.length) {
    content.push(
      createDisclosure('candidacy__substitutes', `Suplentes (${candidacy.suplentes.length})`, [
        createPeopleList(candidacy.suplentes),
      ]),
    );
  }

  if (activeChamber === 'Senado') {
    for (const holder of candidacy.titulares) {
      if (!holder.suplentes?.length) continue;
      content.push(
        createDisclosure('candidacy__substitutes', `Suplentes de ${holder.nombre}`, [
          createPeopleList(holder.suplentes),
        ]),
      );
    }
  }

  const container = document.createElement('div');
  container.className = 'disclosure candidacy';
  const bar = document.createElement('div');
  bar.className = 'candidacy__bar';
  const bodyId = `candidacy-body-${++disclosureSeq}`;
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'candidacy__trigger';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', bodyId);
  const icon = document.createElement('span');
  icon.className = 'disclosure__icon';
  icon.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  text.className = 'disclosure__text';
  text.textContent = `${candidacy.orden}. ${candidacy.partido}`;
  trigger.append(icon, text);
  bar.append(trigger);

  const matchedParty = matchPartyInProvince(candidacy.partido, provinceCode);
  if (matchedParty) {
    const link = document.createElement('a');
    link.className = matchedParty.hasProgram ? 'candidacy__go' : 'candidacy__go candidacy__go--empty';
    link.href = matchedParty.href;
    link.dataset.tooltip = tooltip(
      matchedParty.name,
      matchedParty.hasProgram ? 'Ver programa' : 'Sin programa publicado · Ver ficha',
    );
    const swatch = document.createElement('span');
    swatch.className = 'candidacies__party-swatch';
    swatch.style.background = matchedParty.color;
    swatch.setAttribute('aria-hidden', 'true');
    link.append(swatch, document.createTextNode(matchedParty.hasProgram ? 'Programa' : 'Ficha'));
    bar.append(link);
  }

  const body = document.createElement('div');
  body.className = 'disclosure__body';
  body.id = bodyId;
  body.hidden = true;
  body.append(...content);
  trigger.addEventListener('click', () => togglePanelDisclosure(container, trigger, body));
  container.append(bar, body);
  return container;
};

const toggleButton = document.querySelector<HTMLButtonElement>('#candidacies-toggle')!;

const render = async () => {
  const currentRender = ++renderId;
  list.replaceChildren();
  // With no province the guide shows; with one, the summary and the lists.
  emptyBox.hidden = Boolean(provinceSelect.value);
  content.hidden = !provinceSelect.value;
  // No province chosen: there is nothing to list yet.
  // On a wide screen the lists are always open, so the button has no use there.
  toggleButton.hidden = !provinceSelect.value || isWideScreen.matches;
  if (!provinceSelect.value) {
    setExpanded(false);
    partiesNav.replaceChildren();
    partiesNav.hidden = true;
    provinceName.textContent = '';
    summary.textContent = 'Elige una provincia en el mapa o en la lista.';
    return;
  }
  renderProvinceParties(provinceSelect.value);
  if (isWideScreen.matches) setExpanded(true);
  provinceName.textContent = provinceSelect.selectedOptions[0]?.textContent ?? '';
  summary.textContent = 'Cargando candidaturas…';
  try {
    const loaded = await loadData();
    if (currentRender !== renderId) return;
    const province = loaded.provincias.find((item) => item.codigo === provinceSelect.value);
    if (!province) throw new Error('No hay datos de candidaturas para la provincia seleccionada.');
    const candidacies = province.candidaturas.filter((item) => item.camara === activeChamber);
    provinceName.textContent = province.nombre;
    const countOf = (chamber: Chamber) => province.candidaturas.filter((item) => item.camara === chamber).length;
    summary.textContent = `${countOf('Congreso')} candidaturas al Congreso y ${countOf('Senado')} al Senado. En el ${activeChamber}, ${countPeople(candidacies)} personas.`;

    const byConstituency = new Map<string, RawCandidacy[]>();
    for (const candidacy of candidacies) {
      const group = byConstituency.get(candidacy.circunscripcion) ?? [];
      group.push(candidacy);
      byConstituency.set(candidacy.circunscripcion, group);
    }

    for (const [constituency, group] of byConstituency) {
      const section = document.createElement('section');
      section.className = 'candidacies__group';
      const heading = document.createElement('h3');
      heading.textContent = constituency;
      section.append(heading, ...sortCandidacies(group).map((item) => renderCandidacy(item, province.codigo)));
      list.append(section);
    }

    // The new list starts at the top and fades in again for each province.
    list.scrollTop = 0;
    list.classList.remove('is-entering');
    void list.offsetWidth;
    list.classList.add('is-entering');

    if (!candidacies.length) {
      summary.textContent = `No hay candidaturas al ${activeChamber} en esta provincia.`;
    }
  } catch (error) {
    if (currentRender !== renderId) return;
    summary.textContent = error instanceof Error ? error.message : 'Error al cargar las candidaturas.';
  }
};

const provinceMap = setupProvinceMap(map, (code) => selectProvince(code));

// The same width where the page changes to one column (see the style at the end).
const isWideScreen = matchMedia('(min-width: 821px)');

// The filter of programs (home page) shares the province with this map, in both directions.
// The event carries the code; `fromUser` is false for the calls that only follow the other side.
const PROVINCE_EVENT = 'province:select';
const selectProvince = (code: string, fromUser = true) => {
  if (provinceSelect.value !== code) provinceSelect.value = code;
  provinceMap.select(code);
  render();
  if (fromUser) document.dispatchEvent(new CustomEvent(PROVINCE_EVENT, { detail: { code, source: 'map' } }));
};
document.addEventListener(PROVINCE_EVENT, (event) => {
  const { code, source } = (event as CustomEvent<{ code: string; source: string }>).detail;
  if (source === 'map' || provinceSelect.value === code) return;
  if (code && ![...provinceSelect.options].some((option) => option.value === code)) return;
  selectProvince(code, false);
});
// If the window changes size, the button and the lists follow the new width.
isWideScreen.addEventListener('change', () => render());

provinceSelect.addEventListener('change', () => selectProvince(provinceSelect.value));
document.querySelector('#candidacies-clear')!.addEventListener('click', () => {
  selectProvince('');
  provinceSelect.focus();
});
for (const button of chamberButtons) {
  button.addEventListener('click', () => {
    activeChamber = button.dataset.chamber as Chamber;
    for (const other of chamberButtons) other.setAttribute('aria-pressed', String(other === button));
    render();
  });
}
for (const button of sortButtons) {
  button.addEventListener('click', () => {
    activeSort = button.dataset.sort as SortOrder;
    for (const other of sortButtons) other.setAttribute('aria-pressed', String(other === button));
    render();
  });
}
const toggle = toggleButton;
const toggleLabel = document.querySelector<HTMLElement>('#candidacies-toggle-label')!;
const body = document.querySelector<HTMLElement>('#candidacies-body')!;
const setExpanded = (expanded: boolean) => {
  body.hidden = !expanded;
  toggle.setAttribute('aria-expanded', String(expanded));
  toggleLabel.textContent = expanded ? 'Ocultar candidaturas' : 'Ver candidaturas';
};
toggle.addEventListener('click', () => {
  setExpanded(body.hasAttribute('hidden'));
});

// «?provincia=28» (for example from a party map) opens that province, with its lists open.
const requested = new URLSearchParams(location.search).get('provincia');
const isValid = Boolean(requested) && [...provinceSelect.options].some((option) => option.value === requested);
if (isValid) setExpanded(true);
selectProvince(isValid && requested ? requested : '', false);
