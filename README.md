# Electosfera

Aplicación Astro para leer y analizar los programas electorales de las elecciones generales del 29 de noviembre de 2026.
Cada programa se descompone en medidas, con categoría, colectivos, palancas, plazos, cifras y enlace a su fuente oficial. La portada agrupa los partidos de ámbito autonómico por comunidad.

## Uso

```sh
npm install
npm run dev       # http://localhost:4321
npm run build     # genera dist/
```

### Publicación (sitemap y robots.txt)

La compilación genera `sitemap-index.xml`, `sitemap-0.xml` y `robots.txt`. También pone la URL canónica y las etiquetas Open Graph en cada página. Todas usan la URL pública del sitio, que se pasa con `SITE_URL`:

```sh
SITE_URL=https://electosfera.es npm run build
```

Sin `SITE_URL`, las URL apuntan a `http://localhost:4321`.

### Publicación en Cloudflare (una ruta por elección)

Cada elección puede vivir en su ruta: `tu-dominio.es/<año>/<tipo>/`, por ejemplo `tu-dominio.es/2026/generales/`. Si hay dos elecciones del mismo tipo en un año, la primera conserva su ruta y la segunda añade la fecha (`/2019/generales-10n/`). Una ruta publicada no cambia.

Variables de compilación del Worker (Settings → Build → Variables):

| Variable | Valor |
|---|---|
| `SITE_URL` | `https://electosfera.es` |
| `BASE_PATH` | `/2026/generales` |
| `NESTED_OUTPUT` | `1` |

Con `NESTED_OUTPUT=1`, la web se compila en `dist/2026/generales/`, porque Cloudflare sirve `dist/` desde la raíz del dominio. La compilación también escribe en la raíz de `dist/`:

- `_headers`, con la ruta base delante de cada ruta;
- `_redirects`: `/`, `/2026` y `/2026/` llevan a `/2026/generales/` (302, temporal: más adelante serán portadas con la lista de elecciones);
- `robots.txt`, porque los buscadores solo lo buscan en la raíz.

En GitHub Pages no se usa `NESTED_OUTPUT`: allí la ruta del repositorio ya es el prefijo.

### Dominio propio: electosfera.es y electosfera.com

Los dos dominios están registrados en IONOS. El dominio principal es **electosfera.es**: la web trata de elecciones en España y `.es` indica a los buscadores que es para España. `electosfera.com` y
`www.electosfera.es` redirigen a él con un 301 que conserva la ruta (`electosfera.com/2026/generales/pp/` →
`electosfera.es/2026/generales/pp/`). Así hay una sola URL canónica para los buscadores. La web no necesita cambios
de código: la URL canónica, el sitemap, `robots.txt` y Open Graph salen de `SITE_URL`.

El registro se queda en IONOS; la DNS pasa a Cloudflare, porque el Worker solo acepta un dominio propio si su zona
está en Cloudflare.

1. **Cloudflare**: *Add a domain* → `electosfera.es` (plan Free). Cloudflare importa los registros DNS que encuentra
   y da dos servidores de nombres. Repite con `electosfera.com`.
2. **Correo, antes de seguir**: si usas el correo de IONOS con estos dominios, comprueba que Cloudflare ha copiado los
   registros `MX`, `TXT` (SPF, DKIM, DMARC) y `CNAME` de autodiscover. Si falta uno, el correo deja de llegar.
3. **IONOS**: Dominios y SSL → `electosfera.es` → Servidores de nombres → «Usar servidores de nombres
   personalizados» → los dos de Cloudflare. Repite con `electosfera.com`. El cambio tarda de minutos a 24 horas;
   Cloudflare avisa cuando la zona está activa.
4. **Worker**: Settings → Domains & Routes → *Add* → *Custom domain* → `electosfera.es`.
5. **Variables de compilación** del Worker, y una compilación nueva:

   | Variable | Valor |
   |---|---|
   | `SITE_URL` | `https://electosfera.es` |
   | `BASE_PATH` | `/2026/generales` |
   | `NESTED_OUTPUT` | `1` |

6. **www → dominio principal**: en la zona `electosfera.es`, DNS → registro `AAAA` `www` → `100::`, con proxy
   (nube naranja). Después, Rules → Redirect Rules → *Create rule*: si `Hostname` es `www.electosfera.es`, redirección
   dinámica a `concat("https://electosfera.es", http.request.uri.path)`, código 301, «Preserve query string».
