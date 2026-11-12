# Programas 29N

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
SITE_URL=https://tu-dominio.es npm run build
```

Sin `SITE_URL`, las URL apuntan a `http://localhost:4321`.

## Páginas

| Ruta | Contenido |
|---|---|
| `/` | Portada, mapa seleccionable de provincias y candidaturas al Congreso y Senado, y lista de programas |
| `/pp/`, `/bng/`, `/cc/`, `/erc/`, `/salf/`, `/pfac/`, `/autonomos/`, `/ie/`, `/adelante/`, `/mundo-mas-justo/`, `/eaj-pnv/`, `/tercera-edad/` | Análisis: estructura, categorías, colectivos, palancas y medidas |
| `/pp/medidas/`, `/bng/medidas/`, `/cc/medidas/`, `/erc/medidas/`, `/salf/medidas/`, `/pfac/medidas/`, `/autonomos/medidas/`, `/ie/medidas/`, `/adelante/medidas/`, `/mundo-mas-justo/medidas/`, `/eaj-pnv/medidas/`, `/tercera-edad/medidas/` | Explorador con filtros (admite `?cat=`, `?col=`, `?pal=`, `?bloque=`, `?q=` y `#m-123`) |
| `/pp/bloque/1/` … `/4/`, `/bng/bloque/1/` … `/11/`, `/cc/bloque/1/` … `/10/`, `/erc/bloque/1/` … `/3/`, `/salf/bloque/1/` … `/10/`, `/pfac/bloque/1/`, `/autonomos/bloque/1/`, `/ie/bloque/1/` … `/15/`, `/adelante/bloque/1/` … `/12/`, `/mundo-mas-justo/bloque/1/` … `/32/`, `/eaj-pnv/bloque/1/` … `/5/`, `/tercera-edad/bloque/1/` … `/13/` | Lectura completa por bloque |
| `/categorias/` | Taxonomía común, comparable entre partidos |
| `/calendario/` | Fechas clave del 29N, con enlace a Google Calendar y archivos `.ics` (`/calendario.ics` y `/calendario/<id>.ics`) |
| `/simulador/` | Simulador de Congreso (350 escaños, hemiciclo) y de pactos de investidura (art. 99 de la Constitución); el estado va en la URL (`?e=`, `?c=`, `?v=`) |

## Datos

