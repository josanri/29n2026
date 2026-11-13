/** Kinds of deadline. A date, a maximum waiting time and a time to implement are different things. */
export type DeadlineKind = 'date' | 'maximum' | 'implementation';

export const deadlineKindOrder: DeadlineKind[] = ['date', 'maximum', 'implementation'];

export const deadlineKindLabel: Record<DeadlineKind, { title: string; lead: string }> = {
  date: {
    title: 'Fecha fija',
    lead: 'Un año o una fecha concreta en la que se cumple la medida.',
  },
  maximum: {
    title: 'Plazo máximo de espera',
    lead: 'Un tiempo máximo para atender o responder. La medida fija el límite, no la fecha.',
  },
  implementation: {
    title: 'Plazo de implantación',
    lead: 'Un tiempo que tarda la medida en ponerse en marcha. No fija una fecha.',
  },
};

/** Classifies a deadline written in Spanish ("en 21 días", "6 meses", "2029"). */
export const deadlineKind = (deadline: string): DeadlineKind => {
  const normalized = deadline.toLowerCase();
  if (/\b(19|20)\d{2}\b/.test(normalized)) return 'date';
  if (/^(en|hasta)\b|máximo|maximo/.test(normalized)) return 'maximum';
  return 'implementation';
};

const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

/** Sort key of a deadline written in Spanish: its length in days, or the year for a date. */
export const deadlineRank = (deadline: string): number => {
  const normalized = deadline.toLowerCase();
  const year = normalized.match(/\b20\d{2}\b/);
  if (year) return 3000 + Number(year[0]);
  const duration = normalized.match(/(\d+)\s*(horas?|d[ií]as?|mes(?:es)?|a[nñ]os?)/);
  if (duration) {
    const amount = Number(duration[1]);
    const unit = duration[2];
    if (unit.startsWith('hora')) return amount / 24;
    if (unit.startsWith('d')) return amount;
    if (unit.startsWith('mes')) return amount * DAYS_PER_MONTH;
    return amount * DAYS_PER_YEAR;
  }
  // The start of a four-year term comes first, the end comes last.
  if (normalized.includes('inicio de la legislatura') || normalized.includes('inicio de legislatura')) return 1;
  if (normalized.includes('fin de la legislatura') || normalized.includes('fin de legislatura')) return 4 * DAYS_PER_YEAR;
  return Number.MAX_SAFE_INTEGER;
};
