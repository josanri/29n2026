"""Genera las imágenes de vista previa (Open Graph) que muestran X, Instagram, WhatsApp, Telegram o LinkedIn al pegar un enlace.

Tamaño 1200 × 630 (la proporción 1,91:1 de una tarjeta grande en todas esas redes).

Salida (en `public/<año>/<tipo>/og/`):
- portada.png    la de la web: la portada y cualquier página sin imagen propia
- <partido>.png  la de cada partido con programa: su página, sus medidas y sus bloques

Dibuja con las fuentes y los colores de la web, en un navegador sin ventana (Playwright).
Hay que volver a ejecutarlo cuando se añade o se cambia un programa.

Uso: python scripts/og_images.py [elección]   (por defecto «2026/generales»)
Requiere: pip install playwright pillow && playwright install chromium; y `npm install` (las fuentes salen de node_modules).
"""
import html
import json
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
ELECCION = sys.argv[1] if len(sys.argv) > 1 else '2026/generales'
PROGRAMAS = RAIZ / 'src' / 'data' / ELECCION / 'programas'
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
body {{ width: {ANCHO}px; height: {ALTO}px; padding: 34px; font-family: Archivo, sans-serif; color: #000; background: var(--marco); }}
.card {{ height: 100%; display: flex; flex-direction: column; padding: 44px 54px 36px; background: #fff; border: 6px solid #000; }}
.wm {{ display: flex; align-items: center; font: 900 var(--wm, 52px)/1 BSD; letter-spacing: .01em; }}
.dot {{ width: .675em; height: .675em; margin: 0 .075em; border: .07em solid #000; border-radius: 50%; background: var(--punto); }}
.pie {{ margin-top: auto; display: flex; justify-content: space-between; align-items: center; gap: 24px;
        padding-top: 20px; border-top: 5px solid #000; font: 800 26px Archivo; }}
.url {{ padding: 6px 16px; background: #000; color: #fff; white-space: nowrap; }}
h1 {{ font: 900 var(--h1, 150px)/.86 BSD; text-transform: uppercase; }}
.sub {{ font: 700 36px/1.2 Archivo; }}
.cifra {{ font: 900 120px/.8 BSD; }}
.unidad {{ font: 800 30px Archivo; }}
"""


def pagina(cuerpo, marco, punto):
    return f'<!doctype html><html lang="es"><meta charset="utf-8"><style>{CSS}</style><body style="--marco:{marco};--punto:{punto}">{cuerpo}</body></html>'


def marca(tamano=None):
    estilo = f' style="--wm:{tamano}px"' if tamano else ''
    return f'<div class="wm"{estilo}>ELECT<span class="dot"></span>SFERA</div>'


def portada():
    return pagina(f"""<div class="card">
  <div style="margin:auto 0">
    {marca(150)}
    <p style="font:700 44px/1.2 Archivo;margin-top:36px;max-width:960px">Los programas electorales del 29N, medida a medida: categorías, cifras y plazos.</p>
  </div>
  <div class="pie"><span>{TEXTO_ELECCION}</span><span class="url">electosfera.es</span></div>
</div>""", AMARILLO, AMARILLO)


def partido(datos):
    siglas, nombre = datos['siglas'], datos['partido']
    cuantas = len(datos['medidas'])
    unidad = datos.get('unidadMedidas') or 'medidas'
    if cuantas == 1:
        unidad = {'medidas': 'medida', 'propuestas': 'propuesta', 'compromisos': 'compromiso'}.get(unidad, unidad)
    # Unas siglas largas («FE DE LAS JONS», «MUNDO+JUSTO») bajan de tamaño para caber en una línea.
    h1 = 150 if len(siglas) <= 8 else max(84, int(150 * 8 / len(siglas)))
    nombre_html = '' if nombre.lower() == siglas.lower() else f'<p class="sub" style="margin-top:14px">{html.escape(nombre)}</p>'
    titulo = html.escape(f"«{datos['programa']}»") if datos.get('programa') else ''
    return pagina(f"""<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center">{marca()}<span style="font:800 26px Archivo">Programa electoral · 29N</span></div>
  <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:40px;margin-top:auto">
    <div style="min-width:0">
      <h1 style="--h1:{h1}px">{html.escape(siglas)}</h1>
      {nombre_html}
      <p style="font:600 28px/1.2 Archivo;color:#3a3a3a;margin-top:10px">{titulo}</p>
    </div>
    <div style="text-align:right;flex:none"><div class="cifra">{cuantas}</div><div class="unidad">{html.escape(unidad)}</div></div>
  </div>
  <div class="pie" style="margin-top:30px"><span>Todas sus {html.escape(datos.get("unidadMedidas") or "medidas")}, por categoría</span><span class="url">electosfera.es</span></div>
</div>""", datos['color'], datos.get('colorClaro') or datos['color'])


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    trabajos = [('portada', portada())]
    for archivo in sorted(PROGRAMAS.glob('*.json')):
        datos = json.loads(archivo.read_text(encoding='utf-8'))
        if not datos.get('vacio') and datos.get('medidas'):
            trabajos.append((datos['id'], partido(datos)))
    with sync_playwright() as p:
        navegador = p.chromium.launch()
        hoja = navegador.new_page(viewport={'width': ANCHO, 'height': ALTO})
        for nombre, contenido in trabajos:
            temporal = SALIDA / f'.{nombre}.html'
            temporal.write_text(contenido, encoding='utf-8')
            hoja.goto(temporal.as_uri())
            hoja.evaluate('document.fonts.ready')
            hoja.screenshot(path=str(SALIDA / f'{nombre}.png'))
            # Una paleta de 256 colores basta para estas tarjetas planas y reduce el archivo a un tercio.
            imagen = Image.open(SALIDA / f'{nombre}.png').convert('RGB').quantize(256, method=Image.Quantize.MEDIANCUT)
            imagen.save(SALIDA / f'{nombre}.png', optimize=True)
            temporal.unlink()
        navegador.close()
    print(f'{len(trabajos)} imágenes en {SALIDA.relative_to(RAIZ)}')


if __name__ == '__main__':
    main()
