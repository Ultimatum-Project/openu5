# #73 — El gate de `cbt_scene_populate` (DNGLOOK 0x117E), adjudicado

**Encargo**: censar los llamadores de `DNGLOOK 0x117E`, derivar qué valores de `arg2` llegan
por cada camino y qué semántica tiene el umbral `0xEF`; adjudicar la tarjeta con cuerpo
entero. La tarjeta estaba **derivada pero no confirmada** (1308bb4e), con la hipótesis del
lead (gate = no-spawn de salas despejadas) y dos piezas de evidencia en contra.

**VEREDICTO**: la hipótesis del lead queda **CONFIRMADA** — el gate es exactamente
«no repoblar una sala ya despejada», implementado sobre el **nibble alto del tile**, y es el
complemento exacto del `&0xAF` de `DUNGEON 0x00F5`. Pero **la evidencia en contra no cae: se
agranda**, y ahora está acotada a una sola pregunta. Además el censo destapa **dos artefactos
de instrumento** que invalidaban dos afirmaciones de la propia tarjeta.

---

## 1. El gate, leído literal (0x1248-0x1264)

```
1248: cmp word ptr [bp+4], 0     ; arg1
124c: jg   0x1251                ;   arg1 > 0 ?
124e: jmp  0x139c                ;     no  -> SALIR sin bloque B
1251: cmp word ptr [bp+6], 0xef  ; arg2
1256: jle  0x125e                ;   arg2 <= 0xEF -> 0x125e
1258: cmp word ptr [bp+4], 3     ;   (arg2 > 0xEF)
125c: je   0x1267                ;     arg1 == 3 -> BLOQUE B
125e: cmp word ptr [bp+4], 3
1262: jl   0x1267                ;   arg1 < 3   -> BLOQUE B
1264: jmp  0x139c                ;   si no      -> SALIR
```

Tabla de verdad completa:

| `arg1` | condición sobre `arg2` | ¿corre el bloque B? |
|--------|------------------------|---------------------|
| ≤ 0 | — | **NO** |
| 1 | ninguna | **SÍ** |
| 2 | ninguna | **SÍ** |
| 3 | `arg2 > 0xEF` | **SÓLO si** el tile es `0xF0..0xFF` |
| > 3 | — | NO (no existe ningún call-site así) |

Y en la cabeza, `0x1195`: si `arg1 == 1` **se salta el bloque A** (playerStarts) y va directo
al B. O sea `arg1` no es un booleano: es un **modo** 0/1/2/3.

## 2. Censo de llamadores — ★ son CUATRO, no dos

La tarjeta y `dnglook-117e-body.md` dicen «solo 2 call-sites en todo el corpus». Censo con
parseo en Python sobre los 24 `.asm` (stub `0x7C3E`, sesgo por overlay):

| call-site | rutina | `arg1` | `arg2` que empuja | bloque B |
|-----------|--------|--------|-------------------|----------|
| `CMDS.OVL 0x0058` | `camp_sleep_scene` | **0** | tile de `g_dng_map` en la casilla de la party | **NO** (arg1 ≤ 0) |
| `CMDS.OVL 0x02EF` | `camp_sleep_scene` | **1** | ídem | **SÍ**, sin mirar el tile |
| `DUNGEON.OVL 0x00B9` | `dng_enter_room` | **3** | `[bp+4]` de `dng_enter_room`, **crudo** | sólo si tile ≥ 0xF0 |
| `ULTIMA.EXE 0x6059` | `run_combat_encounter` | **2** | `0` | **SÍ**, sin mirar el tile |

Los dos que faltaban en la tarjeta están ambos en la **escena de campamento** (`(H)ole up`), y
son justo los que **no** aplican el gate del tile.

## 3. `arg2` en el modo 3 es el TILE CRUDO, no el `roomNo`

`dng_enter_room` (DUNGEON 0x0000) hace **dos lecturas distintas del mismo argumento**:

```
0024: mov al,[bp+4] ; and ax,0x0f   -> [bp-0x1a] = roomNo   (para el índice del .CBT)
00b1: mov al,[bp+4]                 -> se empuja CRUDO como arg2 de 0x117E
```

⇒ `arg2 > 0xEF` ⇔ `tile ≥ 0xF0` ⇔ **nibble alto = 0xF = sala VIVA**. Una sala despejada lleva
`0xAn` (`0xA0..0xAF` = 160..175 ≤ 0xEF) y **no pasa el gate**.

**Control de que la lectura es la buena** (no se puede leer el llamador directamente, ver §5):
si `arg2` fuese el `roomNo` (0..15), el umbral `0xEF` sería **código muerto** en el modo 3 y
ninguna sala de mazmorra se poblaría jamás — lo que el **testigo YT** refuta (cm64 con 6 Giant
Rats y 4 Bats en casillas exactas del `.CBT`). Como el testigo YT es control conocido del
proyecto, `arg2` es el tile.

