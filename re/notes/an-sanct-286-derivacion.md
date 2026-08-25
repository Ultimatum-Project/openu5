# Ficha #286 — An Sanct: las TRES ramas de `CAST.OVL:0x02d2`, derivadas enteras

Carril `fix-286` (Mac mini, 2026-08-17), sobre main `3f924180`. Sujeto: el BINARIO
(CAST.OVL / CAST2.OVL / ULTIMA.EXE / DATA.OVL). La ficha decía «An Sanct porta UNA de
las TRES ramas»; esta pasada deriva el cuerpo entero (0x02d2-0x043c), porta la rama de
MAZMORRA y deja la de TABLA DE OBJETOS declarada-bloqueada por #103 — la MISMA decisión
que la rama de combate de An Grav en `hechizos-inertes-319-cableado.md` §4.1.

## 0. Resoluciones de llamadas — por `dispatch_table`, no en crudo

El brazo 6 de la jump table `CAST:0x1146` (`0x0f58`) llama a `an_sanct_unlock_disarm`
(`CAST.OVL:0x02d2`) → **res** (`cast-dispatch-48-brazos.md`). Dentro del cuerpo hay
CUATRO destinos de llamada, resueltos con `re/tools/dispatch_table.py`
(`overlay_near_call_base(CAST.OVL) = 0xbf80`, leído del binario):

| call sites | crudo | residente `(crudo+0xbf80) mod 2^16` | rutina |
|---|---|---|---|
| 0x02f2 / 0x03d3 / 0x0418 (`push 2` delante) | `0xc186` | `0x8106` = stub | CAST2.OVL:0x0000 — despachador de jingle (MISMO stub que el acta #319 §0) |
| 0x0398 | `0xc162` | `0x80e2` = stub | CAST2.OVL:0x0306 — `prompt_direction_seed_target` (getdir, siembra `g_cmb_scratch_x/y`) |
| 0x03b3 | `0x8482` | `0x4402` (kernel) | `get_tile_ptr(scratch_x, scratch_y)` — el mismo call crudo `0x8482` que An Ex Por (CAST 0x0867) usa para escribir el sello |
| 0x0371 / 0x0385 | `0x58d0` | `0x1850` (kernel) | `print_string` |

**Control positivo de la fórmula** (obligado por la doctrina del call cross-overlay):
`(0x3670 + overlay_near_call_base(CAST2.OVL)=0xe1e0) mod 2^16 = 0x1850` = `print_string`,
el par ya acreditado del corpus (`anillos-nombres-cierre.md`). La banda de stubs medida
va `0x7a16-0x81ba` (164 stubs): `0x8106` y `0x80e2` caen dentro y la herramienta los
devuelve con `overlay_num=18` (CAST2) y sus file_off exactos; `0x4402` y `0x1850` caen
fuera = residentes.

🔴 Trampa de lectura que mordió esta pasada (en la aritmética, antes de llamar a la
herramienta): el disasm YA imprime el destino computado (`call 0x58d0`, `call
0xffffc186`), NO el desplazamiento — quien le sume otra vez el next-ip obtiene
`0x83fb/0x847d`, direcciones fuera de la banda de stubs que se leen como «no resuelve».

## 1. El dispatch de contexto (0x02da-0x02eb) — TRES caminos, DOS cuerpos

```
02da cmp byte [g_location], 0x20 / ja 0x2e4   ; loc <= 0x20 (exterior+pueblo) -> jmp 0x398
02e4 cmp byte [g_location], 0x80 / jb 0x2ee   ; 0x20 < loc < 0x80 (MAZMORRA) -> cuerpo 0x2ee
02eb jmp 0x398                                 ; loc >= 0x80 (COMBATE) -> 0x398
```

Convención de locations ya acreditada por la tabla de ventanas (DS:0x1C90, `magic/tables.ts`):
0 exterior · 1..0x20 pueblo · 0x21..0x7F mazmorra · >=0x80 combate. La máscara de An Sanct
es `TIME_PERMITTED_BITS[6] = 0x0f`: los CUATRO contextos — coherente con que el handler
tenga camino para todos. El camino 0x398 es COMPARTIDO por pueblo/exterior y combate; el
cuerpo 0x2ee es exclusivo de mazmorra. Las «tres ramas» de la ficha: MAZMORRA (0x02ee-0x0395)
· PUERTA (0x03c0-0x03db) · TABLA DE OBJETOS (0x03de-0x0432), las dos últimas en secuencia
dentro del camino 0x398.

## 2. Rama de MAZMORRA (0x02ee-0x0395) — PORTADA en esta pasada

1. `02ee push 2 → call jingle` — el jingle del círculo 2 suena a la ENTRADA, antes de
   saber si hay cofre (a diferencia del camino 0x398, donde suena sólo en éxito).
2. Deltas por facing (`02f5-0309`): `si = g_dng_facing*2` → `dx = word[si+0x24d6]`,
   `dy = word[si+0x24de]` — las MISMAS tablas que An Grav #319 §4 (dx=(0,1,0,-1),
   dy=(-1,0,1,0), leídas en crudo entonces).
