# ACTA rng-104 — el «helper sin rand» era la compuerta de terreno de los actores

Tarea #104. Carril `rng-104`, rama `re/rng-104`. Fecha 2026-07-28. CERO e2e (mutex ocupado).

**VEREDICTO EN UNA LÍNEA:** la clasificación «Helpers (sin rand)» de
`overworld-ai-rng.md` era FALSA y la cifra de la tarjeta (1 tirada en 13 de 28 tiles) queda
**CONFIRMADA byte a byte**; el frenado por terreno de la PARTY que vio el usuario ya está
portado y correcto, pero su **gemelo de los ACTORES no existe en el port** — ni la tirada
ni el efecto.

---

## 1. Qué se derivó (MAINOUT 0x1578, cuerpo entero)

Firma `(idx, dx, dy)`, `ret 6`, sin valor de retorno. Escribe x,y del actor en la tabla de
actores. **Dos vías de escape antes de cualquier tirada**: la familia pirata
(`base & 0xfc == 0x2c`, que de paso fija el sprite de rumbo por (dx,dy)) y las bases
`0xdc`, `0x94`, `0xd8`, `0xf0`. Después lee el tile de DESTINO con el localizador de tile
del kernel y, si `t - 4` supera 0x1b sin signo, commit libre. Si no cae en una **tabla de
saltos de 28 entradas** (`t` = 0x04..0x1F).

**La tabla, decodificada por programa** (no a ojo) desde los bytes del listado, con el
sesgo de overlay 0x81D0 aplicado a cada word:

| destino | entradas | qué hace | probabilidad de pasar | tiles |
|---|---|---|---|---|
| 0x1656 | **6** | `rand_range(0,1)`, mueve si **≠0** | **1/2** exacta | 0x04, 0x06, 0x07, 0x08, 0x1E, 0x1F |
| 0x1668 | **7** | `rand_range(0,2)`, mueve si **==2** | **1/3** (10922/32768) | 0x09 … 0x0F |
| 0x16b2 | **15** | commit directo | 1 | 0x05, 0x10 … 0x1D |

6 + 7 = **13 de 28 CONSUMEN UNA TIRADA**. La hipótesis de la tarjeta se confirma con los
tres números exactos (6 / 7 / 15) y con la lista nominal de tiles.

Orden de argumentos verificado contra `rng.md`: el generador toma `[bp+6]` = lo = PRIMER
push y `[bp+4]` = hi = SEGUNDO push, ambos inclusive. En 0x1656 los pushes son 0 y 1; en
0x1668, 0 y 2. Como el valor se enmascara a 15 bits, el 1/2 es exacto (32768 par) y el 1/3
tiene el sesgo de módulo habitual, despreciable.

**Lo que la tirada perdedora hace — y por qué es invisible al que llama:** la rama de
fracaso salta a 0x16f4, que es el MISMO epílogo que la rama de commit, y la rutina no
devuelve nada. Es decir: **el actor no se mueve, la tirada ya está gastada, y ni el chase
ni la deriva pueden enterarse**. No hay reintento, ni segundo eje, ni fallback. Ésa es
exactamente la mecánica de «terreno que frena», escondida bajo un nombre de ejecutor.

**Alcance real — el ejecutor es SÓLO de actores y la party nunca pasa por ahí:** dos
call-sites, MAINOUT 0x1776 (EN la deriva ortogonal) y MAINOUT 0x192a (EN el chase), y
**cero referencias indirectas** — busqué su dirección sesgada como word en toda la imagen del overlay: 0
ocurrencias. La party se frena por otra vía (§2).

## 2. El hallazgo estructural: UN mapa de tiles, DOS consumidores

El clasificador de terreno de la party (MAINOUT 0x03e0) reparte el tile bajo la party en
clase 0/1/2 así: **primero** descarta el tile 5 a clase 0; luego 0x1E/0x1F → clase 1;
luego `< 4` o `>= 0x10` → clase 0; luego `< 9` → clase 1; resto → clase 2.

⇒ clase 1 = {0x04, 0x06, 0x07, 0x08, 0x1E, 0x1F} · clase 2 = {0x09..0x0F}.

**Es la MISMA partición que la tabla de saltos de los actores, incluido el hueco del tile
5.** Un solo mapa tile→clase con dos consumidores que cobran en monedas distintas:

| clase | la PARTY paga | el ACTOR paga |
|---|---|---|
| 1 | +2 min y **1** turno extra de mundo, mensaje `Slow progress!` | **1/2** de no moverse |
| 2 | +4 min y **2** turnos extra de mundo, mensaje `Very slow!` | **1/3** de moverse |

La simetría 1↔1/2 y 2↔1/3 no la impuse: sale de leer las dos rutinas por separado.

★ **Errata menor del ledger, de paso:** la entrada de `frontier.json` del clasificador de terreno de la party (MAINOUT 0x03e0) dice
«clase 1 para tiles 0x1E/0x1F y **4..8**», que se come el carve-out del tile 5 y da 7
tiles donde hay 6. `docs/FIDELITY.md` sí lo tiene bien («tiles 4,6,7,8,30,31»). No lo he
tocado — es de otro dueño; queda anotado para quien pase por esa fila.

### 2.1 Cuántas de las 13 entradas están VIVAS (control de alcanzabilidad)

La tirada sólo ocurre **después** de que la pasabilidad haya aprobado el paso, así que una
entrada de tile no pasable es código muerto para esa clase de movilidad. Leí el bitmap de
pasabilidad a pie directamente del fichero original (DATA.OVL 0x54e4, MSB-first, bit
puesto = bloqueado): `70 0c 00 28 …`, **byte a byte idéntico** al volcado ya publicado en
`dungeon.md`. Resultado:

