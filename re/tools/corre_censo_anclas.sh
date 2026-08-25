#!/usr/bin/env bash
# CENSO DE ANCLAS DE TIENDA sobre los DOS corpus — carril `ad06-teclas`, ficha #12.
#
#   bash re/tools/corre_censo_anclas.sh <worktree> <dirSalida> [<paralelas>] [<puertoBase>]
#
# Corre TODAS las partes de LP1 (part01..06) y del corpus AD (ad01..25) con
# `U5_TECLAS_CENSO=1`, que hace que cada verificación de ancla de tienda DECLARE qué tienda
# hay viva de verdad frente a la que el ancla pidió. El veredicto lo da `censo_anclas.mjs`
# sobre los reports; aquí sólo se producen.
#
# 🔴 Cada brazo lleva su PROPIA caché de vite (derivada del dir de salida) porque varias
# partes corren A LA VEZ: con caché compartida dos brazos se pisan y el modo de fallo no es
# un error, son cifras plausibles del árbol equivocado. Misma razón que `corre_loteria.sh`.
#
# Exit 0 = todas las partes corrieron · 2 = error de uso · 3 = INVALIDADA (movió checkpoints
# tracked) · 4 = algún puerto ocupado al empezar.
set -uo pipefail

if [ "$#" -lt 2 ]; then
  echo "uso: $0 <worktree> <dirSalida> [<paralelas>] [<puertoBase>]" >&2
  exit 2
fi
WT=$(cd "$1" && pwd) || exit 2
OUT=$2
PAR=${3:-5}
BASE=${4:-5320}
mkdir -p "$OUT"

# 🔴 LAS PARTES SE DERIVAN DEL DISCO, NO SE CABLEAN. La primera versión de esto copió el
# default del spec (`part01..06`) y se dejó fuera 18 partes de LP1 que SÍ tienen ruta y
# checkpoint: 10 anclas de tienda quedaron sin censar y el denominador encogió en silencio,
# que es justo el modo de fallo que un censo no puede permitirse. `ALL` del spec es el
# alcance de la CADENA por defecto; el del CENSO es «todo lo que existe».
# `CENSO_PARTES="part08 part09"` acota a mano (para completar una tanda sin repetirla).
if [ -n "${CENSO_PARTES:-}" ]; then
  read -r -a PARTES <<< "$CENSO_PARTES"
else
  PARTES=()
  for f in "$WT"/game/e2e/espejo-tour/routes/*.route.json; do
    PARTES+=("$(basename "$f" .route.json)")
  done
  for f in "$WT"/game/e2e/espejo-tour/routes-ad/*.route.json; do
    PARTES+=("$(basename "$f" .route.json)")
  done
fi

# Guarda de puertos: con `reuseExistingServer` un vite ajeno vivo haría que un brazo midiera
# OTRO árbol sin dar error.
for k in $(seq 0 $((PAR - 1))); do
  P=$((BASE + k))
  if lsof -ti :"$P" >/dev/null 2>&1; then
    echo "🔴 PARO: puerto $P ocupado (PID $(lsof -ti :"$P" | tr '\n' ' '))" >&2
    exit 4
  fi
done

SAVES_ANTES=$(git -C "$WT" status --porcelain -- game/e2e/espejo-tour/saves | wc -l | tr -d ' ')
echo "=== CENSO DE ANCLAS · ${#PARTES[@]} partes · $PAR en paralelo · puertos $BASE..$((BASE + PAR - 1))"
echo "=== HEAD=$(git -C "$WT" rev-parse --short HEAD)  dirty=$([ -n "$(git -C "$WT" status --porcelain)" ] && echo true || echo false)"

corre_una() {
  local PARTE=$1 PORT=$2
  local CORPUS=lp1
  case "$PARTE" in ad*) CORPUS=ad ;; esac
  local D="$OUT/$PARTE"
  mkdir -p "$D"
  (
    cd "$WT/game" || exit 2
    export U5_VITE_CACHE_DIR="$D/.vite"
    export U5_E2E_PORT="$PORT"
    export U5_ESPEJO_SOFT=1
    export U5_ESPEJO_NO_EXPORT=1        # jamás reescribir los checkpoints TRACKED
    export ESPEJO_OUT="$D"
    export U5_TECLAS_CENSO=1
    unset U5_SELLOS_PERTURBA U5_SELLOS_PERTURBA_EN U5_TECLAS_SEG U5_TECLAS_FIX
    if [ "$CORPUS" = "ad" ]; then export U5_ESPEJO_CORPUS=ad; else unset U5_ESPEJO_CORPUS; fi
    U5_ESPEJO_PARTS="$PARTE" npx playwright test -c playwright.espejo.config.ts \
      --output="$D/.pw" > "$D/$PARTE.stdout.log" 2>&1
    echo "   $PARTE :$PORT rc=$?"
  )
}

i=0
while [ $i -lt ${#PARTES[@]} ]; do
  pids=()
  for k in $(seq 0 $((PAR - 1))); do
    idx=$((i + k))
    [ $idx -ge ${#PARTES[@]} ] && break
    corre_una "${PARTES[$idx]}" $((BASE + k)) &
    pids+=($!)
  done
  for p in "${pids[@]}"; do wait "$p"; done
  i=$((i + PAR))
done

SAVES_DESPUES=$(git -C "$WT" status --porcelain -- game/e2e/espejo-tour/saves | wc -l | tr -d ' ')
if [ "$SAVES_DESPUES" != "$SAVES_ANTES" ]; then
  echo "🔴 PARO: la tanda movió checkpoints TRACKED ($SAVES_ANTES → $SAVES_DESPUES) — INVALIDADA" >&2
  exit 3
fi
echo "=== censo producido en $OUT — el VEREDICTO lo da: node re/tools/censo_anclas.mjs $OUT"
exit 0
