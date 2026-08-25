#!/usr/bin/env bash
# LOS CINCO SELLOS, CORRIDOS Y ADJUDICADOS — una sola invocación, un solo veredicto.
#
#   bash re/tools/corre_sellos.sh <rutaDelWorktree> <puerto> [<dirSalida>]
#
# Exit 0 = los cinco intactos · 1 = hay algo que PARAR · 2 = error de uso · 3 = corrida
# INVALIDADA (tocó checkpoints tracked) · 4 = el puerto ya está ocupado por otro ·
# 5 = las únicas desviaciones son roturas REGISTRADAS y DENTRO de su caducidad.
#
# ★★ EL 5 EXISTE PORQUE UNA PUERTA SIEMPRE ROJA NO ES UNA PUERTA. Mientras `ad06-g34` siga
# roto por la ficha #12, el viejo `0 ó 1` daba 1 a TODO el que tocara `game/src/` o las rutas.
# La tabla distinguía ◑ ROTO-CONOCIDO de 🔴 ROTO-NUEVO, pero el exit los colapsaba: el humano
# lo veía y el llamador automático no. Y un semáforo permanentemente en rojo se ignora — el
# primer carril que aterrice diciendo «es la conocida» tendrá razón, y ahí se murió la puerta.
# El 5 NO es un aprobado: es «no te bloqueo, pero esta deuda está viva y tiene fecha».
# 🔴 Si la caducidad VENCE, vuelve a ser 1. Eso es lo que impide que «conocida» sea eterna.
#
# ── QUÉ CORRE Y POR QUÉ NO VALÍA NINGUNO DE LOS DOS RUNNERS QUE YA HAY ──────────────────
# Los cinco sellos viven en DOS corpus:  ad06 · ad09 · ad21 (corpus AD)  y  part04 · part05
# (corpus canónico LP1).
#   · `re/tools/run_brazo_espejo.sh` hace exactamente una parte, pero con `U5_ESPEJO_CORPUS=ad`
#     CABLEADO: no puede correr part04/part05. Y NO se toca — su cabecera dice que es «el
#     comando exacto con el que se adjudicaron F-1 y F-2, commiteado para que las cifras sean
#     reproducibles»: cambiarlo destruiría esa reproducibilidad.
#   · `game/e2e/espejo-tour/tools/run-per-part.sh` corre part01→06 en cadena, no un subconjunto
#     de dos corpus, y EXPORTA checkpoints por defecto.
# Este script reusa la disciplina del primero (puerto propio, caché propia, NO_EXPORT, guarda
# de saves) y añade lo único que faltaba: el corpus POR PARTE y un veredicto único.
#
# ── RÉPLICAS ────────────────────────────────────────────────────────────────────────────
# `veredicto_sellos.mjs` acepta VARIOS dirs de reports y los trata como réplicas de la misma
# parte. Los cinco sellos son DETERMINISTAS, así que una corrida basta y las réplicas sólo
# ENDURECEN (todas tienen que pagar); replicar NO puede salvar un sello que no paga:
#
#   for i in 1 2; do
#     U5_SELLOS_PARTES=ad06 bash re/tools/corre_sellos.sh "$WT" 5252 "$WT/.espejo-sellos-r$i"
#   done
#   node re/tools/veredicto_sellos.mjs "$WT"/.espejo-sellos-r{1,2} --desde=<ISO>
#
# 🔴 Y NO uses réplicas para «adjudicar» un sello que salga rojo: en un ÁRBOL DADO siempre
# pagan lo mismo (medido: `fd6c7f7f` dos veces desde dos worktrees → 220 y 220, y ninguna
# pareja del mismo árbol discrepó jamás). Si un sello no paga, lo que hay que etiquetar es el
# ÁRBOL, no repetir la corrida. El razonamiento entero está en `veredicto_sellos.mjs`.
#
# ── LAS PARTES SON INDEPENDIENTES, NO UNA CADENA ────────────────────────────────────────
# Cada parte importa el checkpoint COMMITEADO de su predecesora (`saves/`, tracked), así que
# correr ad06 sin correr ad01..ad05 es legítimo y es lo que hace `run_brazo_espejo.sh`. Por eso
# NO_EXPORT es obligatorio: si una corrida exportara, reescribiría la entrada de la siguiente
# parte y la cadena canónica dejaría de ser la sellada.
set -uo pipefail

# Dónde vive ESTE script (para resolver sus hermanas sin depender del árbol medido).
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$#" -lt 2 ]; then
  echo "uso: $0 <rutaDelWorktree> <puerto> [<dirSalida>]" >&2
  exit 2
fi
WT=$(cd "$1" && pwd) || exit 2
PORT=$2
OUT=${3:-"$WT/.espejo-sellos"}
mkdir -p "$OUT"

