# ENDGAME.OVL + FLAMES.OVL — secuencia final (Task 3.12)

## ENDGAME.OVL (overlay #9, 2800 B / 0xAF0, load_seg 0x0a29)

8 funciones (prólogos verificados) + 2 bytes de ceros. Catálogo
`re/tools/endgame_catalog.py` (ledger 100%, 9 segmentos, 0 huecos). Las tablas de
palabras-número (0x3e0a cardinales, 0x3e40 ordinales) y las strings del pergamino
viven en DATA.OVL (`fileoff = DS + 0x10`).

| off | nombre | qué hace |
|---|---|---|
| 0x0000 | endgame_throne_scene | escena del trono: sprites del party (0x5c5a), texto vía FONT, tonos, 6 filas |
| 0x023a | text_accum_char | acumulador word-wrap (buffer 0xbcb2, contador 0xbcda; flush en \n o ≥0x27) |
| 0x028c | spell_cardinal | deletrea nº en inglés (words 0x3e0a; decenas 0x3e2e; idiv 10) |
| 0x02d6 | spell_ordinal | ordinal/fecha (first..twelfth 0x3e40; <0x14 → cardinal+"th") |
| 0x0326 | endgame_datestamp | pergamino de cierre + **PLAYTIME** (§Playtime) |
| 0x0510 | move_sprite_toward | avanza un sprite de la cutscene 1 tile hacia el objetivo. 🔴 **firma `(Y, X, slot)`** — ver §Notación |
| 0x05a2 | wander_sprite | random-walk de un actor (rand gate + rand dir 0..3). **RNG** |
| 0x0648 | endgame_main | ENTRY: init, Y/N gateado por g_wooden_box, rama buena vs alterna |

### 🔴 Notación de `move_sprite_toward` (0x0510): los argumentos van **(Y, X, slot)**

Quien la lea como `(x, y, slot)` **invierte la escena entera** — misma familia de trampa que
el `(max, min)` de `rand_range`. Medido en el cuerpo: `rec = 0x5c5a + 8·slot`; `[bp+6]` se
compara contra `rec[2]` (0x053d) y `[bp+4]` contra `rec[3]` (0x0545). Y `rec[2]` es la
**columna** y `rec[3]` la **fila**.

**EL ANCLA QUE LO FIJA A OJO, sin fiarse de la derivación:** el tile de moongate `0xDC` se
escribe en `byte[0xAD99]` (0x0992). El mapa de la escena vive en `DS 0xAD14` con paso `0x20`
(11 filas × 0x20 = 0x160). Entonces:

```
0xAD99 − 0xAD14 = 0x85 = 133      133 ÷ 32 = 4  resto 5      ⇒  fila 4, columna 5
```

…y **(4, 5) es exactamente el par `([bp+4]=4, [bp+6]=5)`** al que caminan el Avatar
(0x08d3), Lord British (0x09b5) y cada miembro del party (0x09f0), la celda donde se planta
el sprite del sacrificio (slot 6 = `0x5c8a`, tile 0x0E, `rec[2]=5`/`rec[3]=4` en
0x0908/0x090d) y donde se hace `blit_tile(0x44, 5, 4)` (0x0a39). Una división entre 32 que
cualquiera repite a mano vale más que la derivación, porque sobrevive a que alguien dude de
los números.

Posiciones iniciales: **LB en el slot 31** (`0x5D52` = 0x5c5a + 248), tile `0x7C`, en
(x=5, y=8) → sube a (5,3); los miembros en el slot `i`, tile
`byte[0x1ade + strchr_index(clase, DS 0x84a4)]`, en (x=5, y=9).

### Playtime (endgame_datestamp @0x0407 — VERIFICADO byte-a-byte)

```
years  = g_year  - 0x8b (139)
months = g_month - 4
days   = g_day   - 5
if days   < 0: days   += 0x1c (28); months--     ; mes de 28 días
if months < 0: months += 0x0d (13); years--      ; año de 13 meses
```

Fecha de inicio fija = **Año 139, Mes 4, Día 5**; calendario britanniano 13×28.

Informe (0x0444–0x04ef, strings volcadas de DATA.OVL):
`"Report now, thy Quest compleat in\n" <Y>" year"["s"][", "]<M>" month"["s"][", "]
<D>" day"["s"]"\nto Lord British at Origin Systems!"`. Cada unidad sólo si ≠0;
"s" si >1; ", " antes de la siguiente unidad no nula. Tras imprimir hay un bucle
infinito (0x04f9) = pantalla "The End" (se reinicia).

