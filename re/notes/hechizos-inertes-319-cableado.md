# Ficha #319 — cableado de In Wis, An Grav y Wis An Ylem (los tres restantes del acta)

Carril `fix-319` (Mac mini, 2026-08-16/17). Sujeto: el BINARIO (CAST.OVL / CAST2.OVL /
ULTIMA.EXE / DATA.OVL) re-careado sobre este árbol, y el cableado que deja a los tres
hechizos con consumidor. Acta madre: `hechizos-inertes-319.md` (f398f599). Hermanas ya
cableadas con este mismo patrón: #340 (In Quas Xen, 655ffe00) y #341 (Vas Rel Por, 76514b80).

## 0. Re-verificación de la derivación del acta, sobre ESTE árbol

Todo por `dispatch_table` (la vía primaria que el acta §2-bis fija), no calls crudos:

- **Stubs 4/4** = los del acta: `stubs()[0x80a6/0x80be/0x80fa/0x8106]` → CAST2.OVL
  file_off `0x07bc` (An Grav) / `0x06ec` (In Wis) / `0x046c` (Wis An Ylem) / `0x0000`
  (despachador de jingle). Los cuatro con `overlay_num=18`.
- **Base de banda**: `overlay_near_call_base(CAST2.OVL) = 0xe1e0`; las nueve
  resoluciones de near-calls del acta §2-quinquies reproducidas idénticas
  (`0x34da→0x16ba putchar · 0x3abe→0x1c9e text_set_font · 0x3670→0x1850 print_string ·
  0x6372→0x4552 · 0x71b4/0x74cc→0x5394/0x56ac · 0x3f1a→0x20fa · 0x7b2a→0x5d0a
  vis_buffer_build · 0x7730→0x5910 viewport_redraw`).
- **Control positivo de la fórmula** (`residente = (destino + base) mod 0x10000`):
  `ULTIMA.EXE:0x4552` abierto — prólogo limpio, barrido de pool con paso 8, y las TRES
  llamadas a `rand_range` (0x2092) exactamente en `0x4625`, `0x466d`, `0x469f`, como
  el acta §5 declara.
- **Cadenas en crudo** (DATA.OVL, `fileoff = DS + 0x10`): DS `0x9548` = `22 2c 20 00`
  = `", ` · DS `0x954c` = `Field destroyed!\n\0` (el LF final ES del binario —
  contiguas, como el acta §2-ter-2 anota).
- **Cuerpos leídos línea a línea**: CAST.OVL arms `0x0f72` (In Wis: `call 0x4a4` →
  `push 2` + jingle + efecto, diez bytes, la trampa §1 confirmada), `0x0fb0` (An Grav:
  `push 1` → stub 0x80a6 → tail `0xf3f` que escribe `[bp-0xa]=ax`), `0x1084`
  (Wis An Ylem: `push 6` jingle → stub 0x80fa → `jmp 0x11a6` sin tocar res);
  CAST2 `0x06ec-0x0767`, `0x07bc-0x08e6`, `0x046c-0x04c1`.

## 1. Dato NUEVO de esta pasada — `0x3abe` NO es «atributo on/off»: es `text_set_font`

La tabla del acta §2-quinquies rotulaba `0x1c9e` como «atributo de texto on/off». El
corpus lo tiene identificado como **`text_set_font`** (`kernel-sweep-3.md:287`:
`[bp+4]` 0..3 indexa la tabla de fuentes DS:0x539c; y `asm-town-zstats-acta.md` §53.4 lo
usa con el mismo sentido). Consecuencia para In Wis:

- el `push 1 / call 0x3abe` inicial **conmuta a la FUENTE 1 (rúnica)** y el
  `push 0` final la devuelve a IBM;
- **toda la fila de coordenadas se pinta en runas** — letras, apóstrofes, la coma y las
  comillas — y tras la vuelta a IBM el binario **sólo imprime LF**, que no pinta glifo
  (el dato colateral de medicion-364c que el encargo pedía carear);
- ⇒ el modelo por-FILA del port (`ConsoleLine.rune`) BASTA aquí: no hay tramo mixto en
  ninguna fila, así que In Wis **no** arrastra la cirugía por-tramo que #364-c declara
  pendiente para el ALAKAZAM (allí el `!` va en IBM a mitad de fila; aquí no hay nada
  imprimible tras el cambio de vuelta).

## 2. Dato NUEVO — el `push -1` de Wis An Ylem y el `jle` de `vis_buffer_build`

`0x5d0a` (vis_buffer_build) siembra el búfer 11×11 (`0xAB02`, stride 0x20) **a 0xFF**
en su prólogo (`5d12-5d31`) y sólo después floodea… si el radio lo permite:
`5d45 cmp word [bp+0xa], 0 / jle 0x5d8f` — **con radio ≤ 0 el flood se SALTA entero**
y el búfer queda todo-visible. Wis An Ylem pasa `push -1` (0x0473) exactamente para
eso: la ventana entera revelada — muros, oscuridad y actores incluidos (el pintor de
actores 0x5394, uno de los dos repintados del bucle, consulta ese mismo búfer).
El «radio −1» no es un radio: es el interruptor del flood.

