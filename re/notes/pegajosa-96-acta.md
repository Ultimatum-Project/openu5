# ACTA #174 (banda PEGAJOSA) — TANDA 4: la celda `PREFIJO-efecto` CERRADA 13/13

> Rama `re/pegajosa-96`, worktree `.claude/worktrees/pegajosa-96`, base **main `d5fb1a4e`**.
> Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> Continúa `pegajosa-103-acta.md` §4 (el corte declarado de aquel carril) y ejecuta el
> orden de ataque de `pegajosa-174-acta.md` §4, punto 1.

---

## 0. VEREDICTO, primero

La celda cabecera viva de la cola —`PREFIJO-efecto` × FORZADA+LIMPIA, **13 pares**— queda
**CERRADA 13/13** por lectura de binario, tramo completo del `cmp` citado a su punto de
reunión:

| clase | pares |
|---|---|
| **(a)** correcta | **8** |
| **(b)** media rama, CORREGIDA con derivación | **4** |
| **(d)** no aplica | **1** |

Los 4 (b) están arreglados en este carril (prosa de `game/src`, cero cambio de
comportamiento; `tsc` EXIT 0 y la suite 303/303 · 3903 tests). **Ningún defecto de MECÁNICA:
el port no falla en esta celda; lo que falla son cuatro citas.**

Dos hallazgos que valen más que el conteo:

- ★ **Un (b) es una afirmación que su propia hermana ya había RETIRADO** (§2.1). Un
  hotfix derivó la verdad, corrigió un docblock y **no propagó al de al lado**, que sigue
  afirmando la fabricación con las mismas cifras. Es el perfil de #133 en su variante
  documental, y es el defecto más grave de la celda.
- ★ **Un (d) es una familia de marca NUEVA** (§3): el «offset» es un **TILE**, un valor
  de tabla, no una dirección. Ni el prefijo `DS` de #188 ni el corchete de #190 lo
  alcanzan, porque no hay nada que marcar: es un número que colisiona con un destino de
  salto.

Y un aviso sobre el propio instrumento que salió de arreglar una cita: **mejorar una cita
puede EMPEORAR su atribución** (§5).

## 1. RE-ANCLA — la partición NO reproduce (328 → 338), y el delta está adjudicado por PARES

La tarjeta ancla el estado en `b4a4a230` (328 pares). En este árbol salen **338**. Los 3
controles del módulo, verdes en los dos; el positivo `SJOG.OVL:0x158e` en su celda de
siempre (`clase2 × LIMPIA`).

**El delta se adjudica por CONTENIDO.** Se levanta un worktree de sólo lectura anclado en
`b4a4a230` —donde reproduce **328 exacto**— y se diffean los dos volcados `--json` par a par:

| | pares |
|---|---|
| ALTAS | 11 |
| BAJAS | 1 |
| neto | **+10** ⇒ 328 → 338 ✓ |

```
+ CAST2.OVL:0x036c     AMBIGUA  DIVERGE          core/magic/blink.ts:21
+ COMSUBS.OVL:0x035f   AMBIGUA  clase2           core/combat/combat.ts:3206
+ MAINOUT.OVL:0x06c2   LEJANA   DIVERGE          core/magic/blink.ts:93
+ MAINOUT.OVL:0x06cf   LEJANA   DIVERGE          core/magic/blink.ts:75
+ SHOPPES2.OVL:0x0030  LIMPIA   BACKEDGE         core/shops/shops.ts:806
+ SHOPPES2.OVL:0x0194  LIMPIA   DIVERGE          core/shops/shops.ts:825
+ SJOG.OVL:0x0f16      LEJANA   BACKEDGE         core/game.ts:3466
+ SJOG.OVL:0x0f64      LEJANA   PREFIJO-bifurca  core/game.ts:3463
+ SJOG.OVL:0x0f69      LEJANA   DIVERGE          core/game.ts:3465
+ TOWN.OVL:0x1456      AMBIGUA  clase2           core/game.ts:1805
+ TOWN.OVL:0x15a6      LEJANA   DIVERGE          core/game.ts:1808
- NPC.OVL:0x0bec       LEJANA   DIVERGE          core/world/commands.ts:190
~ COMBAT.OVL:0x02df    LIMPIA/DIVERGE → AMBIGUA/DIVERGE     core/combat/combat.ts:3227
```

