/** Build the HTML of a tooltip (`data-tooltip`). Every part is escaped. */

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A bold title followed by plain lines, one per line break. */
export const tooltip = (title: string, ...lines: string[]) =>
  [`<b>${escapeHtml(title)}</b>`, ...lines.map(escapeHtml)].join('<br>');
