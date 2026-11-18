"""Colectivos, palancas y territorios de una medida, por palabras clave, en castellano y en catalán.

Lo usan los extractores que no tienen su propia lista (Comuns, A l'Hora, Agenda Valenciana, FIA, Eguzkilore y
Democracia 21). Es una aproximación y la nota de método de cada programa lo dice. `completar(medida)` solo rellena los
campos que están vacíos: no pisa lo que un extractor ya haya decidido.
"""
import re

COLECTIVOS = {
    'empresas': r'\bempres(?:a|as|es|arial|arials|ari|arios|aris)\b|\bind[uú]stri(?:a|as|es|al|ales|als)\b',
    'familias': r'\bfamili(?:a|as)\b|\bfam[ií]l(?:ia|ies)\b|\bconciliaci[oó]n?\b|\bnatalidad\b|\bnatalitat\b|\bcrianza\b',
    'infancia': r'\binfancia\b|\binf[aà]ncia\b|\binfantil\w*|\bni[ñn][oa]s?\b|\bnen[sa]?s?\b|\bmenores\b|\bmenors\b|\balumn(?:o|os|ado)\b|\balumnat\b|\badolesc\w+',
    'inmigrantes': r'\binmigra\w*|\bimmigra\w*|\bextranjer\w*|\bestranger\w*|\brefugiad\w*|\brefugiat\w*|\basilo\b|\basil\b|\bmigrant\w*|\bnouvingut\w*',
    'jovenes': r'\bj[oó]ven(?:es)?\b|\bjuventud\b|\bjov(?:e|es|entut)\b|\bemancipaci[oó]n?\b',
    'rural': r'\bagricultor\w*|\bganader\w*|\bpescador\w*|\bagrari\w*|\bagr[aà]ri\w*|\bmundo rural\b|\bm[oó]n rural\b|\bsector primari\w*|\bpagesi\w*|\bramader\w*|\bregant\w*|\brural(?:es)?\b|\bdespoblaci[oó]n\b|\bdespoblament\b',
    'autonomos': r'\baut[oó]nom[oa]s?\b|\baut[oò]noms?\b|\bpymes?\b|\bmicropimes?\b|\bpimes?\b|\bemprendedor\w*|\bemprenedor\w*|\bpequeñ[oa]s? empres\w*',
    'agentes': r'\bGuardia Civil\b|\bGu[aà]rdia Civil\b|\bpolic[ií]a\w*|\bpolici(?:a|es)\b|\bFuerzas Armadas\b|\bFuerzas y Cuerpos\b|\bmilitares?\b|\bMossos\b|\bbomber\w*|\bbombers\b|\bejército\b',
    'mayores': r'\bmayores\b|\bpersonas mayores\b|\bpensionistas?\b|\bpensions?\b|\bpensiones\b|\bjubilaci[oó]n\b|\bjubilados?\b|\bpersones grans\b|\bgent gran\b|\btercera edad\b',
    'discapacidad': r'\bdiscapacidad\w*|\bdiscapacitat\w*|\bdependencia\b|\bdepend[eè]ncia\b|\bELA\b|\bdiversidad funcional\b',
    'mujeres': r'\bmujer(?:es)?\b|\bdones?\b|\bviolencia (?:machista|de g[eé]nero)\b|\bviol[eè]ncia (?:masclista|de g[eè]nere)\b|\bmaternidad\b|\bmaternitat\b|\bfeminis\w*',
    'victimas': r'\bv[ií]ctimas?\b|\bv[ií]ctimes?\b',
    'pacientes': r'\bpacientes?\b|\bpacients?\b|\blistas? de espera\b|\bllistes? d[\'’]espera\b|\bsanitari\w*|\bsanitaria\b|\bsalud\b|\bsalut\b',
    'funcionarios': r'\bfuncionari\w*|\bempleados p[uú]blicos\b|\bempleats p[uú]blics\b|\bdocentes?\b|\bprofesorado\b|\bprofessorat\b|\bmaestros\b|\bmestres\b|\bpersonal sanitario\b',
}