7. **electosfera.com → electosfera.es**: en la zona `electosfera.com`, registros `AAAA` `@` y `www` → `100::`, con
   proxy. Después, una Redirect Rule para todas las peticiones: redirección dinámica a
   `concat("https://electosfera.es", http.request.uri.path)`, 301, «Preserve query string».
8. **HTTPS**: en las dos zonas, SSL/TLS → Edge Certificates → «Always Use HTTPS». Cuando todo funcione unas
   semanas, activa HSTS.
9. **GitHub Pages**: `.github/workflows/deploy.yml` sigue publicando una copia en `josanri.github.io/29n2026`. Cuando
   electosfera.es funcione, desactiva GitHub Pages (Settings → Pages) o deja el flujo solo con `workflow_dispatch`.
   Dos copias públicas compiten en los buscadores.
10. **Buscadores**: en Google Search Console, añade la propiedad de dominio `electosfera.es` (verificación con un
    registro `TXT` en Cloudflare) y envía `https://electosfera.es/2026/generales/sitemap-index.xml`. Haz lo mismo en
    Bing Webmaster Tools.

Comprobación: `curl -sI https://electosfera.com/2026/generales/pp/` responde `301` con
`location: https://electosfera.es/2026/generales/pp/`, y `curl -sI https://electosfera.es/` responde `302` hacia
`/2026/generales/`.

### Una carpeta por elección

Los datos y los archivos públicos de cada elección están en su carpeta, `<año>/<tipo>`:

```
election.config.mjs           elección que se compila (ELECTION, por defecto «2026/generales»)
src/data/2026/generales/      datos de la elección: programas/, calendario, Congreso, mapa, presencia…
  eleccion.ts                 nombre corto (29N), nombre, fecha: la interfaz toma los textos de aquí
src/data/taxonomia.json       taxonomía común a todas las elecciones
public/2026/generales/        archivos públicos de la elección: programas/, datos-electorales/, favicon.svg
public/comun/                 archivos públicos comunes: _headers, sw.js
scripts/                      solo código: extracción y análisis de los PDF
.cache/2026/generales/        resultados intermedios de la extracción (pp_raw.json…); no está en git
```

- El código importa los datos de la elección con el alias `@eleccion/` (por ejemplo `@eleccion/calendario`). `astro.config.mjs` lo apunta a `src/data/<ELECTION>/`; `tsconfig.json` repite el alias con la elección por defecto, para los tipos del editor.
- La carpeta pública de Astro es `public/<ELECTION>/`. Una integración de `astro.config.mjs` añade `public/comun/`: la sirve en desarrollo y la copia en la compilación. Un archivo de la elección con el mismo nombre tiene prioridad.
- Las URL no incluyen la carpeta: `public/2026/generales/programas/pp.pdf` se publica en `<BASE_PATH>/programas/pp.pdf`. La ruta pública la decide `BASE_PATH`.
- Otra elección: crea `src/data/<año>/<tipo>/` (con su `eleccion.ts`) y `public/<año>/<tipo>/`, y compila con `ELECTION=<año>/<tipo>`.

## Páginas

| Ruta | Contenido |
|---|---|
| `/` | Portada, mapa seleccionable de provincias y candidaturas al Congreso y Senado, y lista de programas |
| `/pp/`, `/bng/`, `/cc/`, `/erc/`, `/salf/`, `/pfac/`, `/autonomos/`, `/ie/`, `/adelante/`, `/mundo-mas-justo/`, `/eaj-pnv/`, `/tercera-edad/`, `/vox/`, `/pacma/` | Análisis: estructura, categorías, colectivos, palancas y medidas |
| `/pp/medidas/`, `/bng/medidas/`, `/cc/medidas/`, `/erc/medidas/`, `/salf/medidas/`, `/pfac/medidas/`, `/autonomos/medidas/`, `/ie/medidas/`, `/adelante/medidas/`, `/mundo-mas-justo/medidas/`, `/eaj-pnv/medidas/`, `/tercera-edad/medidas/`, `/vox/medidas/`, `/pacma/medidas/` | Explorador con filtros (admite `?cat=`, `?col=`, `?pal=`, `?bloque=`, `?q=` y `#m-123`) |
| `/pp/bloque/1/` … `/4/`, `/bng/bloque/1/` … `/11/`, `/cc/bloque/1/` … `/10/`, `/erc/bloque/1/` … `/3/`, `/salf/bloque/1/` … `/10/`, `/pfac/bloque/1/`, `/autonomos/bloque/1/`, `/ie/bloque/1/` … `/15/`, `/adelante/bloque/1/` … `/12/`, `/mundo-mas-justo/bloque/1/` … `/32/`, `/eaj-pnv/bloque/1/` … `/5/`, `/tercera-edad/bloque/1/` … `/13/`, `/vox/bloque/1/` … `/13/`, `/pacma/bloque/1/` … `/3/` | Lectura completa por bloque |
| `/categorias/` | Taxonomía común, comparable entre partidos |
| `/calendario/` | Fechas clave del 29N, con enlace a Google Calendar y archivos `.ics` (`/calendario.ics` y `/calendario/<id>.ics`) |
| `/simulador/` | Simulador de Congreso (350 escaños, hemiciclo) y de pactos de investidura (art. 99 de la Constitución); el estado va en la URL (`?e=`, `?c=`, `?v=`) |
| `/encuestas/` | Seguimiento de la estimación de voto (CIS, 40dB., Sigma Dos, SocioMétrica y GAD3), con gráfica de evolución y enlace a cada publicación |
| `/tests/` | Lista de los tests: «Sin siglas» (`/tests/sin-siglas/`) y «Temas que dividen» (`/tests/temas/`) |
| `/tests/temas/` | Test y comparador de los temas más polarizantes: la postura del lector frente a la de cada programa, con la medida que la prueba |

