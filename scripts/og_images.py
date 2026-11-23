"""Genera la imagen de vista previa (Open Graph y Google Discover) de la portada: la que muestran Discover,
X, Instagram, WhatsApp, Telegram o LinkedIn al pegar un enlace a la portada o a cualquier página sin imagen propia.

Tamaño 1200 × 675 (proporción 16:9, nativa de tarjetas grandes en Google Discover y compatible con redes sociales).
Diseño «Edición Tinta»: lienzo negro puro, franjas amarillas en los bordes superior e inferior para destacar tanto en
feeds claros como oscuros, y la esfera de trama de semitono (1.150 puntos) como protagonista visual.
Salida: public/<año>/<tipo>/og/portada.png

Las tarjetas de cada partido y de cada medida no salen de aquí: el Worker las dibuja al pedirlas
(`worker/og/card.ts`, en `/og/tarjetas/…`), con las mismas fuentes y la misma «Edición Tinta».

Uso: python scripts/og_images.py [elección]   (por defecto «2026/generales»)
Requiere: pip install playwright pillow && playwright install chromium; y `npm install` (las fuentes salen de node_modules).
"""
import json
import math
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
ELECCION = sys.argv[1] if len(sys.argv) > 1 else '2026/generales'
PROGRAMAS_DIR = RAIZ / 'src' / 'data' / ELECCION / 'programas'
SALIDA = RAIZ / 'public' / ELECCION / 'og'
FUENTES = RAIZ / 'node_modules'
ANCHO, ALTO = 1200, 675
AMARILLO = '#ffd23f'
TEXTO_KICKER = 'ELECCIONES 29N · 2026'
PUNTOS_ESFERA = 1150


def formatear_entero(valor: int) -> str:
    return f'{valor:,}'.replace(',', '.')


def contar_datos():
    archivos = sorted(PROGRAMAS_DIR.glob('*.json'))
    total_partidos = len(archivos)
    publicados = 0
    total_medidas = 0
    categorias = set()
    for archivo in archivos:
        datos = json.loads(archivo.read_text(encoding='utf-8'))
        medidas = [m for m in (datos.get('medidas') or []) if not m.get('pendiente') and not m.get('oculta')]
        if medidas:
            publicados += 1
            total_medidas += len(medidas)
            for m in medidas:
                cat = m.get('categoria')
                if cat:
                    categorias.add(cat)
    return total_partidos, publicados, total_medidas, len(categorias) or 21


def svg_esfera(total_puntos: int = PUNTOS_ESFERA) -> str:
    """Dibuja la esfera de semitono con la misma geometría hexagonal e iluminación superior izquierda que `src/lib/sphere.ts`."""
    rejilla = []
    mitad = math.ceil(math.sqrt(total_puntos / 2.7)) + 4
    for j in range(-mitad, mitad + 1):
        for i in range(-mitad, mitad + 1):
            x = i + (0.5 if j % 2 != 0 else 0.0)
            y = j * 0.866
            rejilla.append((math.hypot(x, y), x, y))
    rejilla.sort(key=lambda p: p[0])
    puntos = rejilla[:total_puntos]
    radio_max = puntos[-1][0] + 0.5
    unidad = 49.5 / radio_max
    lx, ly, lz = -0.5, -0.6, 0.62
    circulos = []
    for _, px, py in puntos:
        nx = px / radio_max
        ny = py / radio_max
        nz = math.sqrt(max(0.0, 1.0 - nx * nx - ny * ny))
        luz = max(0.0, nx * lx + ny * ly + nz * lz)
        sombra = min(0.95, 0.14 + 0.88 * (1.0 - luz))
        cx = 50.0 + px * unidad
        cy = 50.0 + py * unidad
        r = (sombra * unidad) / 2.0
        circulos.append(f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}"/>')
    return (
        '<svg class="esfera" viewBox="0 0 100 100" aria-hidden="true">'
        f'<circle cx="50" cy="50" r="50" fill="{AMARILLO}"/>'
        f'<g fill="#000">{"".join(circulos)}</g></svg>'
    )


def fuente(familia: str, archivo: str, peso) -> str:
    ruta = (FUENTES / archivo).as_uri()
    return f"@font-face{{font-family:{familia};src:url({ruta}) format('woff2');font-weight:{peso};}}"


