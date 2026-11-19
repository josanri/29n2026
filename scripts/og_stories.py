"""Dibuja la imagen para stories de Instagram (1080 × 1350) de un partido, con sus colores y cuatro datos de su programa.

Es la misma tarjeta para todos: el marco y el punto de «ELECTOSFERA» llevan el color del partido, y debajo van el
nombre, el lema del programa y cuatro filas con una cifra y su descripción. Las cifras de cada partido están en
`TARJETAS`: salen del JSON del programa y de «Las claves» de `analysis.ts`; el script comprueba las que se pueden
calcular (el total de propuestas) y para si no coinciden con el JSON.

Uso: python scripts/og_stories.py [id ...]   (por defecto, todos los de `TARJETAS`)
Salida: stories/<id>.png (carpeta fuera de `public/`: no se publica con la web).
Requiere: pip install playwright pillow && playwright install chromium; y `npm install` (las fuentes salen de node_modules).
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
PROGRAMAS = RAIZ / 'src' / 'data' / '2026' / 'generales' / 'programas'
SALIDA = RAIZ / 'stories'
FUENTES = RAIZ / 'node_modules'
ANCHO, ALTO = 1080, 1350

# id → (nombre grande, lema, [(cifra, descripción)]). La primera cifra es siempre el total de propuestas.
TARJETAS = {
    'cha-fa': ('CHA-FA', '«Agenda Aragonesa»', [
        ('146', 'propuestas'),
        ('34', 'sobre ferrocarril, carreteras y movilidad'),
        ('36', 'mencionan al Estado o a sus competencias'),
        ('13', 'llevan una cifra'),
    ]),
    'upn': ('UPN', '«Por España, por Navarra, por fin»', [
        ('36', 'compromisos'),
        ('6', 'de sanidad y dependencia'),
        ('5', 'tratan del estatus de Navarra'),
        ('4', 'llevan una cifra'),
    ]),
}


def fuente(familia, archivo, peso):
    return f"@font-face{{font-family:{familia};src:url({(FUENTES / archivo).as_uri()}) format('woff2');font-weight:{peso};}}"


CSS = ''.join([
    fuente('Archivo', '@fontsource-variable/archivo/files/archivo-latin-ext-wght-normal.woff2', '100 900'),
    fuente('Archivo', '@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2', '100 900'),
    fuente('BSD', '@fontsource/big-shoulders-display/files/big-shoulders-display-latin-ext-900-normal.woff2', 900),
    fuente('BSD', '@fontsource/big-shoulders-display/files/big-shoulders-display-latin-900-normal.woff2', 900),
])


def pagina(color, nombre, lema, filas):
    # El nombre se encoge si es largo, para que quepa en una línea.
    tamano = 250 if len(nombre) <= 9 else 190
    filas_html = ''.join(
        f'<div class="fila"><span class="num">{n}</span><span class="txt">{t}</span></div>' for n, t in filas)
    return f"""<!doctype html><html lang="es"><meta charset="utf-8"><style>{CSS}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ width: {ANCHO}px; height: {ALTO}px; padding: 44px; background: {color}; font-family: Archivo, sans-serif; color: #000; }}
.card {{ height: 100%; display: flex; flex-direction: column; padding: 62px 66px 50px; background: #fff; border: 8px solid #000; }}
.wm {{ display: flex; align-items: center; font: 900 66px/1 BSD; letter-spacing: .01em; }}
.dot {{ width: .675em; height: .675em; margin: 0 .075em; border: .07em solid #000; border-radius: 50%; background: {color}; }}
.nombre {{ font: 900 {tamano}px/.9 BSD; margin-top: 16px; letter-spacing: .005em; white-space: nowrap; }}
.lema {{ font: 700 50px/1.15 Archivo; color: #3a3a3a; margin: 22px 0 34px; }}
.fila {{ display: flex; align-items: flex-end; gap: 0; padding: 14px 0 12px; border-top: 7px solid #000; }}
.num {{ flex: 0 0 280px; font: 900 128px/.95 BSD; }}
.txt {{ font: 800 40px/1.12 Archivo; padding-bottom: 12px; }}
.pie {{ margin-top: auto; display: flex; justify-content: space-between; align-items: center; gap: 24px;
        padding-top: 26px; border-top: 7px solid #000; font: 800 30px Archivo; }}
.url {{ padding: 8px 22px; background: #000; color: #fff; white-space: nowrap; }}
</style><body><div class="card">
  <div class="wm">ELECT<span class="dot"></span>SFERA</div>
  <div class="nombre">{nombre}</div>
  <div class="lema">{lema}</div>
  <div>{filas_html}</div>
  <div class="pie"><span>Elecciones generales · 29N</span><span class="url">electosfera.es</span></div>
</div></body></html>"""


def main():
    ids = sys.argv[1:] or list(TARJETAS)
    SALIDA.mkdir(exist_ok=True)
    with sync_playwright() as p:
        navegador = p.chromium.launch()
        hoja = navegador.new_page(viewport={'width': ANCHO, 'height': ALTO})
        for id_ in ids:
            nombre, lema, filas = TARJETAS[id_]
            with open(PROGRAMAS / f'{id_}.json', encoding='utf-8') as f:
                programa = json.load(f)
            total = sum(1 for m in programa['medidas'] if not m.get('oculta'))
            if str(total) != filas[0][0]:
                raise SystemExit(f'{id_}: la tarjeta dice {filas[0][0]} propuestas y el JSON tiene {total}')
            temporal = SALIDA / f'.{id_}.html'
            temporal.write_text(pagina(programa['color'], nombre, lema, filas), encoding='utf-8')
            hoja.goto(temporal.as_uri())
            hoja.evaluate('document.fonts.ready')
            destino = SALIDA / f'{id_}.png'
            hoja.screenshot(path=str(destino))
            temporal.unlink()
            print(destino.relative_to(RAIZ))
        navegador.close()


if __name__ == '__main__':
    main()
