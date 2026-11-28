"""Extract the 16 commitments of the PSC manifesto for 29N 2026 («La força de Catalunya»).

PDF «Manifest del Partit dels Socialistes de Catalunya. Eleccions Generals 29N 2026» (8 pages,
creationDate 2026-11-16), published at
https://www.socialistes.cat/wp-content/uploads/2026/11/Manifest-Generals-2026_DEF.pdf.

The manifesto is written in prose in Catalan and structured in thematic sections. Each commitment is
a literal passage from the PDF, verified against the extracted text, with an editorial short title
in Catalan.

Usage: python scripts/extract_psc.py PDF JSON [--depurar ARCHIVO]
"""
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz
from clasificacion import completar

PAGINAS = 8
FUENTE = 'https://www.socialistes.cat/wp-content/uploads/2026/11/Manifest-Generals-2026_DEF.pdf'

BLOQUES = [
    (1, 'Quatre compromisos per a la majoria social', 'Drets que es puguin exercir', 3,
     'Quatre compromisos prioritaris per a la pròxima legislatura: habitatge, salaris i pensions, sanitat i cures, i finançament just.'),
    (2, 'Defensar Catalunya: més autogovern i més benestar', 'El catalanisme que suma', 4,
     'Federalisme, reforma constitucional, traspàs de Rodalies, ampliació de l’aeroport del Prat, condonació del FLA i llengües oficials.'),
    (3, 'Drets, llibertats i pau', 'La convivència també és un dret', 5,
     'Igualtat, protecció contra la violència masclista, drets LGBTI, llibertats digitals i política exterior multilateral.'),
    (4, 'Enfortir allò que és públic', 'Educació, pensions i fiscalitat justa', 6,
     'Defensa dels serveis públics, del sistema públic de pensions i d’una fiscalitat justa i progressiva.'),
]

# (bloque, pagina, titulo_editorial, categoria, inicio_literal, fin_literal)
COMPROMISOS = [
    (1, 3, 'Protegir els llogaters, construir habitatge públic i regular les zones tensionades', 'vivienda',
     'Volem protegir els llogaters i les llogateres, prorrogant els contractes',
     'També defensarem la regulació de les zones tensionades i combatrem els especuladors.'),
    (1, 4, 'Pujar el salari mínim, reduir la jornada a 37,5 hores i revalorar les pensions amb l’IPC', 'empleo',
     'Per això volem continuar apujant el salari mínim perquè no es quedi enrere',
     'i garantir que les pensions es revalorin d’acord amb l’IPC.'),
    (1, 4, 'Combatre la precarietat juvenil i ampliar la formació professional', 'educacion',
     'Volem combatre la precarietat i la temporalitat, que pesen sobretot sobre els joves:',
     'facilitant que puguin continuar aprenent al llarg de tota la vida laboral.'),
    (1, 4, 'Reforçar l’atenció primària, la salut mental i l’atenció a la dependència', 'sanidad',
     'Reforçarem l’atenció primària, reduirem les esperes sanitàries',
     'i perquè aquesta responsabilitat no recaigui sobre les famílies i, sobretot, sobre les dones.'),
    (1, 4, 'Impulsar un finançament singular que respecti el principi d’ordinalitat', 'territorio',
     'El nou model de finançament que s’ha impulsat des de Catalunya suposaria 4.686 milions',
     'Catalunya ha de disposar dels recursos necessaris per atendre la seva ciutadania i exercir plenament el seu autogovern.'),
    (2, 5, 'Defensar una reforma constitucional d’orientació social i federal', 'territorio',
     'Volem una Espanya que reconegui la seva diversitat, on les decisions es comparteixin',
     'Defensem una reforma constitucional que consolidi aquesta orientació social i federal.'),
    (2, 5, 'Culminar el traspàs de Rodalies amb empresa mixta i més inversió', 'infraestructuras',
     'Volem culminar el traspàs de Rodalies perquè el servei sigui fiable, segur i de qualitat',
     'trens renovats, millor manteniment i una gestió més propera.'),
    (2, 5, 'Fer realitat l’ampliació pactada de l’aeroport del Prat', 'infraestructuras',
     'I volem fer realitat l’ampliació de l’aeroport del Prat, pactada entre la Generalitat',
     'tot fent-la compatible amb la protecció dels espais naturals.'),
    (2, 5, 'Condonar el deute del FLA i garantir l’execució de les inversions compromeses', 'territorio',
     'Volem també la condonació del deute autonòmic vinculat al FLA',
     's’executin i tinguin un seguiment públic.'),
    (2, 5, 'Defensar les llengües oficials a l’Estat i el reconeixement del català a Europa', 'identidad',
     'Defensarem l’ús de les llengües oficials de les comunitats autònomes en l’activitat ordinària',
     'Volem que la ciutadania es pugui adreçar a l’Administració en la seva llengua materna.'),
    (3, 5, 'Blindar el dret de les dones a decidir, la igualtat salarial i la protecció contra la violència masclista', 'social',
     'Ens comprometem a blindar el dret de les dones a decidir sobre el seu cos',
     'amb serveis estables i ben dotats a tot el territori.'),
    (3, 5, 'Defensar els drets LGBTI i perseguir els delictes d’odi i el racisme', 'social',
     'Defensarem els drets de les persones LGBTI i perseguirem els delictes d’odi,',
     'que fan servir la por, el racisme i l’odi com a eina política.'),
    (3, 5, 'Protegir les llibertats civils i regular democràticament les plataformes digitals', 'democracia',
     'Defensarem la llibertat d’expressió, la privacitat, la independència dels mitjans',
     'calen regles democràtiques, transparència i institucions fortes.'),
    (3, 6, 'Política exterior multilateral amb suport a Ucraïna i a la població palestina', 'exterior',
     'Volem una política exterior coherent, basada en el multilateralisme i no en la llei del més fort.',
     'sostingui l’ajuda humanitària i treballi per una pau justa i duradora.'),
    (4, 6, 'Enfortir l’educació pública i blindar el sistema públic de pensions', 'social',
     'L’educació pública, des de l’escola fins a la universitat i la formació professional,',
     'No poden convertir-se en un negoci privat ni quedar a mercè dels interessos financers.'),
    (4, 6, 'Defensar una fiscalitat justa i rebutjar regals fiscals per als més rics', 'fiscalidad',
     'També defensem una fiscalitat justa. No podem acceptar que es faci creure',
     'sinó dels drets que compartim.'),
]

