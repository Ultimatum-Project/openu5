# ACTA — #224: las DOS colas de bloqueo (naval MAINOUT 0x0312-0x0347, y pueblo TOWN 0x083a)

> Rama `re/colas-224`, worktree `.claude/worktrees/colas-224`.
> Carril de MECÁNICA. Precedentes de la tarjeta: #157 (OUCH! del cactus, EN MAIN),
> #216 (Blocked! en los dos brazos, EN MAIN), #235 (symlink padre de `game/assets`),
> #227 (la CAPA es parte de la conducta), #237/#231 (cerrar por INALCANZABLE con la
> medición delante).

---

## §0 — PREDICCIÓN PRE-REGISTRADA (escrita ANTES de medir enrutabilidad y de leer el port)

Escrita tras derivar las dos colas del ASM (§1, §2) y **antes** de tocar
`smallmaps.json`, `resolveStep` o el catálogo de audio.

**P1 — enrutabilidad del cactus en pueblo: PREDIGO QUE SÍ ES ENRUTABLE.**
Razón derivada, no intuición: en las DOS rutinas el tile destino se lee de
`g_vis_buffer` (`[bx + si - 0x5459]`, base 0xABA7 = 0xAB02+165 ⇒ rejilla 11×11 stride 32
centrada en (5,5)) **antes** del test de pasabilidad, y la cola de bloqueo
(`Blocked!` + beep/OUCH) es justamente el `else` del test. O sea:
`IsWalking_Passable=false` no impide llegar al test — **es la precondición de llegar a la
cola**. Lo que podría hacer la divergencia inalcanzable no es la impasabilidad del
cactus, es la TOPOLOGÍA: que ningún cactus de la location 15 tenga un vecino ortogonal
pisable donde la party pueda plantarse.

> **CONDICIÓN DE FRACASO de P1**: si ningún cactus de los 16 de SinVraals_Hut tiene al
> menos un vecino ortogonal pisable **conectado** al punto de entrada de la party ⇒ P1
> FALLA, la divergencia es INALCANZABLE y #224 cierra por declaración (precedente #237).

**P2 — polaridad de la divergencia de pueblo: PREDIGO QUE ESTÁ INVERTIDA respecto al
título de la tarjeta.** El título dice que la cola de pueblo «NO tiene test de cactus»,
que suena a hueco del PORT. Pero es el BINARIO el que no lo tiene: TOWN 0x083a imprime
`Blocked!` + beep y punto. Como `resolveStep` es COMPARTIDO y #157 le colgó `onCactus` en
la rama de bloqueo, predigo que el port dispara OUCH! + daño **también en pueblo**, donde
el binario solo pita ⇒ divergencia por EXCESO introducida por #157, no por defecto.

> **CONDICIÓN DE FRACASO de P2**: si la vía de pueblo del port no pasa por la cola
> compartida de bloqueo, o si ya tiene un gate por capa/location, P2 FALLA.

**P3 — el beep: PREDIGO QUE EL CATÁLOGO YA EXISTE y que «ausente» es media verdad.**
`re/notes/sfx-catalog.md:559-560` ya ficha los DOS call-sites (`0x0344` y `0x0849`) como
`pcspeaker_beep` (CS 0x22c0, `beep(freq=0xa5, dur=0xc8)`), y el acta de #157 §6 habla de
un cue `move-blocked` vivo en el port. Predigo que el beep se emite y que lo que falta,
si falta algo, es la EXCLUSIVIDAD con el OUCH y/o el gate de la rama 0xEC.

> **CONDICIÓN DE FRACASO de P3**: si no hay ningún cue de bloqueo en el port, P3 FALLA y
> la mitad de audio se declara y se remite al carril de audio con #202.

---

## §1 — La cola NAVAL/EXTERIOR: `ship_try_move` (MAINOUT.OVL 0x01fe, size 342)

