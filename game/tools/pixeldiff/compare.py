#!/usr/bin/env python3
"""
Comparador del arnés píxel-diff (task #26, FASE 1).

Alinea un par (port, original) por el marco del chrome, aplica las máscaras de
`regions.json` y emite: aspecto medido de cada lado, veredicto por región, y una
imagen de diff compuesta. Maneja el caso de aspecto distinto reportándolo como
PRIMERA divergencia estructural (no crashea): con aspectos que difieren, el
viewport se compara por histograma (nunca píxel-a-píxel), que es lo único
honesto entre escenas/aspectos distintos.

Uso:
    python3 compare.py PORT.png ORIG.png [--regions regions.json] \
        [--out-dir DIR] [--raw] [--json]

Con --raw, PORT/ORIG son capturas crudas (se normalizan aquí). Sin --raw, se
asumen ya normalizadas a 320×200 (salida de normalize.py, sin --scale).
"""
from __future__ import annotations

import argparse
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

import pdlib

# Tolerancia de aspecto: |a_port - a_orig| por encima de esto ⇒ divergencia
# estructural. 1.667 (píxel crudo) vs 1.389 (4:3) dista 0.28 ≫ 0.05.
ASPECT_TOL = 0.05
BG = {pdlib.EGA_BLACK}  # fondo a efectos de 'tinta' (presence)


def region_pixels(idx: np.ndarray, region: dict) -> np.ndarray:
    """Extrae los índices EGA de una región (rect relleno u outline 1px)."""
    x0, y0, x1, y1 = region["rect"]
    if region.get("kind") == "outline":
        top = idx[y0, x0 : x1 + 1]
        bot = idx[y1, x0 : x1 + 1]
        left = idx[y0 : y1 + 1, x0]
        right = idx[y0 : y1 + 1, x1]
        return np.concatenate([top, bot, left, right])
    return idx[y0 : y1 + 1, x0 : x1 + 1].ravel()


def region_block(idx: np.ndarray, region: dict) -> np.ndarray:
    """El rect de la región como bloque 2D (para modos que necesitan geometría)."""
    x0, y0, x1, y1 = region["rect"]
    return idx[y0 : y1 + 1, x0 : x1 + 1]


def dark_tile_mask(block: np.ndarray, tile: int = 16, darkfrac: float = 0.98) -> np.ndarray:
    """Máscara de celdas 16×16 (H/16, W/16) 'oscuras' = casi todo negro EGA.

    La máscara de luz nocturna del juego apaga TILES ENTEROS (los pone a negro),
    no píxeles sueltos. Detectar celdas negras (≥ darkfrac de píxeles idx0) separa
    limpiamente lo iluminado de lo apagado y es INMUNE a la fase de animación: un
    tile de agua/olas iluminado nunca queda todo negro, así que su swap no cambia
    su bit dark/lit (a diferencia del histograma de paleta o el strict por píxel).
    """
    h, w = block.shape
    ty, tx = h // tile, w // tile
    cells = (block[: ty * tile, : tx * tile] == pdlib.EGA_BLACK)
    cells = cells.reshape(ty, tile, tx, tile).mean(axis=(1, 3))
    return cells >= darkfrac


def hist16(px: np.ndarray) -> np.ndarray:
    """Histograma de paleta normalizado (16 bins)."""
    h = np.bincount(px, minlength=16).astype(np.float64)
    s = h.sum()
    return h / s if s else h


def ink_fraction(px: np.ndarray) -> float:
    """Fracción de píxeles 'con tinta' = no fondo (excluye negro)."""
    if px.size == 0:
        return 0.0
    return float(np.mean(~np.isin(px, list(BG))))


def dominant_ink(px: np.ndarray) -> int:
    """Índice EGA dominante que no sea fondo (para 'color')."""
    mask = ~np.isin(px, list(BG))
    if not mask.any():
        return -1
    return int(np.bincount(px[mask], minlength=16).argmax())


