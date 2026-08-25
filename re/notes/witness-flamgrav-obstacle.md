# Witness #6 — In Flam Grav vs OBSTÁCULO (overworld) · WIP (PARADA — punto exacto)

**Carril:** oracle-fire (rama `re/oracle-fire`) · **Fecha:** 2026-07-19 · Desbloquea la
task #13 del lead (cablear castLineAoe fiel: opacity-stop 0x6a14 + peso radial + ámbito).
Probe: `re/notes/witness-flamgrav-obstacle-probe.py` (copia del scratchpad del carril).

## ESTADO: INCOMPLETO — sin dato de cast todavía

El probe llegó al overworld y corrió el escaneo de direcciones, pero el **SIGALRM (330s)
saltó DURANTE el primer cast** (`cast_ifg` hace 90 iteraciones de `resume()` sin settle →
demasiado lento para el presupuesto). **NO se completó ningún cast** ⇒ NO hay stop-vs-burn
ni geometría medidos en esta corrida.

## Las 2 preguntas del lead (para #13) y lo que sé HOY

1. **stop-vs-burn** (¿la celda opaca recibe código de campo 0x3a-0x3f o queda con su
   terreno?): **SIN MEDIR en vivo.** Pero OJO: **210/256 tiles son "opacos" a 0x6a14,
   INCLUIDA la hierba** (byte 0 = 0xff). El field-witness casteó In Flam Grav sobre hierba
   y sembró 5 celdas ⇒ si el overworld consultara 0x6a14 como opacity-stop, la hierba
   (opaca) lo cortaría en la 1ª celda y NO habría 5 celdas. **Eso ya sugiere que el
   overworld NO aplica el opacity-stop 0x6a14** (que es del aplicador de COMBATE 0x1c36).
2. **fijo-5 vs radial** en overworld: el field-witness ya vio patrón **FIJO de 5 celdas
   DETERMINISTA** (estable 30 turnos, sin variación) ⇒ **overworld usa el stamp simple
   CAST:0x004c, NO el aplicador probabilístico radial 0x1c36** (pico-2000). El radial +
   opacity-stop 0x6a14 pertenecen al aplicador de COMBATE/línea (In Flam Hur etc.).

**HIPÓTESIS DE TRABAJO (no confirmada por cast fresco, derivada de field-witness + ASM +
la tabla 0x6a14):** en OVERWORLD, In Flam Grav = **stamp fijo de 5 celdas, SIN peso radial
y SIN opacity-stop** (siembra las 5 celdas aunque caigan sobre terreno "opaco"/obstáculo).
El peso radial pico-2000 y el corte por 0x6a14 son **SOLO del aplicador de combate 0x1c36**.
Para #13: en overworld cablear stamp simple; reservar radial+opacity-stop al de combate.

## Por qué el escaneo de obstáculos de este probe NO sirve

- Leí `0xAD14` para clasificar tiles; devolvió **0x44/0x00 uniforme** alrededor del party.
  `0xAD14` en overworld NO es el mapa lógico limpio que asumí (el observable VALIDADO por
  el field-witness es el composite **0xab02**, con hierba=0x05, campo=0x3a-0x3f).
- El predicado `opaque()` (0x6a14) marca **casi todo** como opaco (210/256) ⇒ inútil para
  distinguir un obstáculo real de terreno abierto. Un "obstáculo" para este test debe ser
  **IMPASABLE** (montaña 0x0C, agua) y detectarse por su código en 0xab02, no por 0x6a14.

## Qué falta para CERRAR #6 (para la sesión de relevo)

1. **Arreglar el cast del probe:** `cast_ifg` es lento. Reusar el timing EXACTO de
   `probe_field_dur.py` (del carril field-duration, scratchpad
   `<scratch>/`)
   que SÍ casteó bien, o subir el alarm a ~400 y usar `pass_turn`-style (send_key + ticks +
   key_consumed) en vez de 90 resumes.
2. **Leer 0xab02 (NO 0xAD14)** para las celdas de campo (0x3a-0x3f) y para clasificar
   terreno (hierba 0x05 vs obstáculo).
3. **Test de obstáculo:** castear In Flam Grav apuntando a una celda IMPASABLE real
   (montaña/agua natural, localizada escaneando 0xab02, o reposicionando el party) y ver
   si esa celda recibe código de campo (BURN) o no (STOP). Predicción por la hipótesis:
   **BURN** (stamp fijo, sin obstacle-check en overworld).
4. **Confirmar fijo-5 vs radial:** castear 2-3 veces con seeds distintos sobre hierba; si
   el nº/posición de celdas NO varía → FIJO (stamp); si varía → radial probabilístico.
   (El field-witness ya apunta a FIJO.)

## Encaje con el pico-2000 radial del lead

Por la hipótesis, el **pico-2000 radial NO aplica en overworld** (patrón fijo-5 observado);
es del aplicador de combate 0x1c36. Para #13: el radial se cablea en el camino de COMBATE,
no en el stamp de overworld. **Pendiente de confirmar** con el cast fresco (punto 4).
