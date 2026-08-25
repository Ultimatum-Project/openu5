# ACTA — los tres defectos mayores del pool clase-4 (#179 D3 · #180 D6 · #181 D7)

> Rama `fix/defectos-d3d6d7`, worktree `.claude/worktrees/defectos-lote`, **RETENIDA**.
> Un commit por tarjeta: `9c524982` (D3) · `3ff98df8` (D6) · `92ce4fd8` (D7).
> GATES por commit, sin pipes: `npx tsc --noEmit` **EXIT 0** · `npx vitest run` COMPLETO
> **EXIT 0** (297 ficheros; 3828 → 3832 → 3837 pasados, 1 skipped). **CERO e2e.**

---

## 0. Titular

Los tres estaban donde decía `pool-174-acta.md §4.1`, y los tres se arreglan. Pero **las
tres señas heredadas tenían un defecto al verificarlas contra el `.asm`**, y en dos casos
el defecto cambia lo que hay que escribir en el port:

| | lo que decía la seña | lo que dice el binario |
|---|---|---|
| **D3** | «`call 0xffffb680` = tick de viento» | CS 0x5910 es **`viewport_redraw`**; el viento es su callee `0x2f62` y va **GATEADO** por `[0x5891]` |
| **D6** | «el saludo se emite SIEMPRE; el original lo gatea» | no es un gate sí/no: es un **SELECTOR de TRES ramas** que emiten **secciones distintas** del `.TLK` |
| **D7** | «con la party inconsciente…» | **−1 ≠ «inconsciente»**: con la party ENTERA DORMIDA el cierre **SÍ corre** |

Y sale un **hallazgo transversal** que no es de ninguna de las tres tarjetas: en la rama de
D6 el binario hace `srand(reloj_DOS)` ⇒ **la paridad de stream a partir de ahí es imposible
POR CONSTRUCCIÓN**, no incumplida. Ver §4.

---

## 1. Método: cómo se resolvió cada llamada (nada por lectura de etiqueta)

Todas las llamadas inter-overlay se resolvieron con el instrumento, no copiando el label
del disasm (que es file-relativo y miente — `citas-sesgo-overlay.md`):

```
CS = (dispatch_table.overlay_near_call_base(ov) + crudo) & 0xFFFF
```

| overlay | base | comprobación de que no puede ser intra-overlay |
|---|---|---|
| `MAINOUT.OVL` | `0x81D0` | — |
| `OUTSUBS.OVL` | `0xA290` | el fichero mide **0x9A0 B** |
| `TALK.OVL` | `0xBF80` | el fichero mide **0x1310 B** |
| `TOWN.OVL` | `0x81D0` | — |

Y los saltos a través de la tabla de stubs se resolvieron con `dispatch_table.stubs()`, no
leyendo: `stubs()[0x7b5a] = Stub(overlay='OUTSUBS.OVL', entry_file_off=0x5EE)`.

Nombres desde `re/ledger/frontier.json`. Cadenas byte-verificadas contra `DATA.OVL` con
`fileoff = DS + 0x10`.

---

## 2. D3 — la LAVA no quemaba fuera de pueblo (#179, commit `9c524982`)

### 2.1 La cadena, entera

```
MAINOUT 0c7e: cmp word ptr [bp - 0x10], 0x8f      ← [bp-0x10] = tile_addr(party_x,party_y) @0c4a
        0c83: jne 0xc8a
   hermana → 0c85: call 0xfffff98a = CS 0x7b5a = STUB → OUTSUBS.OVL:0x05EE
        0c88: jmp 0xcd0

OUTSUBS 05ee: call 0xffffb680   → CS 0x5910  viewport_redraw
        05f1: mov ax, 0x3a11
        05f4: push ax
        05f5: call 0x75c0       → CS 0x1850  print_string
        05f8: call 0xffff8818   → CS 0x2aa8  party_random_damage
        05fb: ret
```

### 2.2 ★ La corrección: `0xffffb680` NO es «el tick de viento»

CS 0x5910 es **`viewport_redraw`** (`frontier.json`, IDENT, 280 B). El acta acertó el
EFECTO y erró el NOMBRE — y el matiz **no es cosmético**, porque el viento vive dentro con
su propia guarda:

```
5929: cmp byte ptr [g_unk_58a4], 0
592e: jne 0x5933   /  5930: jmp 0x5a1d      ← con la bandera a 0 no hace NADA
5933: cmp byte ptr [0x5891], 0
5938: je  0x5954                            ← ★ se salta el 0x2f62
5944: call 0x2f62                           ← maybe_change_wind = 1×rand(0,63)
   …y en la cabecera:
591d: cmp byte ptr [g_time_spell], 0x54     ('T')
5924: mov byte ptr [0x5891], 0              ← Time-stop apaga la bandera
```

Quien copiara «tick de viento» sin abrir 0x5910 se habría llevado por delante el gate. El
port ya lo tenía bien en la vía de PUEBLO (`timeSpell !== "T"`), así que el fix del
exterior lo calca en vez de inventar otro modelo.

Residuo declarado, NO resuelto: la guarda `g_unk_58a4` (0x5929) no la modela el port —
ni en pueblo ni ahora en exterior. Es preexistente y simétrica; no se toca aquí.

### 2.3 Mecánica derivada

- **UN** mensaje, no uno por miembro: `print_string` está FUERA del bucle; el bucle está
  dentro de `party_random_damage`.
- `party_random_damage` CS 0x2aa8, cuerpo entero: `si` de 0 a 5; salta si
  `si >= g_party_size` (0x2abf `jae`) o si `[0x55b3 + si*0x20] == 0x44` ('D', 0x2ac1);
  si no, `push si / push 1 / push 8 / call 0x2092` ⇒ **rand(1,8) por miembro**.
  (`rand_range` es (min,max): el PRIMER push es el MIN.)
- **★ SIN gate de transporte.** El pantano de al lado (0x0c64) exige
  `cmp [g_transport_tile], 0x1c`; la lava no tiene esa comparación ⇒ quema a caballo.
- **EXCLUSIVA** con puente (0x0c56), pantano (0x0c64) y el chequeo del Códice (0x0c8a):
  las cuatro hacen `jmp 0xcd0`. La exclusión es automática por valor de tile.
- **ORDEN**: después de `advance_clock` (0x0c39), antes del hazard (0xcd0). Por eso
  «Burning!» va antes que «EARTHQUAKE!», y los dos pueden caer en el MISMO turno del
  Underworld — cada uno con su propio barrido de `party_random_damage` (el del hazard es
  0x0a80, el mismo 0x2aa8).
- Es la MISMA terna que el tile de daño de PUEBLO (TOWN 0x10ac-0x10c4), con otro puntero:

| | puntero | bytes leídos de DATA.OVL |
|---|---|---|
| pueblo (TOWN 0x10bd) | DS 0x2780 | `b'Burning!\n'` |
| exterior (OUTSUBS 0x05f1) | DS 0x3a11 | `b'Burning!\n'` |

  Texto IDÉNTICO ⇒ **ninguna clave i18n nueva**. Se unifica en `BURNING_MESSAGE` (un solo
  productor) para que las dos vías no puedan derivar por separado.

### 2.4 Radio, medido

`overworld.json` **16** tiles 0x8F · `underworld.json` **101** ⇒ **117** casillas pisables
donde el clon no hacía nada.

### 2.5 Failing-first y controles

**4 rojos de 8**, los cuatro conductuales: `expected +0 to be 3` (×3) y `expected +0 to be
2` — sin fix no se consume NI UNA tirada.