- Los **6** tiles de clase 1: **todos pasables**.
- Los **7** de clase 2: pasables salvo **0x0C y 0x0D** (las dos montañas), BLOQUEADOS.

⇒ **11 de 13 vivas** para las clases que consultan el bitmap. Las 13 sólo para la única
clase que lo IGNORA — Ghost y Shadow Lord (`mapeo-enemigo-mover.md`): son los únicos
actores del juego que pueden pisar montaña y, por tanto, los únicos que llegan a ejecutar
esas dos entradas.

Consecuencias por clase de movilidad, cruzando con ese mismo mapeo:

- **RotWorm** (sólo Swamp, tile 4) y **Sand Trap** (sólo Desert1, tile 7): su único tile
  legal es de clase 1 ⇒ **tiran en CADA movimiento**, van a media velocidad por
  construcción.
- **Corpser** (sólo Grass, tile 5): su único tile legal es justo el carve-out ⇒ **no tira
  jamás**.
- **Todas las clases acuáticas**: sus tiles son clase 0 ⇒ no tiran jamás.

## 3. CAREO con el port

**(a) Frenado de la PARTY — PORTADO Y CORRECTO.** El testigo del usuario («>East / Very
slow!») pertenece a este flujo, no al de 0x1578. `movement.ts` tiene la partición exacta
(`SLOW_TILES = {4,6,7,8,0x1e,0x1f}` y 9..0x0F), cobra +2/+4 minutos, corre 1 o 2 turnos
extra de mundo y emite los dos mensajes. Sin hueco. (Detalle ya sabido y anotado en el
ledger: el original SUPRIME el mensaje si en los turnos extra pasó algo — sigue diferido.)

**(b) Frenado de los ACTORES — AUSENTE POR COMPLETO.** Censo de consumidores del
clasificador en todo `game/src`: **dos**, y los dos son de la party
(`movement.ts:211` y `:299`). **Cero en `enemies.ts`.** Y tanto el chase como la deriva del
port comprometen la posición sin condición en cuanto la casilla es pasable
(`enemies.ts`: `if (this.canEnter(...)) { enemy.x = nx; enemy.y = ny; }`).

Impacto, separado en sus dos mitades:

1. **Paridad de stream RNG**: falta 1 tirada por cada paso de actor a tile de clase 1 o 2.
   No es cosmético: el turno del overworld encadena spawn y combate detrás.
2. **Conducta VISIBLE**: en el original los monstruos se atascan en pantano, bosque y
   colinas; en el port cruzan a velocidad plena. Los casos extremos son RotWorm y Sand
   Trap, que en el original se mueven la mitad de los turnos **siempre**.

**(c) Prosa auto-infiel encontrada de paso, ya CORREGIDA**: el comentario de
`cmd-strings.ts` afirmaba «el port solo modela `Slow progress!`, no `Very slow!`». Es
falso, y lo era ya cuando se escribió: `movement.ts` emite los dos y `verySlow` está dos
líneas más abajo en ese mismo mapa. Retirada la frase, con la corrección fechada al lado.

## 4. Por qué NO he arreglado (b), y con qué seña queda

El fix de conducta y el desalineamiento de stream **son la misma línea de código**: lo que
hace fiel al monstruo es precisamente gastar la tirada. No se puede portar la conducta sin
mover el stream ⇒ va al **lote de paridad**, no suelto y no sin ventana.

Seña dejada, con el patrón del trinquete de aserto **INVERTIDO** (en vez de un
failing-first que dejaría main en rojo): tres tests nuevos en
`game/tests/overworld-ai.test.ts` que **afirman que el defecto sigue abierto** — que el
port consume sólo el rand del eje sobre Swamp (clase 1) y sobre Forest3 (clase 2), y que
el actor se mueve igualmente. El día que alguien porte la compuerta, **ese bloque se pone
ROJO a propósito** y obliga a retirarlo; la instrucción va dentro del propio bloque. El
tercer test es el **control positivo** del careo: comprueba que la partición de tiles del
port coincide con la del binario (incluido el tile 5 a clase 0), para dejar dicho que lo
que falta no es la tabla sino su segundo consumidor.

## 5. Predicciones falsables (para el día que se porte)

1. Con la compuerta puesta, un actor a pie sobre clase 1 consumirá **exactamente 2** rands
   por paso (eje + terreno) y sobre clase 2 también 2 (eje + terreno), nunca 3.
2. La tirada de terreno se consume **después** de la del eje y **antes** de cualquier otra
   del siguiente actor (el orden de slot 31→1 no cambia).
3. Un actor cuyo paso preferido caiga en clase 1/2 y **pierda** la tirada **no** probará el
   otro eje ni derivará: se queda quieto ese turno. Si al portarlo alguien añade un
   fallback, diverge.
4. RotWorm y Sand Trap medirán ~50% de turnos sin desplazamiento en terreno abierto.
5. Ghost y Shadow Lord serán los únicos que ejerciten las entradas de 0x0C/0x0D.

## 6. Verificación (comandos y resultado)

- Tabla de 28 entradas: decodificada por programa desde los bytes del listado; histograma
  6/7/15 reproducible.
- Bitmap de pasabilidad: leído del DATA.OVL real; coincide byte a byte con el volcado
  publicado en `dungeon.md`.
- Referencias indirectas a 0x1578: 0 ocurrencias de su word sesgado en el overlay.
- Gates: ver el mensaje al lead (pytest del trío + `tsc --noEmit` + vitest afectados +
  `seed_diff` 0/0 sobre este acta y sobre la nota corregida).
