# ACTA — el RESTO del pool clase-4 (#182: D5 · D2 · D8 arreglados · D4 y D11 derivados)

> Rama `fix/pool-resto-b`, worktree `.claude/worktrees/pool-resto-b`, **RETENIDA**.
> Un commit por defecto: `3ae1191f` (D5) · `3a54a376` (D2) · `1da707fc` (D8).
> GATES por commit, sin pipes: `npx tsc --noEmit` **EXIT 0** · `npx vitest run` COMPLETO
> **EXIT 0** · `seed_gate` · `verify_pool174_claims` · `pytest test_frontier` ·
> `pytest test_genero` · `genero.py`, todos **EXIT 0** y re-corridos tras el `git add`.
> **CERO e2e.** Trinquete de citas: **82 → 142 verdes** (+60), control negativo en rojo.

---

## 0. Titular

Tres se arreglan (D5, D2, D8) y dos NO se tocan a propósito (D4, D11) — pero las cinco
señas heredadas de `pool-174-acta.md §4.1` **tenían un defecto al verificarlas contra el
`.asm`**, y en cuatro de los cinco casos el defecto cambia lo que hay que escribir:

| | lo que decía la seña | lo que dice el binario |
|---|---|---|
| **D5** | «DOS entradas al bucle 0xf2c» | son **TRES** (falta `0f27`) ⇒ el barrido es el **DEFAULT** del comando, no una rama más |
| **D2** | «getdir, animación y teleporta» | el rayo **no se para en la primera hierba**, gana la ÚLTIMA, y el alcance lo fija la **ventana de chunks** |
| **D8** | «fuerza `cmp ax,1` y arma 0x21» | además la rama **corta ANTES del rand del amuleto** (0x029c) ⇒ orden de stream |
| **D4** | «el contador está gateado al revés» | `[0xbd1a]` es el **SELECTOR comida/bebida**, no un contador mal puesto — y falta la SUMA DE COMIDA que la seña no menciona |
| **D11** | «la hermana suspende el mundo» | correcto, y el residuo declarado **tiene discriminador medido**: `0ed2 cmp [bp-4],0x11` = el TILE bajo la party |

**Regla del relevo, 5/5 otra vez** (ya van 12 señas corregidas en dos jornadas): la seña
acierta el SITIO y se deja una CONDICIÓN. Leer el tramo COMPLETO entre el `cmp` citado y su
punto de reunión no es una precaución: es donde está la mitad del trabajo.

---

## 1. D5 — el (J)immy sobre cofres de la capa de OBJETO (commit `3ae1191f`)

### 1.1 «No lock!» no es un default, es un resultado

El despacho por tile del (J)immy no tiene tres familias: tiene **cuatro**, y la cuarta es el
DEFAULT. Tres saltos distintos entran al barrido de objetos 0x0F2C:

```
0dbc: jmp 0xf2c     (tile < 0x84)
0dc4: jmp 0xf2c     (0x86..0x96)
0f27: jne 0xf2c     (tile > 0x98 distinto de 0xB9/0xBB)   ← ★ la que faltaba
```

Con la tercera, puerta (0xB9/0xBB), mágica (0x97/0x98) y cepo (0x84/0x85) son las
EXCEPCIONES y todo lo demás cae al barrido — que mapea 1:1 con la rama `else` de
`Game.jimmy`, la que imprimía «No lock!» a pelo. `0x0F16` (DS 0x8B52) se alcanza SÓLO por
agotamiento del bucle: el punto de reunión 0x0F69 es común al match y al fin (`jae 0xf69`
de 0x0f11) y `cmp cx,0x20` discrimina.

### 1.2 ★★ El byte +5 tiene dos significados y son el MISMO BIT

`0x0BAA` no toca ningún tile: lee `[bx + 0x5c5f]` con `bx = idx<<3` = registro**+5**
(0x0bc0). Y ese byte es EL MISMO que `open_chest_world` lee como TRAMPA:

