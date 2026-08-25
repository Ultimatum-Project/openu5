# Globales ocultas por DESPLAZAMIENTO NEGATIVO (agujero de instrumento)

> ⚠ **CIFRAS SUPERADAS por la tarea #66** — ver `re/notes/globals-negdisp-adjudicacion.md`
> y el instrumento `re/tools/globals_negdisp.py`. El hallazgo de esta nota (existe un
> tercer canal, y el hex solo no lo ve) SE SOSTIENE. Lo que no se sostiene son las
> **40 «direcciones invisibles»**: el barrido de abajo toma todo `[reg - 0xNNNN]` como
> acceso a DS, y 27 de esas 40 son **tablas de saltos** (12 con override `cs:`) o
> **datos desensamblados como código** (15). Las candidatas reales son 13, y la cola de
> adjudicación 11. No cites la lista de la §«Cifras» sin leer antes esa nota.

**Hallazgo**: 40 direcciones DS del corpus **no aparecen literalmente en ningún `.asm`** con
su propio valor hexadecimal. Se alcanzan sólo como desplazamiento **negativo** — el
ensamblador escribe `[bx - 0x538c]` donde la dirección real es `(-0x538c) & 0xFFFF =
0xAC74`. Cualquier censo de globales hecho buscando el hex de la dirección las cuenta como
**CERO refs**, y ese cero parece refutación sin serlo.

Es el mismo género que la regla ya escrita «censo de global = hex **Y** símbolo»: la regla
se queda corta, porque hay un tercer canal (el complemento a dos) que no cubre ninguno de
los dos.

## El caso que lo destapó

`SJOG.OVL 0x1ED2` — dentro de `combat_absorb_shadow` (0x1EA4) — es el **único** acceso a
`DS:0xAC74` de todo el corpus:

```
1ecd: mov bl, byte ptr [bx + 6]        ; campo +6 del registro de actor (0xBA14 + actor*8)
1ed2: mov al, byte ptr [bx - 0x538c]   ; ← DS:0xAC74 + bl
1ed6: and al, 0xfc
1ed8: cmp al, 0x3c                     ; ← de aquí sale el calificativo «shadow»
```

Un `grep ac74` sobre `re/disasm/` devuelve **cero líneas**. Por eso la tarea #61 («DS 0xAC74:
único acceso en el corpus — derivar el escritor») parecía no tener de dónde tirar.

## Cifras (barrido re-ejecutable, sin `grep`) — ⚠ LAS «40» ESTÁN RETIRADAS

