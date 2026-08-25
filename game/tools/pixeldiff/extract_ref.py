#!/usr/bin/env python3
"""
Extractor de referencia: saca frames de un vídeo/captura de DOSBox y los
NORMALIZA al espacio lógico 320×200 del original (task #26, FASE 1).

Sigue el patrón ffmpeg del analista de vídeo (frames a scratchpad) pero, a
diferencia de los recortes crudos, cada frame sale registrado por el marco del
chrome, corregido de aspecto y snapeado a la paleta EGA real → directamente
comparable con la captura del port por `compare.py`.

Uso:
    # frames en timestamps concretos de un .mov
    python3 extract_ref.py video-B.mov --out DIR --at 0.0 2.5 5.0
    # un frame cada N segundos
    python3 extract_ref.py video-B.mov --out DIR --every 1.0
    # una imagen suelta (screenshot) → un único frame normalizado
    python3 extract_ref.py captura.png --out DIR

Requiere ffmpeg en el PATH (solo para vídeos). Los .mov/frames NUNCA se
commitean (viven en original/av-referencia/, gitignored).
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile

import pdlib


def ffmpeg_frame(video: str, t: float, dst: str) -> None:
    """Extrae un frame en el segundo `t` (PNG exacto, sin recompresión con pérdida)."""
    subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-y",
         "-ss", f"{t:.3f}", "-i", video, "-frames:v", "1", dst],
        check=True,
    )


def video_duration(video: str) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", video],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def normalize_to(src_png: str, dst_png: str) -> dict:
    idx, meta = pdlib.normalize(pdlib.load_rgb(src_png))
    pdlib.save_idx_png(idx, dst_png)
    return meta


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("input", help="vídeo .mov/.mp4 o imagen .png")
    ap.add_argument("--out", required=True, help="directorio de salida (gitignored)")
    ap.add_argument("--at", type=float, nargs="*", help="timestamps (s) a extraer")
    ap.add_argument("--every", type=float, help="un frame cada N segundos")
    ap.add_argument("--prefix", default="ref", help="prefijo del nombre de salida")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    ext = os.path.splitext(args.input)[1].lower()

    # Imagen suelta → un frame normalizado.
    if ext in (".png", ".jpg", ".jpeg", ".bmp"):
        dst = os.path.join(args.out, f"{args.prefix}_norm.png")
        meta = normalize_to(args.input, dst)
        print(f"{dst}  aspect={meta['src_frame_aspect']}")
        return 0

    # Vídeo → timestamps.
    times = list(args.at) if args.at else []
    if args.every:
        dur = video_duration(args.input)
        t = 0.0
        while t < dur:
            times.append(round(t, 3))
            t += args.every
    if not times:
        print("indica --at T... o --every N para un vídeo", file=sys.stderr)
        return 2

    with tempfile.TemporaryDirectory() as tmp:
        for i, t in enumerate(times):
            raw = os.path.join(tmp, f"f{i}.png")
            ffmpeg_frame(args.input, t, raw)
            dst = os.path.join(args.out, f"{args.prefix}_t{t:07.3f}.png")
            meta = normalize_to(raw, dst)
            print(f"{dst}  aspect={meta['src_frame_aspect']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
