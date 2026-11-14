---
name: analizar-programa
description: Analiza un programa electoral nuevo (PDF o web) y lo incorpora a Electosfera con la misma estructura que los demás partidos. Úsala cuando el usuario aporte o pida añadir el programa de un partido, cuando un partido que estaba «vacío» publique su programa, o cuando haya que regenerar o revisar el análisis de un programa ya incorporado. Cubre la fuente oficial, la compresión del PDF, el extractor (también para programas sin medidas numeradas), la clasificación, «Las claves», las posturas de «Temas que dividen» (test de cinco respuestas), los enlaces y las comprobaciones finales.
---

# Analizar un programa electoral

El objetivo es que el programa nuevo quede igual que los ya publicados (PP, VOX, BNG, ERC, SALF, PACMA…): cada
medida con su texto original, su categoría y su página, y la ficha del partido con claves, cifras, plazos y enlaces a
la fuente. Trabaja sobre la elección que se compila (`ELECTION`, por defecto `2026/generales`). En esta guía, `<e>` es
esa carpeta.

## 0. Antes de empezar

1. Mira si el partido ya existe: `src/data/<e>/programas/<id>.json`. Un partido sin programa tiene `"vacio": true`.
   Conserva su `id`, `partido`, `siglas`, `color` y `colorClaro`: las URL públicas y la presencia dependen de ellos.
2. Busca la **fuente oficial**: la web del partido. Guarda la URL exacta del PDF (o de la página) y la fecha de
   publicación. Un PDF que solo está en un periódico no es la fuente oficial: dilo en `observaciones` y sigue buscando.
3. Comprueba que es el programa de **esta** elección (fecha, lema, mención del 29N). Si no lo dice, añade una
   observación, como en `autonomos.json` y `tercera-edad.json`. La fecha de los metadatos del PDF
   (`creationDate`, `modDate`) sirve como `fechaPdf` cuando el documento no la escribe.

## 1. El documento: descarga y compresión

1. Descarga el original en una carpeta **nueva y vacía** del scratchpad (o en `.cache/<e>/`), nunca en `public/` sin
   revisar. Los scripts de inspección van en otra carpeta, y la ruta del PDF se pasa como argumento.
2. Optimiza el PDF antes de publicarlo. El texto no cambia, así que el extractor lee igual el archivo optimizado:

   ```sh
   python scripts/optimize_pdf.py ORIGINAL.pdf public/<e>/programas/<id>-<lema>-<año>.pdf [ANCHO_MAX] [CALIDAD]
   ```

   Por defecto: fotos a 900 px de ancho y JPEG al 65 %, fuentes reducidas a los glifos usados. Apunta en el README
   el peso antes y después (VOX: 14,5 MB → 2,0 MB). Si el PDF ya pesa menos de 3 MB, no lo toques y cópialo tal cual
   (PACMA: 1,1 MB).
3. Nombre del archivo: minúsculas, guiones, sin tildes: `<siglas>-<lema-corto>-<año>.pdf`.
4. Añade el nombre de descarga en `src/data/<e>/download-names.ts` (`programa-<siglas>-<lema>-<año>.pdf`).

Un programa que solo existe como web (PNV, Autónomos, Escaños en Blanco) no tiene PDF: `"tipoDocumento": "web"`,
`"pdf"` es la URL de la página y `"origenMedidas": "web"`. Transcribe las propuestas tal como están en la página.

## 2. La estructura: el extractor

Antes de escribir el extractor, vuelca las líneas del PDF con su fuente, tamaño, color y posición (`page.get_text('dict')`)
y lee el índice y dos o tres páginas del cuerpo. Así decides qué es una medida.

Escribe `scripts/extract_<id>.py` (Python con PyMuPDF, `import fitz`). Toma como plantilla el extractor del programa
más parecido:

| Plantilla | Cuándo |
| --- | --- |
| `extract_vox.py` | Medidas numeradas con título. |
| `extract_bng.py` + `enrich_bng.py` | Dos pasos, documento largo. |
| `extract_cc.py`, `extract_pfac.py` | Pocas medidas, lista corta. |
| `extract_humanista.py` | «Propuesta N:» dentro de capítulos numerados. |
| `extract_pacma.py` | **Sin medidas numeradas**: apartados con numeración de varios niveles (1, 1.1, 1.1.8.1) y texto en prosa. |
| `extract_adelante.py` | Web por áreas. |

El extractor sigue siempre este orden:

1. Lee las líneas del PDF con su fuente, su tamaño, su color y su página. Identifica la tipografía de cada nivel
   (bloque, sección, número de medida, título, texto, viñetas) y anótala en el docstring del script.
2. Une en una sola línea las piezas que están a la misma altura y **ordénalas por su `x`**: una viñeta en otra fuente
   (Symbol «•») queda un poco más baja que su texto y, sin ordenar, sale al final de la línea. Si entre dos piezas hay
   hueco y no hay espacio, añade uno (Pages no lo escribe entre una pieza en negrita y la siguiente).
