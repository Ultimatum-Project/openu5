# El despacho de comandos en MAZMORRA — kernel compartido y gate por localización EN DOS CAPAS

> Derivado el 2026-08-16 por el carril `dungeondeck-348` (ficha #348, reporte del usuario
> jugando Doom L1 en táctil). Sujeto = BINARIO. Instancia auditable de esta derivación:
> `game/tests/dungeon-botonera.test.ts`, cuyas tablas llevan la columna `gate` diciendo
> DÓNDE se leyó cada veredicto.

---

## TL;DR (3 líneas)

1. La mazmorra **NO tiene despachador propio**: `DUNGEON.OVL sub_06C4` atiende a mano un
   puñado de teclas y manda **todo lo demás** al MISMO `kernel_cmd_dispatch` 0x3178 que
   usan el sobremundo y el pueblo. Es el opuesto del COMBATE, que sí tiene bucle propio.
2. El discriminante es el **gate por `g_location`** (DS 0x5893): 0 = sobremundo · 1..0x20 =
   pueblo · **0x21..0x28 = mazmorra** (0x28 = Doom).
3. 🔴 **Los gates viven en DOS CAPAS y hay que leer LAS DOS.** Unos están en el kernel y
   otros dentro del overlay del comando. Un censo que sólo lea el kernel declara
   ACEPTADAS a **Board, Fire y Yell**, que el overlay RECHAZA.

## 1. El puente: DUNGEON.OVL:0x07A0 → kernel_cmd_dispatch 0x3178

`sub_06C4(key)` atiende directamente: flechas cocidas `1..4` (→ `move()` 0x0502), el `5`
(prompt Y/N de descenso), `0x0B` (karma), `ENTER`/`PERIOD` (giro 180°), `^S`/`^V`, y los
dígitos (`07bc: cmp [bp+4],0x30` … → set active player). **Todo lo demás** cae en:

```
07a0: ff7604            push word ptr [bp + 4]
07a3: e802a8            call 0xffffafa8
```

🔴 **Ese destino NO se lee crudo en `ULTIMA.EXE.asm`** (caería en una rutina ajena con
cuerpo plausible). Se resuelve con `re/tools/dispatch_table.py`: `load_seg` 0x081D ⇒
`overlay_near_call_base` = 0x81D0, y `(0xafa8 + 0x81D0) mod 2^16` = **0x3178**.
CONTROL POSITIVO: `near_calls_to_kernel("DUNGEON.OVL", 0x3178)` devuelve **exactamente
`0x7a3` y ningún otro**, y MAINOUT (`0x0c00`) y TOWN (`0x158f`) dan los otros dos bucles
de contexto — los tres que la herramienta declara.

🔴 **ERRATA CORREGIDA de `dungeon-input-model.md:39`**, que anota
~~«06ef: jmp 0x7bc → kernel_cmd_dispatch 0x3178»~~. **0x7bc es el gate de DÍGITOS**
(`cmp [bp+4],0x30 / jb 0x7a0`); el call real es **0x07a0**. La conclusión de aquella nota
(modelo relativo, port fiel) no cambia — pero quien copie la dirección busca donde no es.

## 2. LAS DOS CAPAS — la regla de método

| capa | dónde | ejemplos |
|---|---|---|
| **kernel** `0x3178` | dentro del handler de la tecla | A (0x3222) · E (0x3254) · G (0x3274) · H (0x3d5b/0x3d76/0x3d90) · K (0x32fc) · L (0x3317/0x331e) · P (0x336a/0x3371) · S (0x33a8) · T (0x33e0) · V (0x342c) · Espacio (0x31f4) |
| **overlay** del comando | dentro de la rutina a la que salta | B (CMDS 0x07fc/0x0803) · F (CMDS 0x0af0/0x0af7) · I (CMDS 0x0dac/0x0db3) · J (SJOG 0x0d52/0x0d59) · O (SJOG 0x137a/0x1381) · S (SJOG 0x0969) · X (CMDS 0x0ebb/0x0ec2) · Y (CMDS 0x1481/0x1488) |

