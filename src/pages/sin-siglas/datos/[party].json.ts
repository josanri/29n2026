/**
 * The measures of one party for «Sin siglas», ready to show: heading, text, category and the provinces
 * where each measure applies. The page loads only the parties that run in the province of the reader.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { publishedPrograms, type Program } from '@/lib/programs';
import { provinces } from '@/lib/presence';
import { categoryById } from '@/lib/taxonomy';
import { applicableProvinces, quizStatement, territoryProvinces, type QuizMeasure } from '@/lib/party-quiz';

const territories = territoryProvinces(provinces);

export const getStaticPaths: GetStaticPaths = () =>
  publishedPrograms.map((program) => ({ params: { party: program.id }, props: { program } }));

export const GET: APIRoute = ({ props }) => {
  const { program } = props as { program: Program };
  const measures: QuizMeasure[] = program.measures
    .filter((measure) => !measure.isPending)
    .flatMap((measure) => {
      const statement = quizStatement(measure);
      if (!statement) return [];
      const where = applicableProvinces(measure, territories, provinces);
      return [{
        n: measure.number,
        c: categoryById[measure.categoryId]?.name ?? measure.categoryId,
        h: statement.heading,
        x: statement.text,
        ...(where ? { a: where } : {}),
      }];
    });
  return new Response(JSON.stringify({ id: program.id, measures }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
