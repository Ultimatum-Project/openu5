# heredados-b · TANDAS 7 y 8 — instrumento, corpus, y tres filas

Carril `heredados-b` · 2026-07-28 · rama `re/heredados-b`.
Contador `verified_inherited_without_cite`: **109 → 105** (la 7 no adjudica filas).

> Verificada con `seed_gate.py`: 0 sembradas, 0 cambiadas.

---

## 1. Tanda 7 — dos arreglos, ya commiteados aparte

**El gate de siembra compara ahora contra la línea base del propio fichero**, no contra
cero, así que responde la pregunta que dice su docstring: «¿has **añadido** siembra?» y no
«¿has tocado un fichero que ya sembraba?». Los cinco controles van sobre la función pura a
propósito —atarlos a la nota real los habría apagado al arreglarla— y la falsificación se
hizo en la vía real: criterio viejo 5 violaciones, criterio nuevo 0, y con una siembra de
verdad, 1.

**`dnglook-raster-spec` §7 corregida en sitio**: `g_unk_52C8` no es un nivel de luz sino el
modo de vídeo, por dos vías, y la primera es el offset que esa misma línea citaba como
respaldo.

De camino salieron dos cosas que no buscaba: el **ejemplo del docstring del propio gate era
falso** (no ponía rojo a nada, y comprobé que no era por tener semilla previa), y el arreglo
**se pagó solo una hora después** — la nota de raster-spec ya sembraba 1 y pisaba 1 en
`main`, así que con el criterio viejo mi edición seed-neutra habría salido roja con dos
violaciones ajenas.

---

## 2. ★ La regla que sale de la retirada de una global mía

Pedí de alta una dirección como si fuese la base de una tabla. **No lo era: era un
desplazamiento sesgado.** Lo verifiqué por mi cuenta antes de aceptar la refutación: ese
literal aparece **una sola vez** en todo el desensamblado, y la base real **no aparece como
literal en ninguna parte** — que es exactamente por lo que un censo de literales no la ve.

> **REGLA, para el catálogo: antes de dar de alta una global, comprobar si el índice PUEDE
> VALER 0.** Si no puede, la dirección escrita en la instrucción **no es la base**, sino la
> base menos el mínimo del dominio. Y la extensión que uno deduzca del dominio *aparente*
> invadirá lo que haya al lado: yo describía el índice como «el tile entero» (0..255) y
> darla de alta así se habría tragado la tabla vecina.

Corolario del mismo día, por otra vía: **la siembra se hereda por cita**. Copiar prosa ajena
que pega una palabra a un offset copia también su defecto — me pasó dos veces en la misma
frase.

---

## 3. Tanda 8 — las tres filas

| # | rutina | nombre | veredicto |
|---|---|---|---|
| 1 | `TOWN.OVL:0x11e` | `find_npc_by_objIdx` | ACREDITADA — ★ devuelve −1, no 0 |
| 2 | `BLCKTHRN.OVL:0x510` | `present_reward_cutscene` | sello SÍ, **`naming_verified` NO** |
| 3 | `ULTIMA.EXE:0x3702` | `find_actor_at / is_occupied` | ACREDITADA — ★★ hallazgo de porte |

**(1)** Recorre 32 ranuras de paso 16 y exige **tres** condiciones a la vez. Lo que importa
para un porte: **devuelve −1 cuando no encuentra**, porque el registro de retorno se
precarga y sólo se pisa al acertar. Devolver 0 confundiría «no hay NPC» con «el NPC 0».

**(2)** Doce bytes: una pausa y el intérprete de bytecode de cutscene sobre un script. El
cuerpo fija **«cutscene»** y **no** fija **«present_reward»** — lo único que dice del
contenido es el identificador del script. Por eso concedo el sello pero **no**
`naming_verified`, y lo dejo declarado en vez de recortar el nombre: su único llamador sí lo
sitúa dentro del interrogatorio, así que el término probablemente es correcto, pero **quien
lo quiera cerrar tiene que leer el script, no esta rutina**.

**(3) ★★ El valor devuelto y el índice viajan por canales distintos.** Barre el array de
actores **hacia atrás**, de la ranura 31 a la 0, y compara dos campos siempre y un tercero
sólo por debajo de cierto valor de `g_location`. Devuelve en el registro **el tile** —cero
si no hay nadie—, y deja **el índice en una global**, con −1 si falló. Un porte que lea
`is_occupied` como booleano pierde el tile; uno que lea `find_actor_at` como «devuelve el
índice» se lleva el tile en su lugar. **Los dos nombres son correctos y los dos inducen a
error sobre el retorno**, que es justo el caso en que hay que escribirlo en la cita.

De propina, **tercera confirmación independiente** de que esa global es una **palabra** y no
un byte: la escritura es `mov word ptr`. Coincide con lo que derivé en la tanda 1 y con lo
que el corpus ya decía por su lado.

**Y no bautizo el tercer campo.** El cuerpo fija que existe, que se compara con el tercer
argumento y que sólo se mira bajo esa condición. Que sea la planta es plausible y este
cuerpo no lo sostiene.

---

## 4. Estado

**26 filas adjudicadas**; contador **128 → 105**.

**Reparto medido el 2026-07-28 a las 13:41 UTC**, antes de esta tanda y sobre 108:
**16 FUERTE · 75 DÉBIL · 17 SIN RASTRO**, cinco de los fuertes por el canal de rangos.

**Cola inmediata**, las dos que dejo preparadas del bucket fuerte por tamaño:
`ENDGAME.OVL:0x28c` (74 B, con divergencia ya declarada en el nombre) e
`INTRO.OVL:0x2024` (108 B, que `intro.md` señala como hoja sin prólogo).