> ⚠ **Método.** La primera versión daba 6 rojos, pero 3 eran `expected undefined to be
> true` sobre `r.burning`: rojo por **campo inexistente**, que no demuestra conducta
> (gemelo de la trampa del import de #157). Se reordenaron las aserciones para que la
> conductual dispare primero, y los 2 controles negativos dejaron de mirar `burning`.

Controles verdes ANTES y DESPUÉS (acotan el cambio): tile ≠ 0x8F no quema ni consume ·
BLOQUEADO sobre lava sale en 0xC30 y no llega al 0x0C7E · candado del literal 0x8f.

**Controles por condición separada** (estándar #170), los dos rojos sin fix:
- a caballo la lava quema igual → aísla la ausencia del gate de transporte;
- Time-stop: 0 ticks de viento pero 3 tiradas de daño → aísla que `[0x5891]` cubre SÓLO
  el `0x2f62`, no el print ni el daño.

### 2.6 ★ Predicción falsable pre-registrada (mueve el stream)

Cada turno de exterior que TERMINE sobre 0x8F consume, donde antes consumía 0:

```
1×rand(0,63) del viento  +  N×rand(1,8), N = miembros con estado ≠ 'D'
```

Con party de 6 viva: **+7 tiradas** por turno sobre lava. Bajo Time-stop: **+N**, sin el 1.
Radio 117 casillas (101 Underworld + 16 overworld). Toda ruta e2e/tour que pise una cambia
HP, consola (una línea nueva) y semilla a partir de ahí. **Si el tour NO se mueve**, o el
fix no está cableado o ninguna ruta pisa lava — y lo segundo se comprueba con las
coordenadas medidas, no suponiendo.

---

## 3. D6 — la apertura de conversación tiene TRES ramas (#180, commit `3ff98df8`)

### 3.1 El flujo, entero (TALK 0x111c-0x117f)

```
111c: mov ax,0x94c4 / call print_string        ← DS 0x94c4 = b'You see '
1123: push 1 / call 0x7aa                      ← SECCIÓN 1 = description
1134,1137: 2× CR
113a: push [0xbcdc] / 113e: call 0xd7a         ← test del bitmap npcMet
1141: or ax,ax / 1143: jne 0x1166
  ├── bit PUESTO (te conoce) → 1166 call 0x4da (comilla) / 1169 push 2
  │                            = SECCIÓN 2 = greeting
  └── bit LIMPIO (desconocido):
        1145: call → CS 0x2056 rng_seed_from_dos_clock
        1149: call → CS 0x207e srand
        114c: push 0 / 114f: push 1 / 1153: call → CS 0x2092 rand_range(0,1)
        1158: je 0x117d  → 117d `sub ax,ax` / 117f `ret`   = NI UNA LÍNEA
        115a: mov ax,0x94ce + print / 1161: sub ax,ax → push 0
                                     = `"I am called ` + SECCIÓN 0 = name
116d: call 0x7aa / 1174: call 0x4da (cierre) / 1177,117a: 2× CR
```

`0x0d7a` leída entera: monta la máscara `1<<npcIdx` (vía `call 0x44f6`) y la cruza contra
la palabra doble `[g_location*4 + 0x5bd6]`; devuelve **1** con el bit PUESTO.

Cadenas byte-verificadas: `DS 0x94c4 = b'You see '` · `DS 0x94ce = b'"I am called '`
(la comilla de apertura viaja EN el literal — por eso 0x1163 salta a 0x116c **sin** pasar
por el `putchar '"'` de 0x4da, a diferencia de la rama de conocido en 0x1166).

**El port emitía SIEMPRE la sección 2** ⇒ a un desconocido le enseñaba el saludo del
NPC-que-ya-te-conoce, nunca la autopresentación (`git grep 'I am called' game/src` →
CERO) y nunca la rama muda.

### 3.2 ★★ Testigo independiente: las TRES ramas están en el espejo

Conteo sobre `game/e2e/espejo-tour/routes-ad` (OCR del LP), **186 aperturas únicas** con
«You see»:

| rama | n | forma |
|---|---|---|
| desconocido, r=1 | **63** | `You see <desc>. "I am called <Nombre>"` |
| desconocido, r=0 | **51** | `You see <desc>. Your interest?` — **sin nada hablado** |
| conocido | **72** | `You see <desc>. "<otro hablado>"` |

El 63/51 entre desconocidos (55 %/45 %) es lo que predice una moneda 0/1. Y **CINCO
descripciones de NPC salen en las DOS ramas de desconocido** — «a grave old wizard» las
dos **dentro de ad06**, más «a young nobleman», «a prett young girl», «a man flowing black
robes» y «a wise and beautiful princess» ⇒ es una **moneda POR CONVERSACIÓN**, no un rasgo
del NPC.

> Límite declarado: el testigo tiene **sesgo de muestreo** — una apertura muda produce
> menos texto distintivo y se curó menos. El 51 es **cota INFERIOR**, no una frecuencia
> medida. Lo que el testigo SÍ prueba es que las tres ramas existen.

### 3.3 ★ La sección 0 no es un nombre pelado

**12 de los 135** scripts traen ops en `name` (`IfElseKnowsName`, `AskName`). Con
desconocido eso cae **EN LA APERTURA**. El testigo lo fija literal:

```
ad06: Talk-West You see a young girl. ` "I am called Treanna" "What is thy
```

Por eso dos tests de Treanna cambian de forma: el `AskName` ya no espera a
`input('name')`, sale en `start()`. Están **rebaselinados contra el testigo**, no
ajustados para que pasen.

### 3.4 Fix

- `PHRASES.I_AM_CALLED` con su cita DS; comilla de apertura en el literal (mismo patrón
  que `"My name is ` de la keyword NAME).
- `ConversationContext.selfIntroRoll` — ausente ⇒ 1 (se presenta): es la rama OBSERVABLE y
  deja los arneses puros deterministas. Se lee `this.knows` y no el getter
  `npcKnowsAvatar`, porque el binario consulta el bitmap UNA vez en 0x113e, antes de que
  ningún AskName de esta conversación pueda cambiarlo.
- `Game.rollTalkSelfIntro()` + inyección en `talk-console.ts`.
- i18n: `"I am called ` → `es.json` («Me llaman ). El manifiesto de cadenas pasa.

### 3.5 Failing-first, controles y rebaselinados

**6 rojos de 54**, todos conductuales:

```
expected 'You see a dark, heavyset man.' to contain 'I am called'      (×2)
expected 'You see a small, nimble, deadly looki…' not to contain '"'   ← rama muda
expected 'You see a young girl.' to contain 'I am called'
expected '"I cannot help thee with that."' to contain 'If you say so...'
expected [ 'You see a hungry lord.', …(1) ] to include '"What is thy name?"\n'
```

> ⚠ **Método.** La rama r=0 se probaba primero con **Thrud** y salía VERDE sin fix —
> porque la sección 2 de Thrud está **VACÍA** y «no sale el saludo» era cierto por el
> motivo equivocado (**control degenerado**, firma de `control-positivo-degenerado`).
> Cambiado a **Toshi** (`'Hail friend!'`, sección 2 sin ops): ahora ese caso sólo puede
> pasar si la rama existe. La misma trampa obligó a usar **Zachariah** en el control de
> «conocido» (Thrud allí también sería indistinguible).

**Control por condición separada** (estándar #170): con NPC CONOCIDO **la moneda NI SE
CONSULTA** — el test la instrumenta con un contador y exige **0 tiradas**, aislando que la
guarda compuesta (bit × moneda) corta antes del `call`.

**Rebaselinados con su motivo, no silenciados**: 2 de Treanna (el AskName pasa a la
apertura; justificado por ad06) y 3 de `present-chains` C7/C8, que miden COMPOSICIÓN DE
COMILLAS del saludo y por tanto se colocan en la rama donde el saludo existe
(`npcKnowsAvatar: true`); el de AskName mueve el op a la sección 0 porque en la 2 sería
**otro control degenerado** (`processSection` se salta AskName si el NPC ya te conoce, y
la sección 2 sólo corre en ese caso).

### 3.6 Predicción falsable

Cada (T)alk a un NPC **NO conocido** consume ahora **1×rand(0,1)** donde antes consumía 0;
con NPC conocido sigue consumiendo **0**. Si el tour se mueve en conversaciones con
conocidos, el gate está mal cableado.

---

## 4. ★★ HALLAZGO TRANSVERSAL: hay un punto donde la paridad de stream es IMPOSIBLE

No es de ninguna de las tres tarjetas y merece decisión del lead.

En la rama de desconocido de D6 el binario **no tira de su stream**:

```
2056  rng_seed_from_dos_clock:  mov ah,0x2c / int 0x21     ← DOS Get System Time
      (CH=hora CL=min DH=seg DL=centésimas)
      shl ch,1 / shl cl,1 ×2 / shl dh,1 ×3 / add ax,dx / add ax,cx
      xor ax,0x91eb / and ax,0xfff                          ← semilla de 12 bits
207e  srand:                    mov [g_rng_seed], ax        ← SOBRESCRIBE la global
```

O sea: la moneda sale del **reloj de pared** y **además REEMPLAZA la semilla global**.
Consecuencia: **ningún arnés determinista puede seguir al original a partir de una
conversación con NPC desconocido**. No es que el port la incumpla — es que ahí no hay
nada que igualar.

Esto encaja con `rng.md`, que ya censaba `rng_time_hash` (0x2056) en **TOWN ×1 · CMDS ×1 ·
TALK ×2** sin explotar la consecuencia. **Quedan 3 sitios más del mismo censo sin
auditar**; si alguno cae dentro de una ruta del espejo o del tour, esa ruta tiene un techo
de paridad que no depende del port. Tarjeta sugerida al lead.

Decisión tomada aquí, declarada en el código: el port conserva SU determinismo y tira de
su propio stream (`game.rollTalkSelfIntro`). Reproducir el `srand(reloj)` habría hecho
no-determinista todo el port desde la primera conversación.

---

## 5. D7 — el cierre del turno de pueblo (#181, commit `92ce4fd8`)

### 5.1 La guarda y el ALCANCE EXACTO del salto

```
15bf: call 0xffffb82c   → CS 0x39fc party_conscious_state
15c2: inc ax
15c3: jne 0x15c8        ← ax ≠ −1: sigue el cierre
15c5: jmp 0x1686        ← ax == −1: SALTA el cierre entero
```

Tramo saltado **0x15c8-0x1685** — la seña listaba cinco cosas y son **nueve**:

| # | qué | offset | ¿estaba en la seña? |
|---|---|---|---|
| 1 | `advance_clock(1)` → CS 0x4f7c | 0x15d4 | sí |
| 2 | refresco de reja/puente si el turno FICHA hora y la nueva es 20 ó 5 | 0x15d7-0x15e9 | sí |
| 3 | `post_turn` 0x0f02 (trampilla · pantano · «Burning!» · housekeeping) | 0x15ec | sí |
| 4 | contador `[0x594f]`/`dec [0x5952]` → `set_map_tile` CS 0x39cc | 0x15f6-0x160a | **NO** |
| 5 | copia de party x/y/planta a `g_char_anim_states+2/3/4` | 0x160d-0x161c | **NO** |
| 6 | toggle de cadencia de MONTURA (transport 0x12..0x15) | 0x161f-0x1640 | **NO** |
| 7 | gate de Time-stop 'T' y toggle de cadencia de Quickness 'Q' | 0x1642-0x165d | **NO** |
| 8 | `guard_wander` 0x0c78 | 0x165f | sí |
| 9 | `npc_tick_all` (stub → NPC.OVL:0xdb4) y `npc_engine` 0x1352 | 0x166e, 0x1683 | sí |

### 5.2 ★★ «−1» NO es «party inconsciente»

`party_conscious_state` CS 0x39fc, cuerpo entero leído (0x39fc-0x3a72):

- recorre `i < g_party_size` sobre `[0x55b3 + i*0x20]`;
- estado `0x47 'G'` ó `0x50 'P'` → deja el índice en `g_cmb_scratch_x` y devuelve **0**;
- estado `0x53 'S'` → incrementa un contador de dormidos;
- agotado el bucle: **1** si hubo algún dormido, **−1** si no hubo ninguno.

⇒ **con la party ENTERA DORMIDA devuelve 1 y el cierre SÍ CORRE** (el reloj avanza, los
peligros aplican, guardias y NPCs se mueven). El −1 es exactamente la condición del
refuge, y por eso el gate se cablea sobre `partyConsciousState` —que el port YA tenía
calcado para `checkRefuge`— y no sobre un «nadie consciente» inventado.

### 5.3 ★ Hallazgo adyacente, NO arreglado (tarjeta propia)

La **cabecera** del bucle (0x1436-0x1464) tiene una SEGUNDA guarda sobre la misma rutina
que la seña no mencionaba, y su rama `ax == 1` es **mecánica ausente** en el port:

```
1436: call 0xffffb82c → CS 0x39fc      → [bp-8]
143c: cmp ax,1 / 143f: jne 0x1456
        1441: push 0xa / call CS 0x16ba putchar
        1448: call CS 0x4c2a draw_box_edge_left
        144b: mov ax,0x288d / call print_string
        1452: jmp 0x15a6                      ← SIN leer tecla
1456: cmp [bp-8],-1 / 145a: jne 0x1468
        145c: call → stub BLCKTHRN.OVL:0x910  party_refuge
        145f: mov [bp-0xa], 0
        1464: jmp 0x15a6
```

`DS 0x288d` byte-verificado (DATA.OVL fileoff 0x289d) = **`b'Zzzzzz...\n'`**.

Con la party entera dormida el original **NO lee tecla**: imprime «Zzzzzz...» y consume el
turno solo. `git grep Zzzzzz -- game/` sólo pica en el OCR del espejo (`routes-ad`), y ahí
pertenece al flujo de **(H)ole up**, no a éste. El port no lo modela.
(La rama `ax == −1` de esa misma cabecera sí está portada como `checkRefuge`.)

### 5.4 Fix, failing-first y controles

Guarda en la rama de pueblo de `runContextTurn`: con `partyConsciousState === -1` se salta
`townTurn`, el refresco horario, los mensajes, `tickDoors` y el hook `afterHousekeeping`
(guardias + NPCs), y se pasa directo a la captura de Blackthorn y al refuge — que **no
están en el tramo saltado** (el binario los resuelve en la cabecera del bucle). **#112
intacto**: sus tests siguen verdes sin tocarlos.

**2 rojos de 20**, conductuales y midiendo cosas distintas:

```
expected 36 to be 35      ← el minuto de más que predecía el acta
expected 1752 to be 4660  ← ★ g_rng_seed MOVIDA: el cierre consumía tiradas
```

El segundo es la aserción fuerte: con `reseed(0x1234)` el turno completo de una party
aniquilada tiene que dejar la semilla **INTACTA**. Pre-fix se movía (viento de `townTurn`
+ `guard_wander` + `npc_engine`); post-fix no se mueve.

Controles: refuge emitido igual (0x1436 fuera del salto) · party viva ⇒ cierre normal.
**Control por condición separada**: **party ENTERA DORMIDA ('S')** ⇒ 0x39fc devuelve 1, el
cierre corre y el reloj avanza. Es el que discrimina el gate correcto del gate plausible:
si alguien relaja la condición a «ningún miembro consciente», ese caso cae solo.

**No mueve el stream en juego normal**: el gate sólo se abre con la party a −1, que es
exactamente el turno en que arranca el refuge. En ese turno el stream deja de moverse
(antes se movía), así que cualquier ruta que provoque un TPK urbano diverge a partir de
ahí respecto de `main` — en la dirección del original.

---

## 6. Cola que este carril NO cierra (con dueño propuesto)

1. **`Zzzzzz...` de TOWN 0x1441** — mecánica ausente, byte-verificada, con su offset y su
   cadena. Tarjeta propia (§5.3).
2. **Los 3 `rng_time_hash` restantes** del censo de `rng.md` (TOWN ×1, CMDS ×1, TALK ×1)
   sin auditar: cada uno es un punto candidato de paridad-imposible (§4).
3. **`g_unk_58a4`** (guarda de `viewport_redraw` 0x5929) sin modelar, en pueblo Y exterior.
   Preexistente y simétrica; no se tocó (§2.2).
4. **`pool-174-acta.md §4.1` queda con tres señas corregidas**: las correcciones van en
   §7 de este acta, no editadas en el acta ajena.

## 7. Correcciones que hay que propagar a `pool-174-acta.md §4.1`

- **D3**: donde dice «`OUTSUBS.OVL:0x05ee: call 0xffffb680` (tick de viento)» debe decir
  «→ CS 0x5910 `viewport_redraw`, que llama a `0x2f62 maybe_change_wind` **gateado** por
  `[0x5891]` (Time-stop lo apaga en 0x591d)». El efecto de la seña era correcto; el nombre
  y el gate, no.
- **D6**: «el saludo se emite SIEMPRE; el original lo gatea» describe mal el defecto. Son
  TRES ramas con TRES secciones distintas del `.TLK`; el port emite la sección 2 también a
  desconocidos y no emite nunca la sección 0 ni la rama muda. Además falta la
  consecuencia del `srand(reloj)`.
- **D7**: «con la party inconsciente» debe decir «con `party_conscious_state == −1`, que
  **no** es «party inconsciente»: la party entera DORMIDA devuelve 1 y el cierre sí
  corre». Y el alcance del salto son nueve elementos, no cinco (§5.1).