```
public/programas/pp-reconstruccion-nacional.pdf PDF original del PP
scripts/extract_pp.py                PDF → estructura (bloques, secciones, medidas) a partir de las fuentes
scripts/enrich_pp.py                 análisis: categoría, colectivos, palancas, plazos, cifras
src/data/programas/pp.json           resultado que consume la web
public/programas/bng-xerais-2026.pdf PDF oficial del BNG (91 páginas, publicado el 3 de noviembre de 2026)
scripts/extract_bng.py               PDF del BNG → estructura (bloques, secciones y medidas)
scripts/enrich_bng.py                análisis y adaptación del BNG al formato común
src/data/programas/bng.json          resultado que consume la web
public/programas/cc-defiende-canarias-2026.pdf PDF de la coalición Primero Canarias–Coalición Canaria (23 páginas, 9 de noviembre de 2026)
scripts/extract_cc.py                extracción y análisis de las 100 medidas del programa
src/data/programas/cc.json           resultado que consume la web
public/programas/erc-programa-electoral-2026.pdf PDF aportado del programa de ERC (48 páginas)
scripts/extract_erc.py               extracción de ERC; clasifica las propuestas en la taxonomía común
src/data/programas/erc.json          resultado que consume la web
public/programas/salf-contrato-electoral-29n.pdf PDF oficial simplificado de SALF (40 páginas)
scripts/extract_salf.py              extracción y análisis de las 119 propuestas en diez compromisos
src/data/programas/salf.json        resultado que consume la web; los identificadores son consecutivos porque el PDF reinicia la numeración en cada compromiso
public/programas/iustitia-europa-contrato-2026.pdf PDF oficial de Iustitia Europa (28 páginas)
src/data/programas/ie.json          15 compromisos resumidos editorialmente y enlazados a su texto completo
programa.adelanteandalucia.org       programa oficial de Adelante Andalucía (29 medidas principales y desarrollo completo)
public/programas/programa-adelante-andalucia-29n.pdf PDF oficial completo de Adelante Andalucía (134 páginas)
public/programas/las-29-del-29n-adelante-andalucia.pdf PDF resumen de las 29 medidas principales (34 páginas)
scripts/extract_adelante.py          extracción de las 719 propuestas numeradas desde las 12 áreas oficiales
src/data/programas/adelante.json     resultado que consume la web
public/programas/mundo-mas-justo-29n-2026.pdf PDF oficial de M+J (95 páginas)
scripts/extract_mundo_mas_justo.py   extracción y análisis de 191 propuestas en 32 ejes
src/data/programas/mundo-mas-justo.json resultado que consume la web
public/programas/feministas-al-congreso-2026.pdf PDF oficial de Feministas al Congreso (2 páginas)
scripts/extract_pfac.py               extracción de las 14 propuestas numeradas
src/data/programas/pfac.json          resultado que consume la web; color tomado del degradado de la web oficial
src/data/programas/autonomos.json     [decálogo oficial](https://www.partidoautonomos.es/decalogo-de-propuestas/) de 10 propuestas; la ficha advierte que no se identifica como programa del 29N
public/programas/en-accion-3e-2026.pdf PDF oficial de En Acción 3e (6 páginas)
scripts/extract_tercera_edad.py      extracción de 63 medidas en 13 áreas
src/data/programas/tercera-edad.json resultado que consume la web; el documento no se identifica expresamente como programa del 29N
src/data/programas/eaj-pnv.json      30 propuestas transcritas de la [página oficial del PNV](https://www.eaj-pnv.eus/es/programa-elecciones-generales-2026/)
public/datos-electorales/candidaturas-proclamadas-2026.pdf BOE, candidaturas proclamadas el 3 de noviembre
public/datos-electorales/candidaturas-proclamadas-2026-correccion.pdf BOE, corrección oficial del 7 de noviembre
scripts/extract_candidaturas.py      extrae las listas, aplica las correcciones y genera la geometría del mapa
public/datos-electorales/candidaturas.json listas oficiales por provincia, circunscripción y cámara
src/data/provincias.json             geometrías simplificadas de las 52 provincias
public/datos-electorales/mapa-provincias.svg imagen base del mapa con áreas HTML interactivas
src/data/taxonomia.json              21 categorías, colectivos y palancas comunes
src/data/analysis.ts                 lectura editorial («Las claves») por programa
```

Para regenerar los datos del PP: `npm run data:pp` (necesita Python con PyMuPDF).
Para regenerar los datos del BNG: `npm run data:bng` (necesita Python con PyMuPDF).
Para regenerar los datos de Coalición Canaria: `npm run data:cc` (necesita Python con PyMuPDF).
Para regenerar los datos de ERC: `npm run data:erc` (necesita Python con PyMuPDF).
Para regenerar los datos de SALF: `npm run data:salf` (necesita Python con PyMuPDF).
Para regenerar los datos de Por un Mundo Más Justo: `npm run data:mundo-mas-justo` (necesita Python con PyMuPDF).
Para regenerar los datos de Feministas al Congreso: `npm run data:pfac` (necesita Python con PyMuPDF).
Para regenerar los datos de En Acción 3e: `npm run data:tercera-edad` (necesita Python con PyMuPDF).
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

1. Copia el PDF a `public/programas/`.
2. Escribe un extractor para su maquetación (el de PP usa las fuentes Anth/Montserrat del documento).
3. Asigna las categorías con los mismos `id` de `src/data/taxonomia.json`.
4. Guarda el JSON en `src/data/programas/<id>.json`. La web lo detecta sola y crea sus páginas.
5. Añade sus claves en `src/data/analysis.ts`.
