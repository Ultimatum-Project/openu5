# Auditoría LOS-opacidad vs PASABILIDAD del port (carril fiel/los-audit, 2026-07-18)

Follow-up del lote D del oráculo (`lote-D-witnesses-relevo.md §Obj 2`). El binario tiene
**tres tablas de tiles SEPARADAS**; esta auditoría verifica que el port NO las conflaciona.

## Las tres tablas del binario (bytes volcados en vivo, relevo del oráculo)

> **⚠ §Las tres tablas SUPERADO EN SU POLARIDAD (2026-07-30, auditoría general 30-07 ALTA-4).**
> Esta sección extendió a `0x6a14` el sentido de bit de la tabla de PASABILIDAD sin derivarlo de
> SU consumidor. En `0x6a14` es al revés: **bit SET = TRANSPARENTE (210 tiles) · bit CLEAR =
> OPACO (46)**. Derivación: kernel `0x3f6e` (`re/disasm/ULTIMA.EXE.asm` 0x3f9d-0x3fac) hace
> `mov cl,[bx+0x6a14]; and ax,cx; cmp cx,1; sbb ax,ax; inc ax` ⇒ devuelve **1 si el bit está
> PUESTO**; `CAST.OVL 0x1bb0`, que pasa ese `ax` intacto, y su consumidor (`0x1dfb: or ax,ax; je
> 0x1e68`) manda **`ax==0` al brazo de PARADA**. Corroboración independiente: el brazo de
> FUERA DE TABLERO de `0x1bb0` (`0x1bcd` → `0x1bd6 sub ax,ax`) devuelve 0, y fuera del tablero
> la línea DEBE cortarse ⇒ **0 = opaco**. Lo que cambia aquí abajo: (1) la fila de `0x6a14` no
> dice «210 opacan»; (2) **las DOS listas de divergencias están mal rotuladas**, no sólo una;
> (3) cae el «ÚNICO caller» (son DOS: `CAST 0x1c28` + `COMSUBS 0x142a`); (4) `0x5dfe`/`0x6a86`
> deja de ser el trazado de proyectil de combate. **El PORT no cambia**: `areaSpellTables.ts`
> ya lleva la polaridad correcta (`SPELL_LOS_TRANSPARENT` = bit SET = 210). Derivación entera
> en `proyectil-los-0x6a14-derivacion.md`. Se conserva el texto de abajo como registro.

Mecánica común de los tres bitmaps: `bit = (0x80>>(tile&7))` del byte `bm[tile>>3]`, MSB-first.
El **SENTIDO** del bit NO es común y se deriva del consumidor de cada tabla:
~~«Predicado bitmap común: bloquea ⟺ bit puesto»~~ vale para la PASABILIDAD (kernel `0x2bd4`,
ver §Pasabilidad) y es **FALSO para `0x6a14`**, donde el bit puesto es TRANSPARENTE
(⚠ corregido 2026-07-30).

| tabla | kernel | DS | tipo | #tiles | uso |
|---|---|---|---|---|---|
| **pasabilidad** | `0x2bd4` | `0x54d4` | bitmap 32B | 182 bloquean | ¿la party/actor puede PISAR el tile? |
| **opacidad-LOS** | `0x3f6e` | `0x6a14` | bitmap 32B | **210 TRANSPARENTES / 46 opacan** (⚠ 2026-07-30; decía ~~«210 opacan»~~) | corta la LÍNEA del aplicador de hechizos de campo/área **y el vuelo del proyectil de combate** — ~~único caller `CAST:0x1c28` (dentro de 0x1c36)~~ **DOS call-sites medidos: `CAST.OVL 0x1c28` + `COMSUBS.OVL 0x142a`** (⚠ 2026-07-30) |
| **opacidad-luz** | `0x5dfe` | `0x6a86` | LISTA 19 (memchr) | 19 opacan | flood de LUZ/fog del viewport (`0x5A28`) ~~+ trazado de combate~~ — **el trazado de combate NO es de esta tabla**: los 2 call-sites de kernel `0x5DFE` son `0x5bfe` y `0x5cb4`, **ambos del flood del viewport** (⚠ 2026-07-30) |

