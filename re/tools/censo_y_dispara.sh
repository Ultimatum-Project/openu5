#!/bin/bash
# Vigía de batería SIN auto-coincidencia — espera-y-dispara para carriles.
# Uso: bash re/tools/censo_y_dispara.sh <worktree_abs> <status_file> <log_file>
#
# 🔴 El bug que arregla (medido por asm-shoppes-3, 06-08-2026): si el bucle de
# espera vive en la LÍNEA DE ÓRDENES, su propia cmdline contiene «pytest», así
# que `pgrep -f pytest` SE CENSA A SÍ MISMO y el vigía se bloquea contra su
# reflejo (66 rondas medidas contra ronda 1 con el mismo disco). Excluir $$ no
# basta: el subshell de `( … ) &` tiene otro PID. En un script, la cmdline es
# sólo este nombre de fichero. El CWD no discrimina vigía de batería — el
# discriminante es la CMDLINE.
#
# Las TRES piezas son deliberadas y ninguna es cosmética:
#  (a) vivir en un fichero — rompe el auto-emparejamiento;
#  (b) el filtro por cmdline que descarta vigías — puede haber vigías de otros
#      carriles con el defecto viejo;
#  (c) la línea de censo explícita antes del DISPARO — hace el veredicto
#      ATRIBUIBLE. El veredicto es el par DISPARO+EXIT de TU status, nunca el
#      contenido de un log (hubo un 201/201 verde huérfano que era trampa).
# Si al tocar esto se cae (c), vuelve el modo de fallo del log huérfano.
#
# Cota honesta (del autor): probado con pytest en un worktree; si el patrón de
# carga deja de ser `pytest`, revisar el filtro (b) junto con él.
WT="$1"
ST="$2"
LOG="$3"
CERROJO=<repo>/.claude/CONTENCION
[ -d "$WT" ] || { echo "worktree no existe: $WT" >&2; exit 64; }
cd "$WT" || exit 64
: > "$ST"
for i in $(seq 1 60); do
  CERR=0; [ -e "$CERROJO" ] && CERR=1
  AJ=""
  for p in $(pgrep -f pytest); do
    [ "$p" = "$$" ] && continue
    CMD=$(ps -o command= -p "$p" 2>/dev/null)
    # 🔴 FANTASMA (censo #45): PID muerto ⇒ ps devuelve VACÍO, y un case sobre
    # cadena vacía no casa nada ⇒ el muerto contaba como ajeno y el vigía
    # esperaba a un proceso inexistente (9-21 irresolubles medidos). Muerto no cuenta.
    [ -z "$CMD" ] && continue
    case "$CMD" in *censo_y_dispara*) continue;; esac   # nunca contar vigías
    # 🔴 SONDA (censo #45): el propio pgrep de OTRO vigía contiene «pytest» y no
    # contiene «censo_y_dispara» — dos vigías se censaban las sondas mutuamente
    # (31/40 rondas). Solo cuenta un INTÉRPRETE ejecutando pruebas de verdad.
    case "$CMD" in *pgrep*) continue;; esac
    case "$CMD" in *python*|*pytest*) ;; *) continue;; esac
    C=$(lsof -p "$p" 2>/dev/null | grep ' cwd ' | awk '{print $NF}')
    AJ="$AJ $p:$C"
  done
  if [ "$CERR" = "0" ] && [ -z "$AJ" ]; then
    echo "CENSO_OK_ronda_$i: cerrojo ausente, cero pytest ajenos" >> "$ST"
    echo "DISPARO" >> "$ST"
    bash re/tools/bateria_aterrizaje.sh > "$LOG" 2>&1
    echo "EXIT=$?" >> "$ST"
    exit 0
  fi
  echo "[$i] espera cerrojo=$CERR ajenos='$AJ'" >> "$ST"
  # JITTER (censo #45): un sleep fijo NO decorrela dos vigías — los ENGANCHA en
  # lockstep al milisegundo (|tA−tB| mediana 0,0 ms medida) y evalúan el mismo
  # instante, donde la ventana de 34 ms sí importa. El jitter rompe el lockstep.
  sleep $((14 + RANDOM % 4))
done
echo "EXIT=TIMEOUT_ESPERA" >> "$ST"
