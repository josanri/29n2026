# Extrae la estructura del programa del PP («Reconstrucción Nacional») usando
# las fuentes tipográficas del PDF: bloques, secciones, subapartados y medidas.
# Uso: python scripts/extract_pp.py <pdf> <salida.json>
import fitz, sys, json, re

PARA = '¶'  # marca interna de salto de párrafo


def classify(s):
    f, sz, x, y = s['font'], round(s['size']), s['bbox'][0], s['bbox'][1]
    t = s['text']
    if f == 'Montserrat-Light' and y < 50 and t.strip().isdigit():
        return None  # número de página
    if sz == 60:
        return 'blocknum' if t.strip().isdigit() else None  # comillas decorativas
    if f == 'Anth-Regular' and sz == 25: return 'blocktitle'
    if f == 'Anth-BoldItalic' and sz == 19: return 'sectnum'
    if f == 'Anth-Italic' and sz == 19: return 'italic19'
    if f == 'Anth-Bold' and sz == 18: return 'mnum'
    if f == 'Montserrat-Bold': return 'bold'
    if f == 'Montserrat-Italic': return 'quote'
    if sz == 11: return 'text'
    return 'other'


def read_pages(path):
    d = fitz.open(path)
    pages = []
    for p in d:
        spans = []
        for b in p.get_text('dict')['blocks']:
            for l in b.get('lines', []):
                for s in l['spans']:
                    if not s['text'].strip(): continue
                    k = classify(s)
                    if k:
                        spans.append(dict(k=k, t=s['text'], x=s['bbox'][0], y=s['bbox'][1]))
        # agrupa por filas (tolerancia 6 pt) y ordena cada fila por x
        spans.sort(key=lambda s: s['y'])
        rows = []
        for s in spans:
            if rows and abs(rows[-1][0]['y'] - s['y']) < 6 and s['k'] != 'quote' and rows[-1][0]['k'] != 'quote':
                rows[-1].append(s)
            else:
                rows.append([s])
        pages.append([s for r in rows for s in sorted(r, key=lambda s: s['x'])])
    return pages


def join(parts):
    out = ''
    for t in parts:
        if t == PARA:
            out = out.rstrip() + PARA
            continue
        t = t.replace('\t', ' ')
        o = out.rstrip(); s0 = t.lstrip()[:1]
        if o.endswith('-') and len(o) > 1 and o[-2].isalpha() and s0.isalpha():
            out = o[:-1] + t.lstrip()  # guion de partición de línea
        elif o.endswith('-') and s0.isdigit():
            out = o + t.lstrip()
        else:
            if out and not out.endswith((' ', PARA)): out += ' '
            out += t.strip()
            if t.endswith(' '): out += ' '
    out = re.sub(r'[ \t]+', ' ', out)
    out = re.sub(r' ?' + PARA + ' ?', '\n\n', out)
    return out.strip()


def build(pages):
    blocks = []; cur_block = cur_sect = cur_m = None
    mode = None; last_title_y = None
    for pi, spans in enumerate(pages):
        pg = pi + 1
        if pg < 8 or pg > 80: continue
        last_y = None
        for s in spans:
            k, t = s['k'], s['t']
            if k == 'text':
                if last_y is not None and s['y'] - last_y > 20:
                    tgt = None
                    if mode == 'blockintro': tgt = cur_block['intro']
                    elif mode == 'mbody' and cur_m: tgt = cur_m['body']
                    elif mode == 'groupintro': tgt = cur_sect['groups'][-1]['intro']
                    if tgt and tgt[-1] != PARA: tgt.append(PARA)
                last_y = s['y']
            elif k in ('blocktitle', 'sectnum', 'mnum'):
                last_y = None

            if k in ('blocktitle', 'blocknum'):
                if cur_block is None or cur_block['page'] != pg:
                    cur_block = dict(title=[], num=None, slogan=[], quote=[], intro=[], sections=[], page=pg)
                    blocks.append(cur_block); cur_sect = cur_m = None
                if k == 'blocktitle': cur_block['title'].append(t)
                else: cur_block['num'] = t.strip()
                mode = 'blockintro'
            elif k == 'italic19' and mode == 'blockintro' and s['x'] < 60:
                cur_block['slogan'].append(t)
            elif k == 'italic19' and t.strip() == 'Por fin.':
                cur_block['intro'] += [PARA, t]
            elif k == 'quote':
                cur_block['quote'].append(t)
            elif k == 'sectnum':
                cur_sect = dict(num=t.strip(), title=[], intro=[], groups=[], measures=[], page=pg)
                cur_block['sections'].append(cur_sect); cur_m = None
                mode = 'secttitle'; last_title_y = s['y']
            elif k == 'italic19':
                if mode == 'secttitle' and s['y'] - last_title_y < 25:
                    cur_sect['title'].append(t); last_title_y = s['y']
                elif re.match(r'(Permanezca|atento|campa|conocer|nueva medida)', t.strip()):
                    pass  # medida pendiente de anunciar
                else:
                    # rótulo de subapartado en la columna izquierda
                    if mode not in ('grouplabel', 'groupintro'):
                        cur_sect['groups'].append(dict(label=[], intro=[]))
                    cur_sect['groups'][-1]['label'].append(t)
                    if mode != 'groupintro': mode = 'grouplabel'
            elif k == 'mnum':
                cur_m = dict(n=int(t.strip()), title=[], body=[], page=pg,
                             group=len(cur_sect['groups']) - 1 if cur_sect['groups'] else None)
                cur_sect['measures'].append(cur_m); mode = 'mtitle'
            elif k == 'bold':
                if mode == 'mtitle': cur_m['title'].append(t)
                elif cur_m: cur_m['body'].append(t)
            elif k == 'text':
                if mode == 'blockintro': cur_block['intro'].append(t)
                elif mode in ('grouplabel', 'groupintro'):
                    cur_sect['groups'][-1]['intro'].append(t); mode = 'groupintro'
                elif mode == 'secttitle': cur_sect['intro'].append(t)
                elif cur_m: cur_m['body'].append(t); mode = 'mbody'
    return blocks


def main():
    blocks = build(read_pages(sys.argv[1]))
    out = dict(blocks=[])
    for b in blocks:
        ob = dict(num=b['num'], title=join(b['title']), slogan=join(b['slogan']), quote=join(b['quote']),
                  intro=join(b['intro']), page=b['page'], sections=[])
        for s in b['sections']:
            ob['sections'].append(dict(
                num=s['num'], title=join(s['title']), intro=join(s['intro']), page=s['page'],
                groups=[dict(label=join(g['label']), intro=join(g['intro'])) for g in s['groups']],
                measures=[dict(n=m['n'], title=join(m['title']), body=join(m['body']), page=m['page'],
                               group=m['group'], hidden=not m['title']) for m in s['measures']]))
        out['blocks'].append(ob)
    # un párrafo de introducción de subapartado puede quedar pegado al final de
    # la medida anterior (empieza antes del rótulo): se mueve a su sitio
    for b in out['blocks']:
        for s in b['sections']:
            ms = s['measures']
            for a, nx in zip(ms, ms[1:]):
                if nx['group'] is not None and nx['group'] != a['group'] and '\n\n' in a['body']:
                    head, tail = a['body'].rsplit('\n\n', 1)
                    if not tail.rstrip().endswith(('.', ':', '»')):
                        a['body'] = head
                        g = s['groups'][nx['group']]
                        g['intro'] = tail.strip() + ' ' + g['intro']
    json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
