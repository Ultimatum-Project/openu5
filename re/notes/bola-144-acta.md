# ACTA #144 — BOLA DE CRISTAL (LOOKOBJ cmd_look, caso 0x29)

**Estado:** mecánica DERIVADA ENTERA y PORTADA. Rama `mech/bola-144`.
**Tesis del encargo, confirmada:** el caso 0x29 se lo comía el *caller* — el port
enrutaba el tile de la bola por la descripción genérica de (L)ook, y ni las visiones ni
la tirada existían. No era un hueco de renderer: era una rama entera del despachador de
`cmd_look` que nunca se portó.

---

## 1. Dónde vive, y por qué «el caller se lo come»

`cmd_look` (LOOKOBJ.OVL **0x099c**) compone el tile de la casilla mirada y despacha. Su
PRIMERA comparación es la bola:

```
0x09e4  cmp word ptr [bp - 2], 0x29
0x09e8  jne 0xa40                     ← TODO lo demás vive en la rama contraria
```

En `0x0a40` —o sea, ya dentro del `jne`— es donde se imprime `DS 0x751c`
(`"\nThou dost see\n"`) y de donde cuelgan las tres vías del handler: CS 0x06a4 para la
descripción de objeto especial, CS 0x07e4 para los carteles y CS 0x0502 para el dispatch
de tiles especiales. **Consecuencia derivada:
mirar una bola de cristal no imprime ni el prefijo «Thou dost see» ni la frase de
LOOK2.DAT del tile** (que es `a crytal sphere`, con la errata del original). Sólo sale
la visión.

Lo que hacía el port: caer por la vía genérica y emitir `Thou dost see a crytal sphere`.
Sin selector de PJ, sin tirada, sin visión, sin daño.

---

## 2. El flujo completo, instrucción a instrucción

Las cuatro llamadas externas se resolvieron con `routine_census.resolve_near_call`
(base de near-call de LOOKOBJ = **0xa290**; el label crudo del disasm es file-relativo
y miente — ver `ultima-exe-disasm-ceiling`):

| sitio | asm | destino resuelto | qué es |
|---|---|---|---|
| 0x09ea | `call 0xffffa6f8` | ULTIMA.EXE **CS:0x4988** | selector de PJ de comando (el ledger lo llama `prompt_active_player`; `ui/pickers.ts` usa el alias `resolve_command_char`) |
| 0x09f6 | `push 1 ; push 0x1e ; call 0x7e02` | ULTIMA.EXE **CS:0x2092** | `rand_range(min=1, max=30)` |
| 0x0a20 | `call 0x87c2` | ULTIMA.EXE **CS:0x2A52** | `apply_damage(idx, amount)` |
| 0x0a23 | `call 0x8670` | ULTIMA.EXE **CS:0x2900** | redraw del panel de party |
| 0x0a3b | `call 0x10fc` | LOOKOBJ **0x10fc** (intra) | `gem_view(x, y)` |

```
0x09ea  call 0x4988          → idx = selector de PJ
0x09f0  inc ax ; jne 0x9f6   → si idx == -1 (0xFFFF) SALTA AL EPÍLOGO (0xa98):
                               sin tirada, sin mensaje, sin daño
0x09f6  push 1 ; push 0x1e   → rand_range(1, 30)      ← ★ ÚNICA tirada del camino
0x09fe  call 0x7e02            de objetos de (L)ook
0x0a01  bx = idx << 5
0x0a08  cl = byte ptr [bx + 0x55b6] ; ch = 0
0x0a0e  cmp cx, ax
0x0a10  ja 0xa2a             → GANA si INT > tirada (sin signo ⇒ el EMPATE pierde)

  0x0a12  push 0x74fa ; call print   "Death vision!\n"
  0x0a19  push idx ; push 1 ; call 0x87c2   apply_damage(idx, 1)
  0x0a23  call 0x8670                        redraw

  0x0a2a  push 0x750a ; call print   "Strange vision!\n"
  0x0a31  push g_party_x ; push g_party_y ; call 0x10fc   gem_view — SIN gastar gema
```