## 3. Qué se cableó (port), pieza a pieza

| hechizo | mecánica | consumidor | tests |
|---|---|---|---|
| In Wis | `inWisPeerText` (`core/magic/cast.ts`) — los 12 pasos de CAST2:0x06ec, Y antes que X, `'A'+nibble`, los DOS `\n` | `main.ts doCast` → `hud.message(texto, rune=true)` | `game/tests/in-wis-peer-319.test.ts` (8) |
| An Grav | `Dungeon.anGravDispel` (`core/dungeon/dungeon.ts`) — bajo-los-pies → enfrente con `&7` en ambos ejes, `and [bx],8` | `main.ts doDungeonCast` → `Game.applyAnGravDispel` | `game/tests/an-grav-dispel-319.test.ts` (14) |
| Wis An Ylem | `CoreViewImpl.revealViewport` + bypass en `visField()`/`snapshot()` (`skin/coreview.ts`) — 20×55 ms | `main.ts doCast` → `view.revealViewport(DEATH_VISION_FRAMES * PAUSE_UNIT_MS)` | `game/tests/wis-an-ylem-reveal-319.test.ts` (9) |

Detalles fieles que un port «razonable» pierde y aquí están defendidos por aserto:

- **An Grav**: la celda bajo el grupo se mira ANTES que la de enfrente; el `& 7`
  envuelve el toro 8×8; la máscara `and [bx],8` conserva el bit iluminado (no escribe
  suelo plano); el éxito imprime `Field destroyed!` con la cola 0x11a6 MUDA (res −1) y
  el fallo imprime `Failed!` (res 0). Cero RNG.
- **In Wis**: éxito silencioso (el handler no toca el código de resultado); el par de
  `\n` reproducido por el impresor modelado #108 (fila en blanco + fila rúnica —
  aserto sobre `pushConsole`). Cero RNG.
- **Wis An Ylem**: el revelado afecta a las DOS pieles por el mismo choke (window sin
  `TILE_HIDDEN` + `visMask` todo 1 + sin `visRadius`); caduca a los 20 fotogramas y el
  siguiente horneado re-censura (el `viewport_redraw` final). La memoización PERF-1 del
  snapshot se salta mientras el revelado está armado (si no, el horneado revelado
  sobreviviría a la caducidad — mordió en el primer run del test y quedó asertado).

Mutantes corridos (uno por hechizo, cada uno con rojo PROPIO, todos revertidos):
invertir Y/X en `inWisPeerText` → 3 rojos de su fichero; quitar la rama bajo-los-pies
de `anGravDispel` (`if (true)`) → 1 rojo propio; quitar la rama del revelado en
`visField` → 4 rojos propios. Y el censo de #278 es la guarda del CABLEADO: huérfanos
**4 → 1** (queda sólo `castAnimOnly`, el centinela adjudicado del acta §0).

## 4. Divergencias DECLARADAS (no cableadas, con razón)

1. **Rama de combate de An Grav** (`CAST2:0x0866`): leída PARCIAL en esta pasada —
   `call 0x306` (cursor de apuntado; 0 = ESC → ret −1 mudo), jingle 4 condicional, y un
   barrido del pool `0x5c5a` de a 8 buscando `tile & 0xfc == 0xe8` (los campos de
   combate). Es el pool partido-en-tres de la ficha **#103**: cablearla antes de
   unificarlo sería la 4ª instancia del defecto. Sigue como pendiente del acta §6; en
   combate el descriptor `dispelField` cae hoy al default sin efecto (como antes).
2. **El tick por fotograma de Wis An Ylem** (`0x6372` → kernel `0x4552`): consume RNG
   (3 sitios) DENTRO del barrido del pool y gateado por `g_time_spell != 'T'` — el
   cardinal depende de la población de actores y NO está derivado. El port consume
   **cero** tiradas (asertado): stream declarado, no inventado (familia #31/#101,
   exactamente lo que el acta §5 manda). **Censo #353 §6: ningún veredicto caduca** —
   el port no añade tiradas nuevas en ningún camino de los tres hechizos (los tres
   asertan semilla-quieta), y la divergencia binario-vs-port de Wis An Ylem existía ya
   (el hechizo era casteable e inerte).
3. **Modalidad del input**: los 20 fotogramas del binario son modales (bucle síncrono);
   el port no bloquea el input durante los ~1,1 s del revelado. Presentación, Clase C.
4. **Jingles 2/4/6**: el port emite el `cast-spell` genérico (la aproximación vigente
   para todos los jingles del Cast, misma que #341 documentó para el 8).
5. **Cadencia**: 20 × 55 ms — la unidad calibrada de `0x3AE6`/`ANIM_TICK_MS` que ya
   usan troll-sneak y world-fx (Clase C declarada, se reusa el número).