★★ **La regla, para el próximo censo de despachador (barco, por ejemplo): leer el kernel
NO basta.** Board, Fire y Yell pasan el kernel limpias y las rechaza su overlay. Quien
censara sólo el kernel les pondría botón, y serían **tres botones muertos** que sólo
saben imprimir un rechazo. Es la cara «falso ACEPTADO» del precedente **#71** (la trampa
inversa: ofrecer una orden que el original rechaza diverge tanto como quitarla).

Y el corolario del método: **una ausencia de gate se mide sobre la rutina COMPLETA**
(extent de `re/ledger/coverage.json`), no sobre una ventana corta, y **con control
positivo** — el mismo escáner debe ENCONTRAR los gates de Open y Board con esos mismos
límites. Así se declararon los «CERO gates» de New order, Quit, Ready y Ztats.

## 3. Las tres clases en mazmorra (0x21 ≤ g_location ≤ 0x28)

**ACEPTADAS (18)** — Espacio Pass (kernel 0x3210, «Pass\n») · A Attack (→ DUNGEON.OVL:0x1D4A) ·
C Cast (CAST.OVL:0x0DBA, gatea POR HECHIZO) · G Get (SJOG.OVL:0x179E; el kernel SALTA el
eco «Get-») · H Hole up (kernel_camp_holeup 0x3C9A: los tres `jae` SALTAN el chequeo de
terreno «On land or ship!» DS 0xa30e y entra en «For how many hours? (1-9)» DS 0xa32c) ·
I Ignite torch (CMDS.OVL:0x0DBA, rama de relumbre 3D) · J Jimmy (SJOG.OVL:0x0C3E) ·
K Klimb (→ DUNGEON.OVL:0x1E10) · L Look (→ DNGLOOK.OVL:0x0000, «Look...\n») · M Mix
(CMDS.OVL:0x1AD8; su único gate es de repintado) · N New order (CERO gates) · O Open
(SJOG.OVL:0x12D4, el cofre de la celda) · Q Quit&Save (CERO gates) · R Ready
(ZSTATS.OVL:0x1296, CERO gates) · S Search (SJOG.OVL:0x0646, «Search...\n») · U Use
(CAST.OVL:0x1792, gatea POR OBJETO) · V View a gem (→ **DNGLOOK.OVL:0x06A8**, el mapa 8×8
de la planta) · Z Ztats (CERO gates).

**RECHAZADAS (6), con su cadena** — B Board → «\nNot here!\n» (CMDS 0x080a, DS 0x4252) ·
E Enter → «Enter what?\n» (kernel 0x3260, DS 0xa156) · F Fire → «What?\n» (CMDS 0x0afe,
DS 0x42e4) · P Push → «Push\nNot here!\n» (kernel 0x3378, DS 0xa1d4) · T Talk →
«Talk-Funny, no response!\n» (kernel 0x33e7, DS 0xa22c) · Y Yell → «\nNo effect!\n»
(CMDS 0x14ac, DS 0x453a).

**DESCONOCIDAS** — D → «D-What?\n» (0x324e) · W → «W-What?\n» (0x3450) · el resto → el
«What?\n» del default 0x34D8.

**Y UN CUARTO CASO que no es ninguna de las tres: X-it.** Su ventana (CMDS 0x0EB4:
`cmp 0x20/jae` seguido de `cmp 0x29/jbe`) manda TODA localización al cuerpo — el rechazo
es **inalcanzable**. Eso es la ficha **#71**, ya adjudicada, y NO un hallazgo de aquí.

## 4. Nota de rótulo (por qué el botón dice «Open» y no «Chest»)

El kernel imprime **«Open-»** (DS 0xa1ce, handler 0x335C) ANTES de bifurcar a la rama de
mazmorra. El vocabulario del binario llama Open a esta orden; «Chest» no salía de ningún
sitio y el usuario no lo entendía.