### 2.1 DS 0x55b6 — el regalo del carril previo: registro de PJ +0x0E es **INTELIGENCIA**

`bx = idx << 5` ⇒ stride **0x20** = tamaño del registro de personaje. La base del roster
es **DS 0x55a8**, y no hay que suponerlo: aparece en el propio `resolve_command_char`,
que imprime el nombre del elegido con `add ax, 0x55a8` (**0x4a36**) tras el mismo
`shl ax, 5`. La resta da DS 0x55b6 − DS 0x55a8 = 0x0E, y el offset 0x0E del registro es
`intelligence` — mismo layout que el port ya lee del SAVED.GAM
(`game/src/core/saveNative.ts:186` y `:210`).

Control cruzado dentro de la MISMA rutina de daño: `apply_damage` resta HP en
`[si + 0x55b8]` (= registro **+0x10**, `currentHp`) y escribe status en
`[si + 0x55b3]` (= registro **+0x0B**). Los tres offsets casan con el decodificador del
port sin tocarlo, así que la identificación no descansa en un solo byte.

### 2.2 El selector de PJ, kernel CS 0x4988 — el gate del -1

Cuerpo leído de principio a fin, CS 0x4988 hasta CS 0x4a83. Tres caminos:

1. `g_location > 0x80` (combate) → el PJ es el del actor de combate vivo
   (`g_cmb_actor`, tabla `[bx - 0x45e9]`). **Inalcanzable por esta vía**: el tile 0x29
   es mobiliario de pueblo/castillo.
2. `g_active_char != 0xFF` → ése, directo, **sin prompt**.
3. Si no: cuenta los elegibles (status `'G'`=0x47 o `'P'`=0x50, barriendo
   `[0x55b3 + n*0x20]`). Con **≤1** devuelve el único (o -1 si no hay ninguno) **sin
   preguntar**. Con ≥2 imprime `DS 0xa3c4` `"Player: "`, abre el select de roster
   (`call 0x2e8e`), completa la fila con el nombre, y con un elegido no-G/P imprime
   `DS 0xa3ce` `"Disabled!\n\n"` y **re-pregunta**. Al salir con -1 imprime
   `DS 0xa3da` `"None!\n"`.

Ese es exactamente el `pickCommandChar` que el port YA tenía portado para el (S)earch
(`game/src/ui/pickers.ts:118`, que cita este mismo CS 0x4988). No se ha escrito un selector
nuevo: se ha reusado el existente.

### 2.3 Las cadenas, byte a byte

Leídas de DATA.OVL con `verify_show.text_at` (convención `fileoff = DS + 0x10`):

```
DS 0x74fa → b'Death vision!\n'     (fileoff 0x750a)
DS 0x750a → b'Strange vision!\n'   (fileoff 0x751a)
DS 0x751c → b'\nThou dost see\n'   (fileoff 0x752c)  ← el de la rama CONTRARIA
```

Contexto crudo del bloque, para que se vea que no hay nada más entre medias:
`b'...signs.dat\x00Death vision!\n\x00\x00Strange vision!\n\x00\x00\nThou dost see\n\x00'`.

### 2.4 `gem_view` es la MISMA vista que el comando (V)

`gem_view` (LOOKOBJ 0x10fc) recibe `(x, y)`, les resta `g_chunk_origin` para colocar el
marcador (0x1104-0x1115) y pinta el doble bucle 32×32. Es literalmente la rutina que
llama el case V del despachador. La diferencia está en el CALLER: el `dec [g_gems]` vive
en `0x3428`, dentro del case V, **fuera** de esta ruta ⇒ **la bola no consume gema**.

---

## 3. Qué se ha portado

