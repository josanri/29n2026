"""Dibuja las piezas para redes de un debate a dos: foto de Instagram (1080 × 1350), imagen de X (1600 × 900) y reel
vertical (1080 × 1920, MP4 de unos 12 s).

Mismo estilo que `og_stories.py` (marco de color, tarjeta blanca, cifras grandes), pero neutro: el marco va mitad del
color de un candidato y mitad del otro, y cada cifra lleva el color de su candidato. Las cifras salen del JSON del
debate (`src/data/<eleccion>/debates/<slug>.json`): tiempo de palabra, palabras, interrupciones y el tema más citado.

Uso: python scripts/og_debate.py <slug> [--sin-reel]
Salida: stories/<slug>-instagram.png, stories/<slug>-x.png y stories/<slug>-reel.mp4 (fuera de `public/`).
Requiere: playwright con chromium, `npm install` (las fuentes) y ffmpeg para el reel.
"""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
DEBATES = RAIZ / 'src' / 'data' / '2026' / 'generales' / 'debates'
PROGRAMAS = RAIZ / 'src' / 'data' / '2026' / 'generales' / 'programas'
SALIDA = RAIZ / 'stories'
FUENTES = RAIZ / 'node_modules'
FPS = 30
REEL_SEGUNDOS = 12
MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
         'noviembre', 'diciembre']


def fuente(familia, archivo, peso):
    return f"@font-face{{font-family:{familia};src:url({(FUENTES / archivo).as_uri()}) format('woff2');font-weight:{peso};}}"


CSS_FUENTES = ''.join([
    fuente('Archivo', '@fontsource-variable/archivo/files/archivo-latin-ext-wght-normal.woff2', '100 900'),
    fuente('Archivo', '@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2', '100 900'),
    fuente('BSD', '@fontsource/big-shoulders-display/files/big-shoulders-display-latin-ext-900-normal.woff2', 900),
    fuente('BSD', '@fontsource/big-shoulders-display/files/big-shoulders-display-latin-900-normal.woff2', 900),
])


def numero(valor, decimales=0):
    texto = f'{valor:,.{decimales}f}'
    return texto.replace(',', ' ').replace('.', ',').replace(' ', '.')


def datos(slug):
    debate = json.loads((DEBATES / f'{slug}.json').read_text(encoding='utf-8'))
    candidatos = [s for s in debate['speakers'] if s.get('partyId')]
    if len(candidatos) != 2:
        raise SystemExit(f'{slug}: estas piezas son para debates a dos; hay {len(candidatos)} candidatos')
    for c in candidatos:
        programa = json.loads((PROGRAMAS / f"{c['partyId']}.json").read_text(encoding='utf-8'))
        c['color'] = programa['color']
        c['apellido'] = c['name'].split()[-1]
    a, b = candidatos
    tema = max(debate['topics'], key=lambda t: t['total'])
    _, mes, dia = debate['date'].split('-')
    filas = [
        {'a': a['minutes'], 'b': b['minutes'], 'dec': 1, 'txt': 'minutos de palabra'},
        {'a': a['words'], 'b': b['words'], 'dec': 0, 'txt': 'palabras'},
        {'a': a['cutsMade'], 'b': b['cutsMade'], 'dec': 0, 'txt': 'interrupciones*'},
    ]
    return {
        'a': a, 'b': b, 'filas': filas,
        'tema': {'n': tema['total'], 'txt': f"menciones de {tema['label'].lower()}: el tema más citado"},
        'fecha': f'{int(dia)} de {MESES[int(mes) - 1]}',
        'canal': debate.get('channel', ''),
    }


