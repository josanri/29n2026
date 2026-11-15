"""Genera los favicons en mapa de bits a partir del dibujo de `favicon.svg`: un punto negro sobre un cuadrado blanco.

Los navegadores usan el SVG, pero los buscadores necesitan una imagen en una URL propia y, si no la encuentran en la
portada, buscan «/favicon.ico» en la raíz del dominio. Google pide un tamaño múltiplo de 48 px.

Salida (en `public/comun/`, común a todas las elecciones):
- favicon.ico            16, 32 y 48 px
- favicon-192.png        192 px (buscadores y Android)
- apple-touch-icon.png   180 px (iOS)

Uso: python scripts/favicons.py [carpeta de salida]
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

LADO = 64     # el viewBox del SVG
RADIO = 20    # el círculo del SVG, centrado
ESCALA = 32   # se dibuja grande y se reduce, para suavizar el borde


def dibujo(tamano):
    grande = LADO * ESCALA
    imagen = Image.new('RGB', (grande, grande), 'white')
    centro, radio = grande / 2, RADIO * ESCALA
    ImageDraw.Draw(imagen).ellipse((centro - radio, centro - radio, centro + radio, centro + radio), fill='black')
    return imagen.resize((tamano, tamano), Image.LANCZOS)


def main():
    salida = Path(sys.argv[1] if len(sys.argv) > 1 else 'public/comun')
    dibujo(256).save(salida / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
    dibujo(192).save(salida / 'favicon-192.png', optimize=True)
    dibujo(180).save(salida / 'apple-touch-icon.png', optimize=True)
    for nombre in ('favicon.ico', 'favicon-192.png', 'apple-touch-icon.png'):
        print(nombre, (salida / nombre).stat().st_size, 'bytes')


if __name__ == '__main__':
    main()