## Datos

```
public/2026/generales/programas/pp-reconstruccion-nacional.pdf PDF original del PP
scripts/extract_pp.py                PDF → estructura (bloques, secciones, medidas) a partir de las fuentes
scripts/enrich_pp.py                 análisis: categoría, colectivos, palancas, plazos, cifras
src/data/2026/generales/programas/pp.json           resultado que consume la web
public/2026/generales/programas/bng-xerais-2026.pdf PDF oficial del BNG (91 páginas, publicado el 3 de noviembre de 2026)
scripts/extract_bng.py               PDF del BNG → estructura (bloques, secciones y medidas)
scripts/enrich_bng.py                análisis y adaptación del BNG al formato común
src/data/2026/generales/programas/bng.json          resultado que consume la web
public/2026/generales/programas/cc-defiende-canarias-2026.pdf PDF de la coalición Primero Canarias–Coalición Canaria (23 páginas, 9 de noviembre de 2026)
scripts/extract_cc.py                extracción y análisis de las 100 medidas del programa
src/data/2026/generales/programas/cc.json           resultado que consume la web
public/2026/generales/programas/erc-programa-electoral-2026.pdf PDF aportado del programa de ERC (48 páginas)
scripts/extract_erc.py               extracción de ERC; clasifica las propuestas en la taxonomía común
src/data/2026/generales/programas/erc.json          resultado que consume la web
public/2026/generales/programas/salf-contrato-electoral-29n.pdf PDF oficial simplificado de SALF (40 páginas)
scripts/extract_salf.py              extracción y análisis de las 119 propuestas en diez compromisos
src/data/2026/generales/programas/salf.json        resultado que consume la web; los identificadores son consecutivos porque el PDF reinicia la numeración en cada compromiso
public/2026/generales/programas/iustitia-europa-contrato-2026.pdf PDF oficial de Iustitia Europa (28 páginas)
src/data/2026/generales/programas/ie.json          15 compromisos resumidos editorialmente y enlazados a su texto completo
programa.adelanteandalucia.org       programa oficial de Adelante Andalucía (29 medidas principales y desarrollo completo)
public/2026/generales/programas/programa-adelante-andalucia-29n.pdf PDF oficial completo de Adelante Andalucía (134 páginas)
public/2026/generales/programas/las-29-del-29n-adelante-andalucia.pdf PDF resumen de las 29 medidas principales (34 páginas)
scripts/extract_adelante.py          extracción de las 719 propuestas numeradas desde las 12 áreas oficiales
src/data/2026/generales/programas/adelante.json     resultado que consume la web
public/2026/generales/programas/mundo-mas-justo-29n-2026.pdf PDF oficial de M+J (95 páginas)
scripts/extract_mundo_mas_justo.py   extracción y análisis de 191 propuestas en 32 ejes
src/data/2026/generales/programas/mundo-mas-justo.json resultado que consume la web
public/2026/generales/programas/feministas-al-congreso-2026.pdf PDF oficial de Feministas al Congreso (2 páginas)
scripts/extract_pfac.py               extracción de las 14 propuestas numeradas
src/data/2026/generales/programas/pfac.json          resultado que consume la web; color tomado del degradado de la web oficial
src/data/2026/generales/programas/autonomos.json     [decálogo oficial](https://www.partidoautonomos.es/decalogo-de-propuestas/) de 10 propuestas; la ficha advierte que no se identifica como programa del 29N
public/2026/generales/programas/en-accion-3e-2026.pdf PDF oficial de En Acción 3e (6 páginas)
scripts/extract_tercera_edad.py      extracción de 63 medidas en 13 áreas
src/data/2026/generales/programas/tercera-edad.json resultado que consume la web; el documento no se identifica expresamente como programa del 29N
public/2026/generales/programas/vox-es-sentido-comun-2026.pdf PDF oficial de VOX «Es sentido común» (55 páginas, 12 de noviembre de 2026), optimizado: 2,0 MB frente a los 14,5 MB del original
scripts/optimize_pdf.py              reduce un PDF antes de publicarlo: recomprime las fotos y deja solo los glifos usados de cada fuente; el texto no cambia
scripts/extract_vox.py               extracción y análisis de las 115 medidas en 13 áreas
src/data/2026/generales/programas/vox.json          resultado que consume la web; diez medidas solo tienen título en el PDF
public/2026/generales/programas/pacma-programa-generales-2026.pdf PDF oficial de PACMA (82 páginas, 12 de noviembre de 2026), sin optimizar: pesa 1,1 MB
scripts/extract_pacma.py             extracción de 102 propuestas en 3 bloques; comprueba los apartados contra el índice del PDF
src/data/2026/generales/programas/pacma.json        resultado que consume la web; cada apartado de último nivel del PDF (1.1.8.1) es una propuesta
src/data/2026/generales/programas/eaj-pnv.json      30 propuestas transcritas de la [página oficial del PNV](https://www.eaj-pnv.eus/es/programa-elecciones-generales-2026/)
public/2026/generales/datos-electorales/candidaturas-proclamadas-2026.pdf BOE, candidaturas proclamadas el 3 de noviembre
public/2026/generales/datos-electorales/candidaturas-proclamadas-2026-correccion.pdf BOE, corrección oficial del 7 de noviembre
scripts/extract_candidaturas.py      extrae las listas, aplica las correcciones y genera la geometría del mapa
public/2026/generales/datos-electorales/candidaturas.json listas oficiales por provincia, circunscripción y cámara
src/data/2026/generales/provincias.json             geometrías simplificadas de las 52 provincias
public/2026/generales/datos-electorales/mapa-provincias.svg imagen base del mapa con áreas HTML interactivas
src/data/taxonomia.json              21 categorías, colectivos y palancas comunes
src/data/2026/generales/analysis.ts                 lectura editorial («Las claves») por programa
src/data/temas.ts                    temas que dividen: pregunta y dos posturas; común a todas las elecciones
src/data/2026/generales/posturas.ts  postura de cada partido en cada tema, con las medidas que la apoyan (la compilación las comprueba)
src/data/2026/generales/encuestas.ts encuestas (fecha, enlace a la publicación original y porcentajes) y páginas oficiales de cada encuestadora
```

