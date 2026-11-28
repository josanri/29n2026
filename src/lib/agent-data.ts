/**
 * The data that the AI agents of the browser read through the WebMCP tools (`src/lib/webmcp/`).
 * Two static files, built with the site:
 * - `/agentes/partidos.json`: every party, the categories and the topics that divide, with the stance of each party;
 * - `/agentes/<partido>.json`: one program, with the full text, the page and the link of each measure.
 * The keys are in Spanish, like the other public data of the site, because the agent passes them on to the reader.
 * The counts use `announcedMeasures` (without the numbers that a program reserves), like the rest of the site.
 */
import { election } from '@eleccion/eleccion';
import { keyFindingsByParty } from '@eleccion/analysis';
import { calendarEvents, ELECTION_DATE } from '@eleccion/calendario';
import { FRENTE_AMPLIO_FROM, pollParties, polls, pollsters } from '@eleccion/encuestas';
import { stances } from '@eleccion/posturas';
import { activeTopics } from '@/data/temas';
import { countBy } from './collections';
import type { Debate } from './debate';
import { compareText } from './format';
import { latestPollAverages, POLL_BAN_DATE, pollTime } from './polls';
import { announcedMeasures, getProgram, programs, publishedPrograms, type Measure, type Program } from './programs';
import { presenceOf, provinces } from './presence';
import { pollIds, routes } from './routes';
import { categories, categoryById, leverById, targetGroupById } from './taxonomy';

/** An absolute URL, so the agent can give it to the reader as it is. */
const absolute = (path: string, site: URL | undefined) => (site ? new URL(path, site).href : path);

/** The link to a page of the PDF, when the program is a PDF and the measure has a page. */
const pdfPage = (program: Program, page: number | undefined, site: URL | undefined) =>
  program.documentType === 'pdf' && page ? `${absolute(program.documentUrl, site)}#page=${page}` : undefined;

/** The communities where a regional party runs. A national party runs in all of them: the list stays empty. */
const regionsOf = (program: Program) => (presenceOf(program).scope === 'national' ? [] : presenceOf(program).regions);

const SIDE_ORDER = ['a', 'matiz', 'b'];

const scopeName = (program: Program) => (presenceOf(program).scope === 'national' ? 'estatal' : 'autonómico');

const ALL_PROVINCES_COUNT = provinces.length;
const chamberPresence = (codes: string[]): 'todas' | string[] => (codes.length === ALL_PROVINCES_COUNT ? 'todas' : codes);