def compare_region(port: np.ndarray, orig: np.ndarray, region: dict) -> dict:
    """Aplica el modo de la región y devuelve el veredicto."""
    mode = region["mode"]
    thresh = region.get("thresh", 0.8)
    pp = region_pixels(port, region)
    po = region_pixels(orig, region)
    res: dict = {"name": region["name"], "mode": mode, "thresh": thresh}

    if mode == "ignore":
        res.update(score=None, passed=None)
        return res

    if mode == "strict":
        score = float(np.mean(pp == po)) if pp.shape == po.shape else 0.0
        res.update(score=round(score, 4), passed=score >= thresh)

    elif mode == "strict_ink":
        # Como strict pero SÓLO sobre píxeles de tinta (no-fondo) en cualquiera de
        # los dos lados. En paneles de texto dispersos (roster, F/G, consola, línea
        # de estado) el fondo negro domina el área y un strict plano da ~0.93 aunque
        # el texto difiera: enmascararía divergencias reales (p.ej. el orden de fecha
        # 4-5 vs 5-4, o los vientos ausentes). Comparar sólo la tinta las delata.
        if pp.shape != po.shape:
            res.update(score=0.0, ink_px=0, passed=False)
        else:
            ink = (~np.isin(pp, list(BG))) | (~np.isin(po, list(BG)))
            score = float(np.mean(pp[ink] == po[ink])) if ink.any() else 1.0
            res.update(score=round(score, 4), ink_px=int(ink.sum()),
                       passed=score >= thresh)

    elif mode == "hist":
        hp, ho = hist16(pp), hist16(po)
        sim = 1.0 - 0.5 * float(np.abs(hp - ho).sum())  # 1 - L1/2 ∈ [0,1]
        res.update(score=round(sim, 4), passed=sim >= thresh)

    elif mode == "hist_video":
        # Como `hist` pero PLEGANDO la deriva de color que mete una GRABACIÓN (#176).
        # No es una tolerancia inventada: el blanco EGA del original sale de los .mov
        # atenuado y azulado (~[238,244,246]) por emulación composite + compresión, y el
        # snap a paleta lo reparte entre idx7 y idx8 — el mismo falso positivo que
        # `game/src/skin/fiel/frame.ts:112-118` ya tenía adjudicado con captura limpia
        # de emulador («idx15 es fiel, no tocar»). MEDIDO en los 11 instantes del
        # desenlace: plegar {7,8}→15 y 9→1 sube la similitud +0.054 … +0.113 en TODOS,
        # o sea que el hueco es un sesgo del códec y no contenido.
        # 🔴 LO QUE ESTE MODO NO PUEDE VER, y hay que decirlo: una divergencia REAL del
        # port entre blanco y los dos grises queda dentro del pliegue. Contra una
        # grabación esa clase no era observable de todos modos (la referencia ya no
        # distingue esos índices); contra un volcado de VRAM se usa `hist` a secas.
        fold = np.array([0, 1, 2, 3, 4, 5, 6, 15, 15, 1, 10, 11, 12, 13, 14, 15], dtype=np.uint8)
        hp, ho = hist16(fold[pp]), hist16(fold[po])
        sim = 1.0 - 0.5 * float(np.abs(hp - ho).sum())
        res.update(score=round(sim, 4), passed=sim >= thresh)

    elif mode == "lit_tiles":
        # Acuerdo espacial de la MÁSCARA DE LUZ a nivel de celda 16×16: fracción de
        # tiles del viewport que coinciden en lit/dark entre port y original. Pilla
        # divergencias de RADIO/FORMA de la máscara nocturna que el histograma NO ve
        # (hist es orden-independiente: el port puede apagar 80% del viewport y el
        # original sólo 30% con histogramas parecidos → falso PASS). Tolera animación.
        bp = dark_tile_mask(region_block(port, region))
        bo = dark_tile_mask(region_block(orig, region))
        agree = float(np.mean(bp == bo))
        res.update(score=round(agree, 4),
                   dark_port=int(bp.sum()), dark_orig=int(bo.sum()),
                   passed=agree >= thresh)

    elif mode == "presence":
        ink_p, ink_o = ink_fraction(pp), ink_fraction(po)
        # PASS si ambos tienen tinta comparable; FAIL si uno está (casi) vacío y
        # el otro poblado — el caso "caja de estado VACÍA en el port".
        both = min(ink_p, ink_o) / max(ink_p, ink_o) if max(ink_p, ink_o) > 1e-6 else 1.0
        res.update(
            score=round(both, 4),
            ink_port=round(ink_p, 4),
            ink_orig=round(ink_o, 4),
            passed=both >= thresh,
        )

    elif mode == "color":
        dp, do = dominant_ink(pp), dominant_ink(po)
        res.update(
            color_port=dp,
            color_orig=do,
            passed=(dp == do),
        )

    else:
        raise ValueError(f"modo desconocido: {mode}")
    return res