| | quién | qué hace con el bit 0x80 |
|---|---|---|
| (J)immy | `0x0bc7 cmp al,0x80` / jae | **puesto** = hay algo que forzar; el éxito lo LIMPIA (`0x0c13 and …,0x7f`) |
| (O)pen | `0x120b cmp [bp-6],0x7f` / ja | **puesto** = dispara la trampa; `0x1214 and …,0x7f` se queda el contenido |

⇒ **el (J)immy sobre un cofre-objeto es DESARMAR LA TRAMPA.** El port ya modelaba el bit
como `WorldObject.trapped`; lo que faltaba era la otra mitad del ciclo.

### 1.3 El gate que faltaba NO era un borde: era el caso común

Con el bit 0x80 limpio, `0x0bcb` carga DS 0x8A58 («Key broke!») y salta a 0x0c1d **sin
llegar al `call 0x6112` de 0x0bf9** ⇒ CERO tiradas y llave rota igual. Y los cofres de
interior del clon nacen TODOS con `INTERIOR_CHEST_CONTENTS = 8` (bit limpio), así que sin
ese gate el port habría tirado el dado y a veces «desarmado» lo que no estaba armado.

### 1.4 Otros dos matices que la seña no traía

- **el barrido arranca en el SLOT 1** (`0f2c: mov cx,1`, si=0x5C62=0x5C5A+8): el slot 0 es
  el vehículo del jugador, el mismo que `worldObjects.ts::findFreeObjectSlot` ya excluye. Y
  `cx` no es un contador auxiliar: ES el índice que viaja a 0x0BAA.