def construir_html() -> str:
    total_partidos, publicados, total_medidas, total_categorias = contar_datos()
    css = ''.join([
        fuente('Archivo', '@fontsource-variable/archivo/files/archivo-latin-ext-wght-normal.woff2', '100 900'),
        fuente('Archivo', '@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2', '100 900'),
        fuente('BSD', '@fontsource/big-shoulders-display/files/big-shoulders-display-latin-ext-900-normal.woff2', 900),
        fuente('BSD', '@fontsource/big-shoulders-display/files/big-shoulders-display-latin-900-normal.woff2', 900),
    ]) + f"""
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{
  position: relative;
  width: {ANCHO}px;
  height: {ALTO}px;
  overflow: hidden;
  font-family: Archivo, sans-serif;
  color: #fff;
  background: #000;
  border-top: 12px solid {AMARILLO};
  border-bottom: 6px solid {AMARILLO};
}}
.esfera {{
  position: absolute;
  top: 40px;
  left: 765px;
  width: 580px;
  height: 580px;
}}
.col {{
  position: relative;
  width: 732px;
  height: 100%;
  padding: 34px 0 30px 64px;
  display: flex;
  flex-direction: column;
}}
.cabecera {{
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 18px;
  border-bottom: 3px solid {AMARILLO};
}}
.wm {{ display: flex; align-items: center; font: 900 52px/1 BSD; letter-spacing: .01em; color: #fff; }}
.dot {{ width: .675em; height: .675em; margin: 0 .075em; border: .07em solid #fff; border-radius: 50%; background: {AMARILLO}; }}
.kicker {{ padding: 7px 14px; background: {AMARILLO}; color: #000; font: 800 26px/1 Archivo; white-space: nowrap; }}
h1 {{ margin-top: 26px; font: 900 100px/.92 BSD; letter-spacing: .01em; text-transform: uppercase; }}
h1 span {{ display: block; color: {AMARILLO}; }}
.sub {{ margin-top: 28px; font: 700 36px/1.28 Archivo; color: #fff; }}
.cifras {{
  margin-top: auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 16px 0 18px;
  border-top: 3px solid #3a3a3a;
  font: 500 26px/1.2 Archivo;
  color: #c8c8c8;
}}
.cifras strong {{ font: 800 30px/1 Archivo; color: {AMARILLO}; margin-right: 6px; }}
.pie {{
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 18px;
  border-top: 4px solid {AMARILLO};
  font: 800 26px/1 Archivo;
  color: #c8c8c8;
}}
.url {{ padding: 7px 16px; background: {AMARILLO}; color: #000; white-space: nowrap; }}
"""
    return f"""<!doctype html><html lang="es"><meta charset="utf-8"><style>{css}</style><body>
  {svg_esfera()}
  <div class="col">
    <div class="cabecera">
      <div class="wm">ELECT<span class="dot"></span>SFERA</div>
      <span class="kicker">{TEXTO_KICKER}</span>
    </div>
    <h1>EL 29N EN DATOS<span>PUNTO POR PUNTO</span></h1>
    <p class="sub">Programas, encuestas, debates, simulador y tests electorales.</p>
    <div class="cifras">
      <div><strong>{publicados}</strong>programas</div>
      <div><strong>{formatear_entero(total_medidas)}</strong>medidas</div>
      <div><strong>{total_categorias}</strong>categorías</div>
    </div>
    <div class="pie">
      <span class="url">electosfera.es</span>
      <span>{total_partidos} partidos · 52 provincias</span>
    </div>
  </div>
</body></html>"""


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    destino = SALIDA / 'portada.png'
    temporal = SALIDA / '.portada.html'
    temporal.write_text(construir_html(), encoding='utf-8')
    with sync_playwright() as p:
        navegador = p.chromium.launch()
        hoja = navegador.new_page(viewport={'width': ANCHO, 'height': ALTO})
        hoja.goto(temporal.as_uri())
        hoja.evaluate('document.fonts.ready')
        hoja.screenshot(path=str(destino))
        navegador.close()
    temporal.unlink()
    imagen = Image.open(destino).convert('RGB').quantize(256, method=Image.Quantize.MEDIANCUT)
    imagen.save(destino, optimize=True)
    print(destino.relative_to(RAIZ))


if __name__ == '__main__':
    main()
