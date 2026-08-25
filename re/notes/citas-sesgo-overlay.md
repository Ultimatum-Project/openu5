# Las 11 citas con etiqueta file-relativa sin sesgo (tarea #56)

**Titular: las 11 CORREGIDAS con su resolución al lado. Las tres bases distintas
(0xBF80 · 0xE1E0 · 0xA290) son la prueba de que no existe un sesgo único. Y la lectura
mínima que pediste destapó que una de ellas estaba mal en TRES cosas, no en una: la
cita de OUTSUBS decía «espera tecla» sobre lo que en realidad es un POLL DE FICHERO.**

Base: `main` @ `54e31dcb`. Lista de partida: commit `f1d2a6b0` (frontera-25).

---

## 1. Las 11, resueltas con el sesgo DE SU OVERLAY

`CS = (overlay_near_call_base(ov) + crudo) & 0xFFFF`. Las 11 confirman la lista de
frontera-25 **una a una**:

| cita en | crudo | base | CS | nombre REAL | lo que el verbo de la cita dice |
|---|---|---|---|---|---|
| `SJOG.OVL:0x1d6a` | `0x766c` | `0xBF80` | `0x35ec` | `prompt_direction` | «getdir» ✔ |
| `SHOPPES2.OVL:0x0000` | `0x34da` | `0xE1E0` | `0x16ba` | `putchar` | «imprime dos `\n`» ✔ |
| `SHOPPES2.OVL:0x00ac` | `0x3670` | `0xE1E0` | `0x1850` | `print_string` | «imprime 0x9ac2» ✔ |
| `SHOPPES2.OVL:0x00dc` | `0x385e` | `0xE1E0` | `0x1a3e` | `print_int_right_justified` | «el total» ✔ |
| `SHOPPES2.OVL:0x01f4` | `0x448c` | `0xE1E0` | `0x266c` | `getkey_with_redraw` | «Y/N» ✔ |
| `SHOPPES3.OVL:0x04e6` | `0x448c` | `0xE1E0` | `0x266c` | `getkey_with_redraw` | «getkey» ✔ |
| `SHOPPES3.OVL:0x08b4` (×2) | `0x448c` | `0xE1E0` | `0x266c` | `getkey_with_redraw` | «lee tecla» ✔ |
| `COMSUBS.OVL:0x0f4a` | `0x2930` | `0xE1E0` | `0x0b10` | `gfx_draw_line` | «traza» ✔ |
| `OUTSUBS.OVL:0x0388` | `0x73e4` | `0xA290` | `0x1674` | `dos_file_exists` | «espera tecla» ✘ **ver §2** |
| `TALK.OVL:0x111c` | `0x6112` | `0xBF80` | `0x2092` | `rand_range` | «tira rand(0,1)» ✔ |
| `ZSTATS.OVL:0x0000` | `0x4b9a` | `0xE1E0` | `0x2d7a` | `select_party_member` | «el picker» ✔ |

**Tres bases distintas en once citas.** Por eso el género existe: quien copia la etiqueta
del disasm acierta sólo si su overlay resuelve por casualidad.

Las 12 menciones (0x448c sale dos veces en `SHOPPES3:0x08b4`) llevan ya su resolución
inline, en el formato del pool: `[= CS 0x… → ULTIMA.EXE:0x… nombre; sesgo 0x… del overlay]`.

## 2. ★ La lectura mínima destapó un error de CONDUCTA, no de nombre

Diez de once encajan con el verbo de su propia cita. La de `OUTSUBS.OVL:0x0388` no:
decía **«espera tecla (getkey 0x73e4 con prompt DS 0x399f)»** y resuelve a
`dos_file_exists`. Leído el sitio:

```
0401: mov ax, 0x399f        ; ← DS 0x399f
0404: push ax
0405: call 0x73e4           ; CS 0x1674 dos_file_exists
0408: or ax, ax
040a: je 0x401              ; ← bucle MIENTRAS devuelva 0
```

Y `DS 0x399f` **no es un prompt: es el nombre de fichero `'BRIT.DAT'`** — el segundo
llamador (`0x0542`) empuja `0x39f1` = `'UNDER.DAT'`. O sea: es un **bucle de espera a que
el FICHERO exista** (que metan el disquete), no una espera de tecla.

La cita estaba mal en tres cosas a la vez: el nombre del kernel, la conducta descrita, y
la naturaleza del argumento. Las tres corregidas. **Sin la lectura mínima habría
«arreglado» sólo el nombre y dejado en pie una descripción falsa** — que es peor, porque
el nombre nuevo le habría dado aspecto de verificada.

## 3. Censo del mismo género con otras redacciones (COTA, no corrección)

frontera-25 declaró su lista como cota inferior porque sólo miró la redacción
«kernel/getdir/getkey 0xNNNN». Amplié el verbo y separé dos cosas que no son lo mismo:

| | n | qué es |
|---|---:|---|
| menciones que casan el patrón bruto | 106 | — |
| de ellas, **`call 0xNNNN` suelto** | **77** | **NO es el género**: la cita TRANSCRIBE la línea del disasm, y transcribir la etiqueta file-relativa es correcto. Marcarlas sería el mismo error de clasificador que ya me costó dos pases en #55. |
| **GÉNERO REAL: la cita ATRIBUYE** (`kernel`/`vía`/`via`/`getkey`/`getdir`/`print`) | **29** | en 22 rutinas, todas cayendo en rutina kernel real y sin resolución al lado |

Reparto del género real: `vía/via` 15 · `kernel` 9 · `getdir` 2 · `print` 2 · `getkey` 1.
Destinos más repetidos: `prompt_direction` (0x766c, 5 veces), `get_tile_ptr` (0x8482, 3),
`disk_retry_with_drive_select` (0x438e, 2).

**NO las corrijo**: el encargo pedía censo, y mi propia lección de #55 es que corregir en
masa un censo sin leer cada sitio rompe citas buenas. Van a tarjeta con la lista completa.

## 4. Gates

| gate | exit |
|---|---|
| `frontier-manual.json` parsea | **0** |
| `pytest test_frontier + test_dispatch + test_ledger` | **0** |
| `verify_cites.py scan` / `scan-code` | **0** / **0** |
