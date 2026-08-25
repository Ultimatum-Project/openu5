# Tarea #66 — DISEÑO y precondiciones (escrito por frontera-27, 2026-07-27)

Requisitos que el tercer canal del censo de globales tiene que cumplir **por
construcción**, no como pulido posterior. Salen de defectos ya medidos en este carril: si
la herramienta nace sin ellos, nace con los tres agujeros que #66 existe para tapar.

El encargo de #66 es: convertir el barrido de `globals-desplazamiento-negativo.md` en
`re/tools/` con test, cablearlo como TERCER CANAL del censo de globales, re-barrer las
direcciones invisibles sin adjudicar y re-censar `0xAC74`.

---

## R1 — Distinguir PUNTEROS DE TEXTO de globales (si no, 420 falsos positivos)

Al derivar CHORE 4 barrí las direcciones DS citadas en la prosa del ledger: **637 citadas,
596 sin entrada en `globals.json`… y 420 de esas 596 resuelven a una cadena
NUL-terminada imprimible de `DATA.OVL`**. No son globales: son punteros al pool de texto
(`'Klimb-U/D-'`, `'Attack\n'`, …). Un censo que no separe esa categoría reporta 420
«globales sin entrada» que no existen, y el ruido entierra las de verdad.

El discriminador ya está escrito y es barato — es el mismo criterio que
`routine_census.resolve_string`: `fileoff = DS + 0x10`; hay cadena si termina en NUL, mide
entre 3 y 200 bytes y ≥85 % de sus bytes son imprimibles. Debe ir en el instrumento, no en
la cabeza de quien lea la salida.

## R2 — El corpus incluye `re/notes`, no solo el ledger

Mi censo derivado contenía **6 de las 8** globales de CHORE 4. Las dos que falló
(`0x5858`, `0x57b2`) no fallaron por criterio: **fallaron por CORPUS**. Mi barrido leía
solo la prosa de `frontier-manual.json`, y esas dos se citan en `re/notes`. El tercer canal
tendrá exactamente el mismo agujero si solo mira el ledger.

## R3 — Los tres canales, y el negativo NO es opcional

Censar una global es buscar **hex** ∧ **símbolo** (`g_nombre` y `g_nombre+N`, offsets en
decimal) ∧ **complemento a dos** (`(-addr) & 0xFFFF`, que el ensamblador escribe como
`[bx - 0x538c]`). El ejemplar de libro es `g_combat_actor_records` **0xBA14**: su layout
entero sale de `move_combat_actor` (SJOG 0x1c56), que direcciona los campos como
`[bx-0x45e8]` / `[bx-0x45e6]` / `[bx-0x45e5]` — en forma negativa, invisible a cualquier
censo por hex.

## R4 — Nunca `grep -r`, y el control positivo en la MISMA RAMA

Los `.asm` del worktree son **symlinks** y `grep -r` los salta en silencio (fue lo que hizo
que el primer barrido declarara 93 invisibles en vez de 40). Se leen los ficheros en
Python. Y el control positivo tiene que caer en la **misma rama del instrumento** que la
población que se mide: en este carril un `except` se tragó un fallo de firma y saltó TODOS
los overlays mientras el control positivo, que vivía en `ULTIMA.EXE`, seguía en verde.

---

## Inventario de arranque (barrido re-ejecutado el 2026-07-27, ya cruzado)

| | |
|---|---|
| direcciones alcanzadas por desplazamiento negativo | **93** |
| de ellas invisibles a una búsqueda por hex | **40** ← reproduce la cifra de la nota (control) |
| de esas 40: punteros de texto (R1) | 5 |
| de esas 40: ya con entrada en `globals.json` | 3 |
| **★ sin adjudicar y sin entrada = la cola real de #66** | **32** |

```
0x9299 0x9309 0x9714 0x9722 0x9d5d 0x9ffc 0xa70a 0xaae2 0xaba7 0xac1a 0xac74 0xad88
0xadb4 0xadbf 0xadd4 0xadf4 0xaed0 0xb02c 0xb21f 0xb220 0xb221 0xb24a 0xbce4 0xc130
0xc8d3 0xca7e 0xd01c 0xd0c6 0xd69e 0xd8da 0xdade 0xde6d
```

La cola es **32, no 39**: CHORE 4 ya se comió parte de ella (dos de las tres que ahora
tienen entrada caen dentro de `g_combat_actor_records`). Conviene re-correr este cruce al
empezar, porque cada tanda de globales nuevas lo encoge.

## `0xAC74` (tarea #61) — cotejar contra la REFORMULACIÓN, no contra la pregunta vieja

`d4dd1466` ya reformuló #61 y el re-censo tiene que partir de ahí: `0xAC74` está 0x10 bytes
dentro de la región basada en **`0xAC64`**, que se puebla con **tres cargas de fichero de
`MISCMAPS.DAT`** (BLCKTHRN 0x070A, CAST2 0x0EDC/0x0EEA, ENDGAME 0x0663), más un uso del
kernel como plano de ráster (ULTIMA.EXE 0x419C). ⇒ **probablemente no existe instrucción
escritora** y el contenido lo pone una lectura de fichero. La pregunta buena no es «derivar
el escritor» sino **cuál de los dos dueños está vivo cuando SJOG 0x1ED2 lo lee** — y ese
0x1ED2 es, además, el único acceso del corpus y está en forma negativa.