Pergamino (strings): `Be it known that on / the <ordinal(day)> Day of / the
<ordinal(month)> Month / of the Year / <cardinal(year/100)> Hundred /
<cardinal(year%100)> / the Avatar / saved the life / of our sovereign / Lord
British, thereby / saving our people / and our land. / THE QUEST OF THE AVATAR IS
FOREVER` (bytes crudos "[E@QUE_@OF@[E@AVATAR / IS@FOREVER" en la fuente cinemática).

### Rama del final (endgame_main @0x08b9)

`answer == 'Y' (0x59) ∧ g_wooden_box (DS 0x57BF) != 0` → rama "buena": sacrificio
animado (tonos 40000/5000, 50000/10000) + `endgame_throne_scene` +
`endgame_datestamp`. El texto exacto del prompt Y/N y la narrativa de la caja quedan
⚠️ (necesitan traza en vivo).

🔴 **`g_wooden_box` es `DS 0x57BF`.** Esta línea decía `0xbf57`, que son **los dos bytes
del `disp16` en orden de fichero** (`80 3e bf 57 00`) leídos como si fueran la dirección.
La canónica está en `re/ledger/globals.json` y en `content-audit.md`. Corregido 2026-08-07;
lo mismo estaba en `endgame-derivation.md:27`.

🔴 **«Secuencia alterna CORTA» es cierto en BYTES y engañoso en TIEMPO — LA RAMA ALTERNA
NO RETORNA NUNCA** (medido al leer el cuerpo entero, 2026-08-07). Son 0x70 B, sí; pero
terminan en `0x0AC9-0x0AE5`: `wander_sprite(1); wander_sprite(3); wander_sprite(4);
wander_sprite(5); jmp 0xac9` — **bucle incondicional sin salida**, y `wander_sprite`
(0x05a2) cierra con `ret 2` normal, o sea no hay escape no-local. El **único `ret` de
`endgame_main`** (0x0AED) se alcanza **sólo** desde `0x0A73 jmp 0xae8`, final de la rama de
sacrificio. ⇒ negarse al sacrificio, o llegar sin la caja, deja el juego animando para
siempre: hay que reiniciar. Se nombran las dos magnitudes porque una sola desinforma: **0x70
bytes de código, duración infinita.**

### Trigger — ✅ DERIVADO byte a byte (era ⚠️ LOW; cerrado 2026-08-04, carril endgame-cierre)

**El endgame NO se dispara por «planta 7 + regalías». Se dispara porque un miembro del
party fue ABSORBIDO.** La cadena completa, con censo exhaustivo y negativo
comprobado en los tres eslabones:

🔴 **CORREGIDO 2026-08-11 (`endgame-absorb-refutacion.md`): «una SOMBRA absorbió a un
miembro» invierte el sujeto.** `absorb` corre sobre el actor que ACABA DE MOVERSE y absorbe
a ESE actor — el mismo `g_cmb_actor` pasa el gate, da nombre al mensaje y se retira del
tablero. No es el ataque de la sombra: es lo que le pasa a quien pisa la fila 2 teniendo un
alma atrapada al norte. La cadena de disparo de abajo (centinela → teardown → overlay 13)
queda INTACTA y re-verificada; lo que cambia es el gate, §3 más abajo.

**1 · El stub que carga el overlay (lo que antes «no se resolvía»).**
Cierto que ENDGAME.OVL no está en el dispatcher: entra por un stub PLINK del RESIDENTE,
y ese stub sí se resuelve. Vive en el residente, CS **0x7c4a** — o sea
`ULTIMA.EXE fileoff 0x844a`, con el header de 0x800 bytes del .EXE ya descontado:

```
9a ec02 2e07   lcall 0x72e:0x2ec      ; cargador PLINK
0d 00          <word inline> = 13     ; overlay #13 = ENDGAME.OVL (tabla canónica)
ea d8a8 0000   ljmp <reloc>:0xa8d8    ; 0xa8d8 − near_call_base(ENDGAME) 0xa290 = 0x0648
```

⇒ salta a **`endgame_main` 0x0648**. Barrido de los **164 stubs PLINK** del EXE (firma
`9a ec02 2e07` + word + `ea`): **hay UN SOLO stub de overlay 13**. Una única puerta de
entrada al endgame en todo el binario, y es ésta.

**2 · Quién llama al stub — DOS sitios, ambos con el mismo gate.**
Censo con el sesgo near-call por banda sobre los 28 `.asm`
(`printed = (0x7c4a − near_call_base) & 0xFFFF`, formas `call` y `jmp`):

