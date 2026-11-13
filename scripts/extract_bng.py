# Extrae la estructura del programa del BNG (Xerais 29N 2026, en gallego).
# El PDF usa fuentes Type3 sin nombre: la estructura se deduce del tamaño,
# la sangría y la numeración de cada línea.
#   - tamaño 24            → capítulo (bloque)
#   - "N.N TÍTULO" x≈189   → sección
#   - "N.N.N", "N)", "a)"  → subapartado
#   - x≈201                → viñeta = una propuesta (el BNG no numera: numeración propia)
#   - x≥215                → subviñeta: se añade a la propuesta que la introduce
#   - x≈189 resto          → texto de introducción
# Uso: python scripts/extract_bng.py <pdf> <salida.json>
import fitz, sys, json, re, os

SECCION = re.compile(r'^(\d+\.\d+)\s*\.?\s+(\S.*)$')
SUBAP = re.compile(r'^(\d+\.\d+\.\d+\.?|\d\)|[a-z]\))\s+(\S.*)$')
PARA = '¶'


def lineas(doc):
    """Devuelve (página, x, y, tamaño, texto) de cada línea, en orden de lectura."""
    out = []
    for pi, p in enumerate(doc):
        ls = []
        for b in p.get_text('dict')['blocks']:
            for l in b.get('lines', []):
                t = ''.join(s['text'] for s in l['spans']).strip()
                if not t:
                    continue
                sz = round(l['spans'][0]['size'])
                if sz == 10 and re.search(r'·\s*\d+\s*$', t):
                    continue  # pie de página
                ls.append((pi + 1, round(l['bbox'][0]), round(l['bbox'][1]), sz, t))
        ls.sort(key=lambda r: (r[2], r[1]))
        out += ls
    return out


def unir(partes):
    out = ''
    for t in partes:
        if t == PARA:
            out = out.rstrip() + PARA
            continue
        o = out.rstrip()
        if o.endswith('-') and len(o) > 1 and o[-2].isalpha() and t[:1].islower():
            out = o[:-1] + t
        else:
            if out and not out.endswith(PARA):
                out += ' '
            out += t
    out = re.sub(r'[ \t]+', ' ', out)
    return re.sub(r' ?' + PARA + ' ?', '\n\n', out).strip()


