import type { Program } from './program-schema';

/** The "Nota de método" paragraph of a party page: how the measures were obtained. */
export function methodNote(program: Program): string {
  if (program.measureOrigin === 'web') {
    // Adelante Andalucía: the official PDF has 29 main measures; the site lists the 719 numbered proposals.
    if (program.id === 'adelante') {
      return `El PDF oficial completo tiene ${program.pageCount} páginas y distingue 29 medidas principales de 637 propuestas por áreas y 82 propuestas territoriales. Este análisis recoge las 719 propuestas numeradas de las fichas oficiales consultadas el ${program.sourceDate}; no cuenta aparte las 29 medidas-resumen. La categoría principal, los colectivos y las palancas son una clasificación editorial.`;
    }
    return `El programa se publica en fichas web oficiales, consultadas el ${program.sourceDate}. Se conservan sus títulos y resúmenes. La categoría principal, los colectivos y las palancas son una clasificación editorial.`;
  }
  return `El texto se extrae del PDF oficial (${program.pageCount} páginas, fecha ${program.documentDate}) a partir de la tipografía del documento: bloque, sección, número de medida, título y texto. La categoría principal de cada medida es una asignación editorial. Los colectivos, las palancas y los territorios se detectan con palabras clave, por eso son una aproximación. El número de página enlaza con el PDF original.`;
}