| | | |
|---|---|---|
| direcciones DS (0x1000-0xF000) tocadas por desplazamiento negativo | **93** | se sostiene |
| ~~de ésas, **invisibles** a una búsqueda literal de su hex~~ | ~~**40**~~ | **RETIRADA (#66)** |
| de las 40, tabla de saltos con override `cs:` (offset de CÓDIGO, no DS) | 12 | ← basura |
| de las 40, datos desensamblados como código (el «desplazamiento» es la palabra LE de dos bytes de datos) | 15 | ← basura |
| **de las 40, candidatas reales** (≥1 acceso limpio) | **13** | ⇒ cola de adjudicación **11** |

Las 53 restantes también aparecen en forma positiva en algún sitio, así que un censo por
hex sí las ve. Las 40 no — pero **27 de esas 40 tampoco son direcciones DS**. Cifras
vivas: `python3 re/tools/globals_negdisp.py`. Adjudicación una por una:
`re/notes/globals-negdisp-adjudicacion.md`.

Lista de las 40 **anotada con su bucket** (⛔ = no es una dirección DS):

- **candidatas reales (13)**: `0xaae2`, `0xaba7`, **`0xac74`**, `0xadb4`, `0xadbf`,
  `0xadd4`, `0xadf4`, `0xb21f`, `0xb220`, `0xb221`, `0xba15`, `0xbce4`, `0xbd32` — de
  éstas, `0xba15` (`g_combat_actor_records+1`) y `0xbd32` (`g_virt_elim`) ya tienen
  entrada en `globals.json` ⇒ **11 a adjudicar**.
- ⛔ **tabla de saltos, override `cs:` (12)**: `0x9380`, `0x9482`, `0x9722`, `0x984a`,
  `0xad88`, `0xb02c`, `0xc130`, `0xca7e`, `0xd01c`, `0xd0c6`, `0xd69e`, `0xdade`.
- ⛔ **datos desensamblados como código (15)**: `0x9299`, `0x9309`, `0x9714`, `0x998a`,
  `0x9d5d`, `0x9d99`, `0x9ffc`, `0xa70a`, `0xac1a`, `0xaed0`, `0xb24a`, `0xbad9`,
  `0xc8d3`, `0xd8da`, `0xde6d`. Las 6 del kernel caen en `[0x7780,0x81D0)` (tabla PLINK)
  o `[0x8200,0x86F0)` (segmento de datos del `.EXE`); las demás, en tablas de saltos de
  su overlay.

**Por qué se me pasó**: el barrido de abajo toma TODO `[reg - 0xNNNN]` como acceso a DS.
Tenía control positivo (`ad14`) y por eso firmé la cifra — pero un control de
**sensibilidad** sólo prueba que el instrumento no está ciego, **no** que lo que ve sea lo
que dice. Falta el control de **especificidad**: un ejemplar de cada clase de basura que
NO debe salir. El instrumento de #66 lleva los dos.

## ⚠ Segundo agujero, del mismo lote: `grep -r` sobre symlinks

Los `.asm` de un worktree son **symlinks** al checkout principal. En esta máquina,
`grep -r` con un fichero symlinkeado como argumento lo **salta en silencio**:

```
grep -l  ad14 re/disasm/DNGLOOK.OVL.asm   →  rc 0, encuentra           (4 líneas)
grep -rl ad14 re/disasm/DNGLOOK.OVL.asm   →  rc 1, NO encuentra        ← falso cero
```

Es intermitente según qué binario de `grep` resuelva el `PATH` (el shell de la sesión y el
`subprocess` de Python pueden no coger el mismo), lo que lo hace peor: **el mismo comando da
resultados distintos según desde dónde se lance**. Detectado aquí porque el primer barrido
declaró «93 invisibles» y el control positivo (`ad14`, que yo mismo había leído minutos
antes) demostró que el instrumento mentía. La cifra buena es 40, no 93.

**Reglas**:
1. Para censar una global, buscar el hex **y** el símbolo **y** el complemento a dos
   (`(-addr) & 0xFFFF`).
2. En un worktree con `.asm` symlinkeados, **no usar `grep -r`**: `grep` sin `-r`, o mejor
   leer los ficheros en Python.
3. Antes de firmar un cero, control positivo **dentro de la salida del propio barrido**.

## Barrido re-ejecutable

```python
import re, glob, os, collections
files = [p for p in sorted(glob.glob('re/disasm/*.asm')) if not p.endswith('.DRV.asm')]
text  = {p: open(p, errors='replace').read() for p in files}
pat   = re.compile(r'\[(?:bx|si|di|bp)(?:\s*\+\s*(?:si|di))?\s*-\s*0x([0-9a-f]+)\]')
neg = collections.defaultdict(list)
for p, t in text.items():
    for line in t.splitlines():
        m = re.match(r'^([0-9a-f]{4}): ([0-9a-f]+)\s+(.*?)\s*$', line)
        if not m: continue
        for d in pat.findall(m.group(3)):
            v = int(d, 16)
            if v < 0x100: continue                    # desplazamiento de struct, no dirección
            a = (-v) & 0xFFFF
            if 0x1000 <= a <= 0xF000:
                neg[a].append(os.path.basename(p))
invisible = [a for a in sorted(neg) if not any(f'{a:04x}' in t for t in text.values())]
```

## Qué queda abierto

- **Tarea #61 reformulada**: `0xAC74` no es una global suelta — está 0x10 bytes dentro de la
  región basada en `0xAC64`, que tiene tres cargas de fichero de `MISCMAPS.DAT` (0xB0 B:
  BLCKTHRN 0x070A, CAST2 0x0EDC/0x0EEA, ENDGAME 0x0663) y un uso del kernel como plano de
  ráster (`ULTIMA.EXE 0x419C: ax = [bp-0x10] + 0xAC64`, en paralelo con otro plano en
  `0xAB02`). ~~⇒ probablemente **no existe instrucción escritora**: el contenido lo pone una
  lectura de fichero.~~ La pregunta buena es cuál de los dueños está vivo cuando SJOG
  0x1ED2 lo lee.
  > ⚠ **«No existe escritora» RETIRADA por #66**: existen CUATRO, todas en forma negativa
  > —que es justo por lo que este censo no las vio—: `ULTIMA.EXE 0x537d`
  > (`world_tile_autotile_resolve`) y `0x5534`/`0x5571`/`0x55b9` (`compose_world_view`),
  > más lecturas en `viewport_compose_11x11` y en CMDS `tile_terrain_class_lookup`. Y la
  > geometría queda derivada: `0xAC64` es una ventana de tiles **11×11 con stride 16**
  > (`0xAD14−0xAC64 = 0xB0 = 11*16`, y la carga de `MISCMAPS.DAT` mide exactamente esos
  > 0xB0), luego `0xAC74` = fila 1, columna 0. Sigue sin derivar el test
  > `and al,0xfc; cmp al,0x3c`. Detalle: `re/notes/globals-negdisp-adjudicacion.md` §4.
- ~~Las otras 39 direcciones invisibles están **sin adjudicar**~~ — **RETIRADO por #66**:
  no eran 39. Descontada la basura, la cola real era de **11**, y están **todas
  adjudicadas** (3 derivadas enteras — `signs.dat` en `0xB21E`, búfer de línea de TALK en
  `0xBCE4`, y la ventana de tiles de arriba —, 8 declaradas no-derivadas con su rutina
  dueña y su forma de acceso). Ver `re/notes/globals-negdisp-adjudicacion.md` §3.
- **Propuesta al orquestador** (no hecha, por la norma de proponer antes de tocar el
  generador): convertir este barrido en `re/tools/` con su test, y que el censo de globales
  lo consuma.

## Control de mi propio trabajo

Re-validada con instrumento sin `grep` la afirmación de exhaustión de
`dungeon-map-buffers.md §4`: el inmediato `0x2a53` (`"DUNGEON.DAT"`) aparece **exactamente
una vez** en todo el disasm, en `MAINOUT.OVL 0x086d`. La afirmación se sostiene.