| overlay | sitio | gate inmediatamente antes |
|---|---|---|
| DUNGEON.OVL | `0x00d2 call 0xfffffa7a` → (0x81d0+0xfa7a)&0xffff = 0x7c4a | `0x00cb cmp [g_unk_58a0],0x4d; jne 0xd5` |
| SJOG.OVL | `0x204d call 0xffffbcca` → (0xbf80+0xbcca)&0xffff = 0x7c4a | `0x2046 cmp [g_unk_58a0],0x4d; jne 0x2050` |

Ningún otro: bandas 1/2/3/4 e INTRO en negativo, y cero `call 0x7c4a` residente.
`SJOG 0x203e` es la rutina que restaura los 0x20 slots de la tabla de actores 0x5c5a
desde 0xa9fc (salida de combate): **lo PRIMERO que hace, antes de restaurar nada, es
mirar el centinela**. `DUNGEON 0x00cb` es la vuelta de la sala: la misma rutina había
puesto el centinela a **0** en `0x00ad` (`mov [g_unk_58a0],ah` con `ah=0` desde `0x0087`)
justo antes de entrar por el stub 0x7c3e, y al volver lo comprueba.

**3 · Quién escribe 0x4d — UN SOLO sitio en todo el binario.**
`SJOG.OVL 0x1edc`, dentro de la rutina **`absorb` 0x1ea4**. Todas las demás escrituras a
`g_unk_58a0` son ceros/reset (DUNGEON 0x00ad, DUNGEON 0x0c39, COMBAT 0x0ba1,
ULTIMA.EXE 0x6be3) o el índice de borde de huida (SJOG 0x1be2, `al` = `[bp+4]`).
0x4d no es un valor que el flujo normal pueda producir: es un centinela dedicado.

⇒ **`absorb` arma el centinela → al salir del combate el teardown lo ve → carga
ENDGAME.OVL → `endgame_main`.**

**Corolario: cierra el pendiente «todos absorbidos → ¿qué?»** de
`endgame-derivation.md` §GAP 1 (3). No hace falta un contador de absorbidos ni un
`cmp party_size,0`: el combate termina por su vía NORMAL (el tablero se queda sin
actores del bando jugador porque el absorb los ha ido retirando con índice negado), y
el centinela DESVÍA esa salida al endgame en vez de devolver al bucle de mazmorra.

**Cómo se invoca `absorb` (censo del tercer eslabón).**
`SJOG 0x1ea4` tiene su propio stub PLINK: `ULTIMA.EXE` CS **0x7e66** (overlay 14,
`ljmp_off` 0xde24 = 0xbf80+0x1ea4). Llamadores del stub: **UNO SOLO** —
**`COMBAT.OVL 0x0b8b`** (`call 0xffffdbd6` → (0xa290+0xdbd6)&0xffff = 0x7e66), el gancho
post-movimiento del combatiente. Su gate local es genérico y NO menciona sombras:

```
0b79: cmp byte [bp-6],0x30 ; jb 0xb85
0b7f: cmp byte [bp-6],0x36 ; jbe 0xb8e     ; en [0x30,0x36] SALTA el gancho entero
0b85: call 0xffffda86 (→SJOG 0x2012) ; call 0xffffb680 (→residente 0x5910 tick) ; call 0xffffdbd6 (→absorb)
```

⇒ el gancho corre para CUALQUIER combatiente fuera de ese rango; la discriminación la
hace `0x1ea4` con su gate propio.

🔴 **EL GATE, CORREGIDO 2026-08-11 — la versión anterior leía MAL tres de sus cuatro
términos.** Decía «activo `[ptr+2]≠0` ∧ enemigo `!([ptr+2]&0x20)` ∧ `[ptr+7]==2` (AI/estado)
∧ `(tile_attr[sprite]&0xfc)==0x3c`». Lo que el cuerpo dice (derivación entera, con tres
anclas por campo, en `endgame-absorb-refutacion.md`):

| término | lectura VIEJA | lo que ES |
|---|---|---|
| `[rec+2]≠0` | activo | activo ✓ (única que aguanta) |
| `!([rec+2]&0x20)` | «es ENEMIGO» | **no está CAÍDO**. El bit de bando es el 0x80 (COMBAT.OVL 0x0bf6); el 0x20 lo pone COMBAT.OVL 0x0c0a al morir. **El gate NO filtra por bando** |
| `[rec+7]==2` | «AI/estado == 2» | **la FILA es 2.** `move_combat_actor` (SJOG 0x1c56) le suma ±1 en los casos North/South —literales de DATA.OVL descodificados— y lo acota a 0..10; COMBAT.OVL 0x0c26 hace `[si+7]<<5 + [si+6]` sobre `g_cbt_room_record` (stride 32). El ledger ya decía «+6 X, +7 Y» |
| `tile_attr[sprite]&0xfc==0x3c` | tabla de atributos indexada por sprite | **`[0xAC74 + rec.X]` = `g_vis_tile_window` FILA 1, MI COLUMNA.** No hay tabla de atributos ahí (ese espacio son los tres búferes de vista). El valor sí es la sombra: `look2[0x13c..0x13f]` = «a trapped soul!» (los actores se pintan `\| 0x100`) |