# ★★ UNA GUARDA DE PUERTO NO ES HIGIENE: ES LO QUE IMPIDE QUE EL VEREDICTO SEA DE OTRO ÁRBOL.
# `playwright.espejo.config.ts` pone `reuseExistingServer` cuando el puerto es explícito, así
# que si aquí hay un vite de OTRO CARRIL (zombi o vivo), esta corrida mide el código de AQUÉL.
# Y el modo de fallo es el peor posible: **no da error**. Da cifras plausibles del árbol
# equivocado, que se publican como veredicto de los sellos. Es el mismo filo que la caché
# compartida que contaminó cuatro partes el 02-08, en otra capa.
# Caso real (02-08): el 5242 asignado a este carril estaba ocupado por un vite VIVO del carril
# de UI; este `exit 4` es lo único que evitó medir su código y llamarlo main.
# ⇒ Si alguien propone `reuseExistingServer` para ir más rápido, ESTE párrafo es la respuesta.
# Se comprueba ANTES en vez de descubrirlo en las cifras.
if lsof -ti :"$PORT" >/dev/null 2>&1; then
  echo "🔴 PARO: el puerto $PORT ya está ocupado (PID $(lsof -ti :"$PORT" | tr '\n' ' '))." >&2
  echo "   Con reuseExistingServer, esta corrida mediría el código de ESE servidor. Elige otro" >&2
  echo "   puerto de la banda 52xx. (No mates procesos ajenos: 5199 es del usuario.)" >&2
  exit 4
fi

# Ventana de procedencia: los reports anteriores a este instante son de OTRA corrida.
DESDE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
SAVES_ANTES=$(git -C "$WT" status --porcelain -- game/e2e/espejo-tour/saves | wc -l | tr -d ' ')

cd "$WT/game" || exit 2
# Caché de vite PROPIA (no pisar la del dev-server del usuario). El nombre entra a propósito
# en el patrón `.espejo-*/` que .gitignore ya declara como genérico para los dirs derivados de
# cada ventana: llamarla `.vite-sellos` la dejaba FUERA del ignore y una corrida ensuciaba el
# árbol con la caché — un `git add -A` la habría commiteado. Medido, no supuesto.
export U5_VITE_CACHE_DIR="$WT/.espejo-sellos-vite"
export U5_E2E_PORT="$PORT"
export U5_ESPEJO_SOFT=1          # sin SOFT el espejo falla siempre por instrumento
export U5_ESPEJO_NO_EXPORT=1     # jamás reescribir los checkpoints TRACKED
# TESTIGO DE LA VARIANTE: el volcado del transcript es lo que permite saber QUÉ prompt de
# apertura sacó el herrero, y con eso distinguir «se movió el stream» de «el port rompió el
# ledger» (ver `testigo_variante.mjs`). Es una salida MÁS, no instrumentación: no toca lo que
# se mide — `writeTranscript` escribe las mismas líneas que el comparador ya había consumido.
export ESPEJO_DUMP=1
export ESPEJO_OUT="$OUT"

echo "=== SELLOS · worktree=$(basename "$WT") HEAD=$(git -C "$WT" rev-parse --short HEAD) :$PORT"
echo "=== salida=$OUT  desde=$DESDE"