def pagina(d, formato):
    """HTML de una pieza. `window.pintar(t)` deja la pieza en el instante t (0..1); 1 es la imagen fija."""
    a, b = d['a'], d['b']
    filas = ''.join(
        f'''<div class="fila" data-i="{i}">
              <span class="num" style="--c:{a['color']}" data-v="{f['a']}" data-dec="{f['dec']}">{numero(f['a'], f['dec'])}</span>
              <span class="num" style="--c:{b['color']}" data-v="{f['b']}" data-dec="{f['dec']}">{numero(f['b'], f['dec'])}</span>
              <span class="txt">{f['txt']}</span></div>'''
        for i, f in enumerate(d['filas']))
    n = len(d['filas'])
    filas += f'''<div class="fila fila--tema" data-i="{n}">
              <span class="num num--solo" data-v="{d['tema']['n']}" data-dec="0">{d['tema']['n']}</span>
              <span class="txt">{d['tema']['txt']}</span></div>'''
    medidas = {
        'instagram': dict(w=1080, h=1350, marco=44, pad='56px 62px 44px', wm=60, titulo=172, sub=40, num=104, col=236,
                          txt=34, nota=22, pie=28),
        'reel': dict(w=1080, h=1920, marco=44, pad='120px 62px 110px', wm=64, titulo=200, sub=42, num=112, col=240,
                     txt=36, nota=24, pie=30),
        'x': dict(w=1600, h=900, marco=36, pad='44px 52px 34px', wm=48, titulo=150, sub=32, num=82, col=200,
                  txt=29, nota=19, pie=24),
    }[formato]
    m = medidas
    ancho = formato == 'x'
    return f"""<!doctype html><html lang="es"><meta charset="utf-8"><style>{CSS_FUENTES}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ width: {m['w']}px; height: {m['h']}px; padding: {m['marco']}px; font-family: Archivo, sans-serif; color: #000;
        background: linear-gradient(90deg, {a['color']} 50%, {b['color']} 50%); overflow: hidden; }}
.card {{ height: 100%; display: flex; flex-direction: column; padding: {m['pad']}; background: #fff; border: 8px solid #000; }}
.cuerpo {{ display: {'grid' if ancho else 'block'}; grid-template-columns: 0.9fr 1.1fr; gap: 0 56px; align-items: start; }}
.wm {{ display: flex; align-items: center; font: 900 {m['wm']}px/1 BSD; letter-spacing: .01em; }}
.dot {{ width: .675em; height: .675em; margin: 0 .075em; border: .07em solid #000; border-radius: 50%;
        background: linear-gradient(90deg, {a['color']} 50%, {b['color']} 50%); }}
.titulo {{ font: 900 {m['titulo']}px/.88 BSD; margin-top: 18px; letter-spacing: .005em; }}
.sub {{ font: 700 {m['sub']}px/1.18 Archivo; color: #3a3a3a; margin: 20px 0 26px; }}
.quien {{ display: flex; gap: 28px; flex-wrap: wrap; font: 800 {m['txt']}px/1.1 Archivo; margin-bottom: 22px; }}
.quien span {{ display: inline-flex; align-items: center; gap: 12px; }}
.quien i {{ width: .8em; height: .8em; border: 4px solid #000; }}
.fila {{ display: flex; align-items: flex-end; padding: 12px 0 10px; border-top: 7px solid #000; }}
.num {{ flex: 0 0 {m['col']}px; font: 900 {m['num']}px/.95 BSD; color: #000; font-variant-numeric: tabular-nums;
        box-shadow: inset 0 -.11em 0 var(--c); padding-bottom: 6px; margin-right: 22px; }}
.num--solo {{ flex-basis: {m['col'] * 2 + 22}px; box-shadow: none; }}
.txt {{ font: 800 {m['txt']}px/1.12 Archivo; padding-bottom: 12px; }}
.nota {{ margin-top: 14px; font: 600 {m['nota']}px/1.3 Archivo; color: #3a3a3a; }}
.pie {{ margin-top: auto; display: flex; justify-content: space-between; align-items: center; gap: 24px;
        padding-top: 22px; border-top: 7px solid #000; font: 800 {m['pie']}px Archivo; }}
.url {{ padding: 8px 22px; background: #000; color: #fff; white-space: nowrap; }}
.cta {{ display: {'block' if formato == 'reel' else 'none'}; margin-top: 34px; padding: 22px 26px; border: 7px solid #000;
        font: 800 38px/1.2 Archivo; }}
.cta b {{ display: block; font: 900 64px/1 BSD; text-transform: uppercase; margin-bottom: 8px; }}
</style><body><div class="card">
  <div class="cuerpo">
    <div class="cabeza">
      <div class="wm">ELECT<span class="dot"></span>SFERA</div>
      <div class="titulo">{'CARA A CARA' if formato == 'instagram' else 'CARA<br>A CARA'}</div>
      <div class="sub">{a['apellido']} y {b['apellido']} · {d['fecha']}</div>
    </div>
    <div class="datos">
      <div class="quien"><span><i style="background:{a['color']}"></i>{a['name']}</span><span><i style="background:{b['color']}"></i>{b['name']}</span></div>
      {filas}
      <p class="nota">* Estimación a partir del audio: cambios de turno con voces a la vez o frases cortadas.</p>
      <div class="cta"><b>Lee el debate entero</b>Transcripción completa, con buscador y filtros por tema y por candidato.</div>
    </div>
  </div>
  <div class="pie"><span>Elecciones generales · 29N</span><span class="url">electosfera.es</span></div>
</div>
<script>
const fmt = (v, dec) => v.toLocaleString('es-ES', {{ minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: 'always' }});
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
// Reel: el título entra primero; después cada fila aparece y cuenta hasta su cifra; al final, la llamada a la web.
window.pintar = (t) => {{
  const show = (el, p, dy = 40) => {{ el.style.opacity = ease(p); el.style.transform = `translateY(${{(1 - ease(p)) * dy}}px)`; }};
  show(document.querySelector('.titulo'), t / 0.08);
  show(document.querySelector('.sub'), (t - 0.05) / 0.08);
  show(document.querySelector('.quien'), (t - 0.1) / 0.08);
  document.querySelectorAll('.fila').forEach((fila, i) => {{
    const inicio = 0.16 + i * 0.13;
    show(fila, (t - inicio) / 0.06);
    fila.querySelectorAll('.num').forEach((num) => {{
      num.textContent = fmt(Number(num.dataset.v) * ease((t - inicio) / 0.11), Number(num.dataset.dec));
    }});
  }});
  show(document.querySelector('.nota'), (t - 0.7) / 0.06, 0);
  show(document.querySelector('.cta'), (t - 0.76) / 0.08);
}};
</script></body></html>"""


