# heredados-168 · TANDA 7 — los campos de arena, derivados del cuerpo

Carril `heredados-168` · 2026-07-28 · rama `re/frontera-verified-26`.
Contador `verified_inherited_without_cite`: **129 → 128**.

> Verificada con `re/tools/seed_diff.py`: 0 sembradas, 0 cambiadas.

Una sola fila, pero densa. La rutina es `end_of_turn_terrain_field_damage`, en
`COMBAT.OVL:0x1b1e`, y queda **ACREDITADA**.

---

## 1. ★★ Las magnitudes 50/100/150 son CÓDIGOS DE TIPO, no cantidades

El acervo del proyecto ya lo decía de este offset. Ahora está **derivado del cuerpo**:
ninguno de los tres valores se suma a una vida. Cada uno **elige una rama**, y dos de las
tres ni siquiera hacen daño directo.

| código | de dónde sale | qué ejecuta |
|---|---|---|
| `0x96` (150) | campo `0xE9` | `CS 0x68AE`, cuyo nombre en el censo es **`durmiente`** ⇒ SUEÑO |
| `0x64` (100) | campo `0xEA`, terreno `0x8F`/`0xBC` | `CS 0x3564` + una tirada `rand_range(0xa)` (0..10 inclusive) pasada a `COMBAT.OVL:0x1574` + stub a `COMSUBS.OVL:0x0312` + marca de redibujado ⇒ **DAÑO**, y es la **única rama con tirada** |
| `0x32` (50) | campo `0xE8`, terreno `0x04` | guarda propia (si el tile del slot de animación es ≥ `0x80` **no hace nada**), luego `COMBAT.OVL:0x18ba` con `-1` y `CS 0x3564` ⇒ efecto de estado, **sin daño directo** |

El nombre `durmiente` sobre `CS 0x68AE` confirma por **vía independiente** la lectura del
acervo de que el campo `0xE9` es sueño: yo llegué ahí resolviendo el near-call, no leyendo
la nota.

---

## 2. Cuatro cosas que no estaban escritas

**(a) PRECEDENCIA.** El terreno se mira **antes**, y si dispara, el barrido de campos **no
corre**. Pisar terreno activo **enmascara** cualquier campo en la misma casilla.

**(b) UN SOLO CAMPO POR TURNO.** El bucle se abandona en la primera coincidencia: dos campos
apilados en la misma celda **no acumulan**.

**(c) TERRENO Y CAMPO COMPARTEN HANDLER.** El terreno `0x8F`/`0xBC` se comporta igual que el
campo `0xEA`, y el terreno `0x04` igual que el campo `0xE8`. Es la misma mecánica por dos
vías, lo que justifica que el nombre lleve *terrain* **y** *field*.

**(d) ★ EL CUARTO MIEMBRO DE LA FAMILIA NO HACE NADA.** El predicado de disipación de
`COMSUBS.OVL:0x0056`, adjudicada en la tanda 1, barre `(tile & 0xfc) == 0xe8`, o sea
**`0xE8`-`0xEB`**. Aquí
sólo se comparan `0xE8`, `0xE9` y `0xEA`. **Un campo `0xEB` existe, ocupa slot y se disipa a
1/16 por ronda, pero no produce efecto de fin de turno.** Lo encontré cruzando esta tanda con
la primera; ninguna de las dos lecturas lo decía sola.

---

## 3. El registro de animación, un poco más cerrado

El careo de coordenadas entre los dos arrays (`+2` y `+3` del registro de animación contra
`+6` y `+7` del de combate) fija dos campos más de `g_char_anim_states`, que hasta ahora sólo
tenía derivados el `+0` (tile, tanda 1), el `+4` (índice, tanda 2) y el `+5` (casco de la
criatura-barco, tandas 1 y 4).

**No le pongo etiqueta x/y a ninguna de las dos parejas.** El cuerpo fija que `+2` casa con
`+6` y `+3` con `+7`, y eso es todo lo que sostiene. El proyecto ya se comió una transposición
de ejes por rellenar ese hueco con una suposición razonable.

---

## 4. Estado

**40 filas adjudicadas** en siete tandas; contador **168 → 128**.
Quedan **128**: 15 del bucket FUERTE, 86 DÉBIL, 26 SIN RASTRO.
