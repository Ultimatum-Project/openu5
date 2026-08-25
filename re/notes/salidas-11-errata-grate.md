# ERRATA (#11, adelanto en frío de ch46) — hay una CUARTA vía: el GRATE, y el binario la gatea PARA SALAS

Adelanto offline autorizado por el lead (ch46 sin tocar el mutex de ch14b). Cero corridas,
cero Playwright. **Corrige dos documentos ya ATERRIZADOS**: el §6 de
`doom-r0-12-adjudicacion.md` y el §4/§5 de `salidas-11-prerregistro.md`. Los corrijo yo,
antes de la ventana, no después.

## Veredicto

Las vías de salida del original **no son tres: son CUATRO**. La que falta es el **Grate**
(`0x86`), y no es una nota al pie — el binario le pone un **gate propio de combate de SALA**,
o sea que existe precisamente para el caso que nos ocupa. El port la tiene en el (K)limb de
pueblo/mazmorra y **no** en el de combate. Consecuencia inmediata: **mis «siete bolsillos
fieles» son DOS**, y `hythloth-r6` —que el criterio de aceptación RATIFICADO manda dejar en
`VICTORY-STUCK`— **tiene un Grate a UN PASO**.

## 1. La derivación — `cmd_klimb_combat`, SJOG.OVL CS 0x1dd5-0x1e19

```
1dd5  cmp word [bp-2], 0xc8      ; ¿tile bajo el PJ = LadderUp?
1dda  jne 0x1df4
1ddc  mov ax, 0x8eec  · call     ; mensaje (DS 0x8eec)
1de9  mov ax, 5                  ; ★ código de salida 5 = UP
1dec  push ax
1ded  call 0x1bb2                ; ← LA MISMA rutina que la salida por BORDE
                                 ;   (combat.ts:2683 ya identificaba este call-site)
1df4  cmp word [bp-2], 0x86      ; ★ ¿GRATE?
1df9  jne 0x1e02                 ;   no → probar 0xc9
1dfb  test byte [g_unk_58a1], 0x80  ; ★★ ¿COMBATE DE SALA? (el mismo bit de 0x00bf)
1e00  jne 0x1e09                 ;   sí → SALE
                                 ;   (si NO es sala, cae a 0x1e02, falla el cmp 0xc9
                                 ;    y termina en el getdir de encaramarse a 0x4c)
1e02  cmp word [bp-2], 0xc9      ; ¿LadderDown?
1e07  jne 0x1e1c
1e09  mov ax, 0x8ef2  · call     ; mensaje (DS 0x8ef2)
1e16  mov ax, 6                  ; ★ código de salida 6 = DOWN
1e19  jmp 0x1dec
```

Lectura: **tres tiles**, dos códigos de salida, un único desagüe.

| tile | código | ¿condicionado? |
|---|---|---|
| `0xC8` LadderUp | 5 = Up | no |
| **`0x86` Grate** | **6 = Down** | **SÓLO si `g_unk_58a1 & 0x80` = combate de SALA** |
| `0xC9` LadderDown | 6 = Down | no |

El gate del Grate es la pieza que lo vuelve decisivo: el binario **añadió** ese tile
específicamente para las salas. No es decoración de suelo.

## 2. Corroboración independiente, y de nuestra propia casa

`re/notes/town-klimb.md` ya lo tenía escrito, línea 32:

> `0xC9` LadderDown **o `0x86` Grate** → `call 0x52E(0xC4, 2)` — baja.

y en su tabla, línea 74: `| K sobre Grate 0x86 | baja | nada |`. El port lo implementa en
el klimb de pueblo/mazmorra (`game.ts:3336` lo cita literalmente: «0xC9 LadderDown / 0x86
Grate → baja»).

## 3. El defecto del PORT, y por qué es de los que no se ven

`Combat.playerKlimbEscape()` (combat.ts:2965) se derivó DE ESA MISMA FUENTE —su JSDoc dice
«Lee el tile bajo el PJ como el Klimb de pueblo (0xC8/0xC9, `re/notes/town-klimb.md`)»— y
**implementó dos de los tres tiles que la fuente lista**. `LADDER_UP_TILE = 0xc8` y
`LADDER_DOWN_TILE = 0xc9` están; `0x86` no.

Es un defecto **con cita propia y sin ambigüedad**: la nota que el código invoca como aval
contiene el tile que el código omite. Género conocido en este repo — el aval en la línea que
borra la comprobación de lo que avala.

## 4. LO QUE ESTO CORRIGE DE MIS PROPIOS DOCUMENTOS

### 4.a — «SIETE bolsillos fieles» → son **DOS**

El censo de `salidas-11-prerregistro.md` §4 buscó anillo pasable, tiles de escalera
(200/201) y barrera (0x70-0x75). **No buscó el Grate.** Rehecho, con la distancia BFS desde
las posiciones de spawn del `.CBT` (y, para hythloth-r6, desde las MEDIDAS por la sonda):

