#!/usr/bin/env python3
"""
Normaliza UNA captura (original DOSBox o port) al espacio lógico 320×200.

Uso:
    python3 normalize.py IN.png OUT.png [--scale N]

Registra por el marco azul del chrome (fiducial), corrige el aspecto 4:3 y snapea
a la paleta EGA real. Imprime el bbox de fuente y el aspecto medido (insumo del
chequeo estructural del comparador).
"""
from __future__ import annotations

import argparse
import json
import sys

import pdlib


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--scale", type=int, default=1, help="escala entera del PNG de salida")
    args = ap.parse_args()

    rgb = pdlib.load_rgb(args.input)
    idx, meta = pdlib.normalize(rgb)
    pdlib.save_idx_png(idx, args.output, scale=args.scale)
    print(json.dumps({"output": args.output, **meta}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