# ══════════════════════════════════════════════════════════════════════════════════════════
# 🔴 HUELLA DEL ÁRBOL TRACKED — la guarda de CONTAMINACIÓN
# ══════════════════════════════════════════════════════════════════════════════════════════
# EL CASO REAL (02-08): un carril editó `layout-cuadrado.ts` y `skin.ts` en ESTE worktree
# mientras la puerta corría. Los sirve el MISMO vite ⇒ cada guardado disparó HMR y recargó la
# página bajo el arnés:
#     ad06: Error: page.evaluate: Execution context was destroyed, most likely because of
#           a navigation
# La puerta publicó `3/5 no intactos`, con `ad06`/`ad09` SIN-CORRER y **`part04-g03` ROTO,
# «DIVERGENCIA DE PORT»**. O sea: **una recarga de página se declaró defecto del port**. Si
# eso se publica, alguien construye un mecanismo encima — que es literalmente lo que ya pasó
# con `ad06-g34`.
#
# ★★ POR QUÉ ESTA GUARDA NO ENUMERA CANALES. Ya había una guarda de contaminación —los
# checkpoints tracked— y NO saltó, porque el HMR es OTRO canal. Una guarda que cubre un canal
# y deja otro abierto no sólo no protege: **su verde tapa el hueco**
# ([[invisible-es-relativo-a-la-lista-de-canales]]). Así que NO se vigila `game/src/` ni una
# lista de sospechosos: se toma la huella del ÁRBOL TRACKED ENTERO. Caza el HMR, un `stash`,
# un `checkout`, un `sed` despistado y **el canal que se invente mañana**.
#
# Dos señales, porque miden cosas distintas:
#   · CONTENIDO (sha1 por fichero) — el fichero acabó distinto.
#   · MTIME — el fichero se TOCÓ durante la ventana aunque su contenido volviera a ser el
#     mismo. Un editar-y-deshacer a mitad de corrida ya disparó el HMR: contaminó igual, y
#     una huella de contenido sola lo daría por limpio.
# Coste medido: ~1 s sobre 3.380 ficheros tracked, contra una corrida de ~25 min.
# 🔴 DOS BUGS PROPIOS, LOS DOS CAZADOS PROBANDO LA GUARDA ANTES DE CABLEARLA:
#  (1) La v1 separaba campos con DOS ESPACIOS y comparaba con `join -j 3`. El `join` partía mal
#      los campos y **el cambio de CONTENIDO no se reportaba** — sólo el de mtime. Una guarda
#      que detecta la contaminación pero se calla el caso PRINCIPAL es peor que ninguna.
#      ⇒ campos con TAB y comparación con `awk`, que no adivina separadores.
#  (2) La v2 hacía `shasum` UNA VEZ POR FICHERO dentro de un bucle: 3.380 procesos, y la huella
#      pasaba de ~1 s a más de 2 min ×2 (antes y después). Una guarda que cuesta minutos se
#      acaba desactivando "sólo por esta vez". ⇒ `xargs` BATCHEA shasum y stat, y `join` los une.
huella_arbol() { # $1 = fichero de salida: "<ruta>\t<sha1>\t<mtime>"
  ( cd "$WT" || exit 2
    git ls-files -z | xargs -0 shasum -a 1 2>/dev/null \
      | sed -E 's/^([0-9a-f]+)  (.*)$/\2\t\1/' | sort -t"$(printf '\t')" -k1,1 > "$1.h"
    # 🔴 TAB REAL, no '\t': el `stat` de BSD NO interpreta escapes en el formato — escribía la
    # cadena literal "\t", el `join` no casaba NADA y la huella salía VACÍA. O sea, la guarda
    # habría dicho "árbol quieto" SIEMPRE. Un fallo silencioso y a favor del resultado cómodo,
    # que es la familia que más caro sale aquí. [[el-vacio-se-lee-como-exito]]
    git ls-files -z | xargs -0 stat -f "%N$(printf '\t')%m" 2>/dev/null \
      | sort -t"$(printf '\t')" -k1,1 > "$1.m"
    join -t"$(printf '\t')" -1 1 -2 1 "$1.h" "$1.m" > "$1"
    rm -f "$1.h" "$1.m" )
}
HUELLA_ANTES="$OUT/.huella-antes.txt"
HUELLA_DESPUES="$OUT/.huella-despues.txt"
huella_arbol "$HUELLA_ANTES"
echo "=== huella del árbol tracked: $(wc -l < "$HUELLA_ANTES" | tr -d ' ') ficheros"

# parte:corpus — el corpus es POR PARTE, que es justo lo que ningún runner existente sabía.
#
# `U5_SELLOS_PARTES="ad06 ad09"` corre un SUBCONJUNTO. Existe para BISECAR (una parte son ~5
# min; las cinco, ~25) y para validar el propio script sin gastar la tanda entera.
# ⚠ Y no relaja nada: el veredicto sigue enumerando los CINCO, así que un subconjunto sale
# ROJO con las que faltan marcadas SIN-CORRER. Recortar el alcance NO puede fabricar un verde.
TODAS="ad06:ad ad09:ad ad21:ad part04:lp1 part05:lp1"
SPECS="$TODAS"
if [ -n "${U5_SELLOS_PARTES:-}" ]; then
  SPECS=""
  for want in $U5_SELLOS_PARTES; do
    for s in $TODAS; do [ "${s%%:*}" = "$want" ] && SPECS="$SPECS $s"; done
  done
  [ -z "$SPECS" ] && { echo "🔴 U5_SELLOS_PARTES='$U5_SELLOS_PARTES' no nombra ninguna parte de sello" >&2; exit 2; }
  echo "⚠ SUBCONJUNTO a petición: $SPECS — el veredicto seguirá exigiendo los CINCO"
fi

