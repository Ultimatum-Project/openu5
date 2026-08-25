"""Tests del comparador por región (task #26). Foco: el modo strict_ink de fase 2.

Corre sin dosbox ni navegador: opera sobre arrays de índices EGA sintéticos.
"""
import numpy as np

import compare


def _blank(h=200, w=320):
    return np.zeros((h, w), dtype=np.uint8)


def test_strict_ink_ignores_background_dominance():
    """En un panel mayormente negro, strict plano infla; strict_ink delata el texto."""
    port, orig = _blank(), _blank()
    region = {"name": "panel", "kind": "rect", "rect": [192, 64, 311, 79],
              "mode": "strict", "thresh": 0.90}
    # 1920 px de región; sólo unas pocas de tinta, y DISTINTAS (fecha 4-5 vs 5-4).
    port[64, 192:196] = [15, 15, 15, 15]   # "texto" del port
    orig[64, 200:204] = [15, 15, 15, 15]   # "texto" del original (otra posición)

    strict = compare.compare_region(port, orig, {**region, "mode": "strict"})
    ink = compare.compare_region(port, orig, {**region, "mode": "strict_ink"})

    assert strict["score"] > 0.98        # el fondo negro domina → falso PASS
    assert strict["passed"] is True
    assert ink["score"] < 0.5            # sólo sobre tinta → delata la divergencia
    assert ink["passed"] is False
    assert ink["ink_px"] == 8            # 4 px de cada lado, sin solape


def test_strict_ink_perfect_match():
    port, orig = _blank(), _blank()
    region = {"name": "p", "kind": "rect", "rect": [0, 0, 9, 9],
              "mode": "strict_ink", "thresh": 0.90}
    port[0, 0:5] = [15, 14, 15, 14, 15]
    orig[0, 0:5] = [15, 14, 15, 14, 15]
    res = compare.compare_region(port, orig, region)
    assert res["score"] == 1.0
    assert res["passed"] is True


def test_strict_ink_all_background_is_full_match():
    """Región totalmente de fondo (sin tinta en ninguno) = match trivial 1.0."""
    port, orig = _blank(), _blank()
    region = {"name": "p", "kind": "rect", "rect": [0, 0, 9, 9],
              "mode": "strict_ink", "thresh": 0.90}
    res = compare.compare_region(port, orig, region)
    assert res["score"] == 1.0
    assert res["ink_px"] == 0


def test_lit_tiles_catches_night_mask_radius():
    """lit_tiles pilla un radio de máscara nocturna distinto que hist NO ve.

    Reproduce el caso overworld_night (task #26 fase 2): el port apaga muchas más
    celdas del viewport que el original (radio de visión nocturno menor). Los
    histogramas de paleta son parecidos (ambos dominados por negro + verde) → hist
    da falso PASS; lit_tiles baja porque las celdas lit/dark no coinciden.
    """
    port, orig = _blank(), _blank()
    region = {"name": "viewport", "kind": "rect", "rect": [8, 8, 8 + 176 - 1, 8 + 176 - 1]}
    # MISMO número de tiles iluminados (5×5=25) pero en POSICIÓN distinta: el
    # original arriba-izquierda, el port abajo-derecha (sin solape). El histograma
    # de paleta es IDÉNTICO (mismo conteo de verde y negro) → hist da PASS ciego;
    # lit_tiles ve que ninguna celda encendida coincide → FAIL. Ésta es justo la
    # ceguera del histograma que destapó overworld_night.
    orig[8 : 8 + 5 * 16, 8 : 8 + 5 * 16] = 2                      # 5×5 arriba-izq
    port[8 + 6 * 16 : 8 + 11 * 16, 8 + 6 * 16 : 8 + 11 * 16] = 2  # 5×5 abajo-der

    hist = compare.compare_region(port, orig, {**region, "mode": "hist", "thresh": 0.85})
    lit = compare.compare_region(port, orig, {**region, "mode": "lit_tiles", "thresh": 0.95})

    assert hist["score"] == 1.0            # histogramas idénticos → falso PASS
    assert hist["passed"] is True
    assert lit["passed"] is False          # lit_tiles SÍ pilla el desalineo espacial
    assert lit["dark_orig"] == 121 - 25    # 5×5 iluminadas de 11×11
    assert lit["dark_port"] == 121 - 25    # mismo conteo, otra posición
    assert lit["score"] < 0.6              # 50 celdas discrepan de 121


def test_lit_tiles_perfect_when_masks_agree():
    """Máscara de luz idéntica en ambos → lit_tiles 1.0 (tolera aunque el TILE difiera)."""
    port, orig = _blank(), _blank()
    region = {"name": "viewport", "kind": "rect", "rect": [8, 8, 8 + 176 - 1, 8 + 176 - 1],
              "mode": "lit_tiles", "thresh": 0.95}
    # Mismas celdas iluminadas, pero con COLOR/tile distinto (idx2 vs idx10): la
    # animación cambia el tile pero no si la celda está encendida → sigue 1.0.
    orig[8 : 8 + 3 * 16, 8 : 8 + 3 * 16] = 2
    port[8 : 8 + 3 * 16, 8 : 8 + 3 * 16] = 10
    res = compare.compare_region(port, orig, region)
    assert res["score"] == 1.0 and res["passed"] is True


def test_border_rule_color_mode():
    """El outline de 1px (regla del marco) compara el color dominante no-fondo."""
    port, orig = _blank(), _blank()
    region = {"name": "border_rule", "kind": "outline", "rect": [7, 7, 20, 20],
              "mode": "color", "thresh": 1.0}
    # perímetro gris (idx7) en ambos → mismo color dominante → PASS
    for arr in (port, orig):
        arr[7, 7:21] = 7
        arr[20, 7:21] = 7
        arr[7:21, 7] = 7
        arr[7:21, 20] = 7
    res = compare.compare_region(port, orig, region)
    assert res["color_port"] == 7 and res["color_orig"] == 7
    assert res["passed"] is True
