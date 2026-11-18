/**
 * File name the browser proposes when a reader downloads a program PDF hosted on this site.
 * Every program with a local PDF needs one: the build stops without it (`src/lib/program-checks.ts`).
 */
export const downloadFileNames: Record<string, string> = {
  bng: 'programa-bng-xerais-2026.pdf',
  cc: 'programa-defiende-canarias-2026.pdf',
  erc: 'programa-erc-2026.pdf',
  jxcat: 'programa-junts-29n-2026.pdf',
  adelante: 'programa-adelante-andalucia-29n.pdf',
  ph: 'programa-partido-humanista-2026.pdf',
  fo: 'programa-frente-obrero-recuperar-espana.pdf',
  vox: 'programa-vox-es-sentido-comun-2026.pdf',
  podemos: 'programa-podemos-paz-casa-y-trabajo-2026.pdf',
  pp: 'programa-pp-reconstruccion-nacional-2026.pdf',
  pacma: 'programa-pacma-generales-29n-2026.pdf',
  fa: 'programa-frente-amplio-29n-2026.pdf',
  'eh-bildu': 'programa-eh-bildu-garantia-y-derechos-2026.pdf',
  d21: 'programa-d21-espana-limpia-2026.pdf',
  'fe-jons': 'programa-fe-jons-29n-2026.pdf',
  pcte: 'programa-de-lucha-pcte-2026.pdf',
  psoe: 'programa-psoe-la-fuerza-de-seguir-avanzando-2026.pdf',
  ie: 'programa-iustitia-europa-contrato-electoral-2026.pdf',
  'mundo-mas-justo': 'programa-por-un-mundo-mas-justo-29n-2026.pdf',
  pfac: 'programa-feministas-al-congreso-2026.pdf',
  salf: 'programa-salf-contrato-electoral-29n.pdf',
  'soria-ya': 'programa-soria-ya-2026.pdf',
  'tercera-edad': 'programa-en-accion-3e-2026.pdf',
  convergents: 'programa-convergents-eleccions-generals-2026.pdf',
  'teruel-existe': 'programa-teruel-existe-29n-2026.pdf',
  'compromis-front-valencia': 'programa-compromis-29n-2026.pdf',
  upc: 'manifiesto-unidad-del-pueblo-canario-29n-2026.pdf',
  'geroa-bai': 'programa-geroa-bai-bases-politicas-29n-2026.pdf',
  ixlg: 'programa-ixlg-senado-29n-2026.pdf',
  nex: 'programa-nex-generales-29n-2026.pdf',
  comuns: 'programa-comuns-29n-2026.pdf',
};

/** File name of the summary PDF of Adelante Andalucía (the 29 main measures). */
export const summaryDownloadFileName = 'las-29-del-29n-adelante-andalucia.pdf';
