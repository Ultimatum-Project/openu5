# La nave del pirata se queda al vencerlo — #35, portada

**Sujeto:** el binario (`SJOG.OVL` `consume_victory_transform`, `MAINOUT.OVL` `world_turn`) y su clon.
**Fecha:** 2026-08-06 · **Carril:** bugs-original.
**Método:** los tres «sin medir» de `asm100-censo-acta` §83.4 resueltos ANTES de escribir código,
y dos de ellos refutaron premisas del diseño. Lo que sigue es lo medido, con su grado.

---

## 1. La rama de victoria, leída entera

`SJOG.OVL 0x2078-0x20c3`:

| dirección | instrucción | lectura |
|---|---|---|
| `0x2078` | `cmp word ptr [bp+4], 0x20` / `jge` | guarda de un solo filo (sólo por arriba) |
| `0x208b` | `cmp [g_cmb_victory_flag], 0` / `je` | **sin victoria → rama de borrado** |
| `0x2094` | `mov al,[bx]` · `and al,0xfc` · `cmp al,0x2c` / `jne` | ¿tile de nave NPC? |
| `0x209c` | `sub byte ptr [bx], 8` | 0x2c..0x2f → **0x24..0x27**, rumbo dentro de los 2 bits bajos |
| `0x209f` | `sub byte ptr [bx+1], 8` | el segundo tile, igual |
| `0x20a3` | `mov byte ptr [bx+5], 0x63` | **casco 99** |
| `0x20a7` | `mov byte ptr [bx+7], 2` | **2 esquifes** |
| `0x20ab` | `jmp 0x20c3` | **no borra el registro** |
| `0x20ae` | cinco `mov` a cero sobre +4..+0 | la otra rama borra **5 de 8 bytes**: casco y esquifes quedan RANCIOS |

## 2. 🔴 El gancho que el diseño proponía era el equivocado

§83.3 decía «al terminar el combate con victoria, en lugar de `removeEnemy` a secas…». Censados
los tres `removeEnemy` del clon: `game.ts:2282` es el **remolino**, `:4431` es la **andanada**
(hundir a cañonazos, sin entrar en combate) y `:6145` es la **ENTRADA** a combate. **Ninguno es
la victoria.** El de `6145` retira al enemigo **cuando el combate empieza**, así que colgar ahí
la transformación habría hecho aparecer la nave-premio **al empezar** el combate.

`endCombat` tampoco vale: su propio comentario documenta que **la victoria no cierra el combate**
—sólo corre al vaciarse el bando party— con la medición 2/7 de Hythloth detrás.

El gancho correcto ya existía: **`onVictoryLatch`**, que es lo que usa la sala de mazmorra
**por esta misma razón**.

## 3. La frontera de tablas NO puede mover el stream — probado por las dos mitades

§83.4 avisaba de que conservar la ranura era necesario porque el orden de ranuras gobierna el
consumo de RNG. Medido:

- **Lado del binario.** El bucle de turno (`MAINOUT.OVL 0x1ab6`) filtra antes de mover:
  `mov al,[di]` / `push` / `call 0x105c` / `or ax,ax` / `je` — y `is_npc_ship_tile` (`0x105c`,
  cuerpo leído) devuelve **1** en `0x2c-0x2f`, **0** por debajo de `0x80`, **0** en `0xb4-0xb7`
  y `0xe8-0xeb`, **1** en el resto `≥0x80`. Los tiles de la nave transformada son `0x24-0x27`
  ⇒ **el predicado da 0 y el bucle la SALTA**: ni movimiento ni tirada. El segundo bucle
  (`0x1ae0`) usa el mismo filtro. La ranura queda ocupada pero **inerte**.
- **Lado del clon.** El turno itera por **slot descendente** (`world/enemies.ts`, `bySlotDesc`),
  no por posición en el array ⇒ retirar una entrada **no altera el orden de las demás**.

**Mismo consumo y mismo orden ⇒ liberar el slot es fiel y no puede mover el stream.**

⚠ `0x1ab6` **no es una rutina**: es un tramo interior de `world_turn` (`MAINOUT.OVL 0x1a60`,
222 B). Quien la busque por ese offset en el ledger no la encuentra — a mí me pasó.

## 4. El rumbo: Clase C, y por una carencia NUESTRA

El binario **sí conserva el rumbo**, por aritmética: la resta de 8 no toca los dos bits bajos.
El clon no puede replicarlo porque su pirata lleva **un solo tile** (`PIRATE_ENEMY_TILE`), así
que fijamos proa al norte (`0x24`). **No es que el original pierda el rumbo: es que nosotros no
tenemos de dónde sacarlo.**

Es la **misma carencia** que la precondición medida el 30-07 sobre `npcShipMoves`
(`transport.ts`): con un tile constante, `facing` sale 256 y aquel cableado saldría **verde sin
arreglar nada**. Quien porte los cuatro tiles del pirata cierra **las dos** de una vez; leídas
por separado parecen dos fichas distintas.