export function partiesData(site: URL | undefined) {
  return {
    eleccion: { nombre: election.name, fecha: election.date, nombreCorto: election.shortName },
    aviso:
      'El texto de cada medida es el del programa oficial. Las categorías, los colectivos, las palancas, las claves y las posturas son una clasificación editorial de Electosfera. La presencia por provincia procede de las candidaturas proclamadas en el BOE.',
    provincias: provinces.map((province) => ({
      codigo: province.code,
      nombre: province.name,
      comunidad: province.region,
    })),
    partidos: programs.map((program) => {
      const presence = presenceOf(program);
      return {
        id: program.id,
        siglas: program.acronym,
        nombre: program.partyName,
        ambito: scopeName(program),
        comunidades: regionsOf(program),
        congreso: chamberPresence(presence.congress),
        senado: chamberPresence(presence.senate),
        tienePrograma: program.hasProgram,
        programa: program.hasProgram ? program.programName : null,
        medidas: announcedMeasures(program).length,
        unidad: program.measureUnitPlural,
        url: absolute(routes.party(program.id), site),
      };
    }),
    categorias: categories.map((category) => ({ id: category.id, nombre: category.name })),
    temas: activeTopics.map((topic) => {
      const topicStances = stances.filter((stance) => stance.topic === topic.id);
      const withStance = new Set(topicStances.map((stance) => stance.party));
      return {
        id: topic.id,
        titulo: topic.title,
        pregunta: topic.question,
        a: { etiqueta: topic.a.label, texto: topic.a.text },
        b: { etiqueta: topic.b.label, texto: topic.b.text },
        // The side of a party is decided by the text of A and B, which can be wider than the question
        // (B of «Servicio militar» is «alguna forma de servicio militar», also a voluntary one).
        comoLeer:
          'El lado de cada partido se decide por el texto de la postura A o B, que puede ser más amplio que la pregunta. «matiz»: el programa trata el tema sin tomar del todo una de las dos posturas. La nota resume la postura; las medidas son la prueba.',
        // The same stances as «Temas que dividen» (`/tests/temas/`), grouped by side (A, with nuances, B) and then
        // by acronym: the order of the file is not a ranking, and it must not look like one.
        posturas: topicStances
          .map((stance) => {
            const program = getProgram(stance.party);
            return {
              partido: stance.party,
              siglas: program.acronym,
              // `matiz`: the program deals with the topic without taking either side fully.
              lado: stance.side,
              postura: stance.side === 'matiz' ? 'Con matices' : topic[stance.side].label,
              // Written by the editors with the words of the program; the measures are the proof.
              nota: stance.note,
              medidas: stance.measures.map((number) => ({
                n: number,
                titulo: program.measures.find((measure) => measure.number === number)?.phraseTitle ?? '',
                url: absolute(routes.measure(stance.party, number), site),
              })),
            };
          })
          .sort((x, y) => SIDE_ORDER.indexOf(x.lado) - SIDE_ORDER.indexOf(y.lado) || compareText(x.siglas, y.siglas)),
        // A party with a program and no stance: its program says nothing that takes a side on this topic.
        // A party without a program has no stance anywhere: it is not in this list.
        sinPostura: publishedPrograms
          .filter((program) => !withStance.has(program.id))
          .map((program) => program.acronym)
          .sort(compareText),
      };
    }),
  };
}

const measureData = (program: Program, measure: Measure, site: URL | undefined) => {
  const section = program.sections.find((candidate) => candidate.id === measure.sectionId);
  return {
    n: measure.number,
    titulo: measure.title,
    texto: measure.text,
    bloque: measure.blockId,
    seccion: section?.title ?? null,
    categoria: categoryById[measure.categoryId]?.name ?? measure.categoryId,
    colectivos: measure.targetGroupIds.map((id) => targetGroupById[id]?.name ?? id),
    palancas: measure.leverIds.map((id) => leverById[id]?.name ?? id),
    territorios: measure.territories,
    cifras: measure.figures,
    plazo: measure.deadline,
    deroga: measure.repeals,
    pagina: measure.page ?? null,
    url: absolute(routes.measure(program.id, measure.number), site),
    pdf: pdfPage(program, measure.page, site) ?? measure.sourceUrl ?? null,
  };
};

export function programData(program: Program, site: URL | undefined) {
  const measures = announcedMeasures(program);
  return {
    id: program.id,
    siglas: program.acronym,
    nombre: program.partyName,
    programa: program.programName,
    subtitulo: program.subtitle,
    ambito: scopeName(program),
    comunidades: regionsOf(program),
    url: absolute(routes.party(program.id), site),
    documento: absolute(program.documentUrl, site),
    fuenteOficial: program.sourceUrl ?? null,
    fechaDocumento: program.documentDate ?? null,
    paginas: program.pageCount ?? null,
    unidad: program.measureUnitPlural,
    notas: program.notes,
    totalMedidas: measures.length,
    porCategoria: countBy(measures, (measure) => measure.categoryId).map(([id, count]) => ({
      categoria: categoryById[id]?.name ?? id,
      medidas: count,
    })),
    // Editorial findings, when the program has them. They are not opinions: shares, absences, figures.
    claves: (keyFindingsByParty[program.id] ?? []).map((finding) => ({
      titulo: finding.title,
      texto: finding.text,
      medidas: finding.measureNumbers,
    })),
    cifras: program.figures.map((figure) => ({
      valor: figure.value,
      unidad: figure.unit,
      texto: figure.text,
      medida: figure.measureNumber,
    })),
    plazos: program.deadlines.map((entry) => ({ plazo: entry.deadline, texto: entry.text, medida: entry.measureNumber })),
    derogaciones: measures
      .filter((measure) => measure.repeals)
      .map((measure) => ({ ley: measure.repeals, medida: measure.number })),
    bloques: program.blocks.map((block) => ({
      id: block.id,
      titulo: block.title,
      medidas: measures.filter((measure) => measure.blockId === block.id).length,
      url: absolute(routes.block(program.id, block.id), site),
    })),
    medidas: measures.map((measure) => measureData(program, measure, site)),
  };
}