Productores: los 5 commits de main que tocan `game/src` desde `b4a4a230` (#182 D2/D5/D8,
#192 D4, #185). Ninguna alta viene de una nota, como exige `pegajosa-103-acta` §0.2.

### 1.1 ★ Y la trampa de §0.1 de la tanda 3 SE REPITE, en otra celda

`DIVERGE × LIMPIA` vale **54 en los dos árboles**. No son los mismos 54:
`COMBAT.OVL:0x02df` **salió** (se fue a AMBIGUA) y `SHOPPES2.OVL:0x0194` **entró**. El
conteo cuadra con la composición cambiada, exactamente como en la tanda anterior y en otra
fila. Familia `prediccion-numerica-cuadra-por-casualidad`: **la celda no es la población de
la celda.** Se deja anotado que el fenómeno ya lleva DOS apariciones en dos tandas
consecutivas, lo que lo mueve de anécdota a propiedad de esta cola.

### 1.2 La cola viva, reproducida

La partición re-anclada devuelve **95 vivos** en la mitad FORZADA+LIMPIA, con la
composición que la tarjeta anticipaba (13 `PREFIJO-efecto` · 4 bifurca · 1 inerte · 12
`BACKEDGE` · 58 `DIVERGE` + 7 clase-2 SIN-TEXTO). Los «~62 DIVERGE» de la tarjeta son 62
menos los 4 ya adjudicados (d) por #188/#190 ⇒ 58. **La cola reproduce.**

## 2. LA CELDA, par a par

| par | veredicto |
|---|---|
| `BLCKTHRN.OVL:0x0c4d` | **(a)** exacta — los 9 efectos del tramo, incluida la hermana |
| `COMSUBS.OVL:0x0562` | **(a)** exacta — los 4 gates y el fallback |
| `COMSUBS.OVL:0x0568` | ★ **(b)** — afirma lo que su hermana ya retiró (§2.1) |
| `DUNGEON.OVL:0x0917` | **(a)** exacta — y con 2ª vía de entrada que la confirma |
| `ENDGAME.OVL:0x0a27` | **(b)** — el contador es 15→0, no «16→1» |
| `LOOKOBJ.OVL:0x069c` | **(b)** — el `jmp` está en 0x0560, no en 0x0558 |
| `MAINOUT.OVL:0x0d11` | **(a)** exacta |
| `OUTSUBS.OVL:0x014c` | ★ **(d)** — es un TILE, no un offset (§3) |
| `OUTSUBS.OVL:0x059d` | **(a)** exacta — la mejor documentada de la celda |
| `SJOG.OVL:0x0ba4` | **(b)** — el `or/jne` está en 0x0b97/0x0b99, no en 0x0b94 |
| `TOWN.OVL:0x0f35` | **(a)** exacta |
| `TOWN.OVL:0x1139` | **(a)** exacta |
| `TOWN.OVL:0x165f` | **(a)** — hermanas modeladas UNA CAPA ARRIBA (§4) |

### 2.1 ★★ `COMSUBS.OVL:0x0568` — el docblock que sostiene una fabricación ya refutada

`combat.ts:1939` dice: *«el cursor original arranca ya fijado sobre el enemigo más cercano
en alcance, 0x0539-0x0568»*.

**Es falso, y el propio repo ya lo sabía.** `combat.ts:887` —el hermano, en el MISMO
fichero— dice literalmente: *«CELDA INICIAL (careo-hotfix, DERIVADO — falsifica el "enemigo
más cercano" previo, que era fabricación)»* y *«No hay ningún barrido de "más cercano" en la
rutina»*. Las dos frases conviven en `main`, sobre el mismo tramo, diciendo lo contrario.

Procedencia, que cierra el caso:

```
d64106ed  port(live): ataques a distancia por teclado    ← mete la frase en :1939
f2a1f18c  hotfix(combate): … aim fiel last-target/actor  ← deriva la verdad, arregla :887
```

El hotfix corrigió el docblock que estaba mirando y **no barrió el resto del fichero**.

**Derivación, que no depende de creerle a ninguno de los dos.** El tramo entero:

```
0511: mov bx,[bp+6]      ; índice del PROPIO actor
0518: mov bl,[bx-0x45e8] ; → su record
0520: mov al,[bx+0x5c61] ; scratch 0x5C5A+idx*8 +7 = ÚLTIMO OBJETIVO
0539: cmp [bp-0xa],0x1f  / 053d: jg  0x562   ] slot > 0x1f
053f: test [si-0x45ea],0x30 / 0544: jne 0x562 ] flags muerto/ido
0546: cmp  [si-0x45ea],0    / 054b: je  0x562 ] flags == 0
054f: cmp  byte ptr [bx],0  / 0552: je  0x562 ] celda vacía
055a: call 0x4d4 (distancia) / 0560: jle 0x568
0562: mov ax,[bp+6] / 0565: mov [bp-0xa],ax   ; ← FALLBACK: el PROPIO ACTOR
0568: …                                        ; ← la cita: punto de reunión
```

★ **Y la prueba mecánica de que no puede haber barrido**: en `0x0504-0x0568` **no hay ni un
salto hacia atrás** (los cinco condicionales son 0x053d, 0x0544, 0x054b, 0x0552, 0x0560, los
cinco hacia delante). Un «más cercano» exige un bucle sobre candidatos; **aquí no hay
bucle**. No es que la prosa exagere: describe una estructura de control que el tramo no
tiene.

`CS 0x0511`, además, corrobora la lectura del hermano al byte: `0x5C5A + 7 = 0x5C61` es
exactamente el `lastTargetId` que `:887` nombra.

**CORREGIDO** en `combat.ts:1939`: se retira la afirmación, se apunta a `aimGeometry` (que
la derivó) y se añade la razón mecánica. El COMPORTAMIENTO del port no se toca — el
recorrido por dirección es la vía de TECLADO y es una aproximación ya declarada.

### 2.2 `ENDGAME.OVL:0x0a27` — «(16→1)» es la simetría supuesta, no el contador
> ⚠ **BANNER 2026-07-30 — la ATRIBUCIÓN sale de la banda, pero la LECTURA de aquí queda
> CONFIRMADA (ruling #204/#217).** Con `sower_upper` por omisión, `ENDGAME.OVL:0x0a27,`
> SALE de la banda: `skin/endgameScene.ts` no nombra `ENDGAME.OVL` en mayúsculas y el
> único aval era un token en minúsculas. ★ Pero la atribución era **CIERTA**, y se ha
> re-verificado byte a byte para este banner: `re/disasm/ENDGAME.OVL.asm` trae en 0x0a27
> `c6 06 87 58 0f` = `mov byte ptr [0x5887], 0xf`, y en 0x0a33 `dec byte ptr [0x5887]` —
> exactamente el 15→0 que esta sección midió. ⇒ el veredicto **(b)** de abajo SIGUE EN
> PIE; lo que se retira es el aval formal de la atribución, no la lectura.


`endgameScene.ts:144`: *«5. El gate se CIERRA (0x0a27-0x0a37): 15 frames MUDOS (16→1)»*.

```
abrir   0997: mov [0x5887],1  … 09a3: inc … 09a7: cmp 0x10 / 09ac: jb   ⇒ 1→16, 15 ticks
cerrar  0a27: mov [0x5887],0xf … 0a33: dec … 0a37: jne                  ⇒ 15→0, 15 ticks
```

El **conteo (15) es correcto en los dos**; el RANGO del cerrar no es `16→1` sino `15→0`
(etapas 15..1). El autor asumió el espejo del abrir, que sí va 1→16.

★ **Y el propio port ya lo tenía bien**: el comentario de implementación 56 líneas más
abajo dice *«`[0x5887]=0xf` y decrementa → etapas 15..1»* y el bucle es
`for (stage = MOONGATE_STEPS-1; stage >= 1; stage--)`. **La cabecera contradice a su propio
cuerpo**, igual que §2.1. Corregida la cabecera; el código no se toca porque es fiel.

### 2.3 Los dos (b) de OFFSET: la instrucción nombrada no está donde dice

Mismo género, distinto tamaño, ninguno cambia el sentido de la afirmación:

| par | dice | está en |
|---|---|---|
| `LOOKOBJ.OVL:0x069c` | `0x0558: jmp 0x69c tras look_sky` | `0558 cmp si,0x59` · `055d call 0x366` · **`0560 jmp 0x69c`** |
| `SJOG.OVL:0x0ba4` | `0x0b94 or ax,ax / jne 0xba4` | `0b94 mov [bp-2],ax` · **`0b97 or ax,ax`** · **`0b99 jne 0xba4`** |

En los dos casos el OFFSET citado es donde se CAPTURA el valor y la prueba viene 3-8 bytes
después. Las dos afirmaciones son ciertas (el cielo salta a `0x69c`, que es el epílogo; la
tabla fija de `0x0ba1` sólo corre cuando devuelve 0 la llamada de `CS 0x45a`). **CORREGIDOS los dos** nombrando
las tres instrucciones en su sitio.

### 2.4 Los (a), y por qué no son un trámite

- `BLCKTHRN.OVL:0x0c4d` — el rango citado `CS 0x0bfd-0x0c4d` es **final EXCLUSIVO** (`0x0c4d`
  es la primera instrucción de fuera) y sus **nueve** efectos tienen renglón en la prosa Y
  línea en el port, **incluida la hermana** (`0x0c47: si food==0 → food=0x3f`). Constantes
  verificadas: `LOC_LORD_BRITISH=0x11` · `TILE_FOOT=0x1c` · `REFUGE_KARMA_FLOOR=0x4b`.
- `DUNGEON.OVL:0x0917` — «el chequeo … corre igualmente» (su offset es el del par) es cierto por **tres** vías:
  destino del `jne` de `0x08f5`, caída de la hermana, **y el `0x0816: jmp 0x917`, directo del
  Reaper** (`0x0810: cmp [bx+5],0x1b`), que es justo el «Reaper no se mueve pero SÍ evalúa
  la emboscada» de la prosa — corroborado por un camino que la cita ni menciona.
- `OUTSUBS.OVL:0x059d` — la hermana no está «mencionada»: tiene **bloque propio con límites
  exactos** (`0x057c-0x0598`, el amuleto) y su gate transcrito literal. Los dos gates de
  shard (`0x05a7`, `0x05ae`) casan al byte. Es el contraejemplo bueno de la celda, como
  `ULTIMA.EXE:0x6ccf` lo fue de la anterior. ★ Y corrige al desensamblado: la etiqueta
  `g_char_anim_states+224` de `0x5d3a` es engañosa porque `0x5C5A+0xE0 = 0x5D3A` cae DENTRO
  de la tabla de objetos — el autor tiene razón y lo dice.
- `TOWN.OVL:0x1139` — «SIEMPRE consume 1 rand(0,1)» es exacto: `CS 0x1139` es reunión del test
  de person-tile, así que la tirada corre por las dos ramas. Orden de argumentos por
  `rand-range-arg-order` (primer push = min): `push 0` / `push 1` ✓.
- `TOWN.OVL:0x0f35` — `rand(0,15)==0xF` por cada `'S'` del roster, stride 0x20; el despertar
  (`0x0f32: mov [si],0x47`) es la hermana y es lo que la frase describe.
- `COMSUBS.OVL:0x0562` y `MAINOUT.OVL:0x0d11` — pines exactos.

## 3. ★★ `OUTSUBS.OVL:0x014c` — (d): una TERCERA familia de marca, que ni #188 ni #190 alcanzan

`api.ts:430` dice: *«tabla de bytes DS 0x1ade = [4c,40,44,48,4c,4c,4c,4c,4c], banco alto ⇒
**A→0x14c** Avatar, M→0x140 Wizard, B→0x144 Bard, F→0x148 Fighter»*.

`0x14c` **no es una dirección**: es el **TILE** del sprite de pie del Avatar. Corroborado
por tres vías independientes:

1. **El consumidor**: el campo que documenta es `awakeTile: number`, y su único uso es
   `drawTile(this.ctx, this.atlas, m.awakeTile, …)` (`skin/fiel/skin.ts:2940`) — índice de
   atlas, no destino de salto.
2. **La serie**: `0x140/0x144/0x148/0x14c`, otra vez entera, en `api.ts:410` como
   salidas de tile de `party_anim_build`. Cuatro valores en progresión aritmética; sólo uno
   colisiona con un destino de salto de este overlay.
3. **La aritmética que la propia línea escribe**: el contenido de la tabla es
   `[4c,40,44,48,…]` y «banco alto» suma, al byte de tabla, 0x100. Sólo tiene sentido para un id de tile.

★ **Por qué es familia nueva.** #188 filtra por el prefijo `DS` y #190 midió el corchete: las
dos son **marcas del autor sobre la notación**. Aquí **no hay marca posible** — el número es
el CONTENIDO de una tabla, escrito como contenido, y el autor no tenía por qué anotarlo. El
mecanismo de fabricación es el de siempre (un valor cae encima de una instrucción y `sweep4`
lo declara plausible), pero la puerta es distinta: **valor-de-tabla**, no dirección-de-dato.

⚠ Y con la lección de #190 §4 aplicada: **esto NO se convierte en filtro.** La señal que lo
resolvió no es tipográfica, es el **CONSUMIDOR** (`drawTile`). Un criterio automático sobre
«números en una lista» barrería citas legítimas. Va a la tarjeta #191 como un tercer caso
para su AVISO, no como regla.

**ADJUDICACIÓN: (d) NO APLICA.** La cita es correcta como su autor la escribió; lo fabricado
es el par.

## 4. ★ `TOWN.OVL:0x165f` — el (a) que estuvo a punto de ser un defecto falso

`game.ts:2012` es una línea sola: `this.tickGuards(); // 0x165F guard_wander (PASO 5)`. El
pin es exacto (`165f: call 0xc78`). Pero el tramo tiene **tres hermanas** que deciden si esa
llamada ocurre siquiera:

```
1640: jne 0x1686                                   ] toggle de MONTADO
1642: cmp [g_time_spell],0x54 / 1647: je 0x1686    ] An Tym ('T') ⇒ NO corre
1649: cmp [g_time_spell],0x51 / 164e: jne 0x165f   ] Quickness ('Q')…
1650-165d: sbb/neg toggle      / 165d: jne 0x1686  ] …corre en turnos ALTERNOS
165f: call 0xc78                                   ; ← la cita
```

Ninguna de las tres aparece en el call-site, y `tickGuards()` **no tiene gate propio**
(`game.ts:2238`: sólo comprueba `npcManager && doors`). Con eso a la vista parecía un
defecto de paridad cruzado con #177/#183 (An Tym) y #122 (Quickness).

**No lo es.** Las tres están modeladas **una capa arriba**: `townNpcTailRuns`
(`turn.ts:404-419`) hace el toggle de montado, el `return false` con `timeSpell === "T"` y
la alternancia con `"Q"`, y es quien gatea el hook `afterHousekeeping` que llama a
`tickGuards`. Su docblock incluso documenta la composición de los dos toggles y que el que
salta no avanza el siguiente.

★ **La lección, que es de método y no de este par**: la forma `PREFIJO-efecto` señaló una
hermana REAL con efecto REAL, y el efecto está portado — pero **en otro fichero y en otra
capa que la línea que cita**. Leer sólo el fichero citante habría producido un defecto
inventado. La regla del encargo («tramo completo hasta el punto de reunión») hay que
extenderla al PORT: el punto de reunión del binario puede corresponder a un call-site cuyo
gate vive en el llamante.

## 5. ★ EFECTO SECUNDARIO DE MIS PROPIAS CORRECCIONES, medido y declarado

Mis 4 arreglos tocan `game/src`, que **es** el corpus de la población. Re-medido y diffeado
par a par contra el volcado de antes:

| | |
|---|---|
| población | 338 → **338** (ALTAS 0 · BAJAS 0) |
| **cambios de CELDA** | **1** |

```
~ LOOKOBJ.OVL:0x069c   LIMPIA/PREFIJO-efecto → LEJANA/PREFIJO-efecto
      distancia 10 → 11   (tok=1 y candidatos=10 sin cambio)
```

★ **La cita quedó MEJOR y su atribución PEOR.** El umbral de `LEJANA` es `distancia > 10`;
al nombrar las instrucciones intermedias (`0x055d call`, `0x0560 jmp`) el offset citado, `0x69c`, se
alejó **un token** del nombre del overlay y cruzó la raya. O sea: el eje `distancia` **penaliza
que una cita sea más explícita**, y lo hace por un margen de 1.

No se re-escribe el arreglo para esquivar el umbral —eso sería ajustar la prosa al
instrumento en vez de al binario—, pero queda dicho, con su cifra, para la tarjeta #191: al
lado de la corroboración por catálogo, este eje tiene un sesgo que conviene conocer antes de
usarlo como filtro. Consecuencia contable: la mitad FORZADA+LIMPIA pasa de 149 a **148**, y
`LOOKOBJ.OVL:0x069c` **sigue adjudicado** (el veredicto salió de leer el binario, no de la
columna en la que caiga).

## 6. Estado de la cola, con las cuentas cuadradas @ `d5fb1a4e` (tras mis edits)

Mitad adjudicable (FORZADA + LIMPIA) = **148** pares.

| | pares |
|---|---|
| clase-2 cerrados (criterio de #172, por PRESENCIA) | 45 |
| clase-2 SIN-TEXTO, sin medir | 7 |
| `PREFIJO-efecto` cerrados en tandas previas | 4 |
| **`PREFIJO-efecto` — CERRADA en §2** | **12** (+1 que se fue a LEJANA, también cerrado) |
| `PREFIJO-bifurca` | 4 |
| `PREFIJO-inerte` (NO auto-adjudicable) | 1 |
| `BACKEDGE` | 12 (−1 ya (d)) |
| `DIVERGE` | 58 (−4 ya (d)) |
| (d) heredados de #188/#190 dentro de la mitad | 5 |

45 + 7 + 4 + 12 + 4 + 1 + 12 + 58 + 5 = **148** ✓

**VIVOS al cerrar: 82** (eran 95 al re-anclar; −13 por esta tanda, y de esos 13 uno cambió
de columna). Orden de ataque que queda, sin cambios respecto a §4 de la tanda 1:
los **7 SIN-TEXTO** (baratos), `PREFIJO-bifurca` (4) + `PREFIJO-inerte` (1), `BACKEDGE`
(12), `DIVERGE` (58). Los **189** LEJANA+AMBIGUA siguen fuera: atribución primero.

## 7. Lo que este carril NO ha hecho, declarado

- **No ha tocado la MECÁNICA del port.** Los 4 arreglos son prosa de docblock; `tsc` EXIT 0
  y la suite entera verde (303 ficheros · 3903 tests · 1 skip), que es el control de que no
  se coló nada más.
- **No ha tocado `re/tools/`.** El hallazgo de §3 se mide y se describe; **no** se
  implementa como filtro, por la razón de #190 §4 (la señal que discrimina es el consumidor,
  no la notación).
- **No ha resuelto ninguna atribución.** Los 189 LEJANA+AMBIGUA siguen como estaban.
- **No ha auditado el reparto de campos de ningún (a).** Se adjudica la afirmación citada y
  sus límites, no todo lo que la rutina hace alrededor.
- **La CONDICIÓN de los (a) por PRESENCIA sigue sin verificarse** para los 45 clase-2
  heredados (#144). Los 8 (a) de §2 sí se cierran por lectura del tramo.
- **No ha verificado** que `LOOKOBJ.OVL:0x069c` sea el único par cuya atribución se mueve
  al corregir prosa. Se midió el efecto de MIS cuatro edits, no el del género.

## 8. Cabos con dueño, para tarjeta

1. **#191 (corroborar contra el catálogo)** — se le añaden DOS insumos medidos: el tercer
   caso de familia de §3 (**valor de tabla**, que no tiene marca posible) y el sesgo del eje
   `distancia` de §5 (penaliza la cita más explícita; margen medido = 1 token).
2. **Género del docblock RANCIO** (§2.1 y §2.2): dos de trece pares de esta celda tienen la
   cabecera contradiciendo a un hermano o a su propio cuerpo, en los dos casos porque una
   corrección posterior no barrió el fichero. **2/13 en una muestra leída al 100%** — no es
   una cota, es la celda entera. Merece barrido propio: buscar docblocks cuya afirmación
   esté ya refutada en otro punto del MISMO fichero.
3. **`MAINOUT.OVL:0x0d0e`** (hermana de `0x0d11`, no adjudicada): llamada condicional
   `call 0xfffff972` cuando `(x & 0xfc) == 0xd4`, fuera del alcance de la cita. Nombrada,
   no leída.

## 9. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

```
npx tsc --noEmit -p game/tsconfig.json              EXIT=0
npx vitest run  (game/)                             EXIT=0   303 ficheros · 3903 tests · 1 skip
python3 re/tools/cita_pegajosa_forma.py             EXIT=0   (3 controles verdes; 338 pares)
python3 re/tools/cita_pegajosa_forma.py --clase2    EXIT=0   (positivo + capacidad verdes)
python3 re/tools/cita_pegajosa_atribucion.py        EXIT=0
python3 re/tools/cita_hermana_emitida.py            EXIT=0   (#172 intacto)
python3 re/tools/cita_clase4_efecto.py              EXIT=0   (#174 estricto intacto)
python3 re/tools/verify_pool174_claims.py           EXIT=0
python3 -m pytest re/tools/test_cita_segmento.py    EXIT=0   (8/8)
python3 re/tools/seed_gate.py                       EXIT=0
python3 -m pytest re/tools/test_frontier.py         EXIT=0
python3 -m pytest re/tools/test_genero.py           EXIT=0
python3 re/tools/genero.py                          EXIT=0
```

### 9.1 ★ `seed_gate` estaba VERDE antes del `git add` y ROJO después

Merece renglón porque es el aviso de dos reglas del acervo cumpliéndose a la vez, en vivo,
sobre este mismo fichero:

- **El gate es ciego a lo untracked.** Corrido con el acta sin añadir: EXIT 0. Corrido tras
  `git add -A`, con el MISMO contenido en disco: EXIT 1. Si esta tanda hubiera declarado
  gates «antes del add», habría firmado un verde falso.
- **Un acta cambia la SEMILLA de un nombre de rutina.** El acta sembraba **siete**
  candidatos de nombre (`citado`, `corrobora`, `chequeo`, `devuelve`, `exacto`…) por prosa
  española pegada a un offset entrecomillado. Es exactamente el ctx pegajoso de #84,
  disparado por el acta que lo cita.

Y un detalle de método que costó tres pasadas: **anteponer `CS ` NO basta.** La adyacencia
se mira por los DOS lados y la comilla invertida cuenta como separador, así que el arreglo
que funciona es **coma inmediatamente después del cierre** (y coma antes, si la palabra de
delante es larga). Queda anotado para el siguiente que escriba un acta de esta cola.

Nada de e2e/playwright (mutex ajeno). `routine-census.json` NO regenerado (EMBARGO).
`pytest re/tools` COMPLETO no corrido (contiene un test de oráculo EN VIVO); los test-files
se corren por nombre.

---

---

# TANDA 5 (mismo carril, mismo árbol `d5fb1a4e`) — los 7 SIN-TEXTO, CERRADOS 7/7

Segundo punto del orden de ataque de `pegajosa-174-acta` §4. La población no se re-mide
porque no ha aterrizado nada entre medias: el árbol es el mismo y el commit de la tanda 4
sólo tocó prosa ya contabilizada en §5.

## 11. VEREDICTO: los 7 salen (a). «SIN-TEXTO» nunca fue señal de defecto

| par | veredicto |
|---|---|
| `ULTIMA.EXE:0x4786` | **(a)** exacta — las DOS ramas, con offset, cap y los dos tiles |
| `CAST2.OVL:0x0a0c` | **(a)** exacta — 3 afirmaciones, 3 confirmaciones al byte |
| `MAINOUT.OVL:0x1c56` | **(a)** exacta — 3×, argumento 5, `.` = 0x2e, límites |
| `SHOPPES.OVL:0x0374` | **(a)** exacta — 4/4, y la hermana documentada por su guarda |
| `SHOPPES.OVL:0x03c2` | **(a)** exacta — los 3 casos del switch, con sus globales |
| `SHOPPES.OVL:0x061c` | **(a)** en sus límites — omite el repaint (§11.3) |
| `ULTIMA.EXE`/`SHOPPES` ⇒ | **7 (a) · 0 (b) · 0 (c) · 0 (d)** |

★★ **LO QUE ESTO MIDE, y es el resultado de la tanda.** `pegajosa-174-acta` §3.1 dejó estos
7 con una etiqueta honesta: *«no son "sin defecto", son SIN MEDIR»*. Medidos: **7 de 7
correctas**. Y ahora se ve POR QUÉ el criterio de #172 no podía pronunciarse — no es una
propiedad de los pares, es un límite del DECODIFICADOR:

- `CAST2.OVL:0x0a0c`, que empuja `0x958e` a `0x3670`: **no es el impresor**;
- `MAINOUT.OVL:0x1c56`, que empuja un **5** (un contador de ticks), no un puntero;
- las de `SHOPPES.OVL` empujan punteros de **otro segmento** (`0x21e6`, `0xb6e2`).

⇒ **SIN-TEXTO es «el partidor miró donde no había cadena», no «hay algo raro aquí».** El
bucket es un artefacto del instrumento y su rendimiento en defectos es **0/7**. Quien
herede la cola puede bajarlo de prioridad con este dato, que antes no existía.

### 11.1 `ULTIMA.EXE:0x4786` — la mejor documentada de las dos tandas

Cita, en `moongate.ts:10`: *«de NOCHE `anim++` (cap 0x10, inc-con-cap 0x3ef0 @0x4775); de DÍA
`anim--`, y al llegar a 0 el tile pasa a hierba (@0x4786-0x4798). El tile compuesto es
binario: 0xDC (puerta) / 5 (hierba)»*.

```
4762: mov [bp-8], 0xdc          ; tile por defecto
4767: cmp [g_hour], 0x14 / 476c: jae 0x4775   ] hora >= 20 ⇒ NOCHE
476e: cmp [g_hour], 5    / 4773: jae 0x4786   ] 5 <= hora < 20 ⇒ DÍA
4775: push 0x5887 / push 1 / push 0x10 / call 0x3ef0   ; ← HERMANA: inc con cap 0x10
4786: push 0x5887 / push 1 / call 0x3f36               ; ← la cita: dec
4791: cmp [0x5887], 0 / 4796: jne 0x479d
4798: mov [bp-8], 5                                    ; ← hierba
```

**Todo cuadra al byte**: el cap `0x10` está literal en 0x477d ✓, la hermana lleva su propio
offset **y** su rutina ✓, y los ÚNICOS dos escritos a `[bp-8]` en la rutina entera son
`0xdc` y `5`, que es justo lo que «el tile compuesto es binario» afirma ✓. La rama de noche
—la hermana— no está insinuada: está citada con `@0x4775`.

★ **Y de propina, la TERCERA vía independiente** de que `0x5887` es DATO y no código: aquí se
empuja **como argumento** a las dos ayudantes, en 0x4775 y 0x4786. Confirma por un camino nuevo
el (d) que `pegajosa-103` §1 sacó por el prefijo y `corchete-190` §2 por el corchete — y lo
confirma desde el MISMO fichero, otra línea, entrando por otro par.

### 11.2 `CAST2.OVL:0x0a0c` y `MAINOUT.OVL:0x1c56` — los dos bucles, exactos

`shrines.ts:136` dice *«mantra ×3 (bucle 0x0a0c, compare contra mantra[v] 0x1f5e)»*:
la base de tabla se arma en 0x0a03 (`add ax, 0x1f5e`), se dereferencia en 0x0a3d
(`push [bx]` → `strcmp` 0xffff8d3e), y el bucle cierra en 0x0a56 con `cmp si, 3 / jl 0xa0c`.
Tres afirmaciones, tres confirmaciones.

`game.ts:1286` dice *«0x1c56-0x1c65  3× [0x3AE6(5) mudo + putchar '.']»*: contador a 3 en
0x1c53, argumento **5** empujado en 0x1c56, `0x2e` (que es `.`) en 0x1c5d, y `dec si / jne
0x1c56` en 0x1c64. Límites exactos: la cita va de la cabeza del bucle a su salto de cierre.

### 11.3 Las tres de `SHOPPES.OVL`, y la única asimetría

`0x0374`, del gremio, y `0x03c2`, su switch, salen **exactas**: sub oro ✓, merma 0x19a ✓, repaint
0x8670 ✓, switch ✓; y los tres casos, `0x0394`/`0x03b8`/`0x03c2`, escriben en `0x57ac`/`0x57ad`/
`0x57ae` con 3/4/5 y tope 0x63 ✓ — incluido el detalle de que los casos 4 y 5 **saltan a la
cola del caso 3** para compartir el `push 0x63 / call`. La hermana (el rechazo por oro) está
documentada por su guarda: *«el único rechazo previo al cobro es el de ORO (0x0361)»*.

★ Ese docblock trae además un **control de ausencia sobre el overlay ENTERO** («en todo
SHOPPES.OVL hay exactamente DOS `cmp` con 0x63… y ninguno cae en la cadena del gremio»), que
es la forma correcta de la familia `ausencia-no-se-prueba-con-head`. Se deja señalado como
ejemplar del género, no sólo como cita válida.

⚠ **La asimetría, que es lo único anotable**: `0x061c`, el de reactivos, enumera sub oro + merma +
add_byte_capped + `DS 0x7988` + `DS 0x79a2` —los cinco verificados— pero **no nombra el
repaint** `0x8670`, que sí está en su tramo, en 0x0626, y que su hermana de `:732` sí nombra para
la misma forma. No es un error: la cita es una lista, no una declaración de completitud, y
todo lo que enumera es cierto. Se adjudica **(a) en sus límites** con la omisión nombrada,
igual que `ULTIMA.EXE:0x66a6` en `pegajosa-103` §2.2.

## 12. Cola tras la tanda 5, y CORTE DECLARADO

| | pares |
|---|---|
| VIVOS al cerrar la tanda 4 | 82 |
| cerrados aquí (los 7 SIN-TEXTO) | **7** |
| **VIVOS** | **75** |

Restante en la mitad adjudicable: `PREFIJO-bifurca` 4 · `PREFIJO-inerte` 1 · `BACKEDGE` 12 ·
`DIVERGE` 58. Los 189 LEJANA+AMBIGUA siguen fuera.

⚠ **CORTE DECLARADO en FRONTERA DE CELDA**, con la celda entera cerrada y sin empezar la
siguiente (`PREFIJO-bifurca` + `PREFIJO-inerte`, 5 pares). No se parte ningún par por la
mitad. Es la regla del §6 del encargo y el quinto precedente de esta cola.

## 13. Lo que la tanda 5 NO ha hecho

- **No ha re-medido la población**: no ha aterrizado nada y el commit anterior sólo tocó prosa
  ya contabilizada. Si el lead aterriza algo antes de la tanda 6, hay que re-anclar.
- **No ha tocado `game/src` ni `re/tools`.** Cero arreglos: los 7 estaban bien.
- **No ha leído** `PREFIJO-bifurca` (4), `PREFIJO-inerte` (1), `BACKEDGE` (12) ni `DIVERGE`
  (58).
- **No ha verificado la CONDICIÓN** de ninguno de los 7 (#144): se adjudica que la cita
  describe el tramo, no que el port lo modele bajo la condición correcta.

---

# TANDA 6 (mismo carril) — `PREFIJO-bifurca` + `PREFIJO-inerte` CERRADAS 5/5

## 14. RE-ANCLA: NO hace falta, y se dice con la medida

Entre la tanda 5 y ésta, main avanzó a `7e99f561` (#186). La regla de la tarjeta es re-anclar
**si un aterrizaje tocó `game/src`**. Medido: `git diff a3efe440..7e99f561 -- game/src` sale
**vacío** ⇒ el corpus no se ha movido ⇒ la partición no puede haber cambiado. Se declara con
el comando y su resultado, no con un «no creo que afecte».

## 15. VEREDICTO: 5/5 (a). Cero defectos, y el bucket «inerte» rinde un hallazgo

| par | veredicto |
|---|---|
| `ULTIMA.EXE:0x4775` | **(a)** exacta — es la OTRA rama del fork ya derivado en §11.1 |
| `NPC.OVL:0x1321` | **(a)** exacta — el INERTE, leído; y su hermana NO es inerte (§15.2) |
| `CMDS.OVL:0x09b2` | **(a)** exacta — «ret directo» verificado hasta el epílogo |
| `DUNGEON.OVL:0x1ca1` | **(a)** exacta — el «SIEMPRE» es demostrable por convergencia |
| `TOWN.OVL:0x0508` | **(a)** exacta — «sólo de NOCHE» con la ventana derivable |

### 15.1 ★ `ULTIMA.EXE:0x4775` salió cerrado GRATIS, y eso es un dato de la banda

Este par y `ULTIMA.EXE:0x4786`, que cerré en la tanda 5, son **las DOS ramas del MISMO fork**
(el reparto día/noche de la moongate), y **una sola línea de docblock las cubre a las dos**.
Al leer el tramo entero en §11.1 quedó adjudicado también éste, sin trabajo nuevo.

⇒ **La banda contiene el mismo fork DOS VECES, una por brazo**, y caen en celdas distintas
(`PREFIJO-efecto` uno, `PREFIJO-bifurca` el otro). Quien planifique tandas por celda debe
contar con que parte del trabajo ya está hecho por la celda vecina: el ahorro es real y no
aparece en ninguna tabla. Vale la pena buscar más pares hermanos-de-fork antes de estimar lo
que queda.

### 15.2 ★★ El INERTE: la cita es correcta, y el PREDICADO está ciego

`PREFIJO-inerte` es el único bucket que la partición declara auto-adjudicable, y `#174` §1 lo
dejó marcado como sospechoso (salió VACÍO en el pool estricto y aquí tiene miembros), pidiendo
que alguien lo pusiera a prueba. Su único miembro de la mitad adjudicable, leído:

```
1308: xor dx, dx                            ; ← inicio del rango citado
130a: cmp al, ah / 130c: jbe 0x1311
130e: mov al, ah / 1310: inc dx             ; caso 1
1311: cmp al, bl / 1313: jbe 0x131a
1315: mov al, bl / 1317: mov dx, 2          ; caso 2
131a: cmp al, bh / 131c: jbe 0x1321
131e: mov dx, 1                             ] HERMANA — el «quirk 3→1»
1321: mov ax, dx                            ; ← la cita: el resultado
```

La cita (`time.ts:65`) dice: *«el periodo del 4º tiempo reutiliza la posición índice 1 (quirk
3→1, `0x131e mov dx,1` en vez de 3)»*, *«los empates los gana el índice MENOR (`jbe`)»* y
*«reproduce byte a byte el listado …»* (el rango es el de la cabecera). Las tres, exactas. El `0x131e`, en efecto, es
`mov dx, 1` ✓, `jbe` mantiene el actual en empate ⇒ gana el menor ✓, y el rango va del `xor`
inicial al `mov ax, dx` final ✓. **(a) exacta.**

★★ **Pero la ETIQUETA es falsa, y ahora se sabe por qué.** El predicado (`cita_clase4_efecto`)
manda a `PREFIJO-inerte` cuando la hermana converge y por el camino no hay `call`, ni
**escritura de memoria**, ni salida — y su propio control lo afirma así
(`x["calls"] or x["writes"] or x["salidas"]`). **No mira los REGISTROS.** Aquí la hermana
escribe `dx`, y `dx` es literalmente el **valor de retorno** (`0x1321 mov ax, dx`).

⇒ **«Inerte» significa «no toca memoria», no «no hace nada».** Y en este caso la hermana no
sólo hace algo: **es el sujeto entero de la cita** — el docblock existe para documentar ese
`mov dx, 1`. Si alguien hubiera auto-adjudicado el bucket, habría saltado el único par cuya
hermana es justo lo que su autor quería explicar. **La negativa de `#174` §1 a auto-adjudicar
queda vindicada con un caso concreto**, que es lo que aquella nota pedía.

Cabo con dueño (no se toca el instrumento, mismo criterio que #188/#190): el predicado
debería contar como efecto la escritura de un registro que alcanza el retorno. **No se aplica
aquí** — es criterio nuevo y le toca su control, y además cambiaría la población.

### 15.3 Los otros tres

- `CMDS.OVL:0x09b2` — *«los rechazos (no-fragata / paralelo) salen sin consumir turno … → ret
  directo»*. Los dos offsets son las cabezas exactas de los dos rechazos
  (`0x0978`, con `0x42c6`; `0x09b2`, con `0x42cd`) y **convergen en la misma cola**
  (`0x097b push / 0x097c call 0x58d0 / 0x097f jmp 0xae4`). Y `0xae4` **es el epílogo**
  (`pop si / pop di / mov sp, bp / pop bp / ret`): entre el rechazo y el `ret` no hay nada más,
  así que «sin consumir turno» es literal y no una impresión. Verificado hasta el `ret` a
  propósito, porque «ret directo» era la parte floja de la frase.
- `DUNGEON.OVL:0x1ca1` — *«imprime SIEMPRE la dirección en 0x1C83 ANTES del gate de salida
  (0x1C87)… incluso cuando el klimb SALE de la mazmorra (rama boundary 0x1CA1)»*. El
  «SIEMPRE» **se demuestra por convergencia**: las dos cargas de cadena (`0x1c7b` «Down!» y
  `0x1c80` «Up!») caen las dos en `0x1c83`, que es `push ax / call 0x9680`, y está **antes**
  del primer gate. Y `0x1ca1` es la rama boundary a la que llegan los DOS extremos (subir
  desde planta 0, bajar desde la 7). Exacta.
- `TOWN.OVL:0x0508` — *«llamado desde el cargador de mapa …, rama 0x0508, sólo de
  NOCHE»*. En `0x0508` hay `call 0x170` ✓, y se llega por `0x04ff jb` (hora < 5) o por caída
  de `0x0506 jbe` (hora > 0x13). La ventana es exactamente **hora < 5 ó hora ≥ 20**, que es
  «sólo de NOCHE» ✓, y cuadra con los bordes 5 y 20 que el mismo docblock da para el otro
  llamador.

## 16. Cola tras la tanda 6

| | pares |
|---|---|
| VIVOS al cerrar la tanda 5 | 75 |
| cerrados aquí | **5** |
| **VIVOS** | **70** |

Restante en la mitad adjudicable: `BACKEDGE` 12 · `DIVERGE` 58 — **las dos celdas de lectura
larga**, que es lo que queda por diseño del orden de ataque. Los 189 LEJANA+AMBIGUA, fuera.

Balance de las tres tandas de este carril: **25 pares adjudicados** (13 + 7 + 5) —
**20 (a) · 4 (b) corregidas · 1 (d)**. Defectos de MECÁNICA del port: **cero**.

## 17. Lo que la tanda 6 NO ha hecho

- **No ha tocado `game/src` ni `re/tools`.** Los 5 estaban bien.
- **No ha arreglado el predicado de `inerte`** (§15.2). Medido y con dueño; criterio nuevo,
  su propio control, y mueve población.
- **No ha barrido los pares hermanos-de-fork** que §15.1 hace sospechar que existen.
- **No ha leído** `BACKEDGE` (12) ni `DIVERGE` (58).

## 10. Nombres de overlay usados aquí (sección FINAL a propósito)

Al final por el ctx pegajoso de la tarjeta #84: un nombre de overlay escrito arriba
re-atribuye los offsets desnudos que vengan detrás dentro de su ventana. `re/notes/` no es
corpus del extractor (medido en `pegajosa-103-acta` §0.2), así que aquí es disciplina, no
necesidad — la misma prosa puede acabar copiada a un docblock de `game/src`, donde sí lo
sería.

Overlays nombrados: `BLCKTHRN.OVL`, `COMSUBS.OVL`, `DUNGEON.OVL`, `ENDGAME.OVL`,
`LOOKOBJ.OVL`, `MAINOUT.OVL`, `OUTSUBS.OVL`, `SJOG.OVL`, `TOWN.OVL`, `ULTIMA.EXE`,
`CAST2.OVL`, `COMBAT.OVL`, `NPC.OVL`, `SHOPPES2.OVL`. `DATA.OVL` no tiene desensamblado en
el corpus (medio mecanismo del defecto original de #188).
