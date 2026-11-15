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
import { stances } from '@eleccion/posturas';
import { activeTopics } from '@/data/temas';
import { countBy } from './collections';
import { announcedMeasures, getProgram, programs, type Measure, type Program } from './programs';
import { presenceOf } from './presence';
import { routes } from './routes';
import { categories, categoryById, leverById, targetGroupById } from './taxonomy';

/** An absolute URL, so the agent can give it to the reader as it is. */
const absolute = (path: string, site: URL | undefined) => (site ? new URL(path, site).href : path);

/** The link to a page of the PDF, when the program is a PDF and the measure has a page. */
const pdfPage = (program: Program, page: number | undefined, site: URL | undefined) =>
  program.documentType === 'pdf' && page ? `${absolute(program.documentUrl, site)}#page=${page}` : undefined;

/** The communities where a regional party runs. A national party runs in all of them: the list stays empty. */
const regionsOf = (program: Program) => (presenceOf(program).scope === 'national' ? [] : presenceOf(program).regions);

const scopeName = (program: Program) => (presenceOf(program).scope === 'national' ? 'estatal' : 'autonómico');

export function partiesData(site: URL | undefined) {
  return {
    eleccion: { nombre: election.name, fecha: election.date, nombreCorto: election.shortName },
    aviso:
      'El texto de cada medida es el del programa oficial. Las categorías, los colectivos, las palancas, las claves y las posturas son una clasificación editorial de Electosfera.',
    partidos: programs.map((program) => ({
      id: program.id,
      siglas: program.acronym,
      nombre: program.partyName,
      ambito: scopeName(program),
      comunidades: regionsOf(program),
      tienePrograma: program.hasProgram,
      programa: program.hasProgram ? program.programName : null,
      medidas: announcedMeasures(program).length,
      unidad: program.measureUnitPlural,
      url: absolute(routes.party(program.id), site),
    })),
    categorias: categories.map((category) => ({ id: category.id, nombre: category.name })),
    temas: activeTopics.map((topic) => ({
      id: topic.id,
      titulo: topic.title,
      pregunta: topic.question,
      a: { etiqueta: topic.a.label, texto: topic.a.text },
      b: { etiqueta: topic.b.label, texto: topic.b.text },
      posturas: stances
        .filter((stance) => stance.topic === topic.id)
        .map((stance) => ({
          partido: stance.party,
          siglas: getProgram(stance.party).acronym,
          // `matiz`: the program deals with the topic without taking either side fully.
          lado: stance.side,
          postura: stance.side === 'matiz' ? 'Con matices' : topic[stance.side].label,
          nota: stance.note,
          medidas: stance.measures.map((number) => ({
            n: number,
            url: absolute(routes.measure(stance.party, number), site),
          })),
        })),
    })),
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
