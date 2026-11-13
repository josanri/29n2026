"""Shrink a program PDF before publishing it: recompress its photos and subset its fonts.

Usage: python scripts/optimize_pdf.py ORIGINAL.pdf OPTIMIZED.pdf [MAX_WIDTH_PX] [JPEG_QUALITY]

Images wider than MAX_WIDTH_PX (900 by default, about 155 ppp on an A5 page) are scaled down and
saved as JPEG with JPEG_QUALITY (65 by default). CMYK images are converted to RGB. Images with
transparency are left as they are. Text and vector graphics do not change, so the extractors read
the optimized file the same way as the original.
"""
import io
import sys

import pymupdf
from PIL import Image


def main():
    origen, destino = sys.argv[1], sys.argv[2]
    ancho_max = int(sys.argv[3]) if len(sys.argv) > 3 else 900
    calidad = int(sys.argv[4]) if len(sys.argv) > 4 else 65

    documento = pymupdf.open(origen)
    vistas = set()
    for pagina in documento:
        for imagen in pagina.get_images(full=True):
            xref, smask = imagen[0], imagen[1]
            if xref in vistas or smask:
                continue
            vistas.add(xref)
            pixmap = pymupdf.Pixmap(documento, xref)
            if pixmap.n - pixmap.alpha >= 4:
                pixmap = pymupdf.Pixmap(pymupdf.csRGB, pixmap)
            if pixmap.alpha:
                continue
            modo = 'RGB' if pixmap.n == 3 else 'L'
            foto = Image.frombytes(modo, (pixmap.width, pixmap.height), pixmap.samples)
            if foto.width > ancho_max:
                foto = foto.resize((ancho_max, round(foto.height * ancho_max / foto.width)), Image.LANCZOS)
            salida = io.BytesIO()
            foto.save(salida, 'JPEG', quality=calidad, optimize=True, progressive=True)
            pagina.replace_image(xref, stream=salida.getvalue())
    documento.subset_fonts()
    documento.ez_save(destino, garbage=4, deflate=True, clean=True)


if __name__ == '__main__':
    main()