Divergencias BIDIRECCIONALES entre pasabilidad (0x54d4) y opacidad-LOS (0x6a14),
derivadas de los bytes (el `A` = 39 casa verbatim con el relevo; ~~el `B` corrige la lista
en prosa del relevo, que tenía erratas de transcripción~~ — **⚠ 2026-07-30: el `B` no corrigió
la lista del relevo, la ESTROPEÓ; lo único que allí estaba mal era el cardinal, 67 y no 66.
Ver debajo**):

> **⚠ LOS TRES RÓTULOS DE ABAJO ESTÁN INVERTIDOS — CORREGIDO 2026-07-30.** Los CONJUNTOS se
> recomputan idénticos (39 / 67 / 143 = `P∖T`, `T∖P`, `P∩T`), pero `T` (= bits puestos en
> `0x6a14`) es el conjunto TRANSPARENTE y no el opaco, así que sus NOMBRES dicen lo contrario
> de lo que son. Se conservan los bytes y se corrigen los rótulos. Con ello aparece un CUARTO
> conjunto que faltaba, y es el que de verdad merece el rótulo «opacas a LOS pero pisables»:
> son **7**, no 67. Control de la corrección: ocho de los 39 de `A` (`0c 0d 4d 4e 4f 5a b8 b9`)
> están también en los 19 de `ALWAYS_OPAQUE` que este mismo fichero da por opacos — imposible
> bajo el rótulo viejo («transparentes a LOS»), consistente bajo el nuevo.

- **A) Bloquean paso Y OPACAS a LOS (39)** ~~«Bloquean paso PERO transparentes a LOS»~~
  (⚠ 2026-07-30): `0c 0d 1a 3a 3b 3c 3d 3f 42 46 4d
  4e 4f 50 51 52 53 54 55 5a 70 71 72 73 74 75 76 77 78 79 7a 7b 7c 7d 7e 7f b8 b9 df`
  (~~agua, mobiliario bajo, campos… se ven a través pero no se pisan~~ — es el muro sólido en
  los DOS ejes: montaña `0c 0d`, muros `4d 4e 4f`, las 16 barreras `70`-`7f`, puertas `b8 b9`).
- **B) PISABLES Y TRANSPARENTES a LOS (67)** ~~«Opacas a LOS pero PISABLES»~~ (⚠ 2026-07-30,
  **doble corrección** — ver debajo): `00 04 05 06 07 08 09 0a 0b 0e 0f 10 11 16 17
  18 1d 1e 1f 20 21 22 23 24 25 26 2c 2d 30 31 32 33 34 35 36 37 39 40 44 45 47 48 49 6a
  6b 86 87 8c 8f 90 91 92 93 aa ab ac bc c4 c5 c6 c7 c8 c9 dc dd f9 ff`.
  La segunda corrección es de FUENTE, no de rótulo, y **desanda media corrección de
  2026-07-18**: la lista anterior (`… 93 ae af b0 c0 c8 c9 ca cb cc cd e0 e1 f9 ff`) se derivó
  del volcado EN VIVO que este mismo fichero declara **CORRUPTO en `0xa8-0xe7`** (§Pasabilidad,
  bytes 21-28). Recomputada contra el canónico `DATA.OVL @0x54e4`, cambian diez tiles —
  **entran** `aa ab ac bc c4 c5 c6 c7 dc dd`, **salen** `ae af b0 c0 ca cb cc cd e0 e1` —,
  todos dentro de la zona corrupta. ★ Y la lista que aquel día se dio por «con erratas de
  transcripción», la de `lote-D-witnesses-relevo.md`, **era la BUENA**: medida hoy tile a tile
  contra `0x54e4` sale idéntica a ésta, 67/67. Lo único que el relevo tenía mal era el
  CARDINAL de su propio rótulo (decía 66 para una lista de 67). Aquella pasada arregló el
  conteo y estropeó la lista, y el estropicio pasó doce días sin que nada lo pinchara porque
  **el cardinal cuadra en las dos**: 67 con la tabla buena y 67 con la corrupta. El test
  (`los-passability-audit.test.ts`) tampoco lo veía: de los dos conjuntos sólo clava `A`
  verbatim; de éste sólo comprueba la longitud.
