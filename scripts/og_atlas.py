"""Genera el atlas de glifos con el que el Worker dibuja las tarjetas de vista previa (Open Graph) al vuelo.

El plan gratuito de Cloudflare Workers da 10 ms de CPU por petición: no da para leer una fuente, trazar sus curvas y
suavizar los bordes. Así que ese trabajo se hace aquí, una vez: cada letra de cada tamaño que usan las tarjetas se
dibuja con el navegador (las mismas fuentes y el mismo suavizado que la web) y se guarda ya rasterizada, con su avance
y el interletraje de los pares más comunes. El Worker solo copia esos mapas de bits en la imagen.

Salida: worker/og/atlas.bin, binario y little-endian, para que el Worker no tenga que analizar nada:
  «OGA1», u32 número de fuentes
  por fuente: u8 largo de la clave, clave ASCII, u16 tamaño, f32 ascendente, f32 descendente,
              u32 glifos, u32 posición de su tabla, u32 pares, u32 posición de su tabla
  tabla de glifos, 20 bytes cada uno: u32 carácter, f32 avance, i16 izquierda, i16 arriba (desde la línea base),
              u16 ancho, u16 alto, u32 posición del mapa de bits
  tabla de pares, 8 bytes cada uno: u32 (carácter 1 × 65536 + carácter 2), f32 interletraje
  mapas de bits: 1 byte por píxel, cobertura de 0 a 15

Hay que volver a ejecutarlo si cambian las fuentes, los tamaños de las tarjetas (`worker/og/card.ts`) o si un programa
nuevo trae letras que no están en el juego base (latín 1 y latín extendido A): el script añade las de los programas.

Uso: python scripts/og_atlas.py [elección]   (por defecto «2026/generales»)
Requiere: pip install playwright && playwright install chromium; y `npm install` (las fuentes salen de node_modules).
"""
import base64
import json
import struct
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
ELECCION = sys.argv[1] if len(sys.argv) > 1 else '2026/generales'
PROGRAMAS = RAIZ / 'src' / 'data' / ELECCION / 'programas'
FUENTES = RAIZ / 'node_modules'
SALIDA = RAIZ / 'worker' / 'og' / 'atlas.bin'

EXTRA = '‘’‚“”„«»‹›–—―…•·€′″‰™ŀĿ№ºª°±×÷≤≥→←'
BASE = ''.join(chr(c) for c in [*range(0x20, 0x7F), *range(0xA0, 0x180)]) + EXTRA


def letras_de_los_programas():
    """Las letras de los titulares, textos, siglas y nombres de los programas, para que ninguna falte en el atlas."""
    letras = set()
    for archivo in PROGRAMAS.glob('*.json'):
        datos = json.loads(archivo.read_text(encoding='utf-8'))
        for clave in ('siglas', 'partido', 'programa'):
            letras.update(datos.get(clave) or '')
        for m in datos.get('medidas') or []:
            letras.update(m.get('tituloFrase') or '')
            letras.update(m.get('titulo') or '')
            letras.update(m.get('texto') or '')
    # Sin caracteres de control, ni emojis ni escrituras que las fuentes no tienen.
    return {c for c in letras if 0x20 <= ord(c) < 0x2C00 and c.isprintable()}


DATOS = letras_de_los_programas()
TEXTO = ''.join(sorted(set(BASE) | DATOS))
MAYUSCULAS = ''.join(sorted({c.upper() for c in TEXTO if len(c.upper()) == 1 and (c.isalnum() or c in ' .-+&\'’·/!¡?¿')}))

# Cada fuente de las tarjetas: clave, familia, peso, tamaño en píxeles y las letras que necesita.
# Los tamaños de los titulares y de las siglas son escalones: `worker/og/card.ts` toma el mayor que cabe.
FUENTES_TARJETA = [
    *[(f'archivo-800-{t}', 'Archivo', 800, t, TEXTO) for t in (72, 58, 46)],  # titular de una medida
    ('archivo-800-26', 'Archivo', 800, 26, TEXTO),  # cabecera, pie y siglas del pie
    ('archivo-800-30', 'Archivo', 800, 30, TEXTO),  # unidad («medidas»)
    ('archivo-500-26', 'Archivo', 500, 26, TEXTO),  # arranque del texto de una medida
    ('archivo-700-36', 'Archivo', 700, 36, TEXTO),  # nombre del partido
    ('archivo-600-28', 'Archivo', 600, 28, TEXTO),  # título del programa
    ('bsd-900-52', 'BSD', 900, 52, 'ELECTSFRA'),  # marca
    *[(f'bsd-900-{t}', 'BSD', 900, t, MAYUSCULAS) for t in (150, 120, 100, 84)],  # siglas
    ('bsd-900-120n', 'BSD', 900, 120, '0123456789.'),  # cifra de medidas (mismo tamaño, solo cifras)
    ('bsd-900-190', 'BSD', 900, 190, '“'),  # comilla de la cita
]
# Pares con interletraje: letras, cifras y la puntuación que más se ve junto a ellas.
PARES = ''.join(sorted({c for c in TEXTO if c.isalnum() and ord(c) < 0x180} | set('.,;:\'’"“”«»-–()¿?¡!')))


def fuente(familia, archivo, peso):
    ruta = (FUENTES / archivo).as_uri()
    return f"@font-face{{font-family:{familia};src:url({ruta}) format('woff2');font-weight:{peso};}}"


CSS = ''.join([
    fuente('Archivo', '@fontsource-variable/archivo/files/archivo-latin-ext-wght-normal.woff2', '100 900'),
    fuente('Archivo', '@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2', '100 900'),
    fuente('BSD', '@fontsource/big-shoulders-display/files/big-shoulders-display-latin-ext-900-normal.woff2', 900),
    fuente('BSD', '@fontsource/big-shoulders-display/files/big-shoulders-display-latin-900-normal.woff2', 900),
])