| cm | sala | Grate | pasos desde los 3 miembros | veredicto CORREGIDO |
|---|---|---|---|---|
| 32 | Destard r0 | (9,9) | 4 · 3 · 3 | **SALIDA POR GRATE** |
| 33 | Destard r1 | (2,6) | 4 · 3 · 2 | **SALIDA POR GRATE** |
| **102** | **Hythloth r6** | **(5,3)** | **1 · 1 · 3** | **SALIDA POR GRATE** |
| 114 | Doom r2 | (3,3) | 1 · 1 · 1 | **SALIDA POR GRATE** |
| 122 | Doom r10 | (5,7) | 1 · 1 · 1 | **SALIDA POR GRATE** |
| 118 | Doom r6 | — | — | BOLSILLO FIEL (se mantiene) |
| 127 | Doom r15 | — | — | BOLSILLO FIEL (se mantiene) |

★ **`hythloth-r6` NO es un bolsillo fiel.** El §6 de `doom-r0-12-adjudicacion.md` lo declaró
tal cosa como «control negativo» — y ese control **miró barrera y escaleras, pero no el
Grate**. Un control que no cubre el espacio entero no absuelve: sólo dice que no encontró lo
que buscaba.

### 4.b — el criterio de aceptación RATIFICADO cambia

Donde decía «`hythloth-r6` SIGUE `VICTORY-STUCK` (bolsillo fiel)» debe decir:
**`hythloth-r6` pasa a `VICTORY` por GRATE**. Y el control negativo de la ventana se
traslada a los DOS que sí lo son: **Doom r6 (cm118) y Doom r15 (cm127)**, que no tienen ni
borde, ni escalera, ni barrera, ni Grate — y hoy ninguno de los dos se ataca (ambos son
`pass2b` de ch27), así que el control habrá que montarlo a propósito.

### 4.c — el alcance gana el MOTOR

La ventana era «cableado de `nav.ts`, cero motor». Ya no: `playerKlimbEscape` necesita
aceptar `0x86` **con su gate de sala** (`this.opts.roomCombat`), que es una condición que el
método hoy ni consulta. Es un cambio pequeño y derivado, pero **es núcleo**, y el núcleo
tiene otro radio: lo ve cualquier combate, no sólo el arnés.

### 4.d — el radio de explosión, actualizado

De los 10 mapas con Grate, sólo cambian resultado los que **no** tienen salida por borde
(por el orden de último recurso): cm32, cm33, cm102, cm114, cm122. Y de ésos, los que hoy se
ATACAN de verdad:

- **ch46** → Destard r0 y r1 ⇒ deja de ser sólo «adjudicar si son fieles»: **son
  conquistables**, y el re-baseline va a esta ventana.
- **ch29** → `hythloth-r6` ⇒ pasa a VICTORY.
- Doom r2 y r10 están hoy en `pass2b` (SKIP) ⇒ **no mueven cifra ahora**, pero dejan de ser
  «muradas que varan» y entran como candidatas conquistables a una Fase 2b futura. Eso
  contradice la cabecera de `ch27-salas-doom.spec.ts`, que las describe como varaderos sin
  salida: **prosa a corregir con esta derivación**, no con una medición.

## 5. PREDICCIONES NUEVAS (sustituyen a las que caen)

- **P7** — `hythloth-r6`: `VICTORY-STUCK` → **VICTORY**, eco `Klimb-Down!`, y la party sale
  **un piso abajo** (código 6). Sustituye al criterio ratificado.
- **P8** — `ch46`: hoy ROJO (predicción P4, intacta); tras el fix, Destard r0/r1 →
  **VICTORY** por Grate. La P4 decía «mi fix NO lo rescata» — **la retiro yo mismo**: con la
  cuarta vía, sí lo rescata.
- **P9** — control negativo de la ventana: **Doom r6 y Doom r15 son los únicos bolsillos
  fieles del juego**. Si apareciera una vía para ellos, el marco de «cuatro vías» está
  incompleto otra vez.
- **P10** — invariancia: sigue en pie para ch20/ch22/ch24/ch26, y **el Grate no la toca**
  porque los otros 5 mapas con Grate (cm34, 35, 41, 96, 121) SÍ tienen borde pasable y el
  orden de último recurso los deja en la vía de siempre.

## 6. LO QUE ME REFUTARÍA

- El eco no es `Klimb-Down!` sino otra cosa ⇒ el mensaje DS 0x8ef2 no es el que creo y hay
  que leerlo en DATA.OVL antes de bancar el calco.
- `hythloth-r6` sigue atascada tras aceptar `0x86` ⇒ el gate de sala del binario no es
  `roomCombat` tal como el port lo modela, o el tile no está bajo un miembro que llegue.
- Doom r6 o r15 salen ⇒ hay una QUINTA vía y este documento repite el error que corrige.

## 7. LA LECCIÓN, otra vez la misma y en el mismo carril

Es la tercera vez en esta sesión que **un resumen mío cierra el espacio de hipótesis**:
primero «perímetro entero de muro» (eran tiles de barrera), ahora «bolsillo fiel» (eran
salas con Grate). El patrón exacto: **un control negativo enumera lo que se le ocurrió al
autor y se reporta como si enumerara el espacio**. El remedio que sí funcionó las dos veces
fue el mismo — **volcar los tiles CRUDOS y preguntar a la tabla cómo se llaman**, en vez de
releer mi propia prosa. Aquí lo que lo destapó fue mirar los DOS números que sobraban en la
rejilla (`134` y `179`) en vez de darlos por decorado.
