/**
 * Schema of one program file in `src/data/<año>/<tipo>/programas/*.json`.
 *
 * The JSON files use Spanish keys because the Python scripts in `scripts/` write them.
 * This schema validates each file at build time and maps the keys to the English
 * domain model. Code outside this file never sees a Spanish key.
 */
import { z } from 'astro/zod';
import { withBase } from '@/lib/routes';

const measureSchema = z
  .object({
    n: z.number(),
    bloque: z.number(),
    seccion: z.string(),
    pagina: z.number().optional(),
    subapartado: z.number().nullable(),
    titulo: z.string(),
    tituloFrase: z.string(),
    texto: z.string(),
    oculta: z.boolean(),
    categoria: z.string(),
    colectivos: z.array(z.string()),
    palancas: z.array(z.string()),
    territorios: z.array(z.string()),
    cifras: z.array(z.string()),
    plazo: z.string().nullable(),
    deroga: z.string().nullable(),
    fuente: z.string().optional(),
  })
  .transform((raw) => ({
    number: raw.n,
    blockId: raw.bloque,
    sectionId: raw.seccion,
    page: raw.pagina,
    subsectionIndex: raw.subapartado,
    title: raw.titulo,
    phraseTitle: raw.tituloFrase,
    text: raw.texto,
    /** `true` when the program reserves the number for a measure it has not announced yet. */
    isPending: raw.oculta,
    categoryId: raw.categoria,
    targetGroupIds: raw.colectivos,
    leverIds: raw.palancas,
    territories: raw.territorios,
    figures: raw.cifras,
    deadline: raw.plazo,
    repeals: raw.deroga,
    sourceUrl: raw.fuente,
  }));

const blockSchema = z
  .object({
    id: z.number(),
    titulo: z.string(),
    lema: z.string(),
    cita: z.string(),
    intro: z.string(),
    pagina: z.number().optional(),
  })
  .transform((raw) => ({
    id: raw.id,
    title: raw.titulo,
    motto: raw.lema,
    quote: raw.cita,
    intro: raw.intro,
    page: raw.pagina,
  }));

const sectionSchema = z
  .object({
    id: z.string(),
    bloque: z.number(),
    titulo: z.string(),
    tituloFrase: z.string(),
    intro: z.string(),
    pagina: z.number().optional(),
    subapartados: z.array(z.object({ titulo: z.string(), intro: z.string() })),
  })
  .transform((raw) => ({
    id: raw.id,
    blockId: raw.bloque,
    title: raw.titulo,
    phraseTitle: raw.tituloFrase,
    intro: raw.intro,
    page: raw.pagina,
    subsections: raw.subapartados.map(({ titulo, intro }) => ({ title: titulo, intro })),
  }));

const keyFigureSchema = z
  .object({
    valor: z.string(),
    unidad: z.string(),
    texto: z.string(),
    contexto: z.string().optional(),
    medida: z.number(),
  })
  .transform((raw) => ({
    value: raw.valor,
    unit: raw.unidad,
    text: raw.texto,
    context: raw.contexto,
    measureNumber: raw.medida,
  }));

const deadlineSchema = z
  .object({ plazo: z.string(), texto: z.string(), medida: z.number() })
  .transform((raw) => ({ deadline: raw.plazo, text: raw.texto, measureNumber: raw.medida }));

export const programSchema = z
  .object({
    id: z.string(),
    partido: z.string(),
    siglas: z.string(),
    comunidad: z.string().optional(),
    observaciones: z.array(z.string()).optional(),
    vacio: z.boolean().optional(),
    coalicion: z.boolean().optional(),
    color: z.string(),
    colorClaro: z.string(),
    programa: z.string(),
    subtitulo: z.string(),
    elecciones: z.string().optional(),
    pdf: z.string(),
    fuentePdf: z.string().optional(),
    paginas: z.number().optional(),
    fechaPdf: z.string().optional(),
    fechaFuente: z.string().optional(),
    tipoDocumento: z.enum(['pdf', 'web']).optional(),
    origenMedidas: z.enum(['pdf', 'web']).optional(),
    unidadMedida: z.string().optional(),
    unidadMedidas: z.string().optional(),
    pdfResumen: z.string().optional(),
    presentacion: z.object({ titulo: z.string(), texto: z.string() }),
    cifras: z.array(keyFigureSchema),
    plazos: z.array(deadlineSchema),
    ordenPlazos: z.array(z.string()),
    verbos: z.array(z.object({ verbo: z.string(), n: z.number() })),
    bloques: z.array(blockSchema),
    secciones: z.array(sectionSchema),
    medidas: z.array(measureSchema),
  })
  .transform((raw) => ({
    id: raw.id,
    partyName: raw.partido,
    acronym: raw.siglas,
    region: raw.comunidad,
    notes: raw.observaciones ?? [],
    /** `false` when the party has not published a program yet. */
    hasProgram: !raw.vacio,
    isCoalition: raw.coalicion ?? false,
    color: raw.color,
    lightColor: raw.colorClaro,
    programName: raw.programa,
    subtitle: raw.subtitulo,
    election: raw.elecciones,
    documentUrl: withBase(raw.pdf),
    sourceUrl: raw.fuentePdf,
    pageCount: raw.paginas,
    documentDate: raw.fechaPdf,
    sourceDate: raw.fechaFuente,
    documentType: raw.tipoDocumento ?? 'pdf',
    measureOrigin: raw.origenMedidas ?? 'pdf',
    measureUnit: raw.unidadMedida ?? 'medida',
    measureUnitPlural: raw.unidadMedidas ?? 'medidas',
    summaryUrl: raw.pdfResumen ? withBase(raw.pdfResumen) : raw.pdfResumen,
    introduction: { title: raw.presentacion.titulo, text: raw.presentacion.texto },
    figures: raw.cifras,
    deadlines: raw.plazos,
    deadlineOrder: raw.ordenPlazos,
    verbs: raw.verbos.map(({ verbo, n }) => ({ verb: verbo, count: n })),
    blocks: raw.bloques,
    sections: raw.secciones,
    measures: raw.medidas,
  }));

export type Program = z.output<typeof programSchema>;
export type Measure = Program['measures'][number];
export type Block = Program['blocks'][number];
export type Section = Program['sections'][number];
export type KeyFigure = Program['figures'][number];
export type DeadlineEntry = Program['deadlines'][number];