# Se ejecuta en el navegador: dibuja cada letra en un lienzo y lee la cobertura (el canal alfa) de cada píxel.
DIBUJAR = """
async ({ familia, peso, tamano, letras, pares }) => {
  const font = `${peso} ${tamano}px ${familia}`;
  await document.fonts.load(font, letras);
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = Math.ceil(tamano * 3);
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  ctx.font = font;
  ctx.fontKerning = 'normal';
  ctx.textBaseline = 'alphabetic';
  const metrica = ctx.measureText('Hxg');
  const glifos = {};
  const bytes = [];
  for (const letra of letras) {
    const m = ctx.measureText(letra);
    const izquierda = Math.floor(-m.actualBoundingBoxLeft) - 1;
    const arriba = -Math.ceil(m.actualBoundingBoxAscent) - 1;
    const ancho = Math.ceil(m.actualBoundingBoxRight) + 1 - izquierda;
    const alto = Math.ceil(m.actualBoundingBoxDescent) + 1 - arriba;
    if (letra.trim() === '' || ancho <= 0 || alto <= 0) {
      glifos[letra.codePointAt(0)] = [m.width, 0, 0, 0, 0, 0];
      continue;
    }
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    ctx.fillText(letra, -izquierda, -arriba);
    const alfa = ctx.getImageData(0, 0, ancho, alto).data;
    const nivel = (x, y) => Math.round((alfa[(y * ancho + x) * 4 + 3] * 15) / 255);
    // Recorta las filas y columnas vacías.
    let x0 = ancho, x1 = -1, y0 = alto, y1 = -1;
    for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) if (nivel(x, y)) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0) { glifos[letra.codePointAt(0)] = [m.width, 0, 0, 0, 0, 0]; continue; }
    const desde = bytes.length;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) bytes.push(nivel(x, y));
    glifos[letra.codePointAt(0)] = [m.width, izquierda + x0, arriba + y0, x1 - x0 + 1, y1 - y0 + 1, desde];
  }
  const kern = {};
  const enAtlas = [...pares].filter((c) => letras.includes(c));
  const avance = Object.fromEntries(enAtlas.map((c) => [c, ctx.measureText(c).width]));
  for (const a of enAtlas) for (const b of enAtlas) {
    const k = ctx.measureText(a + b).width - avance[a] - avance[b];
    if (Math.abs(k) >= 0.25) kern[a.codePointAt(0) * 65536 + b.codePointAt(0)] = Math.round(k * 100) / 100;
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.slice(i, i + 8192));
  return { ascent: metrica.fontBoundingBoxAscent, descent: metrica.fontBoundingBoxDescent, glifos, kern, pixeles: btoa(bin) };
}
"""


def main():
    indice = {}
    pixeles = bytearray()
    with sync_playwright() as p:
        navegador = p.chromium.launch()
        hoja = navegador.new_page()
        # Una página en un archivo: desde «about:blank» el navegador no carga fuentes de «file://».
        temporal = SALIDA.parent / '.atlas.html'
        temporal.write_text(f'<!doctype html><meta charset="utf-8"><style>{CSS}</style><body>', encoding='utf-8')
        hoja.goto(temporal.as_uri())
        temporal.unlink()
        for clave, familia, peso, tamano, letras in FUENTES_TARJETA:
            r = hoja.evaluate(DIBUJAR, {'familia': familia, 'peso': peso, 'tamano': tamano, 'letras': letras, 'pares': PARES})
            desplazamiento = len(pixeles)
            pixeles += base64.b64decode(r['pixeles'])
            glifos = {cp: [round(g[0], 3), *g[1:5], g[5] + desplazamiento] for cp, g in r['glifos'].items()}
            indice[clave] = {'size': tamano, 'ascent': r['ascent'], 'descent': r['descent'], 'glyphs': glifos, 'kern': r['kern']}
            print(f'{clave}: {len(glifos)} glifos, {len(r["kern"])} pares')
        navegador.close()
    claves = list(indice)
    cabecera_largo = 8 + sum(1 + len(c) + 2 + 4 + 4 + 16 for c in claves)
    tablas = bytearray()
    cabecera = bytearray(b'OGA1' + struct.pack('<I', len(claves)))
    for clave in claves:
        f = indice[clave]
        glifos = bytearray()
        for cp, (avance, izquierda, arriba, ancho, alto, desde) in sorted(f['glyphs'].items(), key=lambda e: int(e[0])):
            glifos += struct.pack('<IfhhHHI', int(cp), avance, izquierda, arriba, ancho, alto, desde)
        pares = bytearray()
        for par, k in sorted(f['kern'].items(), key=lambda e: int(e[0])):
            pares += struct.pack('<If', int(par), k)
        en_glifos = cabecera_largo + len(tablas)
        tablas += glifos
        en_pares = cabecera_largo + len(tablas)
        tablas += pares
        cabecera += struct.pack('<B', len(clave)) + clave.encode('ascii')
        cabecera += struct.pack('<HffIIII', f['size'], f['ascent'], f['descent'], len(f['glyphs']), en_glifos, len(f['kern']), en_pares)
    assert len(cabecera) == cabecera_largo
    # Los mapas de bits empiezan tras las tablas: las posiciones de cada glifo se cuentan desde ahí.
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_bytes(bytes(cabecera) + bytes(tablas) + bytes(pixeles))
    print(f'{SALIDA.relative_to(RAIZ)}: {SALIDA.stat().st_size / 1024:.0f} KB (tablas {len(tablas) / 1024:.0f} KB)')

if __name__ == '__main__':
    main()
