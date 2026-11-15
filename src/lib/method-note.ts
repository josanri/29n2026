import type { Program } from './program-schema';

/** «82 páginas, fecha 2026-11-12», or only the pages when the PDF has no date (some PDFs do not say it). */
const pdfFacts = (program: Program) =>
  program.documentDate ? `${program.pageCount} páginas, fecha ${program.documentDate}` : `${program.pageCount} páginas`;

/** The "Nota de método" paragraph of a party page: how the measures were obtained. */
export function methodNote(program: Program): string {
  if (program.measureOrigin === 'web') {
    // Adelante Andalucía: the official PDF has 29 main measures; the site lists the 719 numbered proposals.
    if (program.id === 'adelante') {
      return `El PDF oficial completo tiene ${program.pageCount} páginas y distingue 29 medidas principales de 637 propuestas por áreas y 82 propuestas territoriales. Este análisis recoge las 719 propuestas numeradas de las fichas oficiales consultadas el ${program.sourceDate}; no cuenta aparte las 29 medidas-resumen. La categoría principal, los colectivos y las palancas son una clasificación editorial.`;
    }
    return `El programa se publica en fichas web oficiales, consultadas el ${program.sourceDate}. Se conservan sus títulos y resúmenes. La categoría principal, los colectivos y las palancas son una clasificación editorial.`;
  }
  // PACMA numbers its sections in up to four levels («1.1.8.1») and has no numbered measures.
  if (program.id === 'pacma') {
    return `El texto se extrae del PDF oficial (${pdfFacts(program)}). El programa numera sus apartados en varios niveles (por ejemplo, 1.1.8.1) y no tiene medidas numeradas: cada apartado de último nivel es aquí una propuesta, con un número correlativo del 1 al ${program.measures.length}, y conserva el título y el texto completos del PDF. La taxonomía común no tiene una categoría de protección animal, así que cada propuesta va a la categoría más cercana (el marco legal a Justicia; la caza, la ganadería y la fauna a Campo, mar y mundo rural; la tauromaquia a Lengua, cultura y memoria). Los colectivos, las palancas y los territorios se detectan con palabras clave. El número de página enlaza con el PDF original.`;
  }
  // Convergents: PowerPoint slides; each «✓» is a proposal, without numbers or titles.
  if (program.id === 'convergents') {
    return `El texto se extrae del PDF oficial, en catalán (${pdfFacts(program)}), exportado desde PowerPoint. El programa tiene diez compromisos, cada uno con unos objetivos, y debajo de cada objetivo unas propuestas marcadas con «✓», sin numerar y sin título: cada «✓» es aquí una propuesta, numerada del 1 al ${program.measures.length} en el orden del documento, y su primera frase hace de título. La categoría principal de cada propuesta es una asignación editorial. Los colectivos, las palancas y los territorios se detectan con palabras clave, por eso son una aproximación. El número de página enlaza con el PDF original.`;
  }
  // FE de las JONS: unnumbered annex, measures without titles, PDF shared with the newsroom.
  if (program.id === 'fe-jons') {
    return `El texto se extrae del PDF que se facilitó a la redacción (${pdfFacts(program)}), que el partido no había publicado en su web al incorporarlo. Cada punto numerado del PDF (1.1, 1.2…) es una medida; los puntos no tienen título, así que el título corto es su primera frase. El Anexo I, el Plan Nacional de Remigración, no está numerado: cada frase de introducción y cada viñeta es aquí una medida, con la fase del plan como plazo. La categoría principal de cada medida es una asignación editorial. Los colectivos, las palancas y los territorios se detectan con palabras clave, por eso son una aproximación. El número de página enlaza con el PDF.`;
  }
  // PCTE: a web program printed to PDF; each «eje de lucha» card is a measure.
  if (program.id === 'pcte') {
    return `El programa se publica como web, y el texto se extrae de su versión impresa en PDF (${pdfFacts(program)}). Cada bloque tiene una introducción y unas fichas, los «ejes de lucha», sin numerar: cada ficha es aquí una medida, con su título, numerada del 1 al ${program.measures.length} en el orden del documento. El PCTE lo presenta como un programa de lucha y no como un programa para aplicar desde las instituciones. La categoría principal de cada medida es una asignación editorial. Los colectivos, las palancas y los territorios se detectan con palabras clave, por eso son una aproximación. El número de página enlaza con el PDF.`;
  }
  return `El texto se extrae del PDF oficial (${pdfFacts(program)}) a partir de la tipografía del documento: bloque, sección, número de medida, título y texto. La categoría principal de cada medida es una asignación editorial. Los colectivos, las palancas y los territorios se detectan con palabras clave, por eso son una aproximación. El número de página enlaza con el PDF original.`;
}