3. Quita las cabeceras y los pies repetidos, une las palabras cortadas con guion y respeta los párrafos (`\n\n`). Cada
   punto de una lista es un párrafo que empieza por «– »: la web separa los párrafos por la línea en blanco.
4. Construye `bloques` → `secciones` → `medidas`. Cada medida lleva su número (`n`), `bloque`, `seccion`, `pagina`,
   `titulo`, `tituloFrase` (el título en frase corta), `texto` y `oculta` (`true` si el número está reservado y el
   partido aún no ha anunciado la medida).
5. Comprueba los totales y para con un error si no coinciden: con constantes (`PAGINAS`, `TOTAL_MEDIDAS`) o, mejor,
   contra el **índice** del propio PDF (los mismos apartados, en el mismo orden). Si el documento salta números (ERC
   salta de la 167 a la 198), no los inventes: dilo en `observaciones` y en el README.
6. Escribe `src/data/<e>/programas/<id>.json` con `json.dump(..., ensure_ascii=False, indent=1)`.
7. Añade el script a `package.json`: `"data:<id>": "python scripts/extract_<id>.py public/<e>/programas/<archivo>.pdf src/data/<e>/programas/<id>.json"`.
8. Añade una opción `--depurar <archivo>` que escriba un volcado legible (número, código, página, categoría, título
   y texto de cada medida). Con él lees el programa entero antes de clasificar y de escribir «Las claves».

### Un programa sin medidas numeradas

Si el programa es prosa con apartados numerados (PACMA):

- Primer nivel → bloque. Segundo nivel → sección; su texto es la introducción si tiene subapartados.
- Cada apartado de **último nivel** es una medida, y también un apartado de segundo nivel sin hijos. Un apartado con
  hijos y texto propio que propone algo (PACMA 1.1.8 «Oposición a la caza») también es una medida.
- `n` es correlativo y el título es el del PDF, sin el código. Las tablas del script (categoría, derogaciones,
  cifras, plazos) usan el **código del PDF** («1.1.8.1»), que no cambia si el partido añade un apartado.
- `unidadMedida`/`unidadMedidas`: «propuesta»/«propuestas». Explica el criterio en la nota de método.

Las claves del JSON están en español y las valida `src/lib/program-schema.ts`. Campos de cabecera obligatorios:
`id, partido, siglas, color, colorClaro, programa, subtitulo, elecciones, pdf, fuentePdf, paginas, fechaPdf,
presentacion {titulo, texto}, cifras, plazos, ordenPlazos, verbos, bloques, secciones, medidas`.
`fuentePdf` es la URL oficial del partido: la ficha la enlaza como «PDF original del partido» o «Fuente oficial».
`programa` es el título grande de la ficha: un lema corto («Es sentido común», «Programa electoral 29N»), nunca una
frase larga. Si la portada no tiene texto extraíble (fuente decorativa), usa el título del PDF.

## 3. El análisis de cada medida

Usa los `id` de `src/data/taxonomia.json`. No inventes ninguno.

- **Categoría** (una por medida): la del bloque como base (`BLOQUES`) y las excepciones medida a medida
  (`CATEGORIA_MEDIDA`), leyendo cada medida. Una corrección posterior va a `src/data/<e>/revisiones.json`, no al
  script: así una extracción nueva no la deshace.
- **Un tema que la taxonomía no tiene** (PACMA: la protección animal, casi la mitad del programa): asigna a cada
  medida la categoría más cercana y escribe el criterio en el script, en `observaciones` y en la nota de método.
  Añadir una categoría cambia `/categorias/`, la rosa y la comparación de todos los partidos: es una decisión del
  usuario. Pregúntaselo en el informe final, no la tomes tú.
- **Colectivos** y **palancas**: expresiones regulares sobre título y texto (`COLECTIVOS`, `PALANCAS`). Son una
  aproximación y la nota de método lo dice.
- **Territorios**: los que la medida nombra de forma concreta (`TERRITORIOS`).
- **Cifras**: solo compromisos cuantificados. Cada cifra del programa (`cifras` de cabecera) lleva `valor`,
  `unidad`, `texto`, `contexto` (cita literal corta, que el script comprueba en el texto) y `medida`. Las `cifras`
  de una medida son solo las frases de esos compromisos: la ficha dice «N tienen una cifra», y un dato de contexto
  («300.000 animales abandonados al año», «el alquiler ha subido un 94 %») no es un compromiso. No uses una regla
  automática del tipo «toda frase con un número y un %».
- **Plazos**: solo **cuándo se aplica la medida** («en los primeros 100 días», «antes de 2030», «retirada
  inmediata»). Un dato con tiempo no es un plazo («desalojo en 24 horas», «licencia en 15 días»), ni lo es un plazo
  que el programa reprocha a otros («la Comisión prometió… antes de 2027»). Cada plazo lleva `plazo`, `texto` y
  `medida`, y `ordenPlazos` va de lo más inmediato a lo más lejano.
- **Deroga**: solo las derogaciones explícitas («derogaremos la Ley de Vivienda»). «Superar» o «revisar» no es
  derogar, ni lo es citar que otros pidieron una derogación. El script comprueba que la medida dice «derog».