for spec in $SPECS; do
  parte=${spec%%:*}; corpus=${spec##*:}
  echo "──────── $parte (corpus $corpus)"
  if [ "$corpus" = "ad" ]; then export U5_ESPEJO_CORPUS=ad; else unset U5_ESPEJO_CORPUS; fi
  U5_ESPEJO_PARTS="$parte" npx playwright test -c playwright.espejo.config.ts \
    > "$OUT/$parte.stdout.log" 2>&1
  echo "   rc=$? · $(grep -cE '^' "$OUT/$parte.stdout.log") líneas de log"
done

# GUARDA 1 — CONTAMINACIÓN DEL ÁRBOL. Va ANTES que la de checkpoints porque es la general:
# si el árbol tracked se movió durante la corrida, NADA de lo medido es adjudicable, y decirlo
# «roto» sería declarar defecto del port una edición nuestra.
huella_arbol "$HUELLA_DESPUES"
if ! cmp -s "$HUELLA_ANTES" "$HUELLA_DESPUES"; then
  echo "" >&2
  echo "🔴 CORRIDA INVALIDADA — EL ÁRBOL TRACKED CAMBIÓ DURANTE LA MEDICIÓN" >&2
  echo "   Ningún número de esta corrida es adjudicable: una edición en el worktree que sirve" >&2
  echo "   el vite recarga la página bajo el arnés (HMR) y el fallo se DISFRAZA de divergencia" >&2
  echo "   del port. NO se publica como sello roto." >&2
  echo "" >&2
  # Nombrar QUÉ cambió, y distinguir contenido de sólo-mtime: son diagnósticos distintos.
  # Altas y bajas incluidas — un fichero tracked que aparece o desaparece también contamina.
  awk -F'\t' '
    NR==FNR { h1[$1]=$2; m1[$1]=$3; next }
            { h2[$1]=$2; m2[$1]=$3 }
    END {
      for (r in h1) {
        if (!(r in h2))            printf "   − DESAPARECIÓ: %s\n", r
        else if (h1[r] != h2[r])   printf "   ✗ CONTENIDO: %s\n", r
        else if (m1[r] != m2[r])   printf "   ~ TOCADO (mismo contenido, mtime movido): %s\n", r
      }
      for (r in h2) if (!(r in h1)) printf "   + APARECIÓ: %s\n", r
    }' "$HUELLA_ANTES" "$HUELLA_DESPUES" >&2
  echo "" >&2
  echo "   Re-corre con el árbol QUIETO (o en un worktree que nadie esté editando)." >&2
  exit 3
fi

# GUARDA 2 — CHECKPOINTS. Redundante con la de arriba en el caso normal (los saves son
# tracked), pero se mantiene porque su MENSAJE es específico y accionable, y porque si algún
# día la huella se relajara, ésta sigue cubriendo el canal más caro.
SAVES_DESPUES=$(git -C "$WT" status --porcelain -- game/e2e/espejo-tour/saves | wc -l | tr -d ' ')
if [ "$SAVES_DESPUES" != "$SAVES_ANTES" ]; then
  echo "🔴 PARO: la corrida movió checkpoints TRACKED ($SAVES_ANTES → $SAVES_DESPUES) — INVALIDADA" >&2
  echo "   git -C $WT checkout -- game/e2e/espejo-tour/saves" >&2
  exit 3
fi

echo
# ★ El veredicto se resuelve contra ESTE script, NO contra el worktree medido. El caso de uso
# principal es justamente medir un árbol AJENO y PRISTINO (main sin parches, protocolo de
# `reloj-27`), y ese árbol no tiene por qué llevar la herramienta: buscarla dentro de él
# hacía fallar la corrida por ENOENT justo en el escenario para el que existe.
node "$AQUI/veredicto_sellos.mjs" "$OUT" --desde="$DESDE"
RC_VEREDICTO=$?

# ★★ EL ANCLA VIAJA CON EL VEREDICTO, no en el mensaje de quien lo cita.
# Un veredicto de puerta es de un SHA, no de un carril: si luego se le añaden commits encima
# (o se mergea main), puede dejar de cubrir lo que se entrega. Imprimir aquí el SHA MEDIDO y
# el comando exacto para comprobar su vigencia convierte esa comprobación en algo que se
# EJECUTA en vez de algo de lo que hay que ACORDARSE.
# La regla de arrastre: el veredicto sigue vigente sobre `sha_medido + deltas FUERA de alcance`
# — «main es ancestro» NO basta, porque contesta otra pregunta.
SHA_MEDIDO=$(git -C "$WT" rev-parse --short HEAD)
echo
echo "── ANCLA DE ESTE VEREDICTO ────────────────────────────────────────────────"
# ⚠ El predicado de SUCIO es el MISMO que sella `procedencia()` en el report
# (`git status --porcelain` no vacío — incluye untracked). Usar aquí `diff --quiet HEAD`
# habría sido un SEGUNDO clasificador del mismo hecho: el report diría dirty y esta línea no.
SUCIO=""
[ -n "$(git -C "$WT" status --porcelain 2>/dev/null)" ] && SUCIO="  ⚠ ÁRBOL SUCIO: el sha NO identifica lo que se midió"
echo "   medido sobre: ${SHA_MEDIDO}${SUCIO}"
echo "   ¿sigue vigente cuando entregues?  bash re/tools/veredicto_vigente.sh $SHA_MEDIDO"
echo "───────────────────────────────────────────────────────────────────────────"
exit $RC_VEREDICTO