- **el gate de planta es CONDICIONAL** (`0f56 cmp [g_location],0x7f` / `ja 0xf64`). Se porta
  leyendo `effectiveLocation` (#123), pero la rama de salto es **INALCANZABLE hoy por
  construcción** —`hydrateInteriorObjects` retorna en location 0 y el cofre de mazmorra es
  otra familia (`dungeonChest`, por TILE)— y así queda declarado en el código.
- **TURNO:** `0x0BAA` no toca `g_unk_24e6` en ninguna rama ⇒ este (J)immy **no consume
  turno**, ni al fallar ni al acertar. La puerta sí (0x0e10).

### 1.5 Sustrato, failing-first y controles

Sustrato verificado ANTES de cablear con control positivo **ya en main**:
`jimmy-prisoner.test.ts:180` prueba que un `worldObject` TAPA el tile compuesto y que la
celda cae al «No lock!» — o sea que la capa existe, se compone y llega hasta esta rama.

**5 rojos de 10, los cinco conductuales.** Controles aislando UNA condición (patrón D10):
celda vacía · objeto que NO es cofre (0x0f64) · cofre en OTRA PLANTA (0x0f5d) · cofre en
OTRA CASILLA (0x0f43/0x0f4c).

> ⚠ **El control negativo de RNG no se firma solo.** «Cofre sin trampa ⇒ 0 tiradas» pasaba
> YA sin el fix: verde por el motivo equivocado, firma de `control-positivo-degenerado`. Lo
> redime su gemelo positivo del mismo fichero —«cofre trampeado ⇒ la semilla SE MUEVE»—,
> rojo antes y verde después: es el que prueba que `liveSeed()` mide algo.

**Predicción falsable:** cada (J)immy sobre cofre TRAMPEADO consume 1×rand(1,30) donde antes
consumía 0; sobre cofre NO trampeado sigue consumiendo 0.

---

## 2. D2 — el In Por de EXTERIOR (commit `3a54a376`)

### 2.1 El defecto

`cast.ts:152` devolvía `{kind:"blink"}` y el ÚNICO consumidor era `combat.ts:2257`
(`git grep '"blink"' game/src` → 3 hits). Fuera de combate el efecto caía al final de la
cadena de `main.ts` sin rama: hechizo y maná gastados, sin pedir dirección, sin mover a
nadie. `TIME_PERMITTED_BITS[17] = 0x09` (combate | exterior) acota la rama de 0x0680 a
`g_location == 0`: en pueblo y mazmorra el dispatcher ya corta con «Not here!».

### 2.2 ★★ La mecánica no es «te mueves un poco»

```
06de-06e8: si/di arrancan en g_cmb_scratch (party ± 1, lo dejó el getdir)
06af-06d7: xMax = min(chunk_origin_x + 0x20, 0x100) · yMax igual en Y
0709: cmp byte ptr [bx], 5      ← ★ el destino es HIERBA, y nada más
070c: jne 0x722                  ← no-hierba: siguiente celda
070e-071a: marca encontrado y ESCRIBE g_party_x/y
071d: mov byte ptr [g_unk_24e6], 1        ← turno, DENTRO del if
0722: add si,[bp-0x10] / 0725: add di,[bp-0x12]   ← ★ NO hay break
```

Tres consecuencias que un port «razonable» erraría:

1. **gana la ÚLTIMA hierba del rayo**, no la primera (0x0722 no rompe el bucle);
2. **el alcance lo fija la VENTANA DE CHUNKS**, que es histerética y depende del camino
   (`chunk-origin.ts`, mantenida por paso en `movement.ts:207`) — el mismo hechizo llega
   más lejos o menos según dónde esté la caché;
3. **sin hierba en el rayo no consume turno** (0x071d está dentro del `if`).

Y al acertar, `0740: call 0xffffbbfe` = CS 0x7b7e = stub **MAINOUT.OVL:0x0000**, cuyo tramo
0x0019-0x004c es EXACTAMENTE `initChunkOrigin` ⇒ la ventana se RE-DERIVA alrededor del
destino. Cancelar (Space, DS 0x952c «Pass») sale por `0687 mov ax,0xffff` sin tocar nada:
el getdir CAST2 0x0306 devuelve el CÓDIGO DE TECLA en `di` (0x03ba `mov ax,di`), no el flag
`si`, y Space pone `di=0` (0x03af).

**SIN RNG:** en toda la rama no hay ni un `call 0x6112`.

### 2.3 Residuo declarado

MAINOUT:0x0000 es la recarga ENTERA del exterior y hace más (`[0x5956]=1`,
`g_unk_58a4=1`, `g_sail_dir=0` en 0x000e-0x0014, más repintados). Se porta SÓLO la
re-derivación del origen, que es la única pieza que el clon modela hoy; el resto es la misma
recarga que el port tampoco ejecuta en sus otras vías de entrada al exterior.

### 2.4 ⚠ HONESTIDAD SOBRE EL FAILING-FIRST — este NO es como el de D5

Aquí la mecánica estaba **AUSENTE ENTERA** (ni rutina ni productor), así que los 8 rojos
pre-fix son `TypeError: game.applyBlinkSpell is not a function`: **ESTRUCTURALES**, y por sí
solos no demuestran nada (firma de `failing-first-import-trap`). Dos cosas para que el
fichero no mienta:

1. **el primer intento SÍ era la trampa entera**: importaba `BLINK_TARGET_TILE` de
   `blink.ts` y el rojo fue `Cannot find module '../src/core/magic/blink.js'` — la suite ni
   se cargaba. Arreglado dejando la constante **sin exportar** y usando el literal 5 con su
   cita en el test;
2. **la carga de la prueba se pone en los CONTROLES**, que son los que separan esta
   derivación de la alternativa plausible: última-no-primera · ventana-no-mapa ·
   sin-hierba-no-hay-turno (con su par positivo: blink acertado SÍ mueve reloj y semilla) ·
   las 4 direcciones del getdir · el borde BAJO de la ventana · el origen re-derivado a
   `{112, 80}` calculado a mano desde 0x0019-0x0026.

### 2.5 Daño colateral atendido, no silenciado

El gate modal nuevo desplaza `main.ts` +1 línea y el residual POR LÍNEA de
`i18n-plantillas-nativas.test.ts` (#126) pasa de `:1477` a `:1478`. Se actualiza el pin **y
su motivo escrito**; el CONJUNTO de plantillas cazadas es idéntico, que es lo que el propio
test comprueba.

---

## 3. D8 — el atacante CHARMED (commit `1da707fc`)

### 3.1 La rama y su SITIO

`enemyAttack` (COMBAT:0x0226) saltaba de `selectTarget` directo al negate del amuleto
(0x029c), que es justo el `je` de la guarda citada. La primera bifurcación no estaba:

```
0271: test byte ptr [bx - 0x45ea], 1   ← bit 0 del byte +0 del registro del ATACANTE
0276: je 0x29c                          ← lo citado
  027e: call 0xffffdb2e  → CS 0x7dbe = stub COMSUBS.OVL:0x04D4 (distancia)
  0281: cmp ax,1 / 0284: jne 0x256      ← ★ distancia != 1 ⇒ NO ataca (ignora attackRange)
  0286: mov byte ptr [g_cmb_weapon], 0x21   (= 2H Sword)
  0295: call 0xffffdb5e  → CS 0x7dee = stub COMSUBS.OVL:0x0BF8 (melé con ESA arma)
  0298: jmp 0x35f                        = RETORNA 1, sin el robo de comida de CS 0x0366
```

**El sitio es parte del defecto:** 0x0271 va ANTES de 0x029c ⇒ un atacante charmed **no
consume el rand del amuleto**. No es cosmético, es orden de stream.

### 3.2 Alcance real del cambio, declarado y no inflado

- para un **PJ POSEÍDO** el port ya coincidía por accidente (`reach` de un `kind:"player"`
  ya era 1). Lo que se arregla es el **ENEMIGO encantado** (`castCharm` :2494, aliados
  invocados :2567/:2588), que conservaba su `attackRange` y entraba en la vía a distancia
  con su gate del 50 %;
- el **arma 0x21 es INERTE** para un atacante `kind:"enemy"` en el modelo del clon
  (`attackStat` ignora el arma con atacante enemigo, `strike` usa su `attack` fijo); sólo
  cambia el stat de acierto del PJ poseído;
- el **DAÑO del 2H Sword** para un PJ poseído NO se modela: `CombatOpts` no tiene canal a
  `attackValues`. Residuo declarado.

Sustrato con control positivo **ya en main**: `__parity__/combat-run.ts:289` hace
`c.charmed = (rec.flags & 1) !== 0`, y la Espada del Caos pone el bit en `0x06b2`.

### 3.3 ★ El arnés se midió a sí mismo, y menos mal

La primera versión usaba «Headless» por `enemyAttackRange[34]`, y el def **CONSTRUIDO**
salió con alcance **1**: el índice crudo de la tabla NO casa con el nombre. Lo cazó una
aserción de precondición (`expect(a.attackRange).toBeGreaterThanOrEqual(3)`), no la suerte:
sin ella, «a distancia 3 no ataca» habría salido verde **por alcance 1** — control
degenerado de manual, y encima con el fix puesto habría seguido verde. Cambiado a «Mage»
(alcance 7 medido) y la precondición se queda en el test.

**2 rojos de 5**, los dos conductuales (`expected [{kind:'attacked'}] to be null`).
Y se declara EN EL FICHERO lo que el arnés NO puede probar: que el charmed se salte el rand
del amuleto es **inalcanzable** aquí (un charmed lucha para la party y `selectTarget` nunca
le da un PJ). Eso lo sostiene la lectura del asm, no el test.

---

## 4. D4 — la taberna: la seña NO se sostiene, y falta algo que no menciona

**NO SE ARREGLA EN ESTE CARRIL.** El lead avisaba de que era la más sospechosa; leído el
tramo entero (`SHOPPES2.OVL 0x0140-0x01C8`), lo es, pero no por donde decía.

### 4.1 La cadena real

```
0140: ax = [g_unk_b118] / 0143: sub [g_gold], ax        ← cobra, ANTES de todo gate
0147: call 0xffff9dfa
014a: cmp word ptr [0xbd1a], 0
014f: je 0x1c4                                          ← ★ CERO → salta a 0x1c4
  ┌ [0xbd1a] != 0  (rama A)
  │ 0151-015d: call 0x5d34 (0x57a8, [0xbd1a], 0x270f)   ← ★ SUMA COMIDA, cap 9999
  │ 0160-0173: mesa al NORTE (y−1) == 0x95 →
  │   0185: [bx] = 0x9b · 0188: [0xbd1e] = 0x9b · 018e: call 0x7730 → 0x1c8
  │ 0194-01a7: si no, mesa al SUR (y+1) == 0x95 →
  │   01b9: [bx] = 0x9a · 01bc: [0xbd1e] = 0x9a → 018e → 0x1c8
  │ si ninguna: → 0x1c8
  └ [0xbd1a] == 0  (rama B)
    01c4: inc word ptr [0xbd20]                          ← el contador de servicios
0x1c8: ax = 0x9b16 / call print_string / ret 0
```

### 4.2 ★ Las DOS ramas son EXCLUYENTES, y `[0xbd1a]` es el SELECTOR

La seña decía «el contador de rondas está **gateado al revés en el port**: `inc [0xbd20]`
sólo corre con `[0xbd1a]==0`, y la ronda de comida entra dejando ahí el nº de vivos ⇒ en el
original **nunca** incrementa; el port sí». La MECÁNICA que describe (el `inc` sólo corre
con `[0xbd1a]==0`) es literalmente cierta, pero la LECTURA es equivocada: no hay ningún
contador «al revés». `[0xbd1a]` es la CANTIDAD DE COMIDA de la ronda, y por tanto el
selector de las dos mitades del servicio:

- **con comida** (`!= 0`) el servicio SUMA comida y PINTA EL PLATO en la mesa; no incrementa;
- **sin comida** (`== 0`) no hay plato que pintar y lo que hace es INCREMENTAR el contador.

O sea que el `inc` de 0x01c4 **no es «el contador de la ronda de comida»**: es el de la otra
rama. Cualquier fix escrito sobre la lectura de la seña —«quitarle el incremento a la ronda
de comida»— acertaría por accidente en un caso y erraría el modelo entero.

### 4.3 Lo que la seña NO decía, y es lo más gordo

`buyTavernRound` (`shops.ts:780-789`) **cobra el oro y no hace NADA más**: no suma la
comida de 0x015d y no escribe el plato. Y su comentario dice *«tras el `inc` del contador de
servicios (CS 0x01c4)»* — atribuyendo a esta ronda un incremento que corre en la rama
contraria. Lo mismo `shops.ts:806`: *«Ese contador lo incrementan TANTO las rondas de comida
(0x01C4) COMO las copas de vino (0x0364)»*. Son **prosa auto-infiel**: describen un flujo
que el asm no tiene.

Y la escritura de terreno son **DOS orientaciones con tiles DISTINTOS** (norte 0x9b, sur
0x9a, con el norte PRIMERO), no la única del sur que citaba la seña.

### 4.4 Lo que falta antes de tocar nada (siguiente paso, nombrado)

**El productor de `[0xbd1a]`.** El tramo de CS 0x0140 no tiene prólogo — se entra por salto desde
arriba —, así que quién pone ahí la cantidad de comida y con qué valores decide si la rama B
es alcanzable en juego normal. Sin eso, «en el original nunca incrementa» sigue siendo una
conjetura sobre un dominio que nadie ha acotado (gemelo exacto de
`control-positivo-degenerado`: un `je` que no se toma nunca y otro que se toma siempre se
ven igual desde el `cmp`). **D4 queda vivo, con el tramo ya leído y citado, y con la seña
corregida para que el siguiente no herede el error.**

---

## 5. D11 — la moongate en el filo de medianoche: DECLARADO, no implementado

**NO ESTÁ CUBIERTO por el latch de fases lunares `5f551579` (#176)**, y conviene decirlo
porque el encargo lo planteaba como posibilidad: #176 arregla *qué fase lunar se lee* al
cruzar medianoche bajo tierra (el destino), y D11 es *qué ESCENA corre* al entrar. Son
piezas distintas del mismo comando y no se pisan.

### 5.1 La hermana, resuelta con instrumento

```
0b00: call 0xffffc6d8 → CS 0x48a8 = moongate_enter   (frontier.json, IDENT — no es un stub)
0b03: or ax,ax / 0b05: je 0xb0a                       ← retorno 0 = sigue el flujo (lo citado)
0b07: call 0xfffff89a → CS 0x7a6a = stub CAST2.OVL:0x0E76
```

`moongate_enter` devuelve **1 también cuando NO teleporta** (el gate de medianoche 0x494d,
ya derivado y portado en `checkMoongate`) ⇒ la escena de 0x0E76 corre **en las dos** salidas.

### 5.2 Qué hace la escena (CAST2 0x0E76), leída

- `0e8d`: lee el TILE bajo la party → `[bp-4]`;
- `0e99`: `g_unk_24e6 = 1` (turno consumido);
- `0ea1`: **SALVA** `g_location` en `[0xbd15]` y `0ea4` lo pone a **0xFF** (mundo suspendido),
  con `g_cmb_actor = 0xFF`;
- CS 0x0eb9-0x0ed0 — COPIA los 32 slots de objeto —base DS 0x5C5A, stride 8— a **0xA9FC** y **VACÍA** el
  original (`0ec3 mov byte [si],0`) — o sea, la escena corre con la tabla de actores limpia
  y la restaura después;
- `0ed2: cmp word ptr [bp - 4], 0x11` / `je 0xee6` ⇒ **★ el residuo declarado por #174 tiene
  discriminador MEDIDO: es el TILE bajo la party**, y la rama `!= 0x11` carga otro juego de
  punteros (DS 0x95FC / 0xAC64). El port (`game.ts:2474 checkMoongate`) hace hook + sfx y
  vuelve: nada de esto existe.

### 5.3 Por qué NO se implementa aquí

Es una escena scripted con estado global suspendido, salvaguarda/restauración de la tabla de
objetos y **DOS variantes visuales** cuyo contenido no está derivado (sólo su
discriminador). Portarla a ojo sería fabricar presentación — exactamente lo que #147 dejó
prohibido. Va con **tarjeta propia** y necesita testigo (oráculo o vídeo) para la rama
`!= 0x11`. Lo que este carril entrega es la derivación completa del CUÁNDO y del QUÉ TOCA, y
la cita del discriminador, que es lo que faltaba para poder pedir el testigo bien.

---

## 6. Gates

Por commit, desde la RAÍZ del worktree, **sin pipes**, exit leído por separado y
**re-corridos después del `git add`**:

```
npx tsc --noEmit                                EXIT=0
npx vitest run   (COMPLETO)                     EXIT=0   300 ficheros · 3886 pasados · 1 skipped
python3 re/tools/seed_gate.py                   EXIT=0
python3 re/tools/verify_pool174_claims.py       EXIT=0   142/142 + control negativo en rojo
python3 -m pytest re/tools/test_frontier.py -q  EXIT=0
python3 -m pytest re/tools/test_genero.py -q    EXIT=0
python3 re/tools/genero.py                      EXIT=0
```

**CERO e2e** (regla del carril). `pytest re/tools` COMPLETO **no se ha corrido** — lleva el
test de oráculo EN VIVO; se invocan los testfiles por nombre.

---

## 7. Cola que este carril NO cierra (con dueño propuesto)

1. **D4 — el productor de `[0xbd1a]`** (§4.4). Es la precondición para adjudicar; el tramo
   0x0140-0x01C8 queda leído, citado y con la seña corregida.
2. **D4 — dos piezas de PROSA AUTO-INFIEL en `shops.ts`** (:789 y :806) que atribuyen el
   `inc` de 0x01C4 a la ronda de comida. No se tocan aquí para no soltar una corrección de
   prosa antes de que el veredicto esté cerrado, pero **son del género de #40** y las hereda
   quien cierre D4.
3. **D4 — la SUMA de comida en CS 0x015d y el PLATO de la mesa en CS 0x0185/0x01b9**, ausentes del
   port, con sus DOS orientaciones.
4. **D11 — la escena de moongate CAST2 0x0E76**, con su tarjeta propia y su necesidad de
   testigo para la rama `tile != 0x11` (§5.3).
5. **D8 — el daño del 2H Sword para el PJ poseído**: `CombatOpts` no tiene canal a
   `attackValues` (§3.2).
6. **D5 — el sonido de «Key broke!»** (`0x0c31 call 0x842e`, con magnitudes CS 0x320/0x7d0/1/0x32): la
   familia de la puerta tampoco lo emite en el port. Preexistente y simétrico; es del carril
   audio-costuras, no de éste.

## 7bis. ★ Efecto colateral del ACTA sobre el clasificador de nombres (familia #84)

Escribir este acta **movió el trinquete de género**: `blink` (el nombre real de
ULTIMA.EXE:0x2322, IDENT, con SEIS citas en CUATRO notas — camp-scene-kernel.md:128,
dnglook-raster-spec.md:291, drivers-drv.md:245, kernel-render-sweep.md:214/221/224) cruzó el
umbral `nfiles >= 10` del criterio R5 y entró en la banda TIER-2 de nombres SOSPECHOSOS,
rompiendo `test_los_TIER2_del_ledger_son_exactamente_estos`.

Es el **segundo caso idéntico** al de `walkable` (28-07): no cambió ningún nombre, cambió
la FRECUENCIA que decide qué es prosa, y la cambió una nota nueva. Adjudicado y añadido a
`TIER2_LEDGER_ESPERADOS` con su razón. Lo que este segundo caso confirma es que la lista
POR NOMBRE (y no el tope numérico) es lo único que hace visible el desplazamiento: con sólo
el cardinal, el rojo se habría podido apagar cambiando un sospechoso por otro.

---

## 8. Correcciones que hay que propagar a `pool-174-acta.md §4.1`

- **D2**: falta que el rayo **no se para en la primera hierba** (0x0722 sin break) y que las
  cotas son la **ventana de chunks**, no el mapa; y que al acertar se RE-DERIVA el origen
  (MAINOUT 0x0019-0x004c).
- **D5**: «DOS entradas al bucle» debe decir **TRES** (`0dbc`, `0dc4` y `0f27`) ⇒ el barrido
  es el DEFAULT del comando. Y el bit 0x80 del byte +5 es el MISMO que la trampa de (O)pen:
  jimmy sobre cofre-objeto **desarma**.
- **D8**: añadir que la rama va **ANTES** del rand del amuleto de 0x029c, y que `cmp ax,1`
  ignora `attackRange` por completo (no es «sólo distancia 1» como matiz: es que el alcance
  del bicho deja de existir).
- **D4**: «el contador está gateado al revés en el port» **describe mal el defecto**.
  `[0xbd1a]` es el SELECTOR comida/bebida y las dos ramas son excluyentes; falta la SUMA DE
  COMIDA (0x015d) y el plato tiene DOS orientaciones (0x9b norte / 0x9a sur), no una.
- **D11**: el residuo «qué muestra la escena» ya tiene **discriminador medido**:
  `0ed2 cmp word ptr [bp-4], 0x11` = el TILE bajo la party. Y la escena además SALVA/VACÍA
  la tabla de objetos en CS 0x0eb9-0x0ed0 y suspende `g_location` guardándolo en `[0xbd15]`.