3. PRIMERO la celda BAJO el grupo (`030c-033a`): dirección `(g_floor<<6) +
   (g_party_y<<3) + g_party_x + 0x595a` (la rejilla 8×8 por planta); si
   `tile & 0xf0 == 0x40` (cofre CERRADO, cualquier subtipo) se queda con ésa.
4. Si no, la DE ENFRENTE (`033c-0356`): `((y+dy) & 7)<<3 + ((x+dx) & 7)` — envolvimiento
   `and 7` en LOS DOS ejes (0341/034b): el toro 8×8, nunca sale de la planta.
5. Re-test común (`0359-0365`): sin cofre → `0390 mov word [bp-6], 0` = res 0 ⇒ la cola
   común 0x11a6 imprime "Failed!" (DS 0x4660).
6. Trampa (`0367 test byte [bp-0xe],1`): SOLO el bit 0 del subtipo ⇒
   `0371 push 0x45a1 → print_string`. DS 0x45a1 leída en crudo de DATA.OVL
   (`fileoff = DS+0x10`): `44 69 73 61 72 6d 65 64 21 0a 00` = **`Disarmed!\n`**.
   La trampa NO se dispara — sólo se anuncia el desarme, y ANTES de abrir.
7. Apertura (`0374-037f`): `tile = (tile & 8) | 0x70` — cofre ABIERTO conservando SOLO
   el bit iluminado; trampa Y cerradura fuera de golpe, SIN tirada (a diferencia del
   jimmy de mazmorra, que tira rand(1,30) contra DEX). `0381 push 0x45ac → print_string`:
   DS 0x45ac en crudo = **`Chest opened!\n`**. `0388 mov word [bp-6], 0xffff` = res −1 ⇒
   cola 0x11a6 MUDA (ni "Success!" ni "Failed!").
8. La rama NO toca `g_unk_24e6` (el `or ,2` de la rutina está en 0x03ca, rama de puerta):
   sin marca de turno, como sus gemelas de mazmorra (fieldWall, An Grav).

**Controles de cadena**: DS 0x4656/0x4660 releídas en crudo en la misma pasada =
`Success!\n` / `Failed!\n`, las dos ya adjudicadas a la cola 0x11a6 — la convención
`fileoff = DS+0x10` reproduce el par conocido.

**RNG: CERO.** Ninguna de las llamadas del cuerpo 0x02d2-0x043c es a `rand_range`
(censo de profundidad 1: las cuatro rutinas de §0 y nada más); el comentario previo del
port («medido a profundidad 2») queda corroborado en su capa 1.

**Port**: `Dungeon.anSanctOpenChest` (`core/dungeon/dungeon.ts`) + puente
`Game.applyAnSanctOpenChest` + consumidor `main.ts doDungeonCast`. El cofre queda 0x70:
el botín lo entrega el (G)et (`getHere`, SJOG 0x179E), como en el binario — An Sanct no
concede nada. Tests: `game/tests/an-sanct-dungeon-286.test.ts` (16, con negativos del
`test ...,1` y del `cmp al,0x40`). Mutantes: quitar la rama bajo-los-pies (`if (true)`)
→ 2 rojos propios; `sub & 1 → sub & LIT_BIT` en el predicado de trampa → rojos propios
(corrido tras commitear la base). Antes de esta pasada el descriptor `disarmOrOpen` caía
en mazmorra al `else` genérico de doDungeonCast: turno consumido y NADA más.

## 3. Rama de PUERTA (0x0398-0x03db) — ya portada; careo de esta pasada

