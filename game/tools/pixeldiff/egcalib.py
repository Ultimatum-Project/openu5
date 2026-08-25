#!/usr/bin/env python3
"""
Registro de referencias de VÍDEO para el arnés del desenlace (#176).

POR QUÉ EXISTE ESTE FICHERO — el registro heredado NO SIRVE PARA EL DESENLACE.
`pdlib.normalize` registra cada captura por el MARCO AZUL del chrome
(`detect_frame_bbox`), y las pantallas del final NO TIENEN CHROME. Medido sobre los
instantes del testigo (`endgame-victoria-box-20260721.mov`, timeline en
`re/notes/endgame-witness-20260721.md:9-22`):

    t=30/60/92  (sala verde · diálogo · orbe)  bbox correcto (0,7,1267,773)
    t=102       (disolución)                   bbox (0,7,655,103)   ← chrome a medias
    t=110       (casa del Avatar)              bbox (0,230,755,593) ← el ARTE tiene azul
    t=122/140   (sueño · pergamino)            ValueError: no hay azul

Los dos últimos fallan RUIDOSAMENTE. Los dos del medio fallan EN SILENCIO: devuelven
un 320x200 de aspecto plausible que es un recorte del cuadro. Un arnés montado sobre
la receta heredada habría publicado veredictos sobre frames mal registrados sin dar
ningún síntoma.

QUÉ HACE EN SU LUGAR: el recorte se calibra UNA VEZ POR VÍDEO contra la PLANTILLA DE
CHROME, y se aplica FIJO a todos los instantes (incluidos los que no tienen chrome).
Es legítimo porque está medido: el bbox del chrome sale IDÉNTICO en 13 muestras de
t=3 a t=95 — la ventana de DOSBox no se mueve durante la grabación.

La plantilla NO se cablea aquí: se RE-EXTRAE de `game/src/skin/fiel/frame.ts` en cada
corrida (`FRAME_FILLS`, los rects de `paint_screen_frame`). Si la geometría del chrome
cambia, la calibración cambia con ella en vez de quedarse rancia.

🔴 ALCANCE DEL INSTRUMENTO (medido, no supuesto). La grabación **no** es un escalado
entero del framebuffer EGA: con el recorte calibrado salen 4,000 px por columna lógica
pero sólo 3,984 por fila, y la prueba directa lo refuta — la fracción de bloques 4x4 de
color uniforme es 0,6705, y el CONTROL con bloques 3x3 da 0,6745, o sea lo mismo que el
azar. La grabación está remuestreada y comprimida en H.264. ⇒ los modos `strict` y
`strict_ink` NO son honestos contra esta referencia; los veredictos del desenlace usan
sólo los modos robustos a ±1 px (`hist`, `lit_tiles`, `presence`, `color`).
La vía píxel-exacta exigiría capturar el desenlace en el ORÁCULO (como hace el arnés
mismo-estado, donde los dos lados son volcados nativos de VRAM), y eso está bloqueado
mientras la absorción no esté portada (#179).

🔴 SEGUNDA PÉRDIDA MEDIDA: el recorte calibrado da x0 = -14 px, es decir la grabación
**pierde 3,5 columnas lógicas por la izquierda** (el borde izquierdo de la ventana de
DOSBox quedó fuera de pantalla). Son columnas de la barra azul del chrome, sin
contenido de juego — pero NINGUNA región de los manifiestos puede empezar antes de la
columna lógica 4, y `cobertura_izquierda()` lo devuelve para que la guarda lo vigile.
"""
from __future__ import annotations

import os
import re

import numpy as np
from PIL import Image

import pdlib

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
FRAME_TS = os.path.join(REPO_ROOT, "game", "src", "skin", "fiel", "frame.ts")

# Alto del marco azul en filas lógicas (las 192 de `paint_screen_frame`; 192..199 es
# la línea de estado, fuera del marco). Mismo valor que pdlib.FRAME_LOGICAL_H.
FRAME_H = pdlib.FRAME_LOGICAL_H

_FILL = re.compile(
    r"\{\s*x0:\s*(0x[0-9a-fA-F]+|\d+),\s*y0:\s*(0x[0-9a-fA-F]+|\d+),"
    r"\s*x1:\s*(0x[0-9a-fA-F]+|\d+),\s*y1:\s*(0x[0-9a-fA-F]+|\d+)\s*\}"
)


def frame_fills(path: str = FRAME_TS) -> list[tuple[int, int, int, int]]:
    """Los rects de `FRAME_FILLS` RE-EXTRAÍDOS de frame.ts (no cableados aquí)."""
    with open(path, encoding="utf-8") as f:
        src = f.read()
    # El `[` que abre el ARRAY, no el `[]` del tipo `readonly FillRect[]`.
    start = src.index("= [", src.index("FRAME_FILLS"))
    end = src.index("];", start)
    fills = [tuple(int(v, 0) for v in m) for m in _FILL.findall(src[start:end])]
    if not fills:
        raise ValueError("no se pudo re-extraer FRAME_FILLS de %s" % path)
    return fills