Para regenerar los datos del PP: `npm run data:pp` (necesita Python con PyMuPDF).
Para regenerar los datos del BNG: `npm run data:bng` (necesita Python con PyMuPDF).
Para regenerar los datos de Coalición Canaria: `npm run data:cc` (necesita Python con PyMuPDF).
Para regenerar los datos de ERC: `npm run data:erc` (necesita Python con PyMuPDF).
Para regenerar los datos de SALF: `npm run data:salf` (necesita Python con PyMuPDF).
Para regenerar los datos de Por un Mundo Más Justo: `npm run data:mundo-mas-justo` (necesita Python con PyMuPDF).
Para regenerar los datos de Feministas al Congreso: `npm run data:pfac` (necesita Python con PyMuPDF).
Para regenerar los datos de En Acción 3e: `npm run data:tercera-edad` (necesita Python con PyMuPDF).
Para regenerar los datos de VOX: `npm run data:vox` (necesita Python con PyMuPDF).
Para regenerar los datos de PACMA: `npm run data:pacma` (necesita Python con PyMuPDF; con `--depurar <archivo>` escribe un volcado legible de cada propuesta).
Para regenerar los datos de Adelante Andalucía: `npm run data:adelante` (consulta las páginas oficiales por área; procesa 637 propuestas temáticas y 82 territoriales, numeradas del 1 al 719. Las 29 prioridades del resumen no se cuentan de nuevo).
Para regenerar candidaturas y mapa: `npm run data:candidaturas` (necesita Python con PyMuPDF y conexión para obtener el GeoJSON de provincias). Se usan las proclamaciones del BOE del 3 de noviembre y todas las correcciones de la resolución del 7 de noviembre; las circunscripciones insulares se muestran separadas. El mapa emplea áreas HTML (`<map>`) y se deriva de la capa de provincias del Ministerio de Transportes y Movilidad Sostenible (Sistema de Información Urbana, servicio `SIU/ENTIDADES_TERRITORIALES_EGRN`). En Ceuta y Melilla, el script quita los diques del puerto, que a esa escala son picos finos.
La portada agrupa los partidos autonómicos por comunidad y muestra los tres temas más frecuentes de cada programa. El PDF aportado de ERC salta de la propuesta 167 a la 198 y de la 250 a la 252; el análisis incluye solo las 227 propuestas presentes en el documento.