PALANCAS = {
    'ley': r'\bley(?:es)?\b|\bllei\b|\blleis\b|\breforma\w*|\bderog\w*|\bmodificaci[oó]\w*|\bnormativ\w*|\blegisla\w*|\bC[oó]digo Penal\b|\bCodi Penal\b|\bConstituci[oó]n\b|\bEstatut\w*|\bprohib\w*|\bregula\w*|\bregulaci[oó]\w*',
    'impuestos': r'\bIRPF\b|\bIVA\b|\bfiscal\w*|\bimpuestos?\b|\bimpostos?\b|\btribut\w*|\bdeducci\w*|\bbonificaci\w*|\bdesgrava\w*|\bexenci\w*|\bexempci\w*|\bcotizaci\w*|\bcotitzaci\w*|\bcuotas?\b|\bquotes?\b|\btasas?\b|\btaxes?\b|\barancel\w*',
    'gasto': r'\bfinanci\w*|\bfinan[cç]\w*|\binversi[oó]n(?:es)?\b|\binvertir\b|\binversions\b|\bfondos?\b|\bfons\b|\bayudas?\b|\bajuts?\b|\bsubvenci\w*|\bpresupuest\w*|\bpressupost\w*|\bdotaci\w*|\bgasto\b|\bmillones\b|\bmilions\b|\brecursos\b',
    'organizacion': r'\bcrear\w*|\bcreaci[oó]\w*|\bagencia\b|\bag[eè]ncia\b|\borganismo\b|\borganisme\b|\boficina\b|\bautoridad\b|\bautoritat\b|\bconsejo\b|\bconsell\b|\btraspas\w*|\btrasp[aà]s\w*|\btransferencia\b|\btransfer[eè]ncia\b|\bdelegaci\w*|\bsuprimir\b|\bsupresi\w*|\bunificar\b|\bcompetencias\b|\bcompet[eè]ncies\b|\bcentralizar\b',
    'plan': r'\bplan(?:es)?\b|\bpla\b|\bplans\b|\bestrategia\b|\bestrat[eè]gi\w*|\bprograma\b|\bprogrames\b|\bpacto\b|\bpacte\b|\bacuerdos?\b|\bacords?\b|\bconvenio\b|\bconveni\b',
}

TERRITORIOS = {
    'Cataluña': r'\bCatalu[ñn]a\b|\bCatalunya\b',
    'España': r'\bEspa[ñn]a\b|\bEspanya\b|\bEstado espa[ñn]ol\b|\bEstat espanyol\b',
    'Unión Europea': r'\bUni[oó]n Europea\b|\bUni[oó] Europea\b|\bBruselas\b|\bBrussel·les\b|\bUE\b',
    'País Vasco': r'\bPa[ií]s Vasco\b|\bEuskadi\b|\bPa[ií]s Basc\b',
    'Navarra': r'\bNavarra\b',
    'Canarias': r'\bCanarias\b|\bCanàries\b',
    'Baleares': r'\bBaleares\b|\bIlles Balears\b',
    'Comunidad Valenciana': r'\bComunidad Valenciana\b|\bPa[ií]s Valenci[aà]\b|\bC\. Valenciana\b',
    'Ceuta': r'\bCeuta\b',
    'Melilla': r'\bMelilla\b',
}


def coincidencias(texto, patrones):
    return [clave for clave, patron in patrones.items() if re.search(patron, texto, re.IGNORECASE)]


def completar(medida, territorios=True):
    """Rellena `colectivos`, `palancas` y (si `territorios`) `territorios` de una medida, solo si están vacíos."""
    texto = f"{medida.get('titulo', '')} {medida.get('texto', '')}"
    if not medida.get('colectivos'):
        medida['colectivos'] = coincidencias(texto, COLECTIVOS)
    if not medida.get('palancas'):
        medida['palancas'] = coincidencias(texto, PALANCAS)
    if territorios and not medida.get('territorios'):
        medida['territorios'] = coincidencias(texto, TERRITORIOS)
    return medida