CIFRAS = [
    (2, 'reduir la jornada laboral a 37,5 hores sense pèrdua de sou', '37,5 hores', 'setmanals',
     'Reducció de la jornada laboral a 37,5 hores sense pèrdua de sou'),
    (5, '4.686 milions d’euros addicionals l’any', '4.686 M€', 'addicionals l’any',
     'Recursos addicionals del nou model de finançament per a Catalunya'),
    (5, 'uns 1.700 euros més per habitant', '1.700 €', 'per habitant',
     'Increment estimat per habitant del nou model de finançament'),
]


def limpiar_pagina(texto):
    texto = texto.replace('\u00ad', '').replace('\ufb01', 'fi').replace('\ufb02', 'fl').replace('\u00a0', ' ')
    texto = unicodedata.normalize('NFC', texto)
    lineas = []
    for linea in texto.splitlines():
        s = linea.strip()
        if not s or s.isdigit() or s.startswith('MANIFEST DEL PARTIT DELS SOCIALISTES DE CATALUNYA'):
            continue
        lineas.append(s)
    unido = ''
    for linea in lineas:
        if unido.endswith('-') and linea[:1].islower():
            unido = unido[:-1] + linea
        else:
            unido = f'{unido} {linea}'.strip()
    return re.sub(r'\s+', ' ', unido).strip()