## 5. 🔴 Una conclusión FALSA que el propio port publicaba

`transport.ts` documentaba `PIRATE_SHIP_HULL = 0x64` con su cita correcta (`MAINOUT 0x1050`) y
añadía: *«una nave pirata capturada excede el tope del jugador»*. **Es falso.** `0x20a3` es un
`mov` **incondicional** de 99: el 100 se pisa al capturar. Los 100 son el casco **mientras sigue
siendo pirata**; la capturada sale **exactamente en 99** y nunca excede.

Era una consecuencia inventada al lado de una premisa correcta, y sobrevivía **porque el clon no
modelaba la captura** — no había con qué desmentirla. Corregida con la cita pegada, y es la razón
de que el fix use `HULL_MAX` y no `PIRATE_SHIP_HULL`.

## 6. La andanada NO transforma — dos vías independientes

Censo de `g_cmb_victory_flag` (`0x58a3`) en todo el disasm: COMBAT.OVL lo escribe, CAST/CMDS/COMBAT
lo leen, y **MAINOUT no aparece ni una vez**. La andanada vive en MAINOUT. Y la transformación
está **gateada por ese flag** (`0x208b`). ⇒ El hundimiento por cañón **no puede alcanzarla, por
construcción**. El hundido desaparece, sin nave.

## 7. Grados

- **MEDIDO**: los cuerpos de `0x2078-0x20c3`, `0x1ab6` (tramo), `0x105c`, el censo del flag de
  victoria, y el `bySlotDesc` del clon.
- **MEDIDO**: que la cadena **no consume RNG** — no hay `rand` en ninguna de las rutinas leídas.
- **DECLARADO Clase C**: el rumbo fijo (`0x24`), por carencia de tiles en el clon.
- **NO REPLICADO, anotado**: la rama sin victoria deja casco y esquifes rancios en la ranura.
  El clon no tiene tabla nativa que ensuciar.
- **NO MEDIDO**: si algún recorrido del arnés llega a vencer a un pirata. El fix es inerte hasta
  que eso ocurra.

## 8. La ventana de sellos, y dos cosas que conviene que estén escritas

**Veredicto: los CINCO sellos intactos, `EXIT_SELLOS=0`, anclado a `2a1a3c1d`** (reports con
`dirty=false`). Tres bandas cuadrando fila a fila — `ad06-g34` 220/220/220 · `ad09-g04` −274 ·
`ad21-g26` −1024 · `part04-g03` 36 · `part05-g05` −954. Ningún EXIT 5: la rotura conocida de
`ad06-g34` **no** hizo falta invocarla.

### 8.1 🔴 El `matched` NO es comparable entre corridas separadas por aterrizajes

Durante esta ventana se observó que el `matched` había bajado −2 en ad06 y −1 en ad21 respecto
a la corrida anterior, y se pidió explicarlo. **La explicación es que la comparación no era
válida**: entre las dos corridas `game/` cambió en **18 ficheros, de los que sólo 4 eran del
fix**. Entre los otros 14 iban **el arnés del espejo en persona** (`espejo-tour/runner.ts`, el
spec, `desfase-derivador.json`, `tools/derive-dungeon-ops.mjs`), **dos rutas del propio corpus
AD** (`ad11`, `ad20`) y **`world/loops/spawn.ts`** — un fix que mueve el stream por diseño.

**La regla, para quien mida después:** el arnés del espejo y las rutas del corpus **viajan dentro
de `game/`**, así que dos corridas separadas por cualquier aterrizaje pueden mover el `matched`
sin que ningún fix del port lo haya tocado. **Citar «el matched subió/bajó» sin un par aislado
—misma base, un solo delta— es una cifra sin sujeto.** El `matched` no es criterio de sello: los
sellos son cinco valores concretos con su aserto, y ésos son los que deciden.

Corolario que además explica la excepción que desconcertaba: un corpus con saludos sorteados
(part05) **no se movió** mientras otros sí. No es que la lotería del pool fallara como
explicación — es que **el movimiento no venía de los saludos**, sino de los cambios del arnés y
las rutas, que tocan AD y no LP1.

### 8.2 El descarte de «lo movió el fix» es un ARGUMENTO DE CONSTRUCCIÓN, no un dato

Que el fix no pueda haber movido nada se sostiene en que `piratePrizeShip` **sólo se ejecuta al
vencer a un pirata** — si eso no ocurre en el recorrido, no se llama ni una vez. Es correcto y
es fuerte, **pero es una deducción sobre el código, no una medición**. Queda con esa etiqueta a
propósito.

El dato que lo cerraría es el par aislado: **la misma base con y sin los tres ficheros del fix**,
comparando ad06 y ad21. No se corrió porque la pregunta que lo motivaba se disolvió al retirarse
la comparación inválida. Si alguna vez interesa, ése es el experimento y no otro.
