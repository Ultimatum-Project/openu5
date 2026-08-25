# heredados-b · TANDA 3 — el renombre aprobado y el canal RANGO, con su control

Carril `heredados-b` · 2026-07-28 · rama `re/heredados-b`.
Contador `verified_inherited_without_cite`: **113 → 112**.

> Verificada con `re/tools/seed_diff.py` bajo R5: 0 sembradas, 0 cambiadas.

Tanda corta y de dos piezas: ejecuto el renombre que el lead aprobó, y aterrizo como
pieza lateral la expansión de rangos en el triaje, **con el control que la primera
versión no pasó**.

---

## 1. El renombre, ejecutado

| rutina | antes | ahora |
|---|---|---|
| `LOOKOBJ.OVL:0xe7a` | `gem_glyph_wall_outline_door` | `gem_glyph_road_junction` |

La fila llevaba desde la tanda 1 con la cita puesta y **sin** `verified`, porque el cuerpo
refutaba su nombre y no me lo auto-concedí. Aprobado el renombre, la fila baja el contador
**por la puerta de delante**: `renamed_from` encadenado —no pisado—, `naming_verified` y
`verified`, y una cita nueva que explica el cambio sin re-derivar el cuerpo, que ya estaba
leído entero en la tanda 1.

**El reparto del nombre va declarado a propósito, porque las dos mitades no tienen el
mismo respaldo.** `junction` lo fija **este cuerpo**: un centro relleno de 2×2 y hasta
cuatro muñones de 2 px hacia los lados que marque una máscara de 4 bits. `road` **no lo
fija el cuerpo**: lo fijan el juego de tiles —la categoría son exactamente siete, y sus
máscaras leídas del binario son vertical, horizontal, los cuatro codos y el cruce: una red
de caminos completa— más el corpus y el port, que ya lo llamaban camino. Lo dejo escrito
en la cita para que nadie lea `road` como derivado del cuerpo.

---

## 2. El canal RANGO, aterrizado en `triage_heredados.py`

La cuarta ceguera de la tanda 1: el corpus cubre a veces una familia entera escribiendo
**sólo los dos extremos** de un rango, y un índice de offsets literales no puede verlo.
El lead lo aprobó como pieza lateral mía, con la corrección del §9 dentro: **rinde poco y
no pasa nada, porque es barato**.

**Cómo queda.** Una tercera señal, separada y contable: una fila entra en el bucket fuerte
si algún offset suyo cae dentro de un rango declarado en una línea **que además nombre su
overlay en la misma línea**. Se reporta aparte (`rango`, `n_rango`) para que su aportación
siga siendo audible en vez de fundirse con la señal clásica.

**Lo que aporta, medido el 2026-07-28 a las 09:15 UTC sobre 112 filas:** cinco filas con
cobertura por rango, de las cuales **cuatro son ganancia neta** (la quinta ya tenía señal
estrecha). Un 3,6%. La cifra que anuncié en la tanda 1 antes de medir era «la ceguera más
cara de todas»; sigue retirada.

Las cuatro: dos de `BLCKTHRN`, una de `ENDGAME` y una de `TOWN`.

---

## 3. ★ El control, que es lo que hace que esta pieza valga algo

La **primera versión** de este canal, la del scratchpad, **suspendió su control positivo:
0 de 13**. No encontraba ninguna de las trece filas que yo acababa de adjudicar y de las
que sabía la respuesta. Y aun así ya había producido una salida de aspecto perfectamente
respetable —17 filas «con cobertura»—, de las que diez estaban atribuidas al overlay
equivocado.

Dos defectos, los dos medidos:

1. **Exigía el sufijo `.OVL`.** El corpus escribe el nombre del overlay **desnudo 2375
   veces y con sufijo 1209** — casi 2 a 1.
2. **Arrastraba el contexto de líneas anteriores**, o sea el `ctx` pegajoso de la tarjeta
   #84 reproducido dentro del instrumento escrito para cazar otro defecto.

`re/tools/test_triage_heredados.py` trae los dos controles de siempre, y además **verifiqué
que el positivo se pone rojo cuando el defecto vuelve**: reintroduciendo la exigencia del
sufijo, la cobertura de la familia cae a **0 de 13**; con el instrumento sano, **13 de 13**.
Sin haber visto el detector fallar, el verde no significaría nada.

Hay también una **garantía monótona** en el test: el canal nuevo sólo puede AÑADIR filas al
bucket fuerte, nunca quitar ninguna. Y un caso que sale negativo a propósito —el encabezado
de la §4.3 declara el rango pero no nombra el overlay, así que no atribuye— para que se vea
que la cobertura viene de la línea 199, que sí lo nombra, y no de la que uno esperaría.

**Lo que NO he tocado:** el volcado que `main()` escribe sigue reescribiendo el fichero
tracked de 168 filas que referencian las actas de heredados-168. Lo reporté en la tanda 2 y
lo mantengo como decisión del lead: cambiar la semántica de escritura de un instrumento
compartido no es mío.

---

## 4. Estado

**17 filas adjudicadas** en tres tandas; contador **128 → 112**.

**Reparto CON FECHA** (2026-07-28 09:15 UTC, sobre 112): **19 FUERTE · 75 DÉBIL · 18 SIN
RASTRO**, de los cuales 5 fuertes lo son por el canal nuevo.

**Cola de la tanda 4**, ya con tema: las **tres filas de DNGLOOK** que quedan de la clase
«el rol del anexo y el nombre del ledger discrepan» —`0x117e`, `0x97e` y `0xa48`—, y el
`0x6a8`, el gem de mazmorra, que es el hermano de la familia de la tanda 1 y que el lead
confirmó como candidato.