/** `/agentes/encuestas.json`: 21-day rolling averages and individual polls (newest first). */
export function pollsData(site: URL | undefined) {
  const anchors = pollIds(polls);
  const pollsterById = Object.fromEntries(pollsters.map((pollster) => [pollster.id, pollster]));
  const newestFirst = [...polls].sort((a, b) => pollTime(b.date) - pollTime(a.date));

  return {
    mediaActual: latestPollAverages(),
    frenteAmplioDesde: FRENTE_AMPLIO_FROM,
    partidos: pollParties.map((party) => ({
      id: party.id,
      siglas: party.acronym,
      nombreCorto: party.short ?? null,
    })),
    encuestadoras: pollsters.map((pollster) => ({
      id: pollster.id,
      nombre: pollster.name,
      medio: pollster.media,
      url: pollster.url,
    })),
    encuestas: newestFirst.map((poll) => {
      const id = anchors.get(poll)!;
      const pollster = pollsterById[poll.pollster];
      const voto = Object.fromEntries(Object.entries(poll.values).filter(([, value]) => value !== undefined));
      const escanos = poll.seats
        ? Object.fromEntries(Object.entries(poll.seats).filter(([, value]) => value !== undefined))
        : null;
      return {
        id,
        encuestadora: poll.pollster,
        nombreEncuestadora: pollster?.name ?? poll.pollster,
        medio: pollster?.media ?? null,
        fecha: poll.date,
        muestra: poll.sample ?? null,
        verificadaEnFuente: poll.checked,
        urlFuente: poll.url,
        url: absolute(routes.poll(id), site),
        voto,
        escanos,
      };
    }),
    vedaDesde: POLL_BAN_DATE,
    url: absolute(routes.polls(), site),
    aviso:
      'La media usa la última encuesta de cada encuestadora en los 21 días previos. Las encuestas con verificadaEnFuente: false proceden de agregadores (Mapa Electoral). Del 24 al 28 de noviembre rige la prohibición legal de publicar encuestas (LOREG, art. 69.8). Sumar pasó a llamarse Frente Amplio el 16 de octubre de 2026: las medias no mezclan ambas marcas.',
  };
}

const isModerator = (role: string) => role.toLowerCase().startsWith('moderad');

function debateSummary(debate: Debate, site: URL | undefined) {
  const activeSpeakers = debate.speakers.filter((speaker) => speaker.words > 0);
  const candidateInterruptions = debate.interruptions.filter((item) => item.kind === 'interrupcion').length;
  const moderationCuts = debate.interruptions.filter((item) => item.kind === 'moderacion').length;
  return {
    slug: debate.slug,
    titulo: debate.title,
    fecha: debate.date ?? null,
    cadena: debate.channel ?? null,
    duracionSegundos: debate.durationSeconds,
    url: absolute(routes.debate(debate.slug), site),
    videoUrl: debate.url ?? null,
    ponentes: activeSpeakers.map((speaker) => ({
      id: speaker.id,
      nombre: speaker.name,
      rol: speaker.role,
      partido: speaker.partyId,
      esModeracion: isModerator(speaker.role),
      minutos: speaker.minutes,
      palabras: speaker.words,
      turnos: speaker.turns,
      interrupcionesHechas: speaker.cutsMade,
      interrupcionesRecibidas: speaker.cutsReceived,
      cortesModeracion: speaker.moderationsMade + speaker.moderationsReceived,
    })),
    temas: debate.topics.map((topic) => ({
      id: topic.id,
      etiqueta: topic.label,
      menciones: topic.total,
      interrupciones: topic.interruptions,
    })),
    minutoDeOro: (debate.golden ?? []).map((item) => ({
      ponente: item.speaker,
      inicio: item.start,
      fin: item.end,
    })),
    totalIntervenciones: debate.interventions.length,
    interrupcionesCandidatos: candidateInterruptions,
    cortesModeracion: moderationCuts,
  };
}

