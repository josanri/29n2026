---
name: actualizar-encuestas
description: Busca las encuestas nuevas de CIS, 40dB., Sigma Dos, SocioMétrica y GAD3 y las añade a `src/data/<e>/encuestas.ts` (página /encuestas/). Úsala cuando el usuario pida actualizar, revisar o añadir encuestas, o cuando salga un barómetro o tracking nuevo. Cubre dónde buscar, qué cifra tomar de cada encuestadora, el formato de cada línea, las trampas habituales (Frente Amplio, PP con UPN, horquillas) y las comprobaciones finales.
---

# Actualizar las encuestas

Todo vive en un solo archivo: `src/data/<e>/encuestas.ts` (`<e>` = `2026/generales`). La página `/encuestas/` y la
gráfica (`src/lib/poll-chart.ts`) lo leen tal cual: no hay nada más que tocar para que una encuesta nueva salga.
Cinco encuestadoras: `cis`, `40db`, `sigmados`, `sociometrica`, `gad3`. Otra distinta (Hamalgama, NC Report, More in
Common…) no entra: primero se añade a `pollsters` con su página oficial, y solo si el usuario lo pide.

## 1. Qué hay y qué falta

1. Lee `polls` y apunta, por encuestadora, la fecha de la última línea. Solo interesa lo publicado **después**.
2. Mira la fecha de hoy y el ritmo de cada una. En campaña (desde el 13 de noviembre) publican a diario o casi:
   - **40dB.** (El País y SER): tracking diario, PDF `…/2026/11-tracking-electoral/informe_tracking_diaNN.pdf`.
   - **Sigma Dos** (El Mundo): tracking diario.
   - **SocioMétrica** (El Español): sondeo del domingo por la noche (avance el sábado o domingo).
   - **GAD3** (ABC): barómetro mensual, con alguna entrega extra en campaña.
   - **CIS**: barómetro mensual (hacia el 12-15) y el preelectoral.

## 2. Dónde buscar

`WebSearch` en modo `standard` primero; `extended` si no sale lo de hoy. Una búsqueda por encuestadora, con la fecha:
«SocioMétrica El Español sondeo 15 noviembre 2026», «40dB tracking 14 noviembre 2026»…

Las fuentes que han funcionado, de más a menos fiable:

| Fuente | Para qué |
| --- | --- |
| El Español, El Mundo, El País, ABC, cis.es | La publicación original: aquí va el `url` y se lee la cifra (`checked: true`) |
| electografica.com, electomania.es | Fichas con todos los partidos, escaños y ficha técnica: buenas para cuadrar cifras |
| democrata.es, labandera.es y similares | Crónicas con la tabla: sirven de segunda fuente |
| mapaelectoral.es/encuestas/ | El agregador de la primera carga (`pollAggregator`) |

`WebFetch` rechaza algunos sitios (`SITE_BLOCKED`, `client_error`): no se rodea con `curl` ni espejos; se prueba otra
fuente. Las cifras de un titular sin tabla no sirven: hace falta PP, PSOE y VOX como mínimo.

## 3. Qué cifra tomar

Todo es **% sobre voto válido** (estimación, no intención directa).

- **PP**: el mismo criterio que la línea anterior de esa encuestadora. Si publica «PP» y «PP + UPN-PP» (Navarra),
  la **estimación de voto** sigue la serie existente y los **escaños** van con UPN-PP incluido (así están ya 40dB.,
  GAD3 y SocioMétrica). Déjalo escrito en un comentario sobre la línea.
- **Frente Amplio** (`fa`): la suma que publica la encuestadora para la coalición y sus socios (Front Valencià,
  UPCan, Compromís…). `vFa()` lo coloca en `fa` si la fecha es posterior al 16-X-2026; antes de esa fecha, `v()` y `sumar`.
  Si la fuente solo da FA suelto y los socios aparte, súmalos y apunta la suma en el comentario.
- **Podemos** y **SALF**: la cifra de la encuesta, o `null` si no la publica (Sigma Dos no da SALF).
- **Autonómicos** (`erc`, `junts`, `bildu`, `pnv`, `bng`, `cc`, `upn`, `adelante`): solo los que la fuente da.
  Un partido que no sale no se inventa ni se copia de otra encuesta.
- **Escaños**: número, o `[mínimo, máximo]` si la encuestadora da horquilla. Nunca sumes extremos de horquillas
  distintas para construir una tercera. Si una fila no se publica (p. ej. FA en un tracking), se omite.
- **Muestra** (`sample`): las entrevistas de la publicación. Si no la dice, se omite y la gráfica usa `DEFAULT_SAMPLE`.
  En los trackings acumulados es la muestra de la entrega, no la de un solo día.
- **Fecha** (`date`): la de **publicación** (AAAA-MM-DD), no la del trabajo de campo.

## 4. Una línea por encuesta

Dentro de `polls`, bajo el comentario de su encuestadora y por **orden de fecha, la más reciente arriba**:

```ts
{ pollster: 'sociometrica', date: '2026-11-15', checked: true, url: 'https://…', values: vFa(31.6, 27.8, 19.1, 6.0, 1.2, 2.2, { erc: 2.5, bildu: 1.5, adelante: 1.6 }), sample: 5923, seats: { pp: 132, psoe: 110, vox: 67, fa: 9, erc: 9, junts: 5 } },
```

`vFa(pp, psoe, vox, frenteAmplio, podemos, salf, { otros })` (o `v(...)` antes del 16-X). Los tres primeros y los cuatro
siguientes son obligatorios (`null` si no se publica).

- `url`: la **publicación original**. Si no existe o no se ha podido abrir, pon la mejor fuente que sí has abierto y
  dilo en un comentario sobre la línea (`// sin enlace propio de El Mundo: …`). Una URL deducida de un patrón (el PDF
  `…_dia03.pdf` de 40dB.) se deja con `checked: false` y se avisa al usuario.
- `checked: true` solo si la cifra se ha leído en esa página original. Cualquier otra cosa, `false`.
- Si una fuente corrige una cifra ya publicada (pasa en los trackings), se corrige la línea; no se duplica.
- No cambies los comentarios de cabecera salvo la fecha de «revisión del …».

## 5. Comprobaciones

1. Dos fuentes para cada cifra siempre que se pueda; si discrepan (p. ej. el texto y el gráfico de Sigma Dos para FA),
   gana la que coincide con la serie de esa encuestadora y se anota en un comentario.
2. PP + PSOE + VOX + FA + Podemos + SALF + autonómicos no puede pasar de 100.
3. `npx astro check` sin errores. Si has tocado la página, `SITE_URL=https://electosfera.es npm run build`.
4. Mira `/encuestas/` en `npm run dev`: el último punto de cada encuestadora es el nuevo y el enlace abre.
5. Actualiza la fecha de «revisión del …» de la cabecera de `encuestas.ts`.

## 6. Cierre

Resume al usuario, por encuestadora, qué se ha añadido (fecha, PP/PSOE/VOX), qué no se ha encontrado de nuevo
(«GAD3: nada desde el 9 de noviembre»), y cada cifra o enlace que no se ha podido verificar.
Commit en una rama (`encuestas-AAAA-MM-DD`), mensaje «Encuestas: …», y pull request si el usuario lo pide.
