#!/usr/bin/env bash
# WALKTHROUGH-ESPEJO — runner PARTE-POR-PARTE (Fase C, aislamiento de timeout).
#
# Corre Part01→06 como INVOCACIONES PLAYWRIGHT SEPARADAS: cada parte importa el checkpoint
# de la anterior (route.entry.checkpoint) y exporta el suyo. Un timeout/fallo de UNA parte
# NO mata a las siguientes (a diferencia del describe.serial, donde el 1er fallo salta el
# resto). Así las ventanas se trocean como el resello del tour y una parte lenta no bloquea
# la cosecha de las demás.
#
#   U5_PARTS="part01 part02"  bash tools/run-per-part.sh      # subconjunto
#   bash tools/run-per-part.sh                                 # 01→06
#
# Requiere que cada parte previa haya corrido (para el checkpoint); el bucle en orden lo
# garantiza. SOFT por defecto (calibración). Puerto/cache propios del carril.
set -uo pipefail

GAME_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"  # tools → espejo-tour → e2e → game
cd "$GAME_DIR" || { echo "no pude cd a game/"; exit 2; }
WT_ROOT="$(cd "$GAME_DIR/.." && pwd)"

export U5_VITE_CACHE_DIR="${U5_VITE_CACHE_DIR:-$WT_ROOT/.vite-espejo}"
export U5_ESPEJO_SOFT="${U5_ESPEJO_SOFT:-1}"

# ── PASADA-VÍDEO ⇒ NO_EXPORT POR DEFECTO ─────────────────────────────────────
# Este script EXPORTA el checkpoint de cada parte, y desde que los saves del
# espejo están TRACKED eso reescribe 48 ficheros del repo. Pasó de verdad el
# 2026-07-27: una pasada-vídeo de 24 partes dejó los 24 .gam + 24 .sidecar
# modificados, y además grabó una cadena RE-DERIVADA (su part06 mataba la party,
# donde el checkpoint commiteado la tiene viva) ⇒ el vídeo no retrataba la
# cadena canónica. Con vídeo lo que se quiere es RETRATAR lo sellado, nunca
# reescribirlo: NO_EXPORT pasa a ser el default cuando `U5_ESPEJO_VIDEO=1`.
# Sigue siendo override-able a mano (U5_ESPEJO_NO_EXPORT=0) para un caso raro.
if [ -n "${U5_ESPEJO_VIDEO:-}" ]; then
  export U5_ESPEJO_NO_EXPORT="${U5_ESPEJO_NO_EXPORT:-1}"
  echo "run-per-part: vídeo ON ⇒ U5_ESPEJO_NO_EXPORT=$U5_ESPEJO_NO_EXPORT (no se reescriben los sellos)"
fi

# Foto de los saves TRACKED antes de empezar, para la guarda del final.
SAVES_DIR="e2e/espejo-tour/saves"
SAVES_DIRTY_BEFORE="$(git -C "$GAME_DIR/.." status --porcelain -- "game/$SAVES_DIR" 2>/dev/null | wc -l | tr -d ' ')"
PARTS="${U5_PARTS:-part01 part02 part03 part04 part05 part06}"

# PRESERVA los reports: cada invocación de playwright BORRA test-results/ al arrancar, así
# que sin esto sólo sobrevive el de la última parte. ESPEJO_OUT (FUERA de test-results/, que
# playwright limpia) a un dir común los salva — writeReport escribe partNN.report.json ahí.
PRESERVE="${ESPEJO_OUT:-$WT_ROOT/.espejo-reports}"
mkdir -p "$PRESERVE"

declare -a FAILED=()
declare -a PASSED=()
for p in $PARTS; do
  echo "==================== $p ===================="
  U5_ESPEJO_PARTS="$p" ESPEJO_OUT="$PRESERVE" npx playwright test -c playwright.espejo.config.ts
  rc=$?
  if [ "$rc" -eq 0 ]; then PASSED+=("$p"); else FAILED+=("$p(rc=$rc)"); fi
done
echo "reports preservados en: $PRESERVE"

# ── GUARDA: ¿se han reescrito checkpoints TRACKED? ───────────────────────────
# Ruidosa a propósito. Un save tracked reescrito por una pasada NO es un detalle:
# cambia la cadena canónica que otros carriles importan, y se cuela en un commit
# sin que nadie lo mire. Se avisa SIEMPRE; no se revierte solo (destruir trabajo
# ajeno en silencio sería peor que el propio problema).
SAVES_DIRTY_AFTER="$(git -C "$GAME_DIR/.." status --porcelain -- "game/$SAVES_DIR" 2>/dev/null | wc -l | tr -d ' ')"
if [ "${SAVES_DIRTY_AFTER:-0}" -gt "${SAVES_DIRTY_BEFORE:-0}" ]; then
  echo
  echo "*** AVISO: la pasada REESCRIBIÓ checkpoints TRACKED del espejo ***"
  echo "    antes: ${SAVES_DIRTY_BEFORE} modificados · ahora: ${SAVES_DIRTY_AFTER}"
  echo "    Si esto era una pasada de VÍDEO o de MEDICIÓN, NO querías esto:"
  echo "      git checkout -- game/$SAVES_DIR"
  echo "    y re-lanza con U5_ESPEJO_NO_EXPORT=1."
  echo "    Si de verdad querías re-sellar la cadena, ignora este aviso."
  echo
fi

echo "==================== RESUMEN ===================="
echo "PASSED: ${PASSED[*]:-(ninguna)}"
if [ "${#FAILED[@]}" -eq 0 ]; then
  echo "TODAS VERDES"
  exit 0
fi
echo "FALLARON: ${FAILED[*]}"
exit 1