| fichero | qué |
|---|---|
| `game/src/core/world/crystal-ball.ts` | **nuevo**. Constantes del binario (tile 0x29, cotas 1/30, daño 1) + `crystalBallWins(int, roll)` puro, con la derivación entera en la cabecera |
| `game/src/core/game.ts` | rama `tile === CRYSTAL_BALL_TILE` como PRIMER corte de `look()` (antes de pozo/fuente/cartel, igual que el asm) → evento `crystal-ball-prompt`; método `crystalBall(charIdx)` con la cola 0x09f6-0x0a3e; campo `gemFromCrystalBall` en el evento `gem-view` |
| `game/src/main.ts` | `crystal-ball-prompt` → `pickCommandChar(...)` → `game.crystalBall(idx)`; flag `canvasGemChargesTurn` para que cerrar ESTA vista no cobre el turno de (V) |
| `game/tests/crystal-ball.test.ts` | **nuevo**, 18 tests |
| `game/tests/fixtures/approved-strings.json` | 2 entradas `[D]` con offset DS + fileoff + rama |
| `game/src/i18n/es.json` | `Death vision!` / `Strange vision!` |

### 3.1 Por qué el selector vive en la UI y no en el core

Porque en el binario es **bloqueante y con prompt**, y en el port ese patrón ya está
resuelto así para el (S)earch (`pickCommandChar`). El reparto respeta el gate del -1: el
asm no llega al `rand` si el selector devuelve -1, y en el port `look()` sólo emite el
prompt — **no toca el stream** —, mientras que la tirada vive en `crystalBall()`, al que
la UI no llama si `pickCommandChar` no invoca su callback. Hay un test que lo fija
midiendo la semilla antes/después de `look()`.

### 3.2 La poda del `\n`

Las dos cadenas se emiten sin su `\n` final, siguiendo a sus hermanas del MISMO overlay
y del MISMO comando (`Refreshing...` de DS 0x72e0, `Incapacitated!` de DS 0x72ce). Es el
residuo declarado de **#108** sobre los call-sites, no una decisión nueva de este carril.

### 3.3 Un daño de test se movió: el pin por LÍNEA de #126

`tests/i18n-plantillas-nativas.test.ts` fija su población RESIDUAL por
`fichero:línea`. Insertar el handler en `main.ts` desplazó el peaje de trolls de
`:1471` a `:1477` y el test se puso rojo **sin que cambiara la población**. Se actualizó
el pin y se anotó la fragilidad en el propio fichero: cualquier edición de `main.ts` por
encima de esa línea vuelve a romperlo.

---

## 4. Failing-first: qué demuestra el rojo y qué no

- El test de enrutado (**«no imprime Thou dost see: emite el prompt»**) es rojo genuino:
  quitando SÓLO la línea del `if (tile === CRYSTAL_BALL_TILE)` el fichero da
  `1 failed | 17 passed`, y falla por la ASERCIÓN (recibe un `message` con
  `Thou dost see a crytal sphere` donde espera `crystal-ball-prompt`).
- Los otros 14 tests de mecánica ejercitan `crystalBall()`, que **no existía**: contra
  main serían rojos por `TypeError`, no por aserción. Es inherente a portar una mecánica
  AUSENTE (no hay comportamiento viejo contra el que asertar) y se declara aquí en vez
  de venderlo como failing-first. Lo que sí se ha blindado es la trampa del import:
  el tile y las cotas se escriben como LITERALES del binario y un candado aparte los
  compara con las constantes exportadas, así que un fix que cambiara el valor rompe por
  aserción y no por `undefined`.

## 5. Lo que queda FUERA (declarado, no resuelto)

1. **El turno de (L)ook.** `Game.look()` no cobra turno hoy en el port, ni para la bola
   ni para nada; el coste lo pone el despachador en el binario. La bola no lo empeora
   (la vista abierta por ella se cierra sin cobrar el turno de (V), que sí sería un
   cobro FALSO), pero el hueco es previo y sigue abierto. No es de esta tarjeta.
