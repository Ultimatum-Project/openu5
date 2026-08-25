#!/bin/bash
# Barrido en el NAVEGADOR buscando el «pop del borde trasero»: casillas y direcciones donde
# la fila/columna trasera alcanza su negrura final en el PRIMER fotograma del tween (mutante)
# en vez de rampar (arreglo). Discriminante = índice del fotograma en que el borde trasero
# alcanza su incremento máximo, junto con el valor de ese incremento.
#   uso: barrido.sh <loc> <floor> <hora> <x0> <x1> <y0> <y1>
set -u
LOC=$1; FL=$2; H=$3; X0=$4; X1=$5; Y0=$6; Y1=$7
cd "$(dirname "$0")/../.."   # raíz de game/
for ((y=Y0; y<=Y1; y++)); do
  for ((x=X0; x<=X1; x++)); do
    for K in ArrowRight ArrowLeft ArrowUp ArrowDown; do
      OUT=/tmp/u5-barrido.json
      if U5_PORT=${U5_PORT:-5205} FRAMES=10 node tools/borde-salida/negrura.mjs \
           "skin=shader&nointro&loc=$LOC&floor=$FL&x=$x&y=$y&hour=$H" "$K" > "$OUT" 2>/dev/null; then
        L=$(node tools/borde-salida/pop.mjs "$OUT" | grep "BORDE TRASERO")
        VAL=$(echo "$L" | sed -nE 's/.*incremento ([0-9.]+) en f.*/\1/p')
        FR=$(echo "$L" | sed -nE 's/.*en f([0-9]+) .*/\1/p')
        VAL=${VAL:-0}; FR=${FR:-99}
        # Sólo interesa lo que salta pronto Y salta fuerte.
        if awk "BEGIN{exit !($VAL >= 0.30 && $FR <= 2)}"; then
          echo "POP loc$LOC z$FL ($x,$y) $K → $L"
        fi
      fi
    done
  done
done
echo "barrido terminado"