## Estructura del código

Todo el código (variables, funciones, tipos, clases CSS) está en inglés. Los textos de la web, las URL públicas y las claves de los JSON de datos siguen en español.

```
src/
  content.config.ts       colección «programs»: valida cada JSON y lo traduce al modelo en inglés
  lib/
    program-schema.ts     esquema Zod: claves españolas del JSON → modelo en inglés (Program, Measure, Block…)
    programs.ts           carga y consulta de programas
    presence.ts           dónde se presenta cada partido; estatales y autonómicos
    taxonomy.ts           categorías, colectivos (target groups) y palancas (levers)
    geography.ts          geometría del mapa de provincias
    routes.ts             todas las URL del sitio (no se escribe ninguna ruta a mano)
    format.ts, color.ts, collections.ts, tooltip.ts, blocks.ts, site.ts
  styles/                 tokens.css, base.css, objects.css (ver «Sistema de diseño»)
  components/
    ui/                   Button, Tag, Panel, SectionHeading, BlockChip, Tooltip
    layout/               SiteHeader, SiteFooter
    charts/               BarList, BlockBar, MeasureMap, DeadlineTimeline
    candidacies/          CandidacyMap, PresenceMap
    party/, measures/     ProgramCard, UnpublishedNotice, MeasureCard
  layouts/BaseLayout.astro
  pages/                  [party]/ (programa, medidas, bloques), categorias/, design-system/
```

Reglas:

- Las páginas y los componentes importan con el alias `@/` (por ejemplo `@/lib/routes`).
- Los datos nunca se leen con claves españolas fuera de `program-schema.ts`, `taxonomy.ts`, `geography.ts` y `presence.ts`.
- Antes de entregar un cambio: `npm run check` y `npm run build`.

## Sistema de diseño

La documentación viva está en `/design-system/`: color, contraste en los dos temas, tipografía, espacio, bordes y componentes. Los colores y las razones de contraste se leen de `src/styles/tokens.css` al compilar, así que la página no puede quedar desactualizada.

- **Tokens** (`src/styles/tokens.css`): el único sitio con valores de color, tipografía, espacio, bordes, sombras, capas y movimiento. Cada color usa `light-dark()`: el tema claro y el oscuro se definen en una sola línea.
- **Temas**: sin atributo, el tema sigue al sistema. `data-theme="light"` o `"dark"` en `<html>` lo fija. El botón de la cabecera guarda la elección.
- **Páginas de partido**: `BaseLayout` redefine `--color-accent`, `--color-highlight` y `--color-brand`. El texto sobre el color del partido se calcula (negro o blanco) para cumplir WCAG.
- **Contraste**: 4,5:1 en texto pequeño y 3:1 en texto grande en negrita, en los dos temas. Una pieza que invierte tinta y papel no usa un color de acento como texto.

## Añadir otro programa

La skill del proyecto `.claude/skills/analizar-programa/` describe el proceso completo (fuente oficial, compresión del PDF, extractor, clasificación, claves, posturas y comprobaciones). Resumen:

1. Copia el PDF a `public/2026/generales/programas/`.
2. Escribe un extractor para su maquetación (el de PP usa las fuentes Anth/Montserrat del documento).
3. Asigna las categorías con los mismos `id` de `src/data/taxonomia.json`.
4. Guarda el JSON en `src/data/2026/generales/programas/<id>.json`. La web lo detecta sola y crea sus páginas.
5. Añade sus claves en `src/data/2026/generales/analysis.ts`.