2. **`"None!\n"` con CERO elegibles.** El asm imprime `DS 0xa3da` siempre que el
   selector sale con -1, lo que incluye el caso «nadie G/P». El `pickCommandChar` del
   port sólo lo imprime en el cancel del picker, no en la rama de cero elegibles. Es un
   defecto PREVIO del selector compartido —lo hereda también el (S)earch— y tocarlo aquí
   habría movido el (S)earch sin encargo. **Sin arreglar, con dueño: el selector.**
3. **La rama de COMBATE de 0x4988** (`g_location > 0x80` → actor de combate) no está en
   `pickCommandChar`. Inalcanzable desde la bola; queda como hueco del selector.
4. **Fidelidad gráfica de la vista.** `gem_view` pinta por categoría de tile
   (`byte[tile + 0x1d1a]` → jump-table); el port entrega la rejilla y la piel la pinta.
   L3 heredado del comando (V), sin cambios: esta tarjeta sólo cambia QUIÉN la abre y
   con qué coste.
5. **Sin testigo de oráculo.** Todo lo de arriba sale del binario. No se ha corrido
   DOSBox: no hay confirmación visual de que una bola concreta de un mapa concreto
   dispare esto en vivo. **Predicción falsable para quien tenga la ventana:** mirar una
   bola de cristal con un PJ de INT ≥ 31 debe dar `Strange vision!` y la vista aérea del
   mapa 32×32 **sin descontar gemas**; con un PJ de INT baja debe salir
   `Death vision!` y ese PJ —no el activo si son distintos— debe perder exactamente
   1 HP. En ningún caso debe aparecer «Thou dost see».

## 6. La sugerencia de fix del encargo: VERIFICADA Y REFUTADA

El encargo proponía (pidiendo explícitamente verificarla) «añadir el caso a
`lookSpecialDescription` como `mode:"replace"` — la maquinaria ya existe para 0x59».
**No sirve, por dos razones independientes, y la primera produciría salida MAL.**

1. **`mode:"replace"` NO suprime el prefijo.** Lo que reemplaza es la frase de LOOK2, no
   la envoltura. El call-site es uno solo para las dos modalidades
   (`game.ts` en la rama de `lookSpecial`):

   ```ts
   const inner = special.mode === "replace" ? special.text : `${t(...)}${t(special.suffix)}`;
   events.push({ kind: "message", text: seeWrap(enForPunct, tf("Thou dost see {}", inner)) });
   ```

   Por eso el cielo sale como «Thou dost see the sun!». Con la bola por esa vía saldría
   **«Thou dost see Death vision!»**, que es justo lo que el `jne` de 0x09e8 impide: la
   cadena DS 0x751c vive en la rama CONTRARIA. El fix habría cambiado un texto incorrecto
   por otro texto incorrecto, y con pinta de fiel.

2. **La firma pura no puede expresar la mecánica.** `lookSpecialDescription(tile, nx,
   time, location)` es una función PURA que devuelve texto: no tiene party, ni generador,
   ni forma de pedir un PJ, ni de restar HP, ni de abrir la vista aérea. La bola necesita
   las cuatro cosas. El precedente correcto no es el cielo-texto sino el **daño del sol**,
   que por esto mismo vive fuera de la pura, en `Game.look()` (y así lo dice su propio
   comentario). La bola va un paso más allá porque además es INTERACTIVA (selector de PJ
   bloqueante), así que sigue el patrón del pozo y la fuente: evento → la UI conduce →
   vuelta al core.

Implementado como corte propio al principio de `look()` (que es el orden del asm) más
`crystalBall(charIdx)`. La maquinaria de `lookSpecialDescription` queda intacta.

## 7. El género, cuarta instancia — y en qué NO es igual a las tres previas