/** `/agentes/debates.json`: summary and statistics of every published debate. */
export function debatesIndexData(list: readonly Debate[], site: URL | undefined) {
  return {
    total: list.length,
    debates: list.map((debate) => debateSummary(debate, site)),
    url: absolute(routes.debate(), site),
    aviso:
      'Las transcripciones proceden de la emisión del debate; las afirmaciones son de los ponentes, no de Electosfera. Las interrupciones entre candidatos se cuentan aparte de los cortes de moderación.',
  };
}

/** `/agentes/debates/<slug>.json`: summary plus timestamped interventions of one debate. */
export function debateDetailData(debate: Debate, site: URL | undefined) {
  const speakerById = Object.fromEntries(debate.speakers.map((speaker) => [speaker.id, speaker]));
  const golden = debate.golden ?? [];
  const isGolden = (speakerId: string, start: number, end: number) =>
    golden.some((span) => span.speaker === speakerId && start < span.end && end > span.start);

  return {
    ...debateSummary(debate, site),
    intervenciones: debate.interventions.map((item, index) => {
      const speaker = speakerById[item.speaker];
      return {
        indice: index,
        ponente: item.speaker,
        nombre: speaker?.name ?? item.speaker,
        partido: speaker?.partyId ?? null,
        inicio: item.start,
        fin: item.end,
        temas: item.topics,
        esInterrupcion: item.cut && item.kind !== 'moderacion',
        esCorteModeracion: item.cut && item.kind === 'moderacion',
        esMinutoDeOro: isGolden(item.speaker, item.start, item.end),
        texto: item.paragraphs.join('\n\n'),
      };
    }),
    aviso:
      'Las transcripciones proceden de la emisión del debate; las afirmaciones son de los ponentes, no de Electosfera.',
  };
}

/** `/agentes/calendario.json`: key election dates and legal deadlines. */
export function calendarData(site: URL | undefined) {
  return {
    eleccion: election.name,
    fechaVotacion: ELECTION_DATE,
    urlCalendario: absolute(routes.calendar(), site),
    urlIcs: absolute(routes.calendarIcs(), site),
    total: calendarEvents.length,
    eventos: calendarEvents.map((event) => ({
      id: event.id,
      fecha: event.date,
      fechaFin: event.endDate ?? null,
      horario: event.time ? `${event.time.from}–${event.time.to}` : null,
      horarioDelDia: event.schedule?.map((item) => ({ hora: item.time, titulo: item.label, url: item.url ?? null })) ?? null,
      titulo: event.title,
      descripcion: event.description,
      origen: event.source === 'official' ? 'oficial' : 'derivado',
      baseLegal: event.basis ?? null,
      documento: event.documentPath ? absolute(routes.asset(event.documentPath), site) : null,
      urlOficial: event.officialUrl ?? null,
      urlIcs: absolute(routes.calendarIcs(event.id), site),
    })),
    aviso:
      'Las fechas con origen «derivado» se calculan según la LOREG y la Constitución; conviene confirmarlas en el BOE. Las horas son hora peninsular española (CET).',
  };
}
