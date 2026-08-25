# Kernel render/visibility sweep — BARRIDO lote 1 (task #16)

> Lectura instrucción-a-instrucción del TOP de sospechosos render/visibilidad del
> kernel (`re/coverage-depth.md` §3/§4). Convención: offsets `0xNNNN` = offset de
> imagen del kernel en `re/disasm/ULTIMA.EXE.asm` (CS-relativo). `[0xNNNN]` con
> corchetes = global **DS = DATA.OVL** (`fileoff = DS_off + 0x10`,
> `command-dispatch.md §4`). No re-deriva lo ya hecho: enlaza. Scout: lote 1.

## 0. TL;DR — hallazgos que cambian el mapa

1. **`[0x5350]` es el driver de VÍDEO cargable, no (sólo) de sonido.** Las 3
   primitivas de blit despachan por `lcall [0x5350]` con selectores de **dibujo**
   (0x2d=set color, 0x30=pixel, 0x33/0x39/0x3c=línea, 0x3f=fill-rect, 0x03=set
   mode vía `int 0x10`). El global `g_snd_driver_fn`/`g_snd_driver_seg` (0x5350/
   0x5352) está **mal nombrado**: es el vector del `.DRV` de display (EGA/CGA/HER/
   T1K son adaptadores). El PC-speaker va aparte por `out 0x42` directo
   (`ui-render-map.md §9`), lo que confirma que `[0x5350]` **no** es el sonido.
   → **la tabla de selectores de abajo (§4) ES el contrato de dibujo que la piel
   fiel debe replicar.**

