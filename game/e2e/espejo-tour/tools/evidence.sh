#!/bin/bash
# WALKTHROUGH-ESPEJO — evidencia de vídeo para una divergencia.
#
# Protocolo de ticket (3 piezas): (1) diff textual OCR-vs-port (del reporte JSON),
# (2) FRAME del vídeo original en el punto de la línea OCR divergente (este script),
# (3) captura equivalente del port (playwright screenshot en Fase B).
#
# Los ocrlog.txt NO llevan timestamp por línea (ocr_video.py los descarta): se estima
# por interpolación lineal línea/total × duración y se extraen 4 frames alrededor
# (±3 s). Para el timestamp EXACTO, re-OCR de la ventana con ocr_video.py --fps 2
# sobre un recorte. SOLO por divergencia — jamás extracción masiva (disco).
#
# Uso: evidence.sh <partNN> <ocrLine> [outdir]
set -euo pipefail
PART="$1"; LINE="$2"
OUT="${3:-${TMPDIR:-/tmp}/espejo-evidence}"
YT="<repo>/original/av-referencia/yt"
LOG="$YT/clips/full-part-logs/${PART}.ocrlog.txt"
N=$(printf '%s' "$PART" | sed 's/part0*//')
VIDEO=$(ls "$YT/aulddragon/"*" Part $(printf '%02d' "$N") "*.mp4 2>/dev/null | head -1)
[ -z "$VIDEO" ] && VIDEO=$(ls "$YT/aulddragon/$(printf '%02d' "$N") - "*.mp4 2>/dev/null | head -1)
[ -z "$VIDEO" ] && { echo "no encuentro el mp4 de $PART en $YT/aulddragon/" >&2; exit 1; }
TOTAL=$(wc -l < "$LOG" | tr -d ' ')
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VIDEO")
TS=$(python3 -c "print(round($LINE/$TOTAL*$DUR,1))")
mkdir -p "$OUT/$PART-l$LINE"
echo "vídeo: $VIDEO"
echo "línea $LINE/$TOTAL → ~t=${TS}s (interpolación; refinar con ocr_video.py sobre la ventana)"
for d in -3 -1 1 3; do
  T=$(python3 -c "print(max(0,$TS+$d))")
  ffmpeg -v error -ss "$T" -i "$VIDEO" -frames:v 1 "$OUT/$PART-l$LINE/t${T}s.png" -y
done
echo "frames en $OUT/$PART-l$LINE/ (gitignored/scratch — JAMÁS tracked)"
