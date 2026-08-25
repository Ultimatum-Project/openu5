#!/usr/bin/env bash
# ¿EL SELLO DE LA BATERÍA ACREDITA EL ÁRBOL QUE SE ENTREGA? — la mitad que convierte el sello
# en una COMPROBACIÓN. Sin esto, el sello es doctrina con un fichero al lado.
#
#   bash re/tools/bateria_vigente.sh <sha-que-entregas>
#
# Exit 0 = el sello acredita ESE árbol · 1 = no lo acredita (y dice por qué) · 2 = error de uso.
#
# ════ POR QUÉ NO BASTA CON QUE EL SELLO EXISTA ═════════════════════════════════════════════
# `bateria_aterrizaje.sh` sella su EXIT en disco para que una TUBERÍA no pueda falsificarlo
# (séptima forma de esa trampa en esta flota). Pero un sello que sólo se cita a mano hereda el
# problema que venía a resolver: alguien mira, alguien cita, alguien se equivoca. Lo que lo
# convierte en puerta es que un PROGRAMA lo lea y diga que no.
#
# Comprueba TRES cosas, y las tres han fallado por separado en este repo:
#  · EXIT ≠ 0            — el verde que nadie leyó.
#  · SHA ≠ el que entregas — el sello de OTRO árbol. Es `arbol-en-transicion-no-es-una-foto`:
#    una batería verde de hace tres commits no acredita el de ahora, y desde fuera se ve igual.
#  · DIRTY = true        — verde sobre árbol sucio: acredita lo que había en disco, no el commit.
#
# 🔴 LA AUSENCIA ES ROJA, no verde. Si no hay sello, no es «no falló»: es «no se corrió, o se
# corrió con filtros, o murió de un kill -9». Un gate que aprueba por falta de datos es peor
# que no tener gate — el mismo principio que la guarda de existencia de `veredicto_sellos`.
set -u

if [ "$#" -ne 1 ]; then
  echo "uso: bash re/tools/bateria_vigente.sh <sha-que-entregas>" >&2
  exit 2
fi
ESPERADO_SHA=$1
cd "$(dirname "$0")/../.."
# `BATERIA_SELLO` permite apuntar a OTRO sello — lo usa su testigo para no pisar el real.
# No es una desactivacion: no salta ninguna comprobacion, solo cambia el fichero que lee.
SELLO="${BATERIA_SELLO:-.claude/bateria-sello.txt}"

# ════ ¿HAY UNA BATERÍA VIVA EN ESTE WORKTREE? — SE CENSA ANTES DE LEER EL SELLO (#291) ═════
# 🔴 MEDIDO POR playlist-espejo-278 (14-08) EN VIVO: este censo vivía DENTRO de la rama
# «sello ausente», y el caso ENCOLADO es exactamente el contrario — bateria_aterrizaje.sh
# borra el sello DESPUÉS de ganar el cerrojo (rm tras la espera), así que durante TODA la
# ventana de cola el sello ANTERIOR (rancio) sigue en disco y este script lo adjudicaba:
# rc=1 con la batería VIVA en el worktree, y el consejo «vuelve a correrla» fabricaba una
# corrida DUPLICADA en una cola que ya tenía tres. El hueco existe SOLO en la ventana de
# cola — que crece con la longitud de la cola, hoy la condición normal de la flota.
#
# La regla que lo cierra: mientras haya una corrida en vuelo EN ESTE worktree, NINGÚN sello
# en disco adjudica — es de una corrida anterior POR CONSTRUCCIÓN (la que vuela lo va a
# borrar y reescribir), sea cual sea su EXIT o su SHA. Los dos estados hermanos de REGLA 3
# («ausente-porque-corre» y «presente-pero-ajeno») reciben así la MISMA suerte: exit 3.
VIVAS=""
for _p in $(ps -eo pid,args | awk '$2=="bash" && $3 ~ /bateria_aterrizaje\.sh$/ {print $1}'); do
  # El cwd se resuelve contra ESTE worktree por PID; nunca por patrón de nombre (REGLA 3).
  if lsof -a -p "$_p" -d cwd -Fn 2>/dev/null | grep -q "^n$PWD\$"; then VIVAS="$VIVAS $_p"; fi