`0398 call getdir` (CAST2:0x0306) → si devuelve 0 (cancelación): `039f mov ax, 0xffff /
jmp 0x437` — salta el epílogo normal ⇒ res −1, cola MUDA. Si hay dirección:
`get_tile_ptr(scratch)` → `03c0/03c4 cmp al, 0xb9 / 0xbb` → `03c8 dec byte [bx]`
(0xB9→0xB8, 0xBB→0xBA: quita el cerrojo, NO abre) + `03ca or byte [g_unk_24e6], 2`
(turno/redibujo) + jingle 2 + res 1 ⇒ "Success!". Sin puerta: CAE a la tabla de objetos
(§4) — no falla todavía.

Careo contra `Game.applyUnlockSpell` (la rama que la ficha daba por portada) — fiel en
tile-check, `dec`, "Success!"/"Failed!" y escritura volátil. TRES divergencias medidas,
ninguna nueva de esta pasada (se declaran, no se tocan):
1. **Cancelación**: el binario es MUDO (res −1); el port imprime "Cancelled." (patrón
   compartido con pendingCastDoor/An Ex Por, string fabricada ya en uso).
2. **`or g_unk_24e6, 2`**: el port no marca turno/redibujo extra en el éxito — mismo
   residuo declarado que An Ex Por (`applyDoorSpell`), que en el binario escribe igual.
3. **Fall-through a la tabla de objetos**: en el binario un An Sanct apuntado a algo que
   no es puerta AÚN puede triunfar desarmando un cofre-objeto (§4); en el port imprime
   "Failed!" directamente. Es exactamente el hueco de la rama bloqueada.

## 4. Rama de TABLA DE OBJETOS (0x03de-0x0432) — BLOQUEADA por #103, declarada

Barrido de las 32 ranuras de 8 B del pool `DS 0x5c5a` (`0x3e3 mov di, 0x5c5a` ·
`0x426 add di, 8` · `0x42c cmp word [bp-8], 0x20`):

```
+0 == 1                        ; kind (el barrido sólo acepta el kind 1 = cofre)
+2 == g_cmb_scratch_x          ; celda apuntada por el getdir
+3 == g_cmb_scratch_y
+4 == g_floor                  ; SOLO si g_location <= 0x7f (0x401 ja 0x410:
                               ;   en combate el check de planta SE SALTA)
=> and byte [si+5], 0x7f       ; limpia el bit 7 del +5: desarma la trampa
   + jingle 2 + res 1 ("Success!") + guarda si en [bp-4]
```

Sin acierto: sale por `0x420` con res 0 ⇒ "Failed!". El `+5 & 0x7f` casa con el modelo
del port para cofres del mundo (`contents & 0x80` = trampa en `open_chest_world`): la
rama desarma la trampa de un cofre-OBJETO apuntado, en pueblo/exterior (fall-through de
la puerta) y en combate (todo el camino 0x398 con loc >= 0x80).

**Es el pool partido-en-tres de la ficha #103** (mismo `0x5c5a`, paso 8, que #319 §5
corroboró para el barrido de Wis An Ylem). Cablearla contra uno de los tres fragmentos
del port sería la 4ª instancia del defecto ⇒ MISMA decisión que la rama de combate de
An Grav (#319-cableado §4.1): **declarada, no cableada**, pendiente de la unificación de
#103. Consecuencia visible mientras tanto (divergencia declarada): An Sanct no desarma
cofres-objeto — en pueblo/exterior cae a "Failed!" y en combate al no-op declarado de
`combat.ts`.

Nota lateral de combate: el camino 0x398 en combate TAMBIÉN pasa por el `cmp 0xb9/0xbb`
de la puerta — con el búfer de arena bajo `get_tile_ptr` eso es el `dec` sobre puertas
de SALA (0xB9/0xBB en salas de mazmorra). El clon no modela puertas en la arena
(cabecera de combat.ts): queda dentro del mismo no-op declarado.

## 5. Resumen de veredictos

| rama | binario | port tras #286 |
|---|---|---|
| MAZMORRA 0x02ee-0x0395 | cofre propio→enfrente `&7`, `(tile&8)|0x70`, "Disarmed!"/"Chest opened!", res −1 | **PORTADA** (`anSanctOpenChest`, 16 tests + 2 mutantes) |
| PUERTA 0x03c0-0x03db | `dec` 0xB9/0xBB, `or 24e6,2`, res 1 | ya portada (`applyUnlockSpell`); 3 divergencias declaradas (§3) |
| TABLA DE OBJETOS 0x03de-0x0432 | pool 0x5c5a, `and [si+5],0x7f`, planta salvo combate | **BLOQUEADA por #103**, declarada (§4) — no cablear hasta unificar el pool |

RNG: cero en las tres. Stream intacto (asertado: semilla quieta en el cast de mazmorra).