⇒ **la regla es «quien pisa la fila 2 con un alma atrapada justo al norte, en su misma
columna, es absorbido»** — dos condiciones de POSICIÓN que estaban en el código todo el
tiempo.

🔴 **CERRADO 2026-08-11 — y el párrafo que había aquí concluía lo contrario.** Decía: «por
eliminación, el discriminador vive en los DATOS del encuentro …, no en código», sobre la
premisa «su gate está leído entero». **El gate NO estaba leído entero: estaba leído mal**
(tabla de arriba). El discriminador que se buscaba **sí está en el código** — son las dos
condiciones de posición: `[rec+7]==2` (fila 2) y el alma atrapada en `(fila 1, mi columna)`.

El testigo-3 (`endgame-witness-20260721.md`) queda EXPLICADO sin hipótesis: las sombras de
PASILLO de Doom N1 no absorben porque **en un pasillo no se da la geometría**, no porque
les falte un gate. Se buscó un «gate adicional» durante días porque el gate que lo contenía
se estaba leyendo al revés.

**Lo que SÍ sigue abierto, dicho estrecho:** que las almas estén plantadas en la fila 1 del
mapa de la celda de LB es lo que la regla EXIGE para que el final sea alcanzable, y encaja
con el testigo, pero **no se ha medido**: falta abrir el mapa de la celda y censar su fila
1. Hasta entonces es predicción. Eso sí lo cierra el `cm` real (pendiente (a) de
`endgame-derivation.md` §GAP 1) o un oráculo.

**✅ FIDELIDAD DEL PORT — CERRADO 2026-08-19 (#179, carril fix-179).** El párrafo que
había aquí nombraba el hueco: `checkDoomRescue` disparaba con `floor === 7 &&
endgameReady`. Ya no: la cadena entera está portada (`Combat.maybeAbsorb` = gate +
efecto de SJOG 0x1ea4 en la cola del turno de miembro; `absorptionSentinel` = 0x4d;
`endCombat` desvía ANTES de restaurar nada = DUNGEON 0x00cb/SJOG 0x2046;
`fireAbsorptionEndgame` = el stub del overlay 13) y `checkDoomRescue` sólo marca
`in-doom`. La derivación que faltaba (call-site del absorb, fin por tablero vacío, el
cm real de la celda con su ÚNICA alma en (5,1)) está en
`re/notes/absorcion-179-acta.md`. Cabo que sigue abierto ahí (§6): las «~5 siluetas»
y el «LB sentado» del testigo-1 no existen en el dato ni en el sembrador — pendiente
de re-ver el vídeo (MacBook) u oráculo vivo.

🔴 **El aviso de portado, reformulado 2026-08-11.** Antes decía «no portar `absorb` sin
cerrar antes el pendiente de arriba». El pendiente ya está cerrado y el aviso sigue en pie
por otra razón, más concreta: **el gate no comprueba el bando y su efecto arma el centinela
del FINAL DEL JUEGO**. Quien porte `absorb` sin las DOS condiciones de posición (fila 2 ∧
alma atrapada en la fila 1 de la misma columna) dispara el desenlace en cualquier combate
donde haya un alma atrapada. Las dos condiciones son la mitad del mecanismo, no un detalle
de afinado.

## FLAMES.OVL (overlay #10, 32 B)

**Sin lógica de juego**: sólo el trampolín de enlace PLINK86 (`push bp..ret` +
`pop ax/push ax/ret` @0xe) y 15 bytes de ceros. La animación de llamas (título/
Codex/santuarios) la mueven data de tiles + el animador del kernel/FONT, no este
overlay. Catálogo `re/tools/flames_catalog.py` (code thunk 17 B + inert 15 B).

## Divergencias con el clon (cerradas)

- El clon no tenía informe de playtime ni rama de la caja (⚠️ "endgame
  simplificado"). `game/src/core/quest/endgame.ts` añade `endgamePlaytime` +
  `formatQuestReport` (exactos) y `questScroll`; `rescueLordBritish` los engancha y
  ramifica por `state.specialItems.woodenBox`.