El encargo la cataloga como cuarta del género «portar el callee y dejarse los casos del
CALLER» (#33 `DNGLOOK 0x0844`, #73 `cbt_scene_populate`, #129 Stay-with-ship). **Confirmo
la instancia y el mecanismo**: `re/notes/lookobj.md` documentaba `look_dispatch` en 0x0502
—el CALLEE— con sus casos especiales al detalle, y el caller 0x099c quedaba descrito como
un pipeline de cinco pasos sin que nadie portara su primera rama. El callee se alcanza en
0x0a95 (`call 0x502`, con tile/x/y empujados), o sea DESPUÉS del `jne`: leer sólo el
callee no puede revelar el caso 0x29 ni por asomo.

**Pero conviene no aplanar el censo, porque #144 es de otra subclase.** Las tres previas
son GUARDAS de cabecera: lo que falta es una prohibición, y el síntoma es que en el port
*se puede hacer algo que el original prohíbe* (por eso ningún gate de mensajes las ve —
así lo dice el propio `sapo-120-acta.md` §2.3). Aquí lo que falta no es una guarda sino
**una MECÁNICA COMPLETA en una rama del despachador**: emite texto propio, consume RNG,
escribe en el registro del PJ y abre una vista. Es decir:

| | qué falta | síntoma | ¿lo ve un gate de mensajes? |
|---|---|---|---|
| #33 · #73 · #129 | una GUARDA de cabecera | se permite lo prohibido | no |
| **#144** | una RAMA con mecánica entera | sale el texto del caso EQUIVOCADO | **sí, si alguien compara** |

Esa diferencia es accionable: la subclase de #144 **sí es detectable automáticamente**
(un caso del caller sin contrapartida en el port emite la cadena de otra rama), mientras
que la de las guardas no. Si el censo de #129 las mete en el mismo saco, el criterio de
detección que se derive de él servirá para una mitad y no para la otra.

Un segundo eje, que es el que de verdad la mantuvo escondida: aquí la mecánica **ya estaba
derivada** en `frontier-manual.json` y lo que fallaba era la NOTA, que la archivaba como
UI. Ese es el género de #157 (cactus archivado bajo «barco»), no el de #33. #144 pertenece
a los dos a la vez.

## 8. Adjudicación pedida: ¿lote de paridad o fix directo?

El encargo fija el criterio — «si la conducta visible difiere, fix con re-sello». **La
conducta visible difiere de forma masiva**: donde el original imprime una visión, elige un
PJ, hace daño o abre una vista aérea, el port imprimía «Thou dost see a crytal sphere» y
nada más. ⇒ **FIX DIRECTO**, que es lo hecho.

Sobre el stream, con una acotación que importa para el re-sello: la tirada es nueva, sí,
pero **el consumo es CERO salvo que el jugador mire un tile 0x29 y el selector devuelva un
PJ**. No es el caso de #128 (compuerta de terreno de los actores), que mueve el stream en
cada turno de cada partida; aquí ninguna ruta que no pase por la bola cambia de semilla, y
hay un test que fija que `look()` por sí solo no toca el generador. Predicción para la
ventana de e2e: **ningún capítulo del tour debería moverse**, porque ninguno mira una bola
de cristal. Si alguno se mueve, es que el corte del tile 0x29 está atrapando algo que no
debía y ahí hay un defecto — es una predicción falsable, no una tranquilización.

## 9. Gates

Corridos en `<repo>/.claude/worktrees/bola-144`,
cada uno con su EXIT leído por separado (sin pipes):

```
game: npx tsc --noEmit                     EXIT=0
game: npx vitest run                       EXIT=0   (292 ficheros, 3761 pass, 1 skip)
raíz: python3 re/tools/seed_gate.py        EXIT=0
raíz: python3 -m pytest re/tools/test_frontier.py -q   EXIT=0   (42 passed)
raíz: python3 re/tools/genero.py           EXIT=0
```
