"""Genera las imágenes de vista previa (Open Graph) que muestran X, Instagram, WhatsApp, Telegram o LinkedIn al pegar un enlace.

Tamaño 1200 × 630 (la proporción 1,91:1 de una tarjeta grande en todas esas redes).

Salida (en `public/<año>/<tipo>/og/`):
- portada.png    la de la web: la portada y cualquier página sin imagen propia
- <partido>.png  la de cada partido con programa: su página, sus medidas y sus bloques
- medidas/<partido>-<n>.png  la de una medida, como una cita (titular y arranque del texto): solo las que se piden

Dibuja con las fuentes y los colores de la web, en un navegador sin ventana (Playwright).
Hay que volver a ejecutarlo cuando se añade o se cambia un programa, y para cada medida cuyo texto cambie: la imagen de una medida no se actualiza sola.

Uso: python scripts/og_images.py [elección]                     (portada y partidos; por defecto «2026/generales»)
     python scripts/og_images.py --medida pp:144 [--medida …]  (solo esas medidas, para compartirlas)
     python scripts/og_images.py --todas-las-medidas            (una por medida: unos 6.000 PNG, 150-240 MB; Cloudflare admite 20.000 archivos por despliegue)

La página de una medida (`/<partido>/medidas/<n>/`) usa su imagen si existe y, si no, la del partido.
Requiere: pip install playwright pillow && playwright install chromium; y `npm install` (las fuentes salen de node_modules).
"""
import argparse
import html
import json
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
ARGS = argparse.ArgumentParser(description=__doc__.split('\n')[0])
ARGS.add_argument('eleccion', nargs='?', default='2026/generales')
ARGS.add_argument('--medida', action='append', default=[], metavar='PARTIDO:N', help='una medida, por ejemplo pp:144')
ARGS.add_argument('--todas-las-medidas', action='store_true', help='una imagen por cada medida anunciada')
OPCIONES = ARGS.parse_args()
ELECCION = OPCIONES.eleccion
PROGRAMAS = RAIZ / 'src' / 'data' / ELECCION / 'programas'
SALIDA = RAIZ / 'public' / ELECCION / 'og'
SALIDA_MEDIDAS = SALIDA / 'medidas'
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


def recortar(texto, maximo=190):
    """El arranque de un texto: hasta el final de una frase si es largo, o cortado en una palabra con «…»."""
    texto = ' '.join(texto.split())
    if len(texto) <= maximo:
        return texto
    corte = texto[:maximo]
    fin = corte.rfind('. ')
    return corte[:fin + 1] if fin > maximo / 2 else corte.rsplit(' ', 1)[0] + '…'


def medida(datos, m):
    """La imagen de una medida: su titular entre comillas, el arranque del texto y la página del programa."""
    titulo = m.get('tituloFrase') or m['titulo']
    # Un titular largo baja de tamaño para caber en tres líneas.
    tamano = 72 if len(titulo) <= 38 else 58 if len(titulo) <= 64 else 46
    plural = datos.get('unidadMedidas') or 'medidas'
    unidad = {'ejes': 'eje'}.get(plural, plural.removesuffix('s'))
    # Algunos programas listan una medida con título y sin texto: entonces no hay arranque que mostrar.
    texto_html = (
        f'<p style="font:500 26px/1.35 Archivo;color:#3a3a3a;margin-top:22px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">{html.escape(recortar(m["texto"]))}</p>'
        if m.get('texto', '').strip() else ''
    )
    pagina_texto = f" · pág. {m['pagina']}" if m.get('pagina') else ''
    return pagina(f"""<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center">{marca()}<span style="font:800 26px Archivo">Programa electoral · 29N</span></div>
  <div style="display:flex;gap:26px;margin:auto 0;align-items:flex-start">
    <div style="font:900 190px/.8 BSD;color:{datos['color']};flex:none;margin-top:6px">“</div>
    <div style="min-width:0">
      <p style="font:800 {tamano}px/1.04 Archivo;letter-spacing:-.01em;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">{html.escape(titulo)}</p>
      {texto_html}
    </div>
  </div>
  <div class="pie"><span>{html.escape(datos['siglas'])} · {unidad} {m['n']}{pagina_texto}</span><span class="url">electosfera.es</span></div>
</div>""", datos['color'], datos.get('colorClaro') or datos['color'])


def medidas_pedidas(programas):
    """Las medidas que hay que dibujar: las de `--medida partido:n` o todas las anunciadas."""
    pedidas = []
    if OPCIONES.todas_las_medidas:
        for datos in programas.values():
            pedidas += [(datos, m) for m in datos['medidas'] if not m.get('oculta')]
    for peticion in OPCIONES.medida:
        partido_id, _, numero = peticion.partition(':')
        datos = programas.get(partido_id)
        encontrada = next((m for m in datos['medidas'] if str(m['n']) == numero), None) if datos else None
        if not encontrada or encontrada.get('oculta'):
            raise SystemExit(f'No hay una medida anunciada «{peticion}» (se espera partido:n, por ejemplo pp:144).')
        pedidas.append((datos, encontrada))
    # `--medida` junto a `--todas-las-medidas` no dibuja dos veces la misma.
    return list({(datos['id'], m['n']): (datos, m) for datos, m in pedidas}.values())


def main():
    programas = {}
    for archivo in sorted(PROGRAMAS.glob('*.json')):
        datos = json.loads(archivo.read_text(encoding='utf-8'))
        if not datos.get('vacio') and datos.get('medidas'):
            programas[datos['id']] = datos
    pedidas = medidas_pedidas(programas)
    # Con medidas pedidas, solo se dibujan esas: la portada y los partidos no cambian.
    if pedidas:
        SALIDA_MEDIDAS.mkdir(parents=True, exist_ok=True)
        trabajos = [(f"medidas/{datos['id']}-{m['n']}", medida(datos, m)) for datos, m in pedidas]
    else:
        SALIDA.mkdir(parents=True, exist_ok=True)
        trabajos = [('portada', portada())] + [(datos['id'], partido(datos)) for datos in programas.values()]
    with sync_playwright() as p:
        navegador = p.chromium.launch()
        hoja = navegador.new_page(viewport={'width': ANCHO, 'height': ALTO})
        for nombre, contenido in trabajos:
            temporal = SALIDA / f'.{nombre.replace("/", "-")}.html'
            temporal.write_text(contenido, encoding='utf-8')
            hoja.goto(temporal.as_uri())
            hoja.evaluate('document.fonts.ready')
            hoja.screenshot(path=str(SALIDA / f'{nombre}.png'))
            # Una paleta de 256 colores basta para estas tarjetas planas y reduce el archivo a un tercio.
            imagen = Image.open(SALIDA / f'{nombre}.png').convert('RGB').quantize(256, method=Image.Quantize.MEDIANCUT)
            imagen.save(SALIDA / f'{nombre}.png', optimize=True)
            temporal.unlink()
        navegador.close()
    print(f'{len(trabajos)} imágenes en {(SALIDA_MEDIDAS if pedidas else SALIDA).relative_to(RAIZ)}')


if __name__ == '__main__':
    main()