## 4. La semántica: es el complemento exacto del `&0xAF`

- Al **ganar** una sala, `DUNGEON 0x00F5` hace `g_dng_map[celda] &= 0xAF` ⇒ `0xFn → 0xAn`.
- Al **entrar**, este gate exige `tile > 0xEF` ⇒ sólo `0xFn`.

Las dos mitades de un mismo mecanismo: **la despejadez viaja en la celda del mapa** (además
del bitmap `g_dng_room_cleared` @0x33A), y el gate la lee para no repoblar. Hipótesis del lead
**CONFIRMADA**, y con el mecanismo entero cerrado en vez de sólo el umbral.

## 5. ★ Dos artefactos de instrumento que invalidaban afirmaciones de la tarjeta

**(a) «solo 2 call-sites»** — son 4 (§2).

**(b) `DUNGEON 0x0000` figura con `callers: []`**, y no lo llama nadie: ni near-call (resolví
el grafo interno entero de DUNGEON: 30 destinos, ninguno es `0x0000`), ni stub de la tabla, ni
puntero (`d0 81` no aparece en el `.OVL`). **No es código muerto: es ambigüedad del slot de
overlay.** `TOWN.OVL`, `MAINOUT.OVL`, `DUNGEON.OVL` e `INTRO.OVL` **cargan todos en el mismo
linear `0x81D0`**, así que un stub a `linear 0x81D0` es *a la vez* TOWN 0x0000, MAINOUT 0x0000
y DUNGEON 0x0000 — depende de cuál esté residente. La tabla de stubs los atribuye a TOWN
(`stub 0x7AFA`) y a MAINOUT (`stub 0x7B7E`).

⇒ **Regla**: para los cuatro overlays del slot `0x81D0`, `callers: []` **no** es evidencia de
rutina muerta, y la atribución de overlay de un stub a ese linear **no es fiable**. Afecta a
todo el censo de llamadores de TOWN/MAINOUT/DUNGEON/INTRO.

## 6. La evidencia en contra NO cae: se agranda y se acota

El acta del testigo visual dice que en cm64 —sala **despejada** (`0xA0` en el mapa arrastrado
de Doom), o sea con el gate CERRADO— se vieron las **237 como fuentes**, en las posiciones
exactas del `.CBT`. Busqué la salida fácil («las dibuja el renderizador leyendo el `.CBT`,
no el bloque B») y **la refuté**:

Censo de lectores de las tres filas que usa el bloque B, **por las dos formas** (hex y
complemento a dos — estas tres direcciones están entre las 40 invisibles de
`globals-desplazamiento-negativo.md`, así que un censo por hex habría dado cero):

| fila | dirección | lectores en TODO el corpus |
|------|-----------|----------------------------|
| 5 (sprite) | `DS:0xADB4` (`[bx-0x524c]`) | **1** — DNGLOOK 0x12A4 |
| 6 (X) | `DS:0xADD4` (`[bx-0x522c]`) | **1** — DNGLOOK 0x1305 |
| 7 (Y) | `DS:0xADF4` (`[bx-0x520c]`) | **1** — DNGLOOK 0x130F |

**Nadie más lee esas filas.** Si el bloque B no corre, las filas 5/6/7 no las consulta nadie
⇒ no hay quien coloque las 237. La contradicción del acta es **real** y queda reducida a UNA
pregunta, ya sin escapatoria por esta vía:

> ¿Cómo se vieron las 237 en una sala cuyo tile era `0xA0`?

Candidatas que quedan (**ninguna derivada**, no elijo):
1. El tile en el momento de la llamada **no era** `0xA0` (p. ej. el barrido `DNGLOOK 0x093A`
   corre al arrancar la sesión y sólo degrada `0xF→0xA`, nunca al revés — así que no).
2. Las 237 vistas **no venían de esta escena** sino de la tabla de actores heredada del save
   (`0x5C5A`/`0xBA14`), que el save-escenario arrastraba igual que el mapa.
3. La reconstrucción de la ruta en el acta visual sigue teniendo un error (ya tuvo uno: la
   ruta «wrap oeste» resultó ser norte+este).

La (2) es la más económica y encaja con todo lo demás del confound del save-escenario, pero
**no la afirmo**: exige leer quién puebla `0x5C5A` al cargar y no lo he hecho.

## 7. Qué NO toco

El nombre `cbt_scene_populate` queda como está: el cuerpo (bloque A = playerStarts, bloque B =
16 map-units) lo respalda, y el renombre ya lo adjudicó el lead sobre propuesta de anillo-67.
Aquí sólo se corrigen las dos afirmaciones de instrumento (§5) y se cierra el gate (§1-§4).
