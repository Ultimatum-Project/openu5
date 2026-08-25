#!/usr/bin/env bash
# FASE 3d — MEDIDA EN VIVO. El plan está PRE-REGISTRADO en ../PREDICCION-3d.md; esto sólo lo
# ejecuta. Léelo antes de correr: el diseño no es obvio y un run mal pareado no mide nada.
#
# POR QUÉ ESTE ORDEN Y NO OTRO
# ---------------------------
# El ruido de cadena entre dos runs distintos es ×2.00 (medido: 27 segmentos que NINGÚN run
# condujo pasan de 8.1% a 16.1% sólo por el estado de la cadena). Como el efecto que se busca es
# ~×1.5, comparar contra un run viejo cualquiera NO MIDE NADA.
#
# El único pareado limpio disponible es `.espejo-3c`, porque corrió con NO_EXPORT desde los MISMOS
# checkpoints que siguen en disco. Por eso el experimento LIMPIO son exactamente las partes que
# `.espejo-3c` cubre y que tienen material 3d: ad14, ad17, ad24 (27 segs / 1106 comparables).
#
#   bash tools/run-3d.sh limpio      # ad14 ad17 ad24  → pareable contra .espejo-3c
#   bash tools/run-3d.sh cobertura   # ad15 ad25 ad18  → material, SIN brazo A (no da factor)
#   bash tools/run-3d.sh ad17        # una parte suelta
#
# ANÁLISIS (offline, sin gastar ventana):
#   npx tsx game/e2e/espejo-tour/tools/calib-paired.ts --a .espejo-3c --b .espejo-3d --phase 3d
#   npx tsx game/e2e/espejo-tour/tools/calib-interior.ts --dir .espejo-3d
#
# ⚠ VALIDACIÓN OBLIGATORIA ANTES DE MIRAR NINGÚN %: los segmentos ANTERIORES al primer 3d de cada
# parte tienen que reproducir `.espejo-3c` BYTE A BYTE. Si lo hacen, el pareado es limpio
# DEMOSTRADO; si no, el confundido sigue ahí y se reporta eso, no un factor. La comprueba
# `--verificar` (compara los transcripts de los segmentos previos entre los dos dirs).
set -uo pipefail

WT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"   # tools → espejo-tour → e2e → game → worktree
cd "$WT/game" || { echo "no pude cd a game/"; exit 2; }
OUT="$WT/.espejo-3d"
mkdir -p "$OUT"

case "${1:-}" in
  limpio)    PARTS="ad14 ad17 ad24" ;;
  cobertura) PARTS="ad15 ad25 ad18" ;;
  --verificar)
    # ¿reproducen los segmentos PREVIOS al primer 3d? (validación del pareado)
    npx tsx "$WT/game/e2e/espejo-tour/tools/verify-arm-a.ts" "${@:2}"
    exit $?
    ;;
  "")        echo "uso: run-3d.sh limpio|cobertura|--verificar|<parte...>"; exit 2 ;;
  *)         PARTS="$*" ;;
esac

export U5_VITE_CACHE_DIR="${U5_VITE_CACHE_DIR:-$WT/.vite-espejo}"  # cacheDir PROPIO (regla del repo)
export U5_ESPEJO_CORPUS=ad
export U5_ESPEJO_SOFT=1          # calibración: reporta sin asertar umbral
export U5_ESPEJO_NO_EXPORT=1     # ⚠ medición AISLADA: NO reescribe los checkpoints de la cadena.
                                 #   Sin esto se rompe la contigüidad de los reportes siguientes Y
                                 #   se destruye el brazo A (los checkpoints que hacen pareable 3c).
export ESPEJO_DUMP=1             # transcript congelado → re-medible offline sin gastar otra ventana
export ESPEJO_OUT="$OUT"

# ---------------------------------------------------------------- GUARDA DE CARGA
# La máquina es de 11 cores y la flota la satura: se han medido load 466 con 26 workers de vitest
# a la vez. Con esa carga, un run de conformidad NO vale — los timeouts del arnés (waitForTimeout,
# pacers de reloj de pared, resolvedor de combate) se disparan por contención y el transcript sale
# distinto por razones que no son el port. Vale más una medida tarde que envenenada.
LOAD1=$(uptime | sed 's/.*load averages*: *//' | awk '{print $1}' | tr -d ',')
LIMITE="${U5_LOAD_MAX:-20}"
if awk -v l="$LOAD1" -v m="$LIMITE" 'BEGIN{exit !(l>m)}'; then
  echo "ABORTADO: load average $LOAD1 > $LIMITE."
  echo "  Con la máquina así, la medida sería instrumento y no port (ver PREDICCION-3d.md §3)."
  echo "  Espera a que la flota calle, o fuerza con U5_LOAD_MAX=<n> si sabes lo que haces."
  exit 3
fi
echo "carga OK: load1=$LOAD1 (límite $LIMITE)"

# ------------------------------------------------------------- GUARDA DE VENTANA
# Un run cada vez: dos playwright a la vez se estorban y además rompen el mutex de la flota.
#
# ⚠ El patrón NO puede ser `pgrep -f "playwright test"` a secas: cualquier shell que ESPERE la
# ventana lleva esa cadena en su propia línea de comandos (un `until ! pgrep -f "playwright test"`
# se auto-detecta) y la guarda se bloquearía a sí misma para siempre. Medido en vivo. Se filtran
# los intérpretes: sólo cuenta el proceso que de verdad ejecuta playwright.
holders() {
  pgrep -f "playwright.*test" 2>/dev/null | while read -r pid; do
    cmd=$(ps -o command= -p "$pid" 2>/dev/null)
    case "$cmd" in
      */sh\ -c*|*/bash\ -c*|*/zsh\ -c*|*pgrep*) continue ;;   # esperadores y shells: no son dueños
      *node_modules/.bin/playwright*|*npm\ exec\ playwright*|*playwright/cli*)
        echo "$pid ${cmd:0:110}" ;;
    esac
  done
}
HOLDERS=$(holders)
if [ -n "$HOLDERS" ]; then
  echo "ABORTADO: la ventana la tiene otro carril."
  echo "$HOLDERS" | sed 's/^/  /'
  exit 3
fi

declare -a OK=() KO=()
for p in $PARTS; do
  echo "==================== $p ===================="
  U5_ESPEJO_PARTS="$p" npx playwright test -c playwright.espejo.config.ts
  rc=$?
  if [ "$rc" -eq 0 ]; then OK+=("$p"); else KO+=("$p(rc=$rc)"); fi
done

echo "==================== RESUMEN ===================="
echo "reportes+transcripts en: $OUT"
echo "PASSED: ${OK[*]:-(ninguna)}"
[ "${#KO[@]}" -eq 0 ] || { echo "FALLARON: ${KO[*]}"; exit 1; }
echo "SIGUIENTE: bash tools/run-3d.sh --verificar   (antes de mirar ningún porcentaje)"