def extraer(pdf):
    doc = fitz.open(pdf)
    if len(doc) != PAGINAS:
        raise ValueError(f'Se esperaban {PAGINAS} páginas; el PDF tiene {len(doc)}')
    completo = ' '.join(limpiar_pagina(doc[i].get_text()) for i in range(1, 7))

    bloques, secciones, medidas = [], [], []
    for bid, titulo, lema, pagina, intro in BLOQUES:
        bloques.append({
            'id': bid,
            'titulo': titulo,
            'tituloMayus': titulo.upper(),
            'lema': lema,
            'cita': '',
            'intro': intro,
            'pagina': pagina,
        })
        secciones.append({
            'id': str(bid),
            'bloque': bid,
            'titulo': titulo,
            'tituloFrase': titulo,
            'intro': intro,
            'pagina': pagina,
            'subapartados': [],
        })

    for n, (bid, pagina, titulo, categoria, inicio, fin) in enumerate(COMPROMISOS, 1):
        i = completo.find(inicio)
        if i == -1:
            raise ValueError(f'No se encontró el inicio de la medida {n}: {inicio!r}')
        j = completo.find(fin, i)
        if j == -1:
            raise ValueError(f'No se encontró el final de la medida {n}: {fin!r}')
        texto = completo[i:j + len(fin)].strip()
        medida = {
            'n': n,
            'bloque': bid,
            'seccion': str(bid),
            'pagina': pagina,
            'subapartado': None,
            'titulo': titulo,
            'tituloFrase': titulo,
            'texto': texto,
            'oculta': False,
            'categoria': categoria,
            'colectivos': [],
            'palancas': [],
            'territorios': [],
            'cifras': [],
            'plazo': None,
            'deroga': None,
        }
        completar(medida)
        medidas.append(medida)

    cifras = []
    for n, contexto, valor, unidad, resumen in CIFRAS:
        medida = medidas[n - 1]
        if contexto not in medida['texto']:
            raise ValueError(f'La cifra {contexto!r} no está en la medida {n}')
        medida['cifras'].append(contexto)
        cifras.append({
            'valor': valor,
            'unidad': unidad,
            'texto': resumen,
            'contexto': contexto,
            'medida': n,
        })

    intro_i = completo.find('El 29 de novembre ens trobem en una cruïlla històrica')
    intro_j = completo.find('La força de la gent ho impedirà.') + len('La força de la gent ho impedirà.')
    presentacion = completo[intro_i:intro_j].strip()

    return {
        'id': 'psc',
        'partido': 'Partit dels Socialistes de Catalunya',
        'siglas': 'PSC',
        'comunidad': 'Cataluña',
        'color': '#E10819',
        'colorClaro': '#FDE7E8',
        'programa': 'La força de Catalunya',
        'subtitulo': 'Manifest del Partit dels Socialistes de Catalunya per a les Eleccions Generals 29N 2026',
        'elecciones': 'Eleccions generals · 29 de novembre de 2026',
        'pdf': '/programas/psc-la-forca-de-catalunya-2026.pdf',
        'fuentePdf': FUENTE,
        'paginas': len(doc),
        'fechaPdf': '2026-11-16',
        'observaciones': [
            'El PSC publica un manifest electoral propi en català (8 pàgines) i remet al final al programa estatal del PSOE per al 29N.',
            'El document està escrit en prosa sense mesures numerades: cada compromís és un passatge literal del manifest amb un títol curt editorial.',
        ],
        'unidadMedida': 'compromiso',
        'unidadMedidas': 'compromisos',
        'presentacion': {
            'titulo': 'La força de Catalunya',
            'texto': presentacion,
        },
        'cifras': cifras,
        'plazos': [],
        'ordenPlazos': [],
        'verbos': [],
        'bloques': bloques,
        'secciones': secciones,
        'medidas': medidas,
    }


def main():
    args = sys.argv[1:]
    depurar_path = None
    if '--depurar' in args:
        idx = args.index('--depurar')
        depurar_path = args[idx + 1]
        del args[idx:idx + 2]
    programa = extraer(args[0])
    with open(args[1], 'w', encoding='utf-8') as out:
        json.dump(programa, out, ensure_ascii=False, indent=1)
        out.write('\n')
    if depurar_path:
        with open(depurar_path, 'w', encoding='utf-8') as out:
            for m in programa['medidas']:
                out.write(f"[{m['n']}] p.{m['pagina']} {m['categoria']} | {m['titulo']}\n  {m['texto']}\n\n")
    print('páginas', programa['paginas'], 'compromisos', len(programa['medidas']))
    print('categorías', Counter(m['categoria'] for m in programa['medidas']).most_common())


if __name__ == '__main__':
    main()
