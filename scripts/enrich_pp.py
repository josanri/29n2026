# Enriquece la extracción del programa del PP con el análisis editorial:
# categoría temática de cada medida, colectivos, palancas, plazos y cifras.
# Uso: python scripts/enrich_pp.py .cache/2026/generales/pp_raw.json src/data/2026/generales/programas/pp.json
import json, re, sys
from collections import Counter

raw = json.load(open(sys.argv[1], encoding='utf-8'))


def rng(a, b):
    return list(range(a, b + 1))


# --- Categoría principal (taxonomía común en src/data/taxonomia.json) ----------
CATEGORIA = {}
def asigna(cat, nums):
    for n in nums:
        CATEGORIA[n] = cat

asigna('administracion', rng(1, 12))
asigna('territorio', rng(13, 18) + [59, 92, 94, 98] + rng(100, 106) + [185])
asigna('seguridad', rng(19, 32))
asigna('justicia', [33, 34, 61] + rng(70, 74) + [82, 83])
asigna('inmigracion', rng(35, 46) + rng(140, 143))
asigna('emergencias', rng(47, 51))
asigna('defensa', rng(52, 55))
asigna('democracia', [56, 57, 58, 60] + rng(62, 69) + rng(75, 81) + [84, 85] + rng(86, 91))
asigna('social', rng(107, 115))
asigna('infraestructuras', rng(116, 126))
asigna('identidad', [96, 97] + rng(127, 139))
asigna('vivienda', rng(144, 157))
asigna('familia', rng(158, 168))
asigna('empleo', rng(169, 176))
asigna('fiscalidad', rng(177, 184))
asigna('innovacion', rng(186, 194))
asigna('rural', [99] + rng(195, 208))
asigna('educacion', [95] + rng(209, 218))
asigna('sanidad', [93] + rng(219, 227))
asigna('energia', rng(228, 233))
asigna('exterior', rng(234, 249))
assert len(CATEGORIA) == 249, len(CATEGORIA)

# --- Colectivos citados (palabras clave en título + texto) ----------------------
COLECTIVOS = {
    'jovenes': r'\bj[óo]venes\b|menores de 40|de 18 a 35|\bjoven\b',
    'mayores': r'\bmayores\b(?! de edad)|pensionista|pensiones|jubila',
    'mujeres': r'\bmujer(es)?\b|\bmadres?\b|\bniñas\b',
    'familias': r'\bfamilias?\b|\bhijos?\b|\bmaternidad|natalidad',
    'infancia': r'\bmenores\b|\binfancia|\binfantil|\bniños\b|\balumnos?\b',
    'autonomos': r'\baut[óo]nomos?\b|\bpymes?\b|emprende',
    'empresas': r'\bempresas?\b|\bindustria',
    'rural': r'\brural\b|agricultor|ganader|pescador|\bcampo\b',
    'agentes': r'Guardia Civil|Polic[íi]a Nacional|\bagentes\b|\bmilitares\b|funcionarios de prisiones',
    'funcionarios': r'empleados p[úu]blicos|\bfuncionari',
    'discapacidad': r'discapacidad|\bdependencia\b|\bdependientes?\b',
    'victimas': r'\bv[íi]ctimas?\b',
    'inmigrantes': r'inmigra|extranjer|\basilo\b|migratori',
    'pacientes': r'\bpacientes?\b|\benfermo',
}

# --- Palancas: con qué instrumento se ejecuta la medida -------------------------
PALANCAS = {
    'ley': r'\bley\b|Código Penal|reformaremos|regularemos|derogar|legal(?:mente)?\b|Constituci[óo]n|Reglamento|normativa|tipificar|delito',
    'impuestos': r'\bIRPF\b|\bIVA\b|impuesto|deducci|desgrav|bonific|cotizaci|tribut|fiscal',
    'gasto': r'invertir|inversi[óo]n|millones|financiaci[óo]n|recursos|\bayudas?\b|dotaremos|medios',
    'organizacion': r'crearemos|agencia|autoridad [úu]nica|organismo|unidad|oficina|ventanilla|plataforma|registro',
    'plan': r'\bplan\b|\bpacto\b|estrategia|programa',
}