2. **`0x0892` NO es un handler de comando huérfano** (como suponía coverage-depth
   #19). El tramo `[0x0892, 0x0a70)` es un **clúster de ~7 primitivas gráficas
   leaf** (una sola con prólogo → el particionador las fundió): init-de-modo +
   recorte de línea Cohen-Sutherland + clamp a pantalla 320×200. Ver §3.

3. **`0x2322` NO es un handler de comando huérfano** (coverage-depth #16). Es un
   **callback de animación diferida** que se auto-instala en el vector far
   **mutable `[0x5394]`** (el mismo que por defecto es el hook de disco 0x1232 del
   PLINK, `command-dispatch.md §4`). Ver §6. → **no hay mecánica de comando oculta
   en ninguno de los dos "huérfanos".**

4. **Los 2 "ticks de animación ambiental con RNG por celda" (0x5394 CS, 0x4102) NO
   consumen el stream de rands del juego.** `0x5394` usa una **tabla espacial
   estática** (`0x6ff0`→DS:0x6aa8), no una tirada; `0x4102` es un escáner de
   proximidad por **distancia²** (sin rand). Corrige la hipótesis "RNG por celda"
   de coverage-depth §3 fila 9-10. Ver §5. **Cero impacto en orden-de-rands.**

5. **`0x6936` (anim de sprites del party) SÍ consume RNG del juego en la ruta de
   render**: `rand_range(0,0xf)` (`0x2092`) por cada miembro con status `*`/`,`
   por frame, para un flash. **Posible relevancia de paridad** (consumidor de
   rands en el render). Ver §2 + report.

6. **`npc_build_vismap` (NPC.OVL) es algoritmo propio, NO comparte el raycaster
   `0x5a28`.** Construye una rejilla de **pasabilidad/ocupación 32×32** (walkable
   0xadc + rango 0x6a0, marca 0x90=bloqueado). Los NPC navegan por pasabilidad; el
   party ve por raycast. Sistemas distintos. Ver §8.

---

## 1. `0x5e4a` — emitter_collect_and_flood (colector de emisores + flood por emisor)

`[start=0x5e4a, len=316]`. Verificación del port de E1-S2/b24f0d6 contra la lectura
completa: **el port de la tabla y el radio es EXACTO**; la única divergencia ya está
en `deliberate-divergences.md:590` (escaneo ventana-vs-chunk).

Flujo derivado:
1. `5e5e-5e6b` limpia el buffer de luz **[0xad14]** (0x400 B = 32×32) a `0xff`.
2. `5e72-5ee9` **doble bucle sobre el chunk 32×32 COMPLETO** (si=x 0..0x20 interno,
   [bp-6]=y 0..0x20 externo, row-major). Por celda: `0x4402` (tile-fetch en coords
   `g_chunk_origin_x/y + si/[bp-6]`) → tile; `0x402(tabla=0x6a9a, tile, count=0xa)`
   = **memchr de 10 bytes** (§7). Si el tile está en la tabla → guarda el par
   **(y, x)** en la lista local del stack y escribe el tile-id en [0xad14].
3. `5efe-5f63` **por cada emisor**: limpia el buffer visible 11×11 [0xab02] a 0xff y
   corre el flood `0x5a28(buf=0xad14, stride=0x20, x-5, y-5, x-5, y-5, radio=0xa)`
   → acumula el halo (radio 10) en [0xad14].
4. `5f65-5f78` pase final: cada celda que sigue `0xff` (no alcanzada) → `inc` = `0x00`.

Respuestas a las preguntas del brief:
- **¿chunk 32×32 completo?** Sí (si, [bp-6] ambos 0..0x20). El port sólo mira la
  ventana 11×11 (divergencia ya documentada).
- **¿orden?** row-major, y externo / x interno; emisores en orden de escaneo.
- **¿cachea?** No — reconstruye y re-limpia [0xad14] cada llamada.
- **radio por emisor** = `0xa` (10); **count de la tabla** = 10.

### La tabla de emisores DS:0x6a9a (fileoff DATA.OVL 0x6aaa)
`dc bd be b2 de bf b0 b1 b3 bc 00 00` → **10 tile-ids emisores**:
`0xDC 0xBD 0xBE 0xB2 0xDE 0xBF 0xB0 0xB1 0xB3 0xBC` + terminador `00 00`.
**Coincide byte-a-byte con `EMITTER_TILES` del port**
(`game/src/core/world/visibility.ts:126`) y `EMITTER_LIGHT_RADIUS=10`. Port EXACTO.

`0x402` = `memchr(ptr, byte, count)` (`repne scasb`; devuelve ptr al match o 0).

---

## 2. `0x6936` — party_anim_build (ensambla g_char_anim_states del party)

`[start=0x6936, len=652]`. Llamada desde la cadena de render `0x6bee`.

Flujo:
1. `696d-69cc` limpia los registros de sprite-state en **0x5c5a** (stride 8) hasta
   0x5d5f (y un struct paralelo en 0xba14).
2. `69da-6b7b` bucle por miembro del party (`[bp-4]` < `g_party_size`):
   - salta si el status en char+0xb (`[bx<<5 + 0x55b3]`) == `0x44` ('D' muerto).
   - **flash de status con RNG**: si char+0x1d (`+0x55c5`) == `0x2a`('*') o
     `0x2c`(','), rola **`0x2092 = rand_range(0,0xf)`** (`rng.md`: EL rand del
     juego). Si == `0xb`, imprime string 0xa422 + `0x43ae` (tono) + `0x6e60`. ⚠
     **consumidor de rands en la ruta de render** (ver report).
   - posiciona el sprite (`0x6506` → slot), y fija el **sprite base por
     clase/orientación** con la jump-table `cs:[bx+0x6b04]` (20 entradas, char+0xa
     = clase 'A'..) → escribe 0x40/0x44/0x48/0x4c en `[slot+0x5c5a]`.
   - `6b52` si char+0xb == `0x53` ('S' dormido) → `0x68ae`, si no → `0x6794`
     (pintores).
3. `6b7e-6bb8` caso especial: si `g_unk_adb9 == 0xdc` (tile hoguera, uno de los
   emisores) prepara su sprite de animación (0x5c5f = `g_floor*3+7`).

Confirma coverage-depth #5 ("ensambla tabla de punteros a g_char_anim_states").

---

## 3. `0x0a70` / `0x0aa6` / `0x0b10` — las 3 primitivas de blit (+ clúster 0x0892)

Todas terminan en `mov word [0x5350], SEL; lcall [0x5350]` (driver de vídeo).

| off | args (ret) | qué hace | selector |
|---|---|---|---|
| **`0x0a70`** | 1 word (ret 2) | **SET COLOR**: `[bp+4]` &0xf (16c) o &0x3 (4c, según `g_unk_52c8`); 0xffff = transparente/no-op; guarda en `[0x52da]` | **0x2d** |
| **`0x0aa6`** | 4 words (ret 8) | **FILL RECT** (x0,y0,x1,y1); `0x8e6` clampa a 320×200; CF=0 | **0x3f** |
| **`0x0b10`** | 4 words (ret 8) | **DRAW LINE** (x0,y0,x1,y1) con recorte; vía `0xb2d` | 0x30/0x33/0x39/0x3c |
| `0x0b86` | 4 words (ret 8) | fill-rect variante CF=1 (gemela de 0aa6) | 0x3f |
| `0x0ad0` | 6 words (ret 0xc) | blit/rect con si,di extra (`[bp+0xc/0xe]`) | 0x18 |

`0x0b10`→`0xb2d`: guarda `cx→[0x52cc]`, `dx→[0x52ce]`; si `[0x52c4]`≠0 recorta con
`0x935` (Cohen-Sutherland, ver abajo) y aborta si rechazado. Luego elige selector por
geometría: `bx==dx` (horizontal) → 0x39 (o 0x30 si además ax==cx = punto);
`ax==cx` (vertical) → 0x3c; diagonal → 0x33.

### El clúster de recorte `[0x0892, 0x0a70)` (7 funciones leaf, no un handler)
- `0x0892` init: `int 0x10 AH=0xF` (get mode, guarda en `[0x5304]`) → selector **3**.
- `0x08e6` clamp: ordena (ax≤cx, bx≤dx) y **clampa a [0,0x13f]×[0,0xc7]** (=319×199).
- `0x0a22` = **outcodes Cohen-Sutherland** contra rect `[0x52d0]`=izq `[0x52d2]`=der
  `[0x52d4]`=arr `[0x52d6]`=aba (bits 1/2/4/8).
- `0x0935` = clip de línea: acepta trivial (outcodes 0), rechaza trivial (si&di≠0),
  o subdivide por **punto medio** (`0x0991`, `>>1`).

**Insumo piel fiel:** el rect de recorte activo vive en `[0x52d0..0x52d6]`; el color
actual en `[0x52da]`; la ventana en `[0x52cc/52ce]`. La geometría 320×200 está
horneada en `0x08e6`.

---

## 4. Contrato del driver de vídeo `[0x5350]` (selectores observados)

| SEL | operación (derivada del wrapper que lo emite) |
|---:|---|
| 0x03 | set video mode (tras `int 0x10`) — `0x0892` |
| 0x18 | blit/rect extendido (6 args) — `0x0ad0` |
| 0x2d | **set color** actual `[0x52da]` — `0x0a70` |
| 0x30 | plot pixel (línea degenerada a punto) — `0xb2d` |
| 0x33 | draw line diagonal — `0xb2d` |
| 0x39 | draw line horizontal — `0xb2d` |
| 0x3c | draw line vertical — `0xb2d` |
| 0x3f | **fill rect** — `0x0aa6`/`0x0b86` |
| 0x60 | (usado por `0x6fe0`, adyacente — sin derivar aquí) |

(Los selectores son múltiplos de 3 = índice en la jump-table de entrada del `.DRV`;
`command-dispatch.md §4` ya lo notó como "driver".)

---

## 5. `0x5394` (CS) y `0x4102` — pintores ambientales, SIN RNG

**⚠ OJO: `0x5394` (código CS) ≠ `[0x5394]` (dato DS = vector far mutable, §6).**

### `0x5394` (CS) = paint_world_layer_A (swap de tiles ambiental + capa de actores)
`[start=0x5394, len=690]`.
- `539c-5428` (si `g_location < 0x80`): escribe party_x/y/floor/transport en
  g_char_anim_states[0..4]; **doble bucle 11×11** sobre el buffer visible
  `[-0x54fe]` (0xab02): si tile==`0xdd` y `0x6ff0(x,y) > 5` → tile=`0x1c`; si
  tile==`0x1c` y `0x6ff0(x,y) ≤ 5` → tile=`0xdd`.
- **`0x6ff0(x,y)` = lookup a tabla ESTÁTICA**, no RNG: pliega (x,y) a un cuadrante
  (espejo en centro 5) e indexa `DS:[bx+0x6aa8]` (contiguo a la tabla de emisores).
  Devuelve 0 fuera de 0..0xb. ⇒ el swap `0xdd↔0x1c` es un **dithering espacial
  determinista** (dos variantes del mismo terreno repartidas por patrón fijo), NO
  una animación temporal ni un consumidor de rands.
- `542a-…` recorre la lista de actores (0x5d52↓) y vuelca sus sprites al buffer
  `[-0x539c]` (= **0xAC64** = g_vis_tile_window, con ficha desde #267; `(-0x539C) &
  0xFFFF = 0xAC64`, corregido por #267: decía 0x5c64, heredado de la errata de
  `ui-render-map.md`; la capa a stride 16 derivada en globals-negdisp-adjudicacion.md
  §4) = capa de personajes. ⚠ La ETIQUETA «capa de personajes» NO se retracta —se
  sostiene en lo que hace `542a`, que vuelca sprites de actores ahí— pero queda dicho
  que se escribió junto a la dirección equivocada y que nadie la ha re-derivado desde
  el búfer correcto.

**Corrección a coverage-depth §3 fila 9**: "según tirada 0x6ff0" es incorrecto —
`0x6ff0` es una tabla, no una tirada.

### `0x4102` = ambient_effect_nearest (escáner de proximidad, SIN RNG)
`[start=0x4102, len=614]`. Barre la ventana ±5/+6 alrededor del party calculando
**distancia² (`imul`)** y halla el tile especial más cercano de las familias:
`&0xfe==0xfa` (tipo 1), `&0xfc==0xd4` (2), `&0xfc==0xd8` (3), buffer + `&0xfc==0x5c`
(4). Luego despacha por tipo (0x4247+) imprimiendo strings / chequeando flags
(`[0x5884]`, `[0x6a34]`) = **efecto/mensaje ambiental del terreno cercano**. Sin
`call 0x2092`. Determinista.

**Corrección a coverage-depth §3 fila 10**: no es "RNG por celda"; es
selección-por-distancia del efecto ambiental más próximo.

---

## 6. `0x2322` / `0x2320` / `0x25ca` — handlers del vector far mutable `[0x5394]` (DS)

`[0x5394]` (DS, DATA.OVL) es un **puntero far a función mutable**: por defecto apunta
a 0x1232 (hook de cambio-de-disco del PLINK, `command-dispatch.md §4`), pero el
código lo reescribe con `mov word [0x5394], N` a distintos handlers y lo invoca con
`lcall [0x5394]` en la ruta de turno/render (>30 sitios).

- **`0x2320` = `retf`** (no-op far): el centinela "sin acción".
- **`0x2322`** = callback de **animación diferida de una casilla**: reindexa por
  `g_unk_a9bd`, compara contra `[0x545e]`, y **`xor byte [si], 3`** (toggle de los 2
  bits bajos = avance de frame) sobre el buffer en 0xa9c8+; llama `0x1eac`
  (update de tile). Al entrar **se re-arma a `0x2320`** (`mov [0x5394],0x2320`) →
  es one-shot/auto-desarmable.
- `0x25ca` = otra variante de handler (mismo vector; no derivada a fondo aquí).

⇒ **No es un "handler de comando del dispatcher"** (coverage-depth #16). Es la
mecánica de **hook post-frame** del PLINK/kernel. Sin mecánica de juego oculta.

### El clúster del cursor de selección (`0x251e` / `0x25d8`, addendum del lote)

> ⚠ **REFUTADO ENTERO — no es un cursor, es la capa de ficheros.** Ver
> `es-disco-reintento.md` §8. Los números de servicio de `int 21h` lo cierran: `0x1674` es
> `3Dh`+`3Eh` (abrir/cerrar fichero), no espera de tecla; el `xor 3` alterna la LETRA DE
> UNIDAD `'A'`↔`'B'`, no bits de frame; `[0x5394]` es el hook de error de DOS, no un hook de
> blink. El error estaba en la premisa que `kernel-sweep-2.md` §175 ya había corregido
> (`0x1eac → dos_select_drive`, no «update de tile»): se rectificó la pieza y no este párrafo,
> que colgaba de ella. Se deja el texto en pie para que la corrección sea legible.


`0x2322`/`0x2320`/`0x25ca` + `0x251e` + `0x25d8` forman **el cursor parpadeante de
"elige casilla/dirección"**: comparten el índice `g_unk_a9bd` (celda seleccionada), la
tabla `[idx-0x5638]` (tile guardado bajo el cursor), `0x1eac` (redibuja la celda) y el
vector far `[0x5394]` como su **hook de blink**.

- **`0x251e` → `cursor_highlight_set`** (in-degree far=5, seg2 0x828e; BLCKTHRN/ENDGAME/
  OUTSUBS): fija `g_unk_a9bd`=arg (2/5→1), redibuja la celda con su tile, re-arma
  `[0x5394]=0x2322` (blink). Instala/mueve el cursor.
- **`0x25d8` → `cursor_select_loop`** (in-degree far=3, seg2 0x8348; OUTSUBS×3): loop
  interactivo — espera tecla (`0x1674`), instala `[0x5394]=0x25ca` (handler que imprime
  la string 0xa0e0) alrededor de `0x7296` (overlay), re-arma `0x2322`. `ret 6`.
- **`0x25ca`** = handler far (`retf`) que imprime 0xa0e0 + `0x1dda` — el prompt del loop.

Su bomba de input es `getkey_with_redraw` (`0x266c`, §abajo).

## 9. `0x43ae` → `anim_step_dda` — stepper DDA / interpolador lineal

`[start=0x43ae, len=432]`. **in-degree far=14** (seg2 0x842e; CAST×6 CMDS×3 SJOG×4
TALK×1) — foundational, era nivel A. Args `(steps=[bp+4], p6, p8, pA)`:
- `43bc-43ce` pendiente: `[bp-2] = ((p8 - pA) * p6) / steps` (delta escalado por pasos).
- `43d1-43ef` bucle `di` de 0 a `steps`: por paso `0x22e2(si)` + `0x20c8(p6,1)`
  (callbacks draw/erase de la casilla), avanza `si += [bp-2]`, `di += p6`.
- `43f7` `0x230e` (restore final).

Es el **animador de movimiento por casillas** (proyectil de combate, efecto de hechizo,
sprite que viaja de A a B en N pasos). Los 14 call-sites far vienen de CAST/CMDS/SJOG =
magia + comandos que lanzan algo. Cadencia fina → 🎥 catálogo AV; el mecanismo (N pasos
lineales con draw/erase por paso) es lo derivado aquí.

---

## 7. `0x6150` — avatar_render_update (sprite del avatar + frame por terreno)

`[start=0x6150, len=528]`. Entra por call (ind=0 = indirecta). Procesa **UN** actor
`[bp+4]` (no itera):
- lee su sprite base `[bx<<3 + 0x5c5a] & 0xfc` → `[bp-8]`.
- `0x16ba`+`0x1850` imprimen etiqueta/nombre: si base<0x40 string 0xa3fa; si no,
  índice `(base-0x40)/4` en tabla-word `[0x18b6]` → string. Luego string 0xa402.
- lee el tile bajo el actor (`0x4402(char+0x5c5c, +0x5c5d)`) → `[bp-4]`; marca
  `[bp-6]` si es terreno especial (0x60-0x6f, 0x6a/0x6b).
- **switch grande** que elige el **frame de animación del avatar** `[bp-2]` según:
  transporte (`g_transport_tile & 0xf8 == 0x20` = barco → frames 0xb/0xd/0xe),
  base==0x2c (0xc), y el terreno bajo el avatar vía jump-table `cs:[bx+0x62d8]`
  (mapea tipo de tile → frame 1..8: andar/nadar/etc). Rama `base==0xfc` = cetro
  (`g_sceptre`, anim con `0x2192`).
- `633a` pinta el sprite (`0x60ec`) y **dispara un redibujo completo**:
  `0x5f86`(setup vista) + `0x8016` + **`0x5e4a`** (recolecta luz) + `0x4f7c`.

Es la rutina que compone el **sprite del avatar central con la postura correcta**
(andando/montando/navegando/nadando, elegida por el terreno) y refresca viewport+luz.
La jump-table terreno→frame en `0x62d8` (mal-desensamblada como datos) es insumo de
fidelidad de la animación del avatar.

---

## 8. `npc_build_vismap` (NPC.OVL `0x1d2`, len 346) — pasabilidad, NO LOS

Ya derivada en `re/notes/npc.md §0-§5` (Task 3.5). Confirmación del brief:
**algoritmo propio, no comparte `0x5a28`.** Construye una rejilla **32×32 de
pasabilidad/ocupación** en `[0xb11c]` (stride 0x20): doble bucle 32×32 con predicado
walkable `0xadc(hour, arg, g_floor, y, x)` → 0=libre / `0x90`=bloqueado; superpone
NPCs (recorre 0x5d52↓, test de rango `0x6a0`<4) y el party (g_char_anim_states+2/+3)
como `0x90`. Es una **occupancy grid para pathfinding de NPC**, no un raycast/LOS. Los
NPC "ven"/navegan distinto que el party (que usa el raycaster `0x5a28`).
