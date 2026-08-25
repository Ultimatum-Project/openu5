# Campos NUEVOS del registro de combatiente y de la tabla de actores de mundo — derivados de dos cuerpos

Carril `asm100` (L0 tanda 2) · 2026-08-05 · sobre main `91d5fa3d`.

**Ficha aparte a propósito.** Derivar el SIGNIFICADO de un bit es un acto distinto de sellar
la rutina que lo escribe (regla de `cotejo-76-verified-heredado-marca` §4.1). Las dos
rutinas que lo prueban se sellan en `frontier-manual.json`; lo que el bit SIGNIFICA se
argumenta aquí.

---

## 1. Lo que el ledger tenía, y lo que le falta

`re/ledger/globals.json`, entrada `g_combat_actor_records` (`0xBA14`, 32 registros × 8 B):

> «+2 flags (bit `0x80` miembro del party, bit `0x20` caído), +3 slot de roster, +4 ranura
> en la tabla de actores de mundo `0x5C5A`, +6 X, +7 Y.»

Del byte `+2` sólo documenta **`0x80`** y **`0x20`**. Las lecturas de abajo prueban tres bits
más y dos campos de otra tabla.

## 2. `bit 0x10` del byte `+2` = **INVISIBLE**

Probado por un par de rutinas que son inversa una de otra, más una derivación previa e
independiente del corpus.

**(a) `CAST.OVL:0x0afe` — lo PONE.** Cuerpo entero (42 B, 11 insn):
```
si = g_cmb_actor * 8
bl = [si-0x45e8]          ; = registro +4  (ranura en la tabla de mundo)
bx = bl * 8
mov byte [bx+0x5c5b], 0x1d ; tile de RENDER := 0x1d
or  byte [si-0x45ea], 0x10 ; registro +2 |= 0x10
```
(`-0x45e8` = `0xBA18` = base+4; `-0x45ea` = `0xBA16` = base+2. Direccionamiento en forma
NEGATIVA — el canal que un censo por hex no ve, como ya avisaba la evidencia de la propia
entrada de `globals.json`.)

**(b) `CAST.OVL:0x074c` — lo QUITA, y restaura el tile.** Cuerpo entero (104 B, 42 insn):
bucle de 32 con paso 8 sobre `0xBA16`, con tres filtros —`[si]==0` (ranura vacía),
`[si]&0x80` (**es del party ⇒ NO le afecta**) y `!([si]&0x10)` (no está invisible)—; para el
resto `and byte [si],0xEF` y luego `al=[di]; mov [di+1],al` sobre `0x5C5A + ranura*8`.

**(c) Corroboración independiente, anterior y por otra vía.**
`cotejo-76-verified-heredado-marca` §4.2 derivó `kernel_actor_ring_effects` y encontró que
el **Ring of Invisibility** (`0x2a`) produce «tile de render `0x1d` + bit `0x10` de
invisible». **Mismo tile y mismo bit**, llegando desde el kernel y desde los anillos, no
desde los conjuros.

**(d) Corroboración por el DESPACHO.** La tabla de salto de `cast_command_dispatch`
(CAST.OVL file `0x1146`, 48 entradas) manda el índice **36** a (a) y el **23** a (b). En el
orden `SpellWords`, 36 = **Sanct_Lor** (invisibilidad) y 23 = **Wis_Quas** (revelar). Los dos
conjuros que uno esperaría.

⇒ **`0x10` = invisible.** Cuatro líneas, tres de ellas independientes entre sí.

## 3. Tabla de actores de mundo `0x5C5A`: **+0 = tile BASE · +1 = tile de RENDER** (paso 8)

No se infiere de un nombre: se prueba por la ASIMETRÍA de las dos rutinas. (a) escribe `0x1d`
en **+1** y no toca +0; (b) copia **+0 → +1**. Un valor que se puede sobrescribir y luego
reconstruir desde otro campo sólo puede ser una copia de presentación: **+1 es lo que se
pinta, +0 es lo que el actor ES**.

## 4. `bit 0x40` del byte `+2` — EXISTE, y su significado NO está derivado

`CAST.OVL:0x0c98` filtra con `[di+2] & 0xC0 == 0x40`, o sea `0x80` claro **y** `0x40`
puesto. Que el bit existe y participa en la selección de objetivos está **probado**; qué
significa, **no**. Lo dejo declarado en vez de proponer una lectura: el resto de esta ficha
se sostiene en cuatro líneas y esto tendría una.

## 5. Byte `+0` del registro y `bit 0x02` del `+2` — puestos por un conjuro de estado, sin significado derivado

`CAST.OVL:0x0c98`, tras una tirada de salvación fallida, hace `[di]=1` y `[di+2] |= 0x02`.
Que ése es el efecto del conjuro está probado; que `0x02` sea «miedo» **no**: es justamente
el término que el nombre heredado `in_quas_corp_mass_fear` afirma y que su cuerpo no
acredita.

## 6. Lo que esta ficha NO hace

- **No edita `globals.json`.** Propone; que el ledger de globales lo adopte es acto del
  lead, y mezclarlo aquí repetiría el defecto que #76 §4.1 separa.
- **No mira el port.** Si el clon respeta o no el bit `0x10`, la exclusión del party en Wis
  Quas, o la pareja tile-base/tile-render, no lo he comprobado. Las tres rutinas están
  marcadas `coverage` PARCIAL/AUSENTE en el anexo, así que la pregunta está viva.
- **No cubre los bits restantes** del byte `+2` (`0x01`, `0x04`, `0x08`), que nadie ha tocado.