def build_diff_image(port: np.ndarray, orig: np.ndarray, regions: list[dict],
                     verdicts: list[dict], scale: int = 2) -> Image.Image:
    """Compone port | original con overlays por región (verde=PASS, rojo=FAIL)."""
    pimg = Image.fromarray(pdlib.idx_to_rgb(port))
    oimg = Image.fromarray(pdlib.idx_to_rgb(orig))
    vmap = {v["name"]: v for v in verdicts}
    gap = 8
    W = pdlib.SCREEN_W * 2 + gap
    H = pdlib.SCREEN_H
    canvas = Image.new("RGB", (W, H), (32, 32, 32))
    canvas.paste(pimg, (0, 0))
    canvas.paste(oimg, (pdlib.SCREEN_W + gap, 0))
    for base in (0, pdlib.SCREEN_W + gap):
        d = ImageDraw.Draw(canvas)
        for r in regions:
            v = vmap.get(r["name"], {})
            if v.get("passed") is None:
                col = (128, 128, 128)
            else:
                col = (0, 200, 0) if v["passed"] else (230, 40, 40)
            x0, y0, x1, y1 = r["rect"]
            d.rectangle([base + x0, y0, base + x1, y1], outline=col)
    if scale != 1:
        canvas = canvas.resize((W * scale, H * scale), Image.NEAREST)
    return canvas


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("port")
    ap.add_argument("orig")
    ap.add_argument("--regions", default=os.path.join(os.path.dirname(__file__), "regions.json"))
    ap.add_argument("--out-dir", default=".")
    ap.add_argument("--raw", action="store_true", help="las entradas son capturas crudas (normalizar aquí)")
    ap.add_argument("--json", action="store_true", help="solo el veredicto JSON por stdout")
    args = ap.parse_args()

    cfg = json.load(open(args.regions, encoding="utf-8"))
    regions = cfg["regions"]

    meta = {}
    if args.raw:
        port, mp = pdlib.normalize(pdlib.load_rgb(args.port))
        orig, mo = pdlib.normalize(pdlib.load_rgb(args.orig))
        meta = {"port": mp, "orig": mo}
        a_port, a_orig = mp["src_frame_aspect"], mo["src_frame_aspect"]
    else:
        port = pdlib.snap_to_palette(pdlib.load_rgb(args.port))
        orig = pdlib.snap_to_palette(pdlib.load_rgb(args.orig))
        # Ya normalizadas: por construcción 320×200; el aspecto de fuente no aplica.
        a_port = a_orig = None

    structural = []
    if a_port is not None and a_orig is not None:
        if abs(a_port - a_orig) > ASPECT_TOL:
            # Firma del estirado vertical ×1.2 del port (ASPECT_Y): si el original
            # (cuadrado) tiene ~1.2× el aspecto del port, la divergencia es ese
            # estirado — que por la decisión F-0 (píxel cuadrado) debe eliminarse.
            ratio = a_orig / a_port if a_port else 0.0
            hint = (
                " Firma del estirado ×1.2 del port (ASPECT_Y 1.2): la piel fiel "
                "aún escala 4:3; por F-0 debe pasar a píxel cuadrado (ASPECT_Y 1.0). "
                if 1.13 <= ratio <= 1.27
                else " "
            )
            structural.append({
                "kind": "aspect_mismatch",
                "port_aspect": a_port,
                "orig_aspect": a_orig,
                "detail": (
                    f"El port se muestra a {a_port} y el original a {a_orig} "
                    f"(Δ={round(abs(a_port - a_orig), 3)} > {ASPECT_TOL})."
                    + hint
                    + "El viewport se compara solo por histograma, nunca píxel-a-píxel."
                ),
            })

    verdicts = [compare_region(port, orig, r) for r in regions]

    os.makedirs(args.out_dir, exist_ok=True)
    diff_path = os.path.join(args.out_dir, "diff.png")
    build_diff_image(port, orig, regions, verdicts).save(diff_path)

    fails = [v for v in verdicts if v.get("passed") is False]
    report = {
        "meta": meta,
        "structural_divergences": structural,
        "regions": verdicts,
        "n_fail": len(fails),
        "diff_image": diff_path,
        "verdict": "STRUCTURAL_DIVERGENCE" if structural else ("FAIL" if fails else "PASS"),
    }

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(f"VERDICTO: {report['verdict']}   ({len(fails)} regiones FAIL)")
        for s in structural:
            print(f"  [ESTRUCTURAL] {s['kind']}: {s['detail']}")
        for v in verdicts:
            mark = {True: "PASS", False: "FAIL", None: "skip"}[v.get("passed")]
            extra = ""
            if v["mode"] == "presence":
                extra = f"  tinta port={v['ink_port']} orig={v['ink_orig']}"
            elif v["mode"] == "color":
                extra = f"  color port=idx{v['color_port']} orig=idx{v['color_orig']}"
            elif v["mode"] == "lit_tiles":
                extra = f"  score={v['score']}  tiles oscuros port={v['dark_port']} orig={v['dark_orig']}"
            elif v.get("score") is not None:
                extra = f"  score={v['score']}"
            print(f"  [{mark}] {v['name']:14s} ({v['mode']}){extra}")
        print(f"  diff → {diff_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