def main():
    argumentos = [x for x in sys.argv[1:] if not x.startswith('--')]
    if len(argumentos) != 1:
        raise SystemExit(__doc__)
    slug = argumentos[0]
    d = datos(slug)
    SALIDA.mkdir(exist_ok=True)
    with sync_playwright() as p, tempfile.TemporaryDirectory() as tmp:
        navegador = p.chromium.launch()
        formatos = ['instagram', 'x'] + ([] if '--sin-reel' in sys.argv else ['reel'])
        for formato in formatos:
            w, h = {'instagram': (1080, 1350), 'x': (1600, 900), 'reel': (1080, 1920)}[formato]
            hoja = navegador.new_page(viewport={'width': w, 'height': h})
            html = Path(tmp) / f'{formato}.html'
            html.write_text(pagina(d, formato), encoding='utf-8')
            hoja.goto(html.as_uri())
            hoja.evaluate('document.fonts.ready')
            if formato != 'reel':
                hoja.evaluate('window.pintar(1)')
                destino = SALIDA / f'{slug}-{formato}.png'
                hoja.screenshot(path=str(destino))
            else:
                total = FPS * REEL_SEGUNDOS
                for i in range(total):
                    # La animación dura el 80 % del reel; el resto, la imagen final quieta para leerla.
                    hoja.evaluate(f'window.pintar({min(1, i / (total * 0.8))})')
                    hoja.screenshot(path=str(Path(tmp) / f'f{i:04d}.png'))
                destino = SALIDA / f'{slug}-reel.mp4'
                subprocess.run([
                    'ffmpeg', '-y', '-loglevel', 'error',
                    '-framerate', str(FPS), '-i', str(Path(tmp) / 'f%04d.png'),
                    '-vf', 'scale=out_color_matrix=bt709:out_range=tv',
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
                    '-profile:v', 'main', '-level:v', '4.0', '-g', str(FPS * 2),
                    '-r', str(FPS), '-pix_fmt', 'yuv420p',
                    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
                    '-movflags', '+faststart', str(destino),
                ], check=True)
            hoja.close()
            print(destino.relative_to(RAIZ))
        navegador.close()


if __name__ == '__main__':
    main()