- **Verbos**: los 15 verbos más repetidos (`verbos`), sin los auxiliares ni las frases hechas (`NO_VERBOS`: «no nos
  cansaremos»). Si el programa escribe en futuro, cuenta las formas en -remos; si escribe en infinitivo (VOX), los
  infinitivos.
- **Presentación**: el texto introductorio del programa, literal.

## 4. La ficha del partido

1. **Las claves**: entre 4 y 6 hallazgos en `src/data/<e>/analysis.ts` (`keyFindingsByParty.<id>`). Cada uno con
   título, un párrafo con datos del propio programa y entre 3 y 6 `measureNumbers` que lo prueban. Nada de opinión:
   proporciones, ausencias llamativas, derogaciones, cifras. Calcula cada número con un script sobre el JSON
   (medidas por bloque, títulos con «prohibición», menciones de un tema) y comprueba que cada medida citada dice lo
   que el párrafo le atribuye.
2. **Nota de método**: si el origen es especial (web, resumen, numeración propia, categoría aproximada), añade el
   caso en `src/lib/method-note.ts`.
3. **Relaciones**: si va en coalición o en una lista conjunta, revisa `src/data/<e>/relaciones.json`.
4. **Temas que dividen**: lee el programa buscando los temas de `src/data/temas.ts` y añade las posturas en
   `src/data/<e>/posturas.ts`, al final del grupo de cada tema. Cada postura tiene `side: 'a' | 'b' | 'matiz'`, las
   medidas que lo dicen y una nota corta con las palabras del programa. Sin una medida que lo diga, no hay postura.
   La compilación comprueba que cada medida existe.
   - El test tiene **cinco respuestas** para el lector: A, A con matices, neutral, B con matices y B. La afinidad con
     un partido es `1 − |lector − partido| / 2` sobre la escala A = 1, matiz = 0, B = −1. Por eso `matiz` está en el
     **centro** de la escala, como «neutral»: úsalo solo cuando el programa trata el tema sin tomar del todo una
     postura (PACMA en vivienda: vivienda pública, pero sin tope del alquiler y con incentivos a los propietarios).
   - Que un programa defienda una causa cercana no es una postura sobre el tema: «contra toda discriminación» no es
     una postura sobre la ley trans, y luchar contra el fraude fiscal no es subir impuestos a las rentas altas.
5. **README**: añade el PDF, el script y el JSON a la lista de «Datos», el comando `npm run data:<id>` y la ruta a la
   tabla de «Páginas».

## 5. Enlaces y secciones que deben funcionar

Compila y abre la web (`npm run build` y `npx astro preview`, o `npm run dev`) y revisa en `/<id>/`:

- Botones con icono: «Explorar las N medidas», «Leer por bloques», «Descargar programa completo» (PDF local, con el
  nombre de `download-names.ts`) y «PDF original del partido» (`fuentePdf`).
- El título grande (`programa`) cabe en pocas líneas y el resumen («N tienen una cifra, N tienen un plazo…») da
  números creíbles.
- La esfera lleva a `/<id>/medidas/`, donde la rosa de categorías (la lista a la izquierda y la rosa a la derecha)
  filtra las medidas.
- «Las claves», «Los números del programa», «Cómo se reparte» (barra y mapa resumido), categorías, colectivos y
  palancas, «Lo que tiene fecha», «Deroga, reserva y repite», presentación, nota de método y «Dónde se presenta».
- `/<id>/bloque/1/` … último bloque, y `#m-<n>` abre la medida `n`.
- El partido aparece en la portada (estatal o en su comunidad), en el menú, en `/categorias/`, en la búsqueda, en
  «Sin siglas» (`/tests/sin-siglas/datos/<id>.json`) y, si tiene posturas, en «Temas que dividen».

Para mirar una página sin navegador interactivo, haz una captura con Edge o Chrome sin interfaz:
`msedge --headless=new --window-size=1400,1500 --screenshot=<archivo>.png http://localhost:4321/<id>/`.

## 6. Comprobaciones finales

```sh
npm run check
npm run build
```

- Los dos deben terminar sin errores.
- Compara 5 medidas al azar con el PDF: número, título, texto y página.
- Busca palabras pegadas (`[a-z][A-Z]` dentro de una palabra) y viñetas sueltas («•», «-») en los textos.
- Los totales salen de una sola fuente: `allMeasures`, `totalMeasures` y `announcedMeasures(program)` en
  `src/lib/programs.ts` (sin los números reservados, `oculta: true`). Un código nuevo que cuente medidas de varios
  programas usa esas funciones, nunca `program.measures.length`. La esfera para la compilación si sus puntos no
  coinciden con el total.
- Comprueba el contraste del color del partido en los dos temas (la web calcula el texto negro o blanco, pero revisa
  el subrayado y la esfera si el color es muy claro).
- Informa al usuario: fuente oficial y fecha, páginas, número de medidas, peso del PDF antes y después, y todo lo que
  el documento no resuelve (saltos de numeración, medidas solo con título, dudas de categoría, temas que la
  taxonomía no cubre).