- **Bloquean paso PERO se ven a través: 143** ~~«Ambas (muro sólido): 143»~~ (⚠ 2026-07-30 —
  agua, mobiliario bajo y campos, que era la glosa puesta en `A`).
- **D) Opacas a LOS pero PISABLES: 7** — `12 13 14 15 19 1b 3e` (Keep · Village · SmallCastle ·
  LargeCastle · Shrine · Lighthouse · CastleBritianEntrace). Conjunto AUSENTE del fichero
  hasta hoy: son las entradas de edificio del overworld, que se pisan (se entra) y cortan la
  línea. Recomputado 2026-07-30 de los mismos bytes.

## Auditoría del port por subsistema

**VEREDICTO: el port NO conflaciona LOS con pasabilidad.** Cada subsistema usa una
tabla DISTINTA, mayormente citada al binario. Ningún sistema usa una tabla para las dos
cosas ni una derivación ad-hoc única.

| subsistema | fichero | tabla que usa | verdicto |
|---|---|---|---|
| Fog/LOS del viewport | `world/visibility.ts` (`ALWAYS_OPAQUE`) | los 19 de `0x6a86` VERBATIM | ✅ FIEL |
| Cañón naval | `world/cannon.ts` (`isCannonSolid`) | lista literal 0x97-0x99/0xB8-0xBB | ✅ FIEL |
| Proyectiles de combate | `combat/combat.ts` (`isRangedPathClear`) | `rangeWeaponPassable` (TileData, Clase-D) | ⚠️ aprox #44 |
| Hechizos de campo In *Grav (0x1c36) | `combat.ts:1515` (no-op) | 0x6a14 SIN consumidor | ⚠️ feature no modelada (→ §Pendientes) |
| Pasabilidad de paso/IA | `tiles.ts` (`walkable`) | `IsWalking_Passable` (TileData, Clase-D) | ⚠️ diverge 0x54d4 |

### ✅ Fog/LOS del viewport — FIEL
`visibility.ts::ALWAYS_OPAQUE` = `{09,0a,0c,0d,4d,4e,4f,5a,97,b8,b9,bc,d0,d1,d2,d3,f8,fe,ff}`
= los 19 bytes de `DS:0x6a86` EXACTOS. El flood 0x5A28 (viewport) consume 0x5DFE/0x6a86,
NO la pasabilidad ni 0x6a14. Correcto por construcción. (Cita: `ULTIMA.EXE.asm` 0x5A28
`:9632`, 0x5DFE `:9977`; `visibility.ts` docstring.)

### ✅ Cañón naval — FIEL
`cannon.ts::isCannonSolid` = lista LITERAL del binario 0x97-0x99 (puertas mágicas/
rastrillo) + 0xB8-0xBB (puertas ±ventana), cita `CMDS 0x0C75-0x0C87`. Nota explícita de
que NO es `rangeWeaponPassable` (0x99 Portcullis difiere). Correcto.

### 🔴 Proyectiles de combate — **RESUELTO 2026-07-25: la tabla es `0x6a14`** (el #44 estaba INVERTIDO)

`isRangedPathClear` ya NO usa 0x6a86. El vuelo real (`COMSUBS 0x12DE`, que **devuelve** 0/1)
llama por celda a `0x142a call 0x5d8e` → **kernel `0x3F6E`** → bitmap **`DS:0x6a14`**
(bit puesto = atraviesa). Ver `re/notes/proyectil-los-0x6a14-derivacion.md`. Y **cae la
afirmación de «ÚNICO caller» de la sección de 0x6a14 más abajo**: `0x3F6E` tiene **DOS**
call-sites — `CAST.OVL 0x1c28` (hechizos de línea/área) y `COMSUBS 0x142a` (proyectil de
combate) — censados con `dispatch_table.near_calls_to_kernel`. La tabla ya estaba en el port
como `blocksSpellLine` (`magic/areaSpellTables.ts`), verbatim y con la polaridad correcta.

Lo que sigue es el texto anterior, conservado como registro de lo que se creyó:

### ⚠️ (histórico, FALSO) Proyectiles de combate — aproximación Clase-D (ticket #44)
`combat.ts::isRangedPathClear` raycastea celda a celda con `tileInfo(t).rangeWeaponPassable`
(TileData.json, Clase-D), citado como aproximación a `COMSUBS:0x12DE`/kernel `0x5D8E`. La
adjudicación previa (`combat-spells.md §6`, **Acción #44**, prioridad BAJA) fija que el
trazado de combate usa `0x5D8E`/`0x5dfe` (bitmap 0x6a86) — y **NO cablear 0x6a14 al
combate** (sería la tabla equivocada). El port hace bien en NO usar 0x6a14 aquí; el gap
es Clase-D (rangeWeaponPassable vs 0x6a86), ya ticketeado. Fuera de alcance de este carril.

### ⚠️ La tabla 0x6a14 NO tiene consumidor en el port — hechizos de campo NO modelados
El binario usa `0x6a14` (kernel `0x3f6e`, `ULTIMA.EXE.asm:6979` `3f9d: mov cl,[bx+0x6a14]`)
en ~~UN solo sitio~~ **DOS** (⚠ corregido 2026-07-25: el segundo es `COMSUBS 0x142a`, el
proyectil de combate): el aplicador de hechizos de campo/área `CAST.OVL:0x1c36` (~~ÚNICO caller
del validador de LOS 0x1bb0→0x1c28→0x3f6e), que traza una LÍNEA deteniéndola en el primer
tile opaco a LOS y siembra un patrón con peso radial de probabilidad. El hechizo confirmado
que entra por ahí es **In Flam Grav (#14, fieldWall)** (cita estática del relevo + witness
v2: siembra campo 3×3 en overworld). Derivación completa en `cast-line-area-spell-derivation.md`.

**PERO el port NO modela ese hechizo:** `combat.ts:1515` case "fieldWall" es NO-OP explícito
(«campos 0xE8-0xEB no modelados en la arena, aprox. consciente»), y NO hay handler de
overworld que siembre el `overworldTile` (grep en `game.ts` = 0). ⇒ **La tabla 0x6a14 no
se alcanza en el port porque su(s) hechizo(s) son una aproximación consciente no modelada.**
NO es conflación de tablas ni tabla mal cableada; es una FEATURE faltante → §Pendientes.

### ⚠️ Pasabilidad — TileData (Clase-D) diverge del binario canónico (29 → 3 residuales)

**FUENTE CANÓNICA + CONVENCIÓN (corrección 2026-07-18).** La tabla de pasabilidad a pie es
`DATA.OVL` fileoff **`0x54e4`** (32 bytes, 1 bit/tile) — la que el kernel carga en `DS:0x54d4`.
El predicado del consumidor es el kernel `0x2bd4`:
```
2bda mov ax,0x80 ; 2be2 and cx,7 (=tile&7) ; 2be5 sar ax,cl  → máscara 0x80>>(tile&7)  [MSB]
2bee mov cl,[bx+0x54d4] (bx=tile>>3) ; 2bf4 test cx,ax ; 2bf6 je → bit CLARO=pasa, PUESTO=BLOQUEA
```
Convención: **MSB-first, bit PUESTO = BLOQUEA**. Anclas: hierba `0x05` clear=pasa, agua `0x01`
puesto=bloquea, desierto `0x07` pasa (Slow-progress). **El binario bloquea 182 EXACTOS.**
La convención de bit SE DERIVA DEL CONSUMIDOR (0x2bd4), no se asume — dos lecturas «bonitas»
(LSB / polaridad invertida) aciertan por casualidad en algunos tiles y fallan en otros.

**Doble corrección de esta divergencia.** La «diff de 29» original salió de un VOLCADO EN VIVO
(lote D) tomado en overworld y **CORRUPTO en la zona `0xa8-0xe7`** (bytes 21-28): fabricó ~20
falsos positivos. Re-derivada contra `0x54e4` con la convención del kernel, la divergencia real
sobre el scope de los 29 se reduce a **3 tiles**:
- **binario BLOQUEA / port PISA (1):** `0x1a` BrokenShrine — **divergencia DELIBERADA** del port:
  el bitmap bloquea pero se ENTRA para restaurar (patrón-moongate, CMDS.OVL 0x130c→0x1202; el
  port lo espeja con `checkShrineEntry` sobre `walk=1`). Cita: `re/notes/passability-18flags.md`.
  NO se overridea.
- **port BLOQUEA / binario PISA (2):** `0xf9` sign · `0xff` black-square — el port SOBRE-bloquea;
  dirección típica de caso-especial deliberado → **⏳ derivar por-tile**, no swap ciego.

**Wire aplicado** (`WALKABLE_OVERRIDE` en `tiles.ts`, capa Clase-A sin tocar el vendored):
`0x6c-0x6f` WaterStream (byte13=0xcf, los 4 bloquean) + `0x1c` Oasis + `0xc3` campo-muerto →
`walkable=false`. **`0xbc` Fireplace NO se overridea**: era el falso positivo estrella del volcado
corrupto (byte23 `0xff`→canónico `0xf7` = PISABLE; en el U5 real se pisa el hogar). El port bloquea
183 (177 dataset + 6 override), el binario 182 (diferencia = 0x1a deliberado − {0xf9,0xff}).

**EPISODIO — DOCTRINA (la cadena cazó el falso positivo que el estático ya señalaba).** El wire
anterior incluyó `0xbc` (dato corrupto). La cadena `workers=6` respiró en **ch04 Trinsic** (0xbc en
(25,7)) y **ch08 Yew** (0xbc en (8,27)): el Grand Tour cruzaba la party POR el hogar porque el
original lo PISA — el sello calcaba el juego, no un bug. Cuando estático (`0x54e4`), volcado-limpio
del relevo-2 (en castillo) y sellos del tour (empírico) coinciden, el veredicto es total. Doctrina:
(1) la convención de bit se DERIVA del consumidor; (2) parar-y-reportar ante un sello que respira
cazó dos veces — un fixture podrido (#43) y este wire propio.

**Consecuencia del override en COMBATE (Clase-C).** `WALKABLE_OVERRIDE` rige `info.walkable`, que
combate consulta en `combat.ts:754` para el movimiento clase-0 (terrestre): el override bloquea
también el paso a pie en la ARENA sobre agua-stream — **fidelidad esperada** (las arenas con
riachuelos bloquean el paso a pie en el original). El predicado vive en el kernel (`0x2bd4` lee
`0x54d4`) y el port lo unifica en `info.walkable`; sin cita directa `COMBAT.OVL → call 0x2bd4` aún
(los llamadores vistos son intra-kernel) → **Clase-C**. El fixture #43 de `combat.test.ts` usaba
`0x6c` con `walkable=1` (el bug corregido); migrado a lava `0x8f` (walkable-pero-no-landEnemyPassable,
byte-fiel en el canónico).

## Fixtures (para los tests dirigidos)
Los sets A (39), B (67) y C (17+12) se derivan de los bytes de las tres tablas —
`game/tests/los-passability-audit.test.ts` los recomputa y los clava como fixtures + guarda
de regresión de que el viewport (ALWAYS_OPAQUE) sigue siendo `0x6a86` verbatim.

## VEREDICTO DE CIERRE

**El port es FIEL en la separación de tablas LOS-opacidad ↔ pasabilidad.** No hay
conflación: viewport-LOS usa 0x6a86 verbatim, cañón usa su lista literal, pasabilidad usa
su propia tabla, y la LOS de hechizo (0x6a14) simplemente no se alcanza porque sus hechizos
de campo son una aproximación consciente no modelada. El mandato de la auditoría (¿el port
usa UNA tabla para LOS y paso?) queda respondido: **NO**. Quedan 1 backlog de feature y 2
carriles/incógnitas (abajo).

## Pendientes / backlog (el lead los prioriza en el ledger)

1. **[FEATURE, EN-GOAL diferida] Hechizos de campo In *Grav en combate (y overworld).**
   El port no-opea `fieldWall` (combat.ts:1515) y no siembra el `overworldTile` en overworld
   → In Flam/Nox/Zu/Sanct Grav (#14/15/16/20) no hacen nada visible. Un no-op no sobrevive al
   goal de calco 100%. **Andamiaje ya listo y aterrizado**: `magic/areaSpell.ts` +
   `areaSpellTables.ts` (tablas 0x6a14 + curva radial VERBATIM; opacity-stop citado; radial=
   probabilidad citada; geometría 3×3-norte del witness v2) + esqueleto de tests parametrizados.
   Derivación: `cast-line-area-spell-derivation.md`. Al abrir el carril: implementar la siembra
   3×3 + opacity-stop + gate radial en el aplicador de efectos (overworld + combate), fijar los
   2 bits semánticos con el ítem 4d del usuario, gate de cadena completa. **Auditar además** si
   el cast OVERWORLD del port es también no-op (parece que sí — sin handler).

2. **[INCÓGNITA ABIERTA — posible F-0 en código modelado] Vía real de los `lineAoe` cortos.**
   Los hechizos de línea del port SÍ modelados — In Zu (#28), In Nox Hur (#40), In Flam Hur
   (#45), In Vas Grav Corp (#44), `combat.ts::castLineAoe`, len 1-2 — **probablemente NO van por
   0x1c36** (la curva radial de 21 celdas no encaja con len 1-2). Su vía real en el binario está
   SIN derivar, y con ella si el binario les aplica algún corte por opacidad (que `castLineAoe`
   hoy no hace). Es el ÚNICO posible F-0 restante en código MODELADO. **NO cerrar por analogía.**
   Plan de derivación: localizar en `CAST.OVL.asm` el dispatch de los índices de hechizo 28/40/
   44/45 (jump-table `0x0f1a jmp cs:[bx-0x2f3a]`), seguir su handler, y ver si consulta 0x6a14
   / 0x6a86 / ninguna tabla en el trazado de su línea corta.

   **Corrección de spec (boot final del lead) + candidato afinado 2026-07-18.** El aplicador
   de área `CAST.OVL:0x1c36` (frame de 190 bytes = buffer de curva radial) es el consumidor
   de la maquinaria LOS+radial del esqueleto, PERO la siembra de campo overworld 3×3 es
   DETERMINISTA: su gate salta el trazado LOS (no consulta 0x6a14 en el sellado) — así que el
   par LOS-trace + gate-radial pertenece a la vía APUNTADA/de área, no a `fieldWall`. Ojo con
   los offsets: en `0x1c36` el `[bp+6]` es el ÍNDICE DE DIRECCIÓN (`0x1c45 mov si,[bp+6];
   shl si,3; mov al,[si-0x45e6]` → tabla de coords de 8 bytes/dir), y hay un parámetro de MODO
   en `[bp+4]` (`0x1c6d cmp ax,1`) que bifurca el comportamiento. El plan se afina: seguir qué
   hechizos entran a `0x1c36` con qué valor de MODO ([bp+4]) — ése es el discriminante entre la
   siembra determinista y la vía apuntada con corte por opacidad. (El offset "[bp+6]&1" de notas
   previas era relativo al KERNEL, no a CAST.OVL — no reutilizar.) Dato de formato que descarta
   un ruido en la reconciliación: el mapbuf overworld NO empaqueta tiles (DS:0x6608, 32×32,
   1 tile/byte de 8 bits, low-2-bits = frame de animación ciclado por tabla @kernel 0x44b8;
   direccionado por `0x4402: 0x6608 + y·32 + x`; render agrupa frames con `and al,0xfc`). Por
   tanto NO hay codificación `tile>>2` en el buffer de render — el `0x3a-0x3f` del witness es un
   scratch/pre-render, pendiente del volcado CRUDO de oracle-relevo-2 (no cerrar por analogía).

3. **[CARRIL C — pasabilidad] CERRADO en su mayor parte** (ver arriba §Pasabilidad). Re-derivado
   contra la tabla canónica `DATA.OVL @0x54e4` (convención kernel `0x2bd4`, MSB): de las 29
   divergencias originales (volcado corrupto) quedan **3 residuales** — `0x1a` deliberada
   (walk-to-restore) y `0xf9`/`0xff` (sobre-bloqueo del port, ⏳ derivar por-tile sin blind-swap).
   Wire de 6 tiles (`0x6c-0x6f`,`0x1c`,`0xc3`) aterrizado con gate de cadena completa.