def chrome_template(path: str = FRAME_TS) -> np.ndarray:
    """Máscara booleana (192, 320) de dónde pinta azul el chrome del original."""
    t = np.zeros((FRAME_H, pdlib.SCREEN_W), bool)
    for x0, y0, x1, y1 in frame_fills(path):
        t[y0:min(y1 + 1, FRAME_H), x0:x1 + 1] = True
    return t


def _resample_mask(mask: np.ndarray, crop, w: int, h: int) -> np.ndarray:
    x0, y0, x1, y1 = crop
    im = Image.fromarray((mask * 255).astype(np.uint8))
    return np.asarray(im.crop((x0, y0, x1 + 1, y1 + 1)).resize((w, h), Image.BILINEAR)) > 127


def _fit_axis(profile: np.ndarray, target: np.ndarray, lo0, hi0, lo1, hi1):
    """Ajusta el par (inicio, fin) del recorte en un eje por correlación de perfiles."""
    n = len(target)
    best = None
    for a in range(lo0, hi0 + 1):
        for b in range(lo1, hi1 + 1):
            if b - a < n // 2:
                continue
            v = np.interp(np.linspace(a, b, n), np.arange(len(profile)), profile)
            c = float(np.corrcoef(v, target)[0, 1]) if v.std() > 1e-9 else -1.0
            if best is None or c > best[0]:
                best = (c, a, b)
    return best


def calibrate(rgb: np.ndarray, template: np.ndarray | None = None) -> dict:
    """Calibra el recorte de un frame CON CHROME. Devuelve crop y su calidad.

    `precision` = fracción del azul detectado que cae DENTRO de la plantilla. Es la
    cifra que decide: sube bruscamente con el recorte correcto. El `recall` NO se usa
    como criterio y por eso no vuelve — es estructuralmente < 1 porque el original
    dibuja TEXTO en color sobre las barras azules (la fecha del panel, «Dir: East» de
    la línea inferior, las runas de esquina), y esos píxeles son plantilla-azul que la
    realidad pinta de otro color. Quien use recall como criterio leerá un desalineo
    donde sólo hay tipografía.
    """
    tpl = chrome_template() if template is None else template
    mask = pdlib.snap_to_palette(rgb) == pdlib.EGA_BLUE
    h, w = mask.shape
    _, y0, y1 = _fit_axis(mask.mean(axis=1), tpl.mean(axis=1), -8, 20, h - 40, h - 1)
    _, x0, x1 = _fit_axis(mask[max(y0, 0):y1 + 1].mean(axis=0), tpl.mean(axis=0),
                          -28, 28, w - 60, w - 1)
    best = None
    for dx0 in range(-3, 4):
        for dx1 in range(-3, 4):
            for dy0 in range(-2, 3):
                for dy1 in range(-2, 3):
                    crop = (x0 + dx0, y0 + dy0, x1 + dx1, y1 + dy1)
                    r = _resample_mask(mask, crop, pdlib.SCREEN_W, FRAME_H)
                    hit = int((r & tpl).sum())
                    prec = hit / max(int(r.sum()), 1)
                    score = hit - 3 * int((r & ~tpl).sum())
                    if best is None or score > best[0]:
                        best = (score, crop, prec)
    _, crop, prec = best
    return {"crop": list(crop), "precision": round(prec, 4),
            "cobertura_izquierda": cobertura_izquierda(crop)}


def cobertura_izquierda(crop) -> int:
    """Primera columna LÓGICA que la grabación llega a cubrir (0 = cubre todo).

    Con x0 negativo el recorte pide píxeles a la izquierda del frame, que no existen:
    esas columnas lógicas salen rellenas de negro y NO son dato. Ninguna región de un
    manifiesto puede empezar antes de este número.
    """
    x0, _, x1, _ = crop
    if x0 >= 0:
        return 0
    px_col = (x1 - x0 + 1) / pdlib.SCREEN_W
    return int(np.ceil(-x0 / px_col))


def normalize_fixed(rgb: np.ndarray, crop) -> np.ndarray:
    """Registra un frame con el recorte YA calibrado (sin fiducial de chrome).

    `crop` encuadra las 192 filas lógicas del marco; las 200 se completan alargando
    hacia abajo con el mismo px/fila, igual que hace `pdlib.normalize`.
    """
    x0, y0, x1, y1 = crop
    px_row = (y1 - y0 + 1) / FRAME_H
    y1_full = y0 + int(round(pdlib.SCREEN_H * px_row)) - 1
    im = Image.fromarray(rgb).crop((x0, y0, x1 + 1, y1_full + 1))
    im = im.resize((pdlib.SCREEN_W, pdlib.SCREEN_H), Image.BILINEAR)
    return pdlib.snap_to_palette(np.asarray(im, dtype=np.uint8))