El ledger la tiene como `ship_try_move` (`re/ledger/frontier.json`, start `0x01fe`,
IDENT). **No es «la rutina del barco»**: es la única rutina de paso del exterior para
todos los modos (hallazgo de #157, corregido en #178).

Cuerpo derivado (verbatim del disasm, `re/disasm/MAINOUT.OVL.asm`):

```
0200  push bp / mov bp,sp / sub sp,6 / push si      ; args: [bp+6]=dx  [bp+4]=dy
0205  cmp (g_transport_tile & 0xfc), 0x24  → print DS 0x2982 "Rowing!"
0215  [bp-2] = 1                                    ; «se puede pasar» por defecto
021a  call 0xffffb4be(party_x+dx, party_y+dy, g_floor)  → [bp-4] = OBJETO en destino
      [= CS 0x368e ULTIMA.EXE find_object_at_xy, sesgo 0x81d0]
023e  si [bp-4]==0 → 0x288                          ; sin objeto: sigue permitido
0240  [bp-2] = 0                                    ; con objeto: bloqueado por defecto
0245  cmp g_transport_tile,0x30 / jae 0x253         ; ≥0x30 → rama A
024c  cmp g_transport_tile,0x20 / jae 0x270         ; 0x20..0x2f → rama B
      (…<0x20 cae también en rama A)
0253  rama A: obj∈[0x24,0x2c) → permitido
       obj==0x1b            → permitido
       (obj&0xfe)==0x10     → permitido
       si no                → 0x288 con [bp-2]=0
0270  rama B: si transport<0x28 → 0x288 ; obj∈[0x24,0x28) → permitido ; si no 0x288
0283  [bp-2] = 1
0288  si = [bp+4] << 5 ; bx = [bp+6]
028c  mov al, byte ptr [bx + si - 0x5459]  → [bp-6] = TILE DESTINO
      (0xABA7 = g_vis_buffer 0xAB02 + 165 = (5+dy)*32 + (5+dx) — rejilla 11×11 stride 32)
029b  si [bp-2]!=0: call 0xffffaa7c([bp-6], g_transport_tile)  ; pasabilidad
02ad     si devuelve 0 → ax=0
02b9  si ax!=0 → jmp 0x34a   ⇒ RETORNA 1 = paso permitido
── COLA DE BLOQUEO (compartida pie/vehículo/barco) ──────────────────────────
02c0  cmp g_sail_dir,0 / je 0x312            ; ¿navegando a vela?
      ── brazo A VELA (g_sail_dir != 0) ──
02c7    dest==0x03   → print DS 0x298b "BREAKING UP!"
02d2    dest==0x47   → (no imprime nada aquí)
02d8    otro         → print DS 0x2999 "COLLISION!"
02df    dest==0x47   → print DS 0x29a5 "Docked!" + g_transport_tile += 4 (auto-FURL)
02f4    dest!=0x47   → call 0xffffa06c — ARGS 0x12c, 0x7d0, 0x64    ; noise_burst
0303                 + call 0x109e = daño al casco
0306    g_sail_dir = 0 ; [0x5956] = 1 ; → 0x34a
      ── brazo B PIE/VEHÍCULO (g_sail_dir == 0) ──
0312    cmp g_transport_tile,0x20 / jb 0x322     ; a pie → salta el gate 0xEC
0317    (montado/vehículo) al = [bp-4] & 0xfc ; cmp 0xec ; je 0x34a
        ⇒ ★ SALIDA SILENCIOSA: montado y con OBJETO 0xEC..0xEF en destino,
          retorna SIN Blocked!, SIN beep y SIN daño. (Sólo aquí; TOWN no la tiene.)
0322    print DS 0x29ae "Blocked!\n"               ← en los DOS brazos (#216)
0329    cmp [bp-6], 0x2f                           ; ¿TILE DESTINO = cactus?
032f      sí → print DS 0x29b8 "OUCH!\n" + call 0xffffa8d8 (kernel_party_random_damage,
               CS 0x2aa8, rand(1,8) por miembro vivo)              → 0x347
033c      no → call 0xffffa0f0(0xc8, 0xa5)  = pcspeaker_beep(freq=0xa5, dur=0xc8)
                                                                    (sfx-catalog §…:559)
0347  call 0xffff9946                              ; cola común
034a  ax = [bp-2] ; ret 4
```

★ **beep y OUCH son ramas EXCLUYENTES del mismo `if`** (0x0329). Ya derivado en #157;
re-verificado aquí verbatim.

★ **La salida 0xEC de 0x0317 es EXCLUSIVA del exterior.** Es un `je 0x34a`: se come
`Blocked!`, el beep y el OUCH. Y su gate previo (`transport < 0x20 → jb 0x322`) la hace
inalcanzable a pie.

## §2 — La cola GEMELA de PUEBLO: TOWN.OVL 0x0600 (`town_move`)

Ledger: `re/ledger/frontier.json` la describe como el switch dir 1..4 con
`town_transport_face(0x57C)` y `0x083A "Blocked!" 0x26D6`.

```
0600  push bp / mov bp,sp / sub sp,0xe / push si    ; arg: [bp+4] = dir 1..4
0607  transport==0x1c  ó  (transport&0xfe)==0x12  → call 0xffffc16e
061a  [bp-6]=[bp-0xc]=[bp-0xa]=0                   ; borde=0, dy=0, dx=0
0625  switch [bp+4]:
      1 → 0x73c: dx-- ; party_x<1  → borde=1 ; [bp+4]=3 ; face(3) ; str 0x268a "West"
      2 → 0x71a: dx++ ; party_x>0x1e→ borde=1 ; [bp+4]=1 ; face(1) ; str 0x2684 "East"
      3 → 0x648: dy-- ; party_y<1  → borde=1 ; [bp+4]=0 ; face(0) ; str 0x2676 "North"
      4 → 0x6f8: dy++ ; party_y>0x1e→ borde=1 ; [bp+4]=2 ; face(2) ; str 0x267d "South"
0669  [bp-4] = 1                                    ; permitido por defecto
066e  si = dy<<5 ; bx = dx ; [bp-0xe] = [bx+si-0x5459]   ← MISMA lectura de g_vis_buffer
0681  call 0xffffb4be(party_x+dx, party_y+dy, g_floor) → [bp-8] = OBJETO
06a2  si [bp-8]==0 → 0x776
06a9  [bp-4]=0 ; mismas dos ramas por g_transport_tile (0x30 / 0x20 / 0x28)
      rama A: obj∈[0x24,0x2c) · obj==0x1b · (obj&0xfe)==0x10
              ★ + obj==0x1e   (0x06e3)      ← NO está en MAINOUT
              ★ + obj==0x1f   (0x06ec)      ← NO está en MAINOUT
      rama B: idéntica a MAINOUT (0x75e)
0776  si [bp-4]==0 → 0x83a  BLOQUEADO
077f  call 0xffffaa7c([bp-0xe], g_transport_tile) ; si 0 → 0x83a BLOQUEADO
0792  si borde!=0 → prompt DS 0x2690 «Dost thou wish to leave?» + getkey Y/N/ESC
        Y → DS 0x26ab, g_location==0x19 ? (DS 0x26b9 + g_floor=0xff) : (DS 0x26c6 + g_floor=0)
            + party_x/y de las tablas [si+0x1e89]/[si+0x1eb1] + g_location=0
        N → DS 0x26d2 ; [bp-6]=0 ; return
0810  COMMIT: party_x+=dx ; party_y+=dy ; g_unk_24e6=1
        (transport&0xfe)==0x12 → call 0xffffc16e
        push [bp+4] ; push [bp-0xe] ; call 0x52e     ; entrada de casilla (escaleras…)
── COLA DE BLOQUEO ──────────────────────────────────────────────────────────
083a  print DS 0x26d6 "Blocked!\n"
0841  call 0xffffa0f0(0xc8, 0xa5)  = pcspeaker_beep(freq=0xa5, dur=0xc8)  ← SIEMPRE
084c  call 0xffff9946                              ; misma cola común que MAINOUT
084f  [bp-6] = 0
0854  ax = [bp-6] ; ret 2
```

### §2.1 — El careo de las dos colas, hecho: TRES diferencias

| | EXTERIOR, MAINOUT 0x0312-0x0347 | PUEBLO, TOWN 0x083a-0x084c |
|---|---|---|
| `Blocked!` | DS 0x29ae, siempre | DS 0x26d6, siempre |
| test de cactus (`dest==0x2f`) | **SÍ** (0x0329) | **NO existe** |
| OUCH! + `party_random_damage` | sí, en la rama cactus | **nunca** |
| beep `(0xa5,0xc8)` | sólo en la rama NO-cactus | **siempre** |
| salida silenciosa 0xEC | **SÍ** (0x0317, sólo montado) | **NO existe** |
| brazo de vela | sí (0x02c0) | no aplica |
| objetos tolerados extra | — | **0x1e y 0x1f** (0x06e3/0x06ec) |
| coste de turno del bloqueo | 0 min | 1 min |

⇒ **El binario NO comparte la cola.** Son dos rutinas con dos colas distintas que
casualmente empiezan igual. El port, que comparte `resolveStep`, es quien tiene que
poner el gate por CAPA.

---

## §3 — LA MEDICIÓN QUE IBA PRIMERO: enrutabilidad del cactus en pueblo

La tarjeta lo puso como gate y tenía razón en ponerlo: `TileData.json` da 0x2F
`IsWalking_Passable = false`, así que «existen 16 cactus» es NECESARIO pero no suficiente.

**Censo (re-medido, no heredado)** sobre `game/assets/maps/smallmaps.json`, los 32 mapas,
todas las plantas, contando por POSICIÓN de array **y** por `id` para no repetir el
off-by-one de `combatmap`:

| | |
|---|---|
| ocurrencias de 0x2F en small maps | **16** |
| mapas con alguna | **1** — posición **14**, `id` **15**, `SinVraals_Hut` |
| ⚠ posición ≠ id | la posición 15 es `Grendels_Hut` (id 16). El dato de cama-241 decía «location 15» y es el **id**; la posición es la 14 |

**Enrutabilidad — BFS de casillas pisables desde la entrada estándar** `SMALL_MAP_ENTRY`
= (15,30) (`game.ts:367`), con el predicado del propio juego (`tileInfo().walkable`, que
es `IsWalking_Passable` más los 7 overrides de `tiles.ts:77`):

```
tile de la entrada (15,30) = 0x1e LeftDesert2, pisable ✔ (la entrada no es degenerada)
pisables totales 946 · alcanzables desde la entrada 923 · pisables TAPIADOS 23
cactus con vecino ortogonal ALCANZABLE: 16 / 16
```

Las 16, con sus vecinos: (21,1) (4,2) (8,5) (31,6) (27,8) (3,10) (29,14) (1,16) (25,20)
(30,22) (7,24) (23,26) (2,28) (28,29) (7,31) (20,31).

**Controles de sensibilidad del BFS** (sin ellos el 16/16 no vale nada):

| control | esperado | medido |
|---|---|---|
| NEGATIVO: 1 cactus con las 4 ortogonales puestas a montaña 0x0C | 0 | **0** ✔ |
| POSITIVO: el mismo, con un vecino puesto a desierto 0x07 | 1 | **1** ✔ |
| el flood NO cubre el mapa entero | <946 | 923 (23 tapiados) ✔ |
| variante permisiva (walkable+openable, por si hay puertas) | ≥16 | 16/16, 947 alcanzables |

⇒ **P1 CONFIRMADA. La divergencia es ALCANZABLE en las 16.** #224 **no** cierra por
inalcanzable. El razonamiento de P1 se sostuvo: la impasabilidad del cactus no impide
llegar al test, *es la precondición de llegar a la cola*.

## §4 — El careo del port: P2 CONFIRMADA, y la polaridad estaba INVERTIDA

`resolveStep` (`game/src/core/world/movement.ts`) es COMPARTIDO. Antes del fix:

- `movement.ts:309` `const onCactus = target === TILE_CACTUS` — geometría pura, sin capa.
- `movement.ts:310-318` la rama de PUEBLO (`!map.wraps`) devolvía ese `onCactus`.
- `game.ts:1180-1189` el ÚNICO consumidor: `if (step.onCactus)` → «OUCH!» +
  `partyRandomDamage` + `party-changed`; `else` → `sfxEvent("move-blocked")`.

⇒ En SinVraal's Hut, chocar con un cactus emitía **«Blocked!» + «OUCH!» + una `rand(1,8)`
por miembro vivo y NINGÚN beep**, donde TOWN 0x083a manda **«Blocked!» + beep y nada
más**. Es divergencia **por EXCESO**, introducida por el fix de #157 al enrutar la
mecánica por una capa que en el binario no la tiene. El título de la tarjeta («la cola de
pueblo NO tiene test de cactus») se lee como hueco del port y es al revés: el que no lo
tiene es el BINARIO, y el port se lo inventaba.

★ Y el comentario de `game.ts:1167-1189` llevaba la prueba dentro: citaba `MAINOUT 0x0322
/ 0x0329 / 0x032f / 0x033c` — **todos de MAINOUT** — para justificar una bifurcación que
corría en las dos capas. Cita correcta, alcance equivocado: la firma de #227.

**FIX (a) — el gate va en el PRODUCTOR**, no en el call-site: `resolveStep` devuelve
`onCactus: false` en la rama de pueblo. Motivo: si el gate viviera en `game.ts`, el flag
seguiría siendo `true` para cualquier consumidor futuro, que es exactamente cómo llegó
aquí el defecto. Hoy el consumidor es UNO (censado con `git grep onCactus`: 6 hits, 5 en
la definición/producción y 1 en el consumo).

## §5 — El beep naval: P3 CONFIRMADA, y NO hacía falta carril de audio

El encargo contemplaba declarar esta mitad si exigía catálogo inexistente. **No lo exige.**

- `core/sfx.ts:126` ya declara el cue `"move-blocked"` con el comentario derivado.
- `skin/fiel/speaker.ts:452` lo realiza como `[beep(0xa5, 0xc8)]` — los parámetros exactos.
- `re/notes/sfx-catalog.md` ficha los DOS call-sites del binario con `pcspeaker_beep` =
  kernel 0x22c0: el de EXTERIOR es MAINOUT 0x0344, y el de PUEBLO es TOWN 0x0849.

Lo único que faltaba era el `push`: `resolveNavalStep` no emitía cue alguno en la rama
"blocked" (declarado como divergencia abierta en `transport.ts:378-381`). **FIX (b)**:
`if (res.outcome === "blocked") events.push(sfxEvent("move-blocked"))`, después de los
mensajes, que es el orden del binario: MAINOUT 0x0322 imprime, y MAINOUT 0x033c pita.

**Lo que NO se cablea, y por qué** (aquí sí se declara y se remite):
- brazo de VELA, collision/breakup → MAINOUT 0x02f4 `call 0xffffa06c` = **noise_burst**
  ARGS `0x12c, 0x7d0, 0x64`. Otra primitiva, **sin entrada en el catálogo de cues** del port.
  ⇒ al carril de AUDIO junto a #202. (`sfx-catalog.md §10.1` ya lo tenía apuntado como
  «Colisión NAVAL … cue candidato futuro `ship-collision`».)
