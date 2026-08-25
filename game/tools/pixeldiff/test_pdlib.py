#!/usr/bin/env python3
"""
Auto-test del núcleo del arnés píxel-diff. Corre standalone o con pytest:
    python3 test_pdlib.py      |      python3 -m pytest test_pdlib.py

No se engancha a ninguna suite del repo (vitest = src/tests; pytest = re/tools).
"""
import numpy as np

import pdlib


def test_snap_exact_palette():
    """Cada color exacto de la paleta snapea a su propio índice (regresión int16:
    255²=65025 desbordaba int16 y mandaba negro→blanco)."""
    for i, rgb in enumerate(pdlib.PALETTE):
        img = np.array([[rgb]], dtype=np.uint8)
        assert pdlib.snap_to_palette(img)[0, 0] == i, f"idx {i} mal snapeado"


def test_snap_black_is_zero():
    """El caso concreto del bug: negro puro → idx0, no idx15."""
    assert pdlib.snap_to_palette(np.zeros((4, 4, 3), np.uint8)).max() == 0


def test_idx6_is_brown():
    """Paleta real de U5: idx6 = #AA5500 marrón (EGA con brown-fix).
    Witness runtime en re/notes/palette-idx6-verdict.md. Este test es la
    guarda anti-ceguera del arnés: si idx6 vuelve a oliva, la comparación
    orig-vs-port queda oliva-vs-oliva y no ve la regresión de paleta."""
    assert tuple(pdlib.PALETTE[6]) == (0xAA, 0x55, 0x00)


def test_detect_frame_bbox_union():
    """El bbox del marco une piezas azules grandes aunque no sean conexas
    (notches/texto parten la barra superior) e ignora ruido azul pequeño."""
    idx = np.zeros((100, 200), np.uint8)
    idx[10:90, 10:14] = pdlib.EGA_BLUE   # barra izquierda
    idx[10:90, 186:190] = pdlib.EGA_BLUE  # barra derecha (pieza separada)
    idx[0:2, 0:2] = pdlib.EGA_BLUE        # ruido azul pequeño (descartar)
    x0, y0, x1, y1 = pdlib.detect_frame_bbox(idx)
    assert (x0, y0, x1, y1) == (10, 10, 189, 89)


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"ok  {name}")
    print("PASS")