done
if [ -n "$VIVAS" ]; then
  echo "⏳ BATERÍA VIVA en este worktree (PID$VIVAS) — su veredicto SUPERSEDE a todo sello en disco." >&2
  if [ -f "$SELLO" ]; then
    echo "   El sello presente es de una corrida ANTERIOR: el borrado va tras ganar el cerrojo," >&2
    echo "   así que en cola el sello rancio sigue en disco y se lee como fresco. NO adjudica." >&2
  else
    echo "   El sello se escribe en el trap de salida, así que durante la corrida NO existe." >&2
  fi
  echo "   Esto NO es «no se corrió» ni «re-lánzala»: es «espera». Vuelve a preguntar al terminar." >&2
  exit 3
fi

if [ ! -f "$SELLO" ]; then
  # 🔴 SEÑALADO POR asm-cast-dispatch (07-08): la enumeración de causas de este mensaje
  # tenía TRES y faltaba la cuarta — ESTÁ CORRIENDO AHORA MISMO. No es un matiz: la batería
  # `rm -f "$SELLO"` al arrancar (bateria_aterrizaje.sh:144) y sólo lo escribe en el trap de
  # EXIT (:162), así que durante TODA la corrida el fichero no existe. O sea que el estado
  # más normal del mundo —una batería en vuelo— caía en una lista que sólo nombraba fallos,
  # y quien la leyera concluía «no la corriste» sobre alguien que la estaba corriendo.
  # ★★ La AUSENCIA sigue siendo roja y eso no cambia; lo que estaba mal era el DIAGNÓSTICO.
  # Una lista de causas incompleta cuyo hueco se parece a las que sí están es peor que no
  # dar causas: dirige la investigación al sitio equivocado con aire de haberla acotado.
  # (#291: el censo de baterías vivas corre ARRIBA, antes de mirar el sello — tenía que
  #  cubrir también el caso sello-PRESENTE-pero-rancio de la ventana de cola, así que si
  #  esta rama se alcanza es que NO hay ninguna corrida viva en este worktree.)
  echo "🔴 SIN SELLO: no hay '$SELLO' y NO hay ninguna batería viva en este worktree." >&2
  echo "   La batería no se ha corrido aquí, o se corrió con filtros (esa rama no sella a" >&2
  echo "   propósito), o murió sin llegar al trap." >&2
  echo "   La ausencia NO es un verde." >&2
  exit 1
fi

# shellcheck disable=SC1090
. "$SELLO"   # EXIT, SHA, DIRTY, CARDINAL, WHEN

# ════ ¿LO ESCRIBIÓ LA BATERÍA DE HOY, O UNA COPIA VIEJA DEL SCRIPT? ══════════════════════
# 🔴 SEÑALADO POR re/kernel-3178 (07-08), y es una clase que no teníamos: el cerrojo y la
# guarda de fase viven en `bateria_aterrizaje.sh` EN MAIN, pero **cada carril ejecuta la copia
# de SU RAMA**. Una rama que no haya rebasado corre la batería VIEJA — sin cerrojo, sin la
# guarda de `game/assets` y sin negarse a sellar un verde de una corrida abortada. El arreglo
# estaba verde como artefacto del repo y era INERTE en lo que de verdad se ejecuta.
#
# ★★ Y lo que hizo invisible el hueco fue mi propia evidencia: vi MI corrida encolarse detrás
# de otra y lo di por desplegado. **Una observación positiva de un mecanismo prueba el caso
# que observaste, no su cobertura** — sólo podía verlo entre ramas que YA lo tenían.
#
# El tell no hay que inventarlo: los campos son nuevos, así que **su AUSENCIA data el script**.
# Un sello sin `CERROJO=` lo escribió una batería anterior al 07-08. No invalida su EXIT —lo
# que dice es que corrió SIN las tres guardas nuevas—, así que avisa fuerte y no rechaza.
if [ -z "${CERROJO:-}" ] || [ -z "${FASE:-}" ]; then
  echo "⚠️  SELLO DE UNA BATERÍA VIEJA: no lleva CERROJO= ni FASE=." >&2
  echo "    Tu rama ejecuta una copia del script anterior al 07-08 ⇒ corrió SIN cerrojo de" >&2
  echo "    exclusión, SIN la guarda de game/assets y SIN la negativa a sellar un verde de" >&2
  echo "    una corrida abortada. El EXIT vale; las tres guardas NO estuvieron." >&2
  echo "    Trae main a tu rama y re-sella antes de entregar." >&2