# --- Plazos explícitos (diagrama de calendario) --------------------------------
# Only when a measure will be carried out. The «seis meses» of measure 192 is how long each strategic
# project waits for its electrical connection, a figure of the measure, so it is not listed.
PLAZOS = {
    1: ('100 días', 'Auditoría de todo el gasto y de la Administración'),
    76: ('100 días', 'Reforma de RTVE y EFE'),
    228: ('100 días', 'Prórroga de la vida útil de las nucleares'),
    15: ('6 meses', 'Auditoría de la presencia del Estado y Plan Nacional'),
    68: ('6 meses', 'Código ético del Tribunal Constitucional'),
    231: ('6 meses', 'Nuevas reglas del sistema eléctrico'),
    230: ('18 meses', 'Plan de choque de acceso a la red eléctrica'),
    100: ('Inicio de legislatura', 'Conferencia de Presidentes sobre financiación autonómica'),
    234: ('Inicio de legislatura', 'Estrategia de Acción Exterior en las Cortes'),
    7: ('Antes de 2029', 'Cargas administrativas −25 % (−35 % para pymes)'),
    163: ('Fin de legislatura', 'Escuela infantil de 0 a 3 años gratuita'),
    126: ('Hasta 2030', '40.000 M€ en infraestructuras hidráulicas'),
    117: ('15 años', 'Más de 300.000 M€ en infraestructuras'),
}
ORDEN_PLAZOS = ['100 días', '6 meses', '18 meses', 'Inicio de legislatura', 'Antes de 2029',
                'Fin de legislatura', 'Hasta 2030', '15 años']

# --- Cifras clave (fichas de cabecera) ------------------------------------------
CIFRAS = [
    dict(valor='1.000.000', unidad='viviendas', texto='nuevas viviendas en la legislatura', medida=144),
    dict(valor='+300.000', unidad='M€', texto='plan de infraestructuras con el sector privado (15 años)', medida=117),
    dict(valor='0 %', unidad='IVA', texto='para alimentos básicos mientras dure la crisis de inflación', medida=180),
    dict(valor='85.000', unidad='€', texto='de facturación por debajo de la cual el autónomo no cobra ni declara IVA', medida=171),
    dict(valor='−25 %', unidad='cargas', texto='de cargas administrativas antes de 2029 (−35 % pymes)', medida=7),
    dict(valor='48', unidad='horas', texto='para recuperar una vivienda ocupada por orden judicial', medida=157),
    dict(valor='7', unidad='días', texto='máximo para identificar a quien entre de forma irregular', medida=37),
    dict(valor='100', unidad='días', texto='para auditar todo el gasto público', medida=1),
    dict(valor='3 × 1', unidad='normas', texto='se eliminan tres normas por cada norma nueva', medida=7),
    dict(valor='14', unidad='años', texto='edad mínima para tener una cuenta en redes sociales', medida=168),
]

# Derogaciones explícitas
DEROGA = {
    60: 'Ley de Amnistía',
    129: 'Ley de Memoria Democrática',
    145: 'Ley de Vivienda',
}

# Plazos de cumplimiento implícitos en el título (lo que «se hará sí o sí»)
TERRITORIOS = {
    'Ceuta': r'\bCeuta\b', 'Melilla': r'\bMelilla\b', 'Canarias': r'\bCanarias\b|canari',
    'Baleares': r'\bBaleares\b', 'Cataluña': r'\bCataluña\b|Rodalies', 'País Vasco': r'País Vasco|etarras|\bETA\b',
    'Navarra': r'\bNavarra\b', 'Andalucía': r'\bAndaluc|andaluz|Algeciras|Estrecho', 'Gibraltar': r'\bGibraltar\b',
    'Galicia': r'\bGalicia\b|\bVigo\b', 'C. Valenciana': r'\bValencia\b|valenciana',
}

VERBO = re.compile(r'\b([A-ZÁÉÍÓÚ]?[a-záéíóúñ]+(?:aremos|eremos|iremos))\b')


def tags(text, table):
    return [k for k, p in table.items() if re.search(p, text, re.I if table is not COLECTIVOS else re.I)]


def oraciones_con_cifras(body):
    out = []
    for s in re.split(r'(?<=[.!?])\s+', body):
        if re.search(r'\d', s) and re.search(r'%|euros|millones|horas|días|años|meses|\d\.\d{3}', s):
            out.append(s.strip())
    return out[:3]


def titulo_frase(t):
    """Pasa el título en mayúsculas a frase con mayúscula inicial."""
    t = t.strip().rstrip('.')
    low = t.lower()
    keep = ['España', 'Estado', 'Ceuta', 'Melilla', 'Agencia Tributaria', 'Seguridad Social', 'Junta Electoral',
            'Tribunal Constitucional', 'Tribunal Supremo', 'Fiscal General', 'Abogacía del Estado', 'CIS', 'RTVE',
            'EFE', 'Consejo de Estado', 'Tribunal de Cuentas', 'Senado', 'Parlamento', 'Cortes', 'Congreso',
            'PAU', 'Ley de Memoria Democrática', 'Ley de Concordia', 'Ley de Vivienda', 'Mundial de 2030', 'Hucha Hogar Joven',
            'IRPF', 'IVA', 'PISA', 'FP', 'PAC', 'POSEI', 'Almaraz', 'Ascó', 'Vandellós', 'Cofrentes', 'Trillo',
            'Magreb', 'Sáhara Occidental', 'Ucrania', 'Rusia', 'Gibraltar', 'Iberoamérica', 'Europa', 'Cuba',
            'Nicaragua', 'Venezuela', 'Oriente Medio', 'Administración General del Estado', 'Administración',
            'Gobierno', 'Fuerzas Armadas', 'Policías', 'Guardias Civiles', 'Rodalies', 'Cercanías', 'Alta Velocidad',
            'Unión', 'Hacienda', 'Nación', 'Marco Financiero Plurianual', 'Administración de Justicia',
            'Comunidad Autónoma', 'Seguridad Nuclear', 'IMSERSO']
    i = next(j for j, c in enumerate(low) if c.isalpha())
    out = low[:i] + low[i].upper() + low[i + 1:]
    # de más largo a más corto: «Administración General del Estado» gana a «Estado»
    for k in sorted(keep, key=len, reverse=True):
        out = re.sub(r'(?<![\wáéíóúñ])' + re.escape(k.lower()) + r'(?![\wáéíóúñ])', k, out)
    out = re.sub(r'([.:»]\s+)([a-záéíóúñ])', lambda m: m.group(1) + m.group(2).upper(), out)
    return out


