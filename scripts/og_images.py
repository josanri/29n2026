"""Genera la imagen de vista previa (Open Graph) de la portada: la que muestran X, Instagram, WhatsApp, Telegram o
LinkedIn al pegar un enlace a la portada o a cualquier página sin imagen propia.

Tamaño 1200 × 630 (la proporción 1,91:1 de una tarjeta grande en todas esas redes).
Salida: public/<año>/<tipo>/og/portada.png

Las tarjetas de cada partido y de cada medida no salen de aquí: el Worker las dibuja al pedirlas
(`worker/og/card.ts`, en `/og/tarjetas/…`), con las mismas fuentes y colores.

Dibuja con las fuentes y los colores de la web, en un navegador sin ventana (Playwright).

Uso: python scripts/og_images.py [elección]   (por defecto «2026/generales»)
Requiere: pip install playwright pillow && playwright install chromium; y `npm install` (las fuentes salen de node_modules).
"""
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
ELECCION = sys.argv[1] if len(sys.argv) > 1 else '2026/generales'
SALIDA = RAIZ / 'public' / ELECCION / 'og'
FUENTES = RAIZ / 'node_modules'
ANCHO, ALTO = 1200, 630
AMARILLO = '#ffd23f'
TEXTO_ELECCION = 'Elecciones generales · 29 de noviembre de 2026'


def fuente(familia, archivo, peso):
    ruta = (FUENTES / archivo).as_uri()
    return f"@font-face{{font-family:{familia};src:url({ruta}) format('woff2');font-weight:{peso};}}"


CSS = ''.join([
    fuente('Archivo', '@fontsource-variable/archivo/files/archivo-latin-ext-wght-normal.woff2', '100 900'),
    fuente('Archivo', '@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2', '100 900'),
    fuente('BSD', '@fontsource/big-shoulders-display/files/big-shoulders-display-latin-ext-900-normal.woff2', 900),
    fuente('BSD', '@fontsource/big-shoulders-display/files/big-shoulders-display-latin-900-normal.woff2', 900),
]) + f"""
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ width: {ANCHO}px; height: {ALTO}px; padding: 34px; font-family: Archivo, sans-serif; color: #000; background: {AMARILLO}; }}
.card {{ height: 100%; display: flex; flex-direction: column; padding: 44px 54px 36px; background: #fff; border: 6px solid #000; }}
.wm {{ display: flex; align-items: center; font: 900 150px/1 BSD; letter-spacing: .01em; }}
.dot {{ width: .675em; height: .675em; margin: 0 .075em; border: .07em solid #000; border-radius: 50%; background: {AMARILLO}; }}
.pie {{ margin-top: auto; display: flex; justify-content: space-between; align-items: center; gap: 24px;
        padding-top: 20px; border-top: 5px solid #000; font: 800 26px Archivo; }}
.url {{ padding: 6px 16px; background: #000; color: #fff; white-space: nowrap; }}
"""

PORTADA = f"""<!doctype html><html lang="es"><meta charset="utf-8"><style>{CSS}</style><body><div class="card">
  <div style="margin:auto 0">
    <div class="wm">ELECT<span class="dot"></span>SFERA</div>
    <p style="font:700 44px/1.2 Archivo;margin-top:36px;max-width:960px">Los programas electorales del 29N, medida a medida: categorías, cifras y plazos.</p>
  </div>
  <div class="pie"><span>{TEXTO_ELECCION}</span><span class="url">electosfera.es</span></div>
</div></body></html>"""


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    destino = SALIDA / 'portada.png'
    temporal = SALIDA / '.portada.html'
    temporal.write_text(PORTADA, encoding='utf-8')
    with sync_playwright() as p:
        navegador = p.chromium.launch()
        hoja = navegador.new_page(viewport={'width': ANCHO, 'height': ALTO})
        hoja.goto(temporal.as_uri())
        hoja.evaluate('document.fonts.ready')
        hoja.screenshot(path=str(destino))
        navegador.close()
    temporal.unlink()
    # Una paleta de 256 colores basta para esta tarjeta plana y reduce el archivo a un tercio.
    imagen = Image.open(destino).convert('RGB').quantize(256, method=Image.Quantize.MEDIANCUT)
    imagen.save(destino, optimize=True)
    print(destino.relative_to(RAIZ))


if __name__ == '__main__':
    main()