- brazo de VELA, "dock" → **el binario es MUDO**: 0x02f1 `jmp 0x306` salta el `call` de
  0x02f4. No falta nada.

### §5.1 — Alcance del cambio naval: por qué NO lleva gate de capa
`shipTryMove` no conoce la capa. En pueblo, TOWN 0x083a también beepea SIEMPRE ⇒ para
el outcome "blocked" el cue es correcto en las dos capas. El único caso que divergiría es
**naval × cactus × pueblo** (el port daría OUCH!, el binario beep), y está **MEDIDO como
INALCANZABLE**: SinVraal's Hut —el único mapa con cactus— tiene **0 tiles boat-passable y
0 skiff-passable** (23 tiles distintos, ninguno navegable), y ningún cactus tiene vecino
navegable. Se DECLARA, no se cablea (precedente #237/#231). Control de sensibilidad del
predicado en el test: `isPassable(0x00,"ship") === true`.

## §6 — Tests: conducta, mutantes y fixtures no degeneradas

`game/tests/colas-224-colas-bloqueo.test.ts` — **16 tests, EXIT 0**.

- Pueblo: sin OUCH!, con beep, sin daño, sin movimiento + **control de UNIFORMIDAD**
  (cactus y montaña producen los MISMOS mensajes y los MISMOS cues).
- **Control de CAPA**: el MISMO tile, la MISMA dirección, la MISMA party en overworld SÍ
  da OUCH! y NO beepea — lo único que cambia es la capa (no-regresión de #157).
- Naval: beep en "blocked", silencio en "cactus", con precondición sobre el outcome.
- Alcance contra el ASSET, no contra fixture inventada: censo 16-en-SinVraal's + BFS 16/16
  + cero navegables, cada uno con su control.

**MUTANTES (el aserto real de que los tests miden algo):**

| mutante | rojos | mensaje |
|---|---|---|
| (a) rama de pueblo vuelve a propagar `onCactus` | **4** | `expected ['Blocked!','OUCH!'] to not include 'OUCH!'` · `expected [] to include 'move-blocked'` · `expected [47,45] to deeply equal [50,50]` |
| (b) se quita el `sfxEvent` naval | **1** | `expected [] to include 'move-blocked'` |

Restaurados los dos ⇒ 16/16 en verde otra vez.

### §6.1 — ERROR PROPIO, con re-medición
La primera fixture naval usaba `FURLED = 0x26` «fragata arriada mirando al este». **Mal.**
Leí `TURN_ARG` desplazado una línea y me llevé los valores de su VECINA `SAIL_DIR`
(`transport.ts:157-170`): son dos tablas adyacentes con la misma pinta y distinto orden —
`TURN_ARG` (MAINOUT 0x04D3) es N→0, **E→1**, S→2, O→3, y `SAIL_DIR` (g_sail_dir del
kernel) es O→1, E→2, N→3, S→4. Con 0x26 (que mira al SUR) el primer pulsado se lo comía el
VIRAJE y el test medía «Head East» en vez del bloqueo: **fixture degenerada que habría
pasado por verde en cuanto relajase la aserción**. Lo cazó el propio rojo. Re-medido con
un sondeo directo de `faceTile`/`shipFacingStep` sobre 0x24-0x27 y 0x20/0x22: el
east-facing arriado es **0x25**. La cautela quedó escrita EN el test.

## §7 — Defectos de CITA encontrados de paso (y arreglados)

1. **`game/src/core/game.ts` (salida de pueblo)** — el comentario citaba TRES offsets y
   los tres estaban mal, cada uno de una forma distinta. Medido byte a byte
   (`fileoff = DS + 0x10`):
   | citaba | decía que era | **es de verdad** |
   |---|---|---|
   | `0x26bb` | `"Yes\n\nExit to\n"` | `b'derworld!\n'` — cae DENTRO de 0x26b9 |
   | `0x26d6` | `"Britannia!\n"` | **`b'Blocked!\n'`** — ¡la cadena de la otra mitad de #224! |
   | `0x26c9` | Underworld (loc 0x19) | `b'tannia!\n'` — cae DENTRO de 0x26c6 |
   Los correctos: **0x26ab** `Yes\n\nExit to\n` · **0x26c6** `Britannia!\n` · **0x26b9**
   `Underworld!\n` (TOWN 0x07be / 0x07da / 0x07c5).
2. **`re/notes/sfx-catalog.md`, «Matiz de fidelidad»** — decía «MAINOUT `0x329`**/TOWN**:
   imprime OUCH!…». Esa barra atribuye a TOWN un `cmp` que TOWN no tiene, y **es la
   fuente de la premisa equivocada del título de #224**. Corregido con la cola de TOWN
   entera. Su segunda frase («el port no modela el OUCH! a pie») quedó RANCIA con #157 —
   también corregida.

## §8 — Lo que NO toqué (con dueño)

- **Salida silenciosa 0xEC** (MAINOUT 0x0317, `and al,0xfc / cmp al,0xec / je 0x34a`,
  sólo montado/vehículo): NO portada, y ya tiene tarjeta propia **#223** con la derivación
  escrita en `transport.ts:356-368` (`find_object_at_xy` = kernel 0x368E; 0xEC..0xEF =
  REMOLINO). No la emulo a medias aquí.
- **Los objetos 0x1E y 0x1F que pueblo tolera de más** (TOWN 0x06e3/0x06ec) y que MAINOUT
  no: careo no hecho, cabo propuesto en §9.
- `noise_burst` de collision/breakup: §5, al carril de audio con #202.

## §9 — Cabos (propuestas de tarjeta)

1. **TOWN tolera DOS clases de objeto que MAINOUT no** (0x1E en TOWN 0x06e3, 0x1F en
   0x06ec, dentro de la rama A del clasificador de objeto en destino). El port no modela
   la ocupación por objetos en pueblo por esta vía; con #223 abierto para el exterior,
   conviene una tarjeta que cubra las DOS listas a la vez y no una capa sola.
2. **`noise_burst` de COLISIÓN naval** → carril de audio con #202: falta la entrada de
   catálogo (`ship-collision`), los parámetros ya están derivados — ARGS 0x12c, 0x7d0, 0x64.