TITULOS_BLOQUE = {1: 'Reparar el Estado', 2: 'Regenerar la democracia', 3: 'Reunir a la Nación',
                  4: 'Recuperar la ambición y la autoestima'}

medidas = []
bloques = []
secciones = []
for bi, b in enumerate(raw['blocks']):
    if not b['num']:
        presentacion = b
        continue
    bid = int(b['num'])
    bloques.append(dict(id=bid, titulo=TITULOS_BLOQUE[bid],
                        tituloMayus=b['title'], lema=b['slogan'], cita=b['quote'], intro=b['intro'], pagina=b['page']))
    for s in b['sections']:
        secciones.append(dict(id=s['num'], bloque=bid, titulo=s['title'], tituloFrase=titulo_frase(s['title']),
                              intro=s['intro'], pagina=s['page'],
                              subapartados=[dict(titulo=g['label'], intro=g['intro']) for g in s['groups']]))
        for m in s['measures']:
            full = m['title'] + ' ' + m['body']
            entry = dict(
                n=m['n'], bloque=bid, seccion=s['num'], pagina=m['page'],
                subapartado=m['group'],
                titulo=m['title'].rstrip('.'), tituloFrase=titulo_frase(m['title']) if m['title'] else '',
                texto=m['body'], oculta=m['hidden'],
                categoria=CATEGORIA[m['n']],
                colectivos=[] if m['hidden'] else tags(full, COLECTIVOS),
                palancas=[] if m['hidden'] else tags(full, PALANCAS),
                territorios=[] if m['hidden'] else [k for k, p in TERRITORIOS.items() if re.search(p, full)],
                cifras=oraciones_con_cifras(m['body']),
                plazo=PLAZOS.get(m['n'], (None,))[0],
                deroga=DEROGA.get(m['n']),
            )
            medidas.append(entry)

medidas.sort(key=lambda m: m['n'])
verbos = Counter()
for m in medidas:
    for v in VERBO.findall(m['texto']):
        verbos[v.lower()] += 1

out = dict(
    id='pp',
    partido='Partido Popular',
    siglas='PP',
    color='#135898',
    colorClaro='#4dc1df',
    programa='Reconstrucción Nacional',
    subtitulo='El programa del cambio necesario para España',
    elecciones='Elecciones generales · 29 de noviembre de 2026',
    pdf='/programas/pp-reconstruccion-nacional.pdf',
    fuentePdf='https://www.pp.es/wp-content/uploads/2026/11/LA-RECONSTRUCCION-NACIONAL.pdf',
    paginas=82,
    fechaPdf='2026-11-09',
    presentacion=dict(titulo='La España que haremos entre todos', texto=presentacion['intro']),
    cifras=CIFRAS,
    plazos=[dict(plazo=PLAZOS[n][0], texto=PLAZOS[n][1], medida=n) for n in
            sorted(PLAZOS, key=lambda n: (ORDEN_PLAZOS.index(PLAZOS[n][0]), n))],
    ordenPlazos=ORDEN_PLAZOS,
    verbos=[dict(verbo=v, n=c) for v, c in verbos.most_common(15)],
    bloques=bloques,
    secciones=secciones,
    medidas=medidas,
)
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# Resumen en consola para revisar el análisis
print('medidas', len(medidas), 'ocultas', sum(m['oculta'] for m in medidas))
print('categorías', Counter(m['categoria'] for m in medidas).most_common())
print('colectivos', Counter(c for m in medidas for c in m['colectivos']).most_common())
print('palancas', Counter(c for m in medidas for c in m['palancas']).most_common())
print('territorios', Counter(c for m in medidas for c in m['territorios']).most_common())
print('verbos', verbos.most_common(15))
print([b['titulo'] for b in bloques])
