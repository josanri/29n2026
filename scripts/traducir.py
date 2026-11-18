"""Traducción al castellano de un programa escrito en otro idioma, en capa aparte y marcada (src/lib/translations.ts).

El texto original no se toca. El proceso tiene cuatro pasos:
  1. preparar: corta las medidas del programa en trozos (`in-NN.json`, una lista de {n, titulo, texto}).
  2. Un modelo traduce cada trozo (`out-NN.json`, la misma lista, con el título y el texto en castellano).
  3. Un segundo modelo revisa cada traducción contra el original y escribe la versión final (`rev-NN.json`).
  4. unir: junta los `rev-NN.json`, comprueba el resultado y escribe `traducciones/<id>.json`.

Comprobaciones de `unir`: las mismas medidas que el programa; ningún título vacío; el texto está vacío solo si el
original lo está; los mismos párrafos y viñetas («– »); y las mismas cifras (números, años, porcentajes).
Una diferencia para el proceso: se corrige en `rev-NN.json` y se vuelve a unir.

Uso:
  python scripts/traducir.py preparar <id> <carpeta> [<medidas por trozo>]
  python scripts/traducir.py unir <id> <carpeta> <idioma de origen>
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PROGRAMAS = RAIZ / 'src' / 'data' / '2026' / 'generales' / 'programas'
SALIDA = RAIZ / 'src' / 'data' / '2026' / 'generales' / 'traducciones'
FECHA = '2026-11-18'


def cargar(id_programa):
    programa = json.loads((PROGRAMAS / f'{id_programa}.json').read_text(encoding='utf-8'))
    return [m for m in programa['medidas'] if not m.get('oculta')]


def preparar(id_programa, carpeta, tamano):
    medidas = cargar(id_programa)
    carpeta = Path(carpeta)
    carpeta.mkdir(parents=True, exist_ok=True)
    trozos = [medidas[i:i + tamano] for i in range(0, len(medidas), tamano)]
    for numero, trozo in enumerate(trozos, start=1):
        datos = [{'n': m['n'], 'titulo': m['titulo'], 'texto': m['texto']} for m in trozo]
        (carpeta / f'in-{numero:02d}.json').write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'{len(medidas)} medidas en {len(trozos)} trozos, en {carpeta}')


def cifras(texto):
    """Los números del texto, sin espacios: «0,6 %» → «0,6», «12/2023» → «12», «2023»."""
    return sorted(re.findall(r'\d+(?:[.,]\d+)*', texto))


def parrafos(texto):
    return [p for p in texto.split('\n\n') if p.strip()]


def unir(id_programa, carpeta, idioma_origen):
    originales = {m['n']: m for m in cargar(id_programa)}
    traducidas = {}
    for archivo in sorted(Path(carpeta).glob('rev-*.json')):
        for item in json.loads(archivo.read_text(encoding='utf-8')):
            if item['n'] in traducidas:
                raise SystemExit(f'La medida {item["n"]} está en dos trozos')
            traducidas[item['n']] = item
    problemas = []
    faltan = sorted(set(originales) - set(traducidas))
    sobran = sorted(set(traducidas) - set(originales))
    if faltan:
        problemas.append(f'faltan {len(faltan)} medidas: {faltan[:15]}')
    if sobran:
        problemas.append(f'sobran medidas que no existen: {sobran[:15]}')
    for n, original in originales.items():
        t = traducidas.get(n)
        if not t:
            continue
        if not t.get('titulo', '').strip():
            problemas.append(f'{n}: título vacío')
        if bool(original['texto'].strip()) != bool(t.get('texto', '').strip()):
            problemas.append(f'{n}: el texto está vacío en uno de los dos')
        if len(parrafos(original['texto'])) != len(parrafos(t.get('texto', ''))):
            problemas.append(f'{n}: distinto número de párrafos o viñetas')
        a = cifras(original['titulo'] + ' ' + original['texto'])
        b = cifras(t.get('titulo', '') + ' ' + t.get('texto', ''))
        if a != b:
            problemas.append(f'{n}: cifras distintas {sorted((Counter(a) - Counter(b)).elements())} / {sorted((Counter(b) - Counter(a)).elements())}')
    if problemas:
        print(f'{len(problemas)} problemas:')
        for p in problemas[:80]:
            print(' -', p)
        raise SystemExit(1)
    SALIDA.mkdir(parents=True, exist_ok=True)
    resultado = {
        'id': id_programa,
        'idiomaOrigen': idioma_origen,
        'estado': 'revisada',
        'fecha': FECHA,
        'medidas': {str(n): {'titulo': t['titulo'].strip(), 'texto': t.get('texto', '').strip()} for n, t in sorted(traducidas.items())},
    }
    (SALIDA / f'{id_programa}.json').write_text(json.dumps(resultado, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'{len(traducidas)} medidas traducidas y revisadas -> {SALIDA / (id_programa + ".json")}')


if __name__ == '__main__':
    orden = sys.argv[1] if len(sys.argv) > 1 else ''
    if orden == 'preparar' and len(sys.argv) >= 4:
        preparar(sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 80)
    elif orden == 'unir' and len(sys.argv) == 5:
        unir(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        raise SystemExit(__doc__)
