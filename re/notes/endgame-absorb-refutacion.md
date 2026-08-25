# ACTA — El gate de `absorb` (SJOG.OVL 0x1ea4): tres campos leídos al revés, y el discriminador de la celda SÍ está en el código

**Fecha:** 2026-08-11 · **Carril:** hueco-desenlace (ficha #175) · **Sujeto:** el BINARIO.

Refuta la lectura del gate que hoy publican `endgame.md` §Trigger y `endgame-derivation.md`
GAP 1, y con ella la frase que el sitio publica en el hueco 1 de `/verificacion`
(«la condición que lo ata a *esa* celda se buscó y se demostró que no está en el código:
vive en los datos del encuentro»). Esa frase es **falsa**: dos de los tres términos de la
condición son código, y están en el gate que se creyó leído.

Lo que NO cambia: la cadena de disparo del overlay (centinela `0x4d` → teardown → stub
del overlay 13) queda **confirmada**, re-verificada aquí con censo propio. Lo que cambia es
**qué arma el centinela**, y por tanto qué tiene que portar el clon.

---

## 1 · El cuerpo, entero

`SJOG.OVL.asm` 0x1ea4-0x1f25. Corre en el gancho post-movimiento de combate
(`COMBAT.OVL` 0x0b8b, llamador único vía el stub `ULTIMA.EXE` 0x7e66).

```
1eaa: mov al,[g_cmb_actor] ; sub ah,ah ; mov cl,3 ; shl ax,cl
1eb3: add ax,0xba14            ; rec = g_combat_actor_records + 8*g_cmb_actor
1eb9: mov bx,ax
1ebb: cmp  byte [bx+2],0    / je  0x1f22      ; (A)
1ec1: test byte [bx+2],0x20 / jne 0x1f22      ; (B)
1ec7: cmp  byte [bx+7],2    / jne 0x1f22      ; (C)
1ecd: mov bl,[bx+6] ; sub bh,bh               ; (D)
1ed2: mov al,[bx-0x538c]                      ;     = 0xAC74 + bl
1ed6: and al,0xfc ; cmp al,0x3c / jne 0x1f22  ; (E)
--- a partir de aquí, el efecto ---
1edc: mov byte [g_unk_58a0],0x4d              ; EL CENTINELA
1ee1: push 0xa ; call 0x573a                  ; tono
1ee8: push g_cmb_actor ; call 0xffffbe1a      ; imprime el NOMBRE del actor
1ef1: push 0x8f02 ; call 0x58d0               ; " is absorbed!\n"
1ef8: push 0x4b0,0x7d0,1,0x28 ; call 0x842e   ; tono de absorción
1f0b: mov byte [g_active_char],0xff
1f13: mov al,[g_cmb_actor] ; neg ax ; dec ax
1f1b: push ax ; call 0xffffbe02               ; RETIRA del tablero (índice negado)
1f22: mov sp,bp ; pop bp ; ret
```

## 2 · Qué es cada campo, con dos anclas independientes por campo

El registro es `g_combat_actor_records` @0xBA14, 32 registros de 8 B. El ledger
(`re/ledger/globals.json`) ya lo tenía: «+2 flags (bit 0x80 miembro del party, bit 0x20
caído), +3 slot de roster, +4 ranura en 0x5C5A, **+6 X, +7 Y**». **El ledger es el que
aguanta**; las dos notas del endgame lo contradicen sin haberlo careado.

### (C) `[rec+7] == 2` es LA FILA, no un «estado de IA»

- **Ancla 1 — `move_combat_actor` (SJOG 0x1c56).** Los cuatro casos de dirección suman ±1:
  los casos 1 y 2 sobre `[rec+6]`, los casos 3 y 4 sobre `[rec+7]`. El resultado se acota a
  `0..10` en 0x1cbb-0x1cce (rejilla 11×11) y se escribe de vuelta a `[rec+6]`/`[rec+7]`
  (0x1d1f/0x1d2a), espejado a `[0x5C5A + 8·slot + 2]` y `+3`, que la propia `endgame.md`
  §Notación fija como **columna** y **fila**.
- **Ancla 2 — los literales, descodificados de DATA.OVL** (fileoff = DS + 0x10) antes de
  teorizar: caso 3 → 0x8eb8 = `North\n`, caso 4 → 0x8ec0 = `South\n`, caso 2 → 0x8ec8 =
  `East\n`, caso 1 → 0x8ece = `West\n`. Norte y Sur mueven `[rec+7]` ⇒ **`+7` es Y**;
  Este y Oeste mueven `[rec+6]` ⇒ **`+6` es X**.
- **Ancla 3 — COMBAT.OVL 0x0c26-0x0c36**, que es la forma CANÓNICA de leer el tile bajo un
  combatiente: `bx = [si+7] << 5` (×32) `+ [si+6]`, indexado sobre `[bx-0x52ec]` = **0xAD14
  = g_cbt_room_record, cuyo stride es 32**. Fila×32 + columna, sin ambigüedad.

⇒ **`cmp [rec+7],2` es una condición de POSICIÓN: el actor está en la fila 2.**

### (B) `[rec+2] & 0x20` es CAÍDO, no «es enemigo»

`COMBAT.OVL` 0x0c0a hace `or byte [si+2],0x20` justo después de dar por muerto al actor, y
0x0bef lo usa para SALTARLO en el barrido. El bit de bando es el **0x80** (0x0bf6
`test al,0x80` = miembro del party). ⇒ el gate **no filtra por bando**: no dice «sombra»
por ningún lado.

### (D)+(E) No hay «tabla de atributos de tile»: es la ventana de vista, y el índice es la COLUMNA

`[bx-0x538c]` = **0xAC74 = `g_vis_tile_window` + 16** (ledger: 11 filas, stride 16, base
0xAC64). Con el índice = columna del actor (0..10) la lectura barre exactamente
0xAC74..0xAC7E = **la fila 1 completa**, sin desbordar al relleno: es «el tile pintado en
(fila 1, MI columna)». Una tabla de 256 atributos ahí es imposible — ese espacio son los
tres búferes de vista consecutivos (0xAB02 / 0xAC64 / 0xAD14).

El valor comparado sí es la sombra, y en eso la lectura vieja acertaba **por la conclusión,
no por el camino**: los búferes guardan el tile en un BYTE y los actores se pintan
`| 0x100`, así que `& 0xfc == 0x3c` selecciona los cuatro fotogramas de
`look2[0x13c..0x13f]` = **«a trapped soul!»**. Controles del mismo índice, para que nadie
tenga que fiarse: `look2[0x44]` = `cobble`, `look2[0xdc]` = `a moon gate!`,
`look2[0x108]` = `a gem` (el orbe de GAP 4).

**Cabo de censo (menor, para quien mantenga la ficha de 0xAC64):** los cuatro escritores y
los tres lectores que el ledger enumera para ese búfer usan el desplazamiento −0x539c.
**Este lector usa −0x538c** (la base +16) y por eso no aparece en su censo. La ausencia era
del patrón, no del lector.

## 3 · La regla, que es la CONTRARIA de la publicada

El absorbido es **el actor que acaba de moverse**: el mismo `g_cmb_actor` que pasa el gate
es el que da nombre al mensaje (0x1ee8) y el que se retira del tablero (0x1f13-0x1f1c).
Sujeto y víctima son el mismo registro. La lectura vieja tomó el gate por una descripción
del ATACANTE y de ahí salió «una sombra absorbe a un miembro del grupo».

> **Quien pisa la fila 2 teniendo un alma atrapada justo al norte, en su misma columna, es
> absorbido.** Estando activo y no caído. El bando no se comprueba.

De las tres condiciones, **dos son código** (fila 2 · adyacencia norte con tile de alma
atrapada) y **una es dato** (dónde están plantadas las almas, o sea la fila 1 del mapa de la
celda de Lord British). La frase publicada «no está en el código» describe la tercera y se
la aplica a las tres.

**Corolario que ya no necesita hipótesis:** el testigo-3 (`endgame-witness-20260721.md`)
mostraba sombras de PASILLO en Doom N1 que pelean como monstruos normales y no absorben. No
les falta un gate: en un pasillo **no se da la geometría**. Se buscó durante días un
discriminador «adicional» porque el gate que lo contenía se estaba leyendo mal.

## 4 · La cadena de disparo, re-verificada (sin cambios)

Censo propio de las **13** referencias a `g_unk_58a0` en los 28 `.asm`:

| sitio | qué hace |
|---|---|
| **SJOG 0x1edc** | **escribe 0x4d — ÚNICO** |
| DUNGEON 0x00cb · SJOG 0x2046 | `cmp …,0x4d` → stub del overlay 13 (`endgame_main`) |
| COMBAT 0x0ba1 · DUNGEON 0x00ad · DUNGEON 0x0c39 · ULTIMA.EXE 0x6be3 | ceros / reset |
| SJOG 0x1be2 (escribe `al`) · SJOG 0x1bd8 · SJOG 0x1bfa · DNGLOOK 0x0fda · DUNGEON 0x1db8 (`cmp 5`) · DUNGEON 0x1dec (`cmp 6`) | el uso MULTIPLEXADO del mismo byte, ajeno al endgame |

⇒ `absorb` arma el centinela → el teardown del combate lo ve → carga ENDGAME.OVL. Intacto.

## 5 · El port

`game/src/core/game.ts:5336` — `if (ds.pos.floor === 7 && endgameReady(this.state) &&
!this.state.questFlags["game-won"])`. Ni celda, ni combate, ni almas atrapadas, ni
centinela. La tarjeta del hueco acierta en que el port arranca con otra regla; se equivoca
en cuál es la del binario y en dónde vive.

🔴 **Aviso a quien porte esto:** el gate no comprueba el bando, y el efecto es
«retirar del tablero + armar el centinela del FINAL DEL JUEGO». Un `absorb` portado sin las
DOS condiciones de posición dispara el desenlace en cualquier combate donde haya un alma
atrapada. Las dos condiciones son la mitad del mecanismo, no un detalle.

## 6 · Qué queda abierto, dicho con su nombre

- **Los datos de la celda de LB no se han leído en este acta.** Que las almas estén en la
  fila 1 del mapa de esa celda es lo que la regla EXIGE para que el final sea alcanzable, y
  es coherente con el testigo, pero **no lo he medido**: falta abrir el mapa de la celda
  (MISCMAPS.DAT / el `cm` del encuentro) y censar la fila 1. Hasta entonces es predicción,
  no medición.
- **Por qué la fila 2 y no la fila del actor.** El gate fija la fila 2 como constante y lee
  la fila 1 como constante; no calcula «la celda al norte de donde yo esté». Con la
  geometría de la celda de LB eso da lo mismo, pero **son dos cosas distintas** y lo
  transcrito es lo primero. Quien lo porte calca la constante, no la generalización.