def main():
    doc = fitz.open(sys.argv[1])
    L = lineas(doc)
    bloques = []
    presentacion = []
    b = s = m = None
    modo = None
    ult = None  # (página, y) de la línea anterior

    def nueva_seccion(num, titulo, pg):
        nonlocal s, m
        s = dict(num=num, title=[titulo], intro=[], groups=[], measures=[], page=pg)
        b['sections'].append(s)
        m = None

    for pg, x, y, sz, t in L:
        if pg <= 3:
            continue
        hueco = (y - ult[1]) if ult and ult[0] == pg else 99
        ult = (pg, y)

        if sz >= 20:  # título de capítulo (puede ocupar varias líneas)
            if t == 'INTRODUCIÓN':
                modo = 'presentacion'
                continue
            if modo == 'cap_titulo' and hueco < 40:
                b['title'].append(t)
                continue
            mm = re.match(r'^(\d+)\.\s+(.*)$', t)
            b = dict(num=mm.group(1), title=[mm.group(2)], intro=[], sections=[], page=pg)
            bloques.append(b)
            s = m = None
            modo = 'cap_titulo'
            continue

        if modo == 'presentacion':
            if hueco > 20 and presentacion:
                presentacion.append(PARA)
            presentacion.append(t)
            continue

        ms = SECCION.match(t) if x < 195 else None
        if ms and re.match(r'[A-ZÁÉÍÓÚÑ]', ms.group(2)) and int(ms.group(1).split('.')[0]) == int(b['num']):
            nueva_seccion(ms.group(1), ms.group(2), pg)
            modo = 'sec_titulo'
            continue
        if modo == 'sec_titulo' and x < 195 and hueco < 18 and t.isupper():
            s['title'].append(t)  # título de sección en dos líneas
            continue

        if s is None and x < 195 and SUBAP.match(t):
            # capítulo sin secciones que empieza por un subapartado («1) En materia…»)
            nueva_seccion(b['num'], ' '.join(b['title']), pg)
            s['implicita'] = True

        if s is None and x < 195 and not b['sections']:
            # capítulo sin secciones: texto previo a la primera viñeta = introducción del capítulo
            if modo == 'cap_titulo' or modo == 'cap_intro':
                if hueco > 20 and b['intro']:
                    b['intro'].append(PARA)
                b['intro'].append(t)
                modo = 'cap_intro'
                continue

        if s is None:
            # primera viñeta de un capítulo sin secciones: sección implícita con el título del capítulo
            nueva_seccion(b['num'], ' '.join(b['title']), pg)
            s['implicita'] = True

        msub = SUBAP.match(t) if x < 195 else None
        if msub:
            s['groups'].append(dict(label=[t], intro=[]))
            m = None
            modo = 'grupo'
            continue

        if x < 195:
            # texto normal: introducción de la sección o del subapartado
            if modo == 'grupo' and hueco < 18 and not s['groups'][-1]['intro']:
                s['groups'][-1]['label'].append(t)
                continue
            if s['measures'] and modo in ('item', 'subitem'):
                # texto entre listas: abre un subapartado sin rótulo
                s['groups'].append(dict(label=[], intro=[t]))
                modo = 'grupo_intro'
                m = None
                continue
            tgt = s['groups'][-1]['intro'] if s['groups'] else s['intro']
            if hueco > 20 and tgt:
                tgt.append(PARA)
            tgt.append(t)
            if modo == 'grupo':
                modo = 'grupo_intro'
            continue

        if x < 215:  # viñeta principal
            if m is None or hueco > 17 or modo == 'subitem':
                m = dict(body=[t], subs=[], page=pg, group=len(s['groups']) - 1 if s['groups'] else None)
                s['measures'].append(m)
            else:
                m['body'].append(t)
            modo = 'item'
            continue

        # subviñeta
        if m is None:
            m = dict(body=[], subs=[], page=pg, group=len(s['groups']) - 1 if s['groups'] else None)
            s['measures'].append(m)
        if modo != 'subitem' or hueco > 17:
            m['subs'].append([t])
        else:
            m['subs'][-1].append(t)
        modo = 'subitem'

    # Secciones sin viñetas (capítulo 8): cada párrafo tras el primero es una propuesta
    # con título propio («Dereito de veto algorítmico. Prohibir…»).
    for b in bloques:
        for s in b['sections']:
            if s['measures'] or s['groups']:
                continue
            pars, cur = [], []
            for t in s['intro']:
                if t == PARA:
                    pars.append(cur); cur = []
                else:
                    cur.append(t)
            if cur:
                pars.append(cur)
            if len(pars) < 3:
                continue
            s['intro'] = pars[0]
            for p in pars[1:]:
                s['measures'].append(dict(body=p, subs=[], page=s['page'], group=None, titulada=True))

    # numeración propia y salida
    n = 0
    out = dict(presentacion=unir(presentacion), blocks=[])
    for b in bloques:
        ob = dict(num=b['num'], title=unir(b['title']), slogan='', quote='', intro=unir(b['intro']),
                  page=b['page'], sections=[])
        for s in b['sections']:
            os_ = dict(num=s['num'], title=unir(s['title']), intro=unir(s['intro']), page=s['page'],
                       implicita=s.get('implicita', False),
                       groups=[dict(label=unir(g['label']).rstrip(':'), intro=unir(g['intro'])) for g in s['groups']],
                       measures=[])
            for m in s['measures']:
                n += 1
                cuerpo = unir(m['body'])
                subs = [unir(x) for x in m['subs']]
                titulo = ''
                if m.get('titulada'):
                    mt = re.match(r'^(.{6,110}?)\.\s+(?=[A-ZÁÉÍÓÚÑ])', cuerpo)
                    if mt:
                        titulo, cuerpo = mt.group(1), cuerpo[mt.end():]
                os_['measures'].append(dict(n=n, title=titulo, body=cuerpo, subs=subs, page=m['page'],
                                            group=m['group'], hidden=False))
            ob['sections'].append(os_)
        out['blocks'].append(ob)
    # the intermediate file goes to an ignored folder (.cache/<año>/<tipo>/), which may not exist yet
    os.makedirs(os.path.dirname(sys.argv[2]) or '.', exist_ok=True)
    json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('capítulos', len(bloques), 'secciones', sum(len(b['sections']) for b in bloques), 'propuestas', n)


if __name__ == '__main__':
    main()