fi

fallos=0
if [ "${EXIT:-1}" != "0" ]; then
  echo "🔴 El sello dice EXIT=$EXIT — la batería NO pasó." >&2
  fallos=$((fallos + 1))
fi
# ── ¿MISMO COMMIT? SE COMPARAN OBJETOS, NO CADENAS ──────────────────────────────
# 🔴 DEFECTO MEDIDO EL 06-08-2026, EN EL PRIMER USO AJENO Y EN UN ATERRIZAJE REAL.
# Esto era `[ "$SHA" != "$ESPERADO_SHA" ]`, igualdad de texto. El sello graba con
# `rev-parse --short` (8 dígitos) y quien verifica usa `git rev-parse HEAD` —la forma
# canónica— que da los 40. Resultado: el MISMO commit se rechazaba como «otro árbol».
# Discriminante que lo fijó, corrido en el mismo instante sobre el mismo sello:
#     bateria_vigente.sh f691ef19…2680  → EXIT 1, «SELLO DE OTRO ÁRBOL»
#     bateria_vigente.sh f691ef19       → EXIT 0, «✓ VIGENTE»
# Y el modo de fallo es de los peores: **rechaza en la dirección segura**, así que se
# lee como «el árbol se movió» y no como defecto del instrumento — el lead estuvo a
# punto de re-correr una batería de 25 min por esto.
#
# El arreglo no normaliza longitudes (eso deja la clase viva: mañana alguien pasa un
# tag, o `HEAD`, o mayúsculas): **resuelve las dos revisiones a objeto con git y
# compara los objetos**. Los SHAs son OBJETOS, no cadenas. De regalo, acepta `HEAD`,
# tags y cualquier revisión válida.
resuelve() { git rev-parse --verify --quiet "${1}^{commit}" 2>/dev/null; }
SHA_SELLADO_OBJ=$(resuelve "${SHA:-}")
SHA_ESPERADO_OBJ=$(resuelve "$ESPERADO_SHA")

if [ -n "$SHA_SELLADO_OBJ" ] && [ -n "$SHA_ESPERADO_OBJ" ]; then
  MISMO=$([ "$SHA_SELLADO_OBJ" = "$SHA_ESPERADO_OBJ" ] && echo si || echo no)
  COMO="objeto"
else
  # Alguna de las dos no resuelve — típicamente el sello es de un commit que un rebase
  # dejó huérfano y el `gc` ya se llevó. Se cae a PREFIJO (una abreviatura de git es un
  # prefijo del completo), y se DICE que la comparación fue textual: el grado viaja con
  # el veredicto en vez de quedarse en la cabeza de quien lo corrió.
  corto=${SHA:-}; largo=$ESPERADO_SHA
  [ ${#corto} -gt ${#largo} ] && { corto=$ESPERADO_SHA; largo=${SHA:-}; }
  case "$largo" in
    "$corto"*) MISMO=si ;;
    *) MISMO=no ;;
  esac
  COMO="prefijo (una de las dos revisiones no resuelve a objeto en este repo)"
fi

if [ "$MISMO" != "si" ]; then
  echo "🔴 SELLO DE OTRO ÁRBOL: sellado sobre '${SHA:-?}', entregas '$ESPERADO_SHA'." >&2
  echo "   Una batería verde de otro commit no acredita éste — vuelve a correrla." >&2
  echo "   (comparado por $COMO)" >&2
  fallos=$((fallos + 1))
fi
if [ "${DIRTY:-true}" != "false" ]; then
  echo "🔴 ÁRBOL SUCIO al sellar: el verde acredita lo que había en disco, no el commit." >&2
  fallos=$((fallos + 1))
fi

if [ "$fallos" -gt 0 ]; then
  echo "   (sello: EXIT=${EXIT:-?} SHA=${SHA:-?} DIRTY=${DIRTY:-?} CARDINAL=${CARDINAL:-?} WHEN=${WHEN:-?})" >&2
  exit 1
fi

echo "✓ VIGENTE — la batería pasó sobre $ESPERADO_SHA con el árbol limpio."
echo "   cardinal ${CARDINAL:-?} · sellado ${WHEN:-?}"
