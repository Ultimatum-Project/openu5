# Re-barrido por MOVILIDAD + TRIGGERS: ch16b resuelto, #65 des-atribuido, #125 con mecanismo nuevo

Aplicación de la regla nueva («cuando aparece un mecanismo no modelado en UNA sala, el barrido de
las demás no está terminado») a las tres salas que quedaban. Todo **estático**, sin tocar el run.
Sonda: `scratchpad/roomprobe.py` (tiles + units con resolución de enemigo y flags + triggers con
pisabilidad del `at` + BFS a pie desde el grupo de spawn + LOS `0x6a14` real).

---

## A. ch16b / #29 — LA PREGUNTA PREVIA: **(5,5) SÍ SE ALCANZA**. Caen los DOS sellos

Entrada desde el Underworld: la party cae en el bolsillo `f7(7,7)/(7,6)` y entra a la sala
`(7,5)` moviéndose al **norte** ⇒ grupo de spawn = OPPOSITE = **south** (`ch16b:110-123`).

```
BFS a pie desde grupo 'south' (6 spawns): 70 celdas alcanzables
  >>> objetivo (5,5) tile=0x44 pisable=True  ALCANZABLE=True
```

Las **8 placas** tienen todas `at=(5,5)`, tile `0x44 BrickFloor`, **pisable**. Y lo que escriben
encaja celda por celda con dónde están los enemigos:

| placa escribe `0x44` en | Headless presentes |
|---|---|
| (1,4) (2,4) (3,4) (1,5) (2,5) (3,5) (1,6) (2,6) (3,6) | **(1,4) (2,5) (1,6) (1,5)×6 = los 9** |

Roster real: **2 Dragones** `(8,1) (9,1)` + **9 Headless** en el bolsillo. Y ambos con
**`DoNotMove: FALSE`** — es decir, **ni siquiera la premisa «melé-estático» del sello original era
cierta**; los Headless se mueven, sólo que están emparedados (`CanPassThroughWalls: false`) hasta
que la placa abre el bolsillo.

<!-- [MOVILIDAD t#27, 07-27 — re/notes/redux-flags-movilidad-barrido.md] El OUTCOME de esta nota
(dead-end de ch16b FABRICADO, la placa abre el bolsillo) NO cambia: no depende del flag. Pero el
paréntesis `CanPassThroughWalls: false` es INOPERANTE como explicación: ese campo es CÓDIGO MUERTO
en el port (se asigna en enemies.ts y no lo lee nadie) ⇒ NINGÚN enemigo cruza muros, valga true o
false. «Emparedados» es la regla universal del port, no un rasgo de los Headless. El mecanismo real
del binario es la CLASE DE MOVIMIENTO (kernel 0x2C4C, tabla DATA.OVL 0x5504, 11 handlers; la clase 4
sí atraviesa muros), y a quién se le aplica queda pendiente del probe #30. -->


**Veredicto:** el dead-end de ch16b es **FABRICADO**, y **la condicional del lead se resuelve en
contra del sello**: como `(5,5)` SÍ se alcanza desde el bolsillo del Underworld, **el dead-end del
ASCENSO de Deceit también cae**. No sobrevive ninguno de los dos.

---

## B. #65 Covetous r1 — el LOS NUNCA fue el bloqueo. Mi atribución era errónea

Grupo `east` (ch24 entra `f0(7,2)` approach `west`):

```
BFS 54 celdas · enemigos alcanzables a MELÉ: 0/7
enemigos con LÍNEA DE TIRO (0x6a14) desde celda andable: 7/7   ← ★
```

**Los 7 son disparables bajo la tabla FIEL.** Mi lectura de `#65` («dead-end fabricado por `0xff`»)
identificaba bien que `0xff` es transparente, pero **la conclusión no dependía de eso**: con
cualquiera de las dos tablas hay línea de tiro a los 7. **Retiro la atribución.**

Y el mecanismo de placas aquí **no aplica, y es fiel que no aplique**: las 8 placas tienen
`at=(4,5)`, tile **`0x8a`, NO pisable** ⇒ nadie las ocupa ⇒ no se disparan nunca (exactamente el
caso que la docstring de `fireTriggers` declara «fiel, no bug»). Contraste limpio con #29, donde
el `at` es `0x44` pisable.

**El roster explica el DEADEND mejor que cualquier tabla:**

| unidades | qué son |
|---|---|
| **6× `sprite 236` = i=43 `Whirpool1/x`** | **stats TODO A CERO**: str 0, dex 0, int 0, armour 0, damage 0, **hp 0**, maxPerMap 0, treasure 0, Exp 0, **`ActivelyAttacks: FALSE`** |
| 1× `sprite 156` = i=23 `Ghost` | **`CanPassThroughWalls: TRUE`** (atraviesa muros ⇒ viene a ti) — ★ ver anotación bajo la tabla |
| 3× sprites 30 / 2 / 1 | no-enemigos (fuera del rango de conversión) |
| **6× `sprite 237`** | **DESCARTADAS por el port** — ver abajo |

<!-- ★ [MOVILIDAD t#27, 07-27 — re/notes/redux-flags-movilidad-barrido.md] La fila del Ghost dice
«atraviesa muros ⇒ VIENE A TI». Eso es FALSO PARA EL PORT: `CanPassThroughWalls` es CÓDIGO MUERTO
(asignado en enemies.ts, leído por nadie) y `combat.ts::tilePassableFor` tiene 3 ramas —walkable /
water / land∪water— ninguna de las cuales cruza un muro. El Ghost NO viene a ti a través de la roca.
Tampoco puede afirmarse lo contrario del ORIGINAL: el binario SÍ tiene el mecanismo (clase 4 de
kernel 0x2C4C: «pasable si no es agua», ignorando el bitmap de a pie), pero el mapeo enemigo→clase
NO está derivado ⇒ probe #30. La composición del roster y el OUTCOME medido de #65 quedan en pie;
lo que se retira es la predicción de movilidad que se apoyaba en el flag. -->


⇒ La hipótesis con mejor encaje para el DEADEND de #65 es **de ARNÉS, no de fidelidad** — que es
justo la salida que el plan del resello dejó escrita («si NO ocurre ⇒ problema de ARNÉS»): la sala
tiene 6 «enemigos» que son remolinos con 0 HP y 0 daño, y el veredicto se calcula con
`enemiesAlive === 0`. **No está probado**; es la pista, y la telemetría la confirma o la tumba.

### Candidato de DEFECTO nuevo (no lo declaro sapo — falta el binario)

`combat.ts:648-654` convierte los 16 slots del `.CBT` con
`adjusted = sprite + 0x100` → `spriteToEnemyIndex`, que exige **`off % 4 === 0`** y devuelve `null`
si no. `sprite 237` → `493 − 320 = 173`, `173 % 4 = 1` ⇒ **`continue`: la unidad se tira entera.**
En la posición 65 eso son **6 de 16 unidades**, todas en celdas del área abierta
`(5,1) (4,2) (2,1) (6,8) (2,8) (4,9)`.

`237 = 236 + 1` = **el mismo remolino en otro FRAME de animación**. Si el original deriva el tipo
con un desplazamiento (`(sprite−320)>>2` = 43) en vez de exigir resto 0, **el original coloca 6
remolinos más y el port ninguno**. Es hermano del sapo `(0,0)` (task #17) y vive **en el mismo
cargador**. **Pendiente de leer el binario antes de llamarlo defecto** — el filtro del original que
ya tracé (`DNGLOOK 0x117E @0x12ab`) sólo descarta `sprite == 0`, lo que apunta a que no hay
comprobación de resto, pero eso hay que verlo en la ruta de combate, no en la de mazmorra.

---

## C. #125 Doom r13 — aparece un SEGUNDO mecanismo junto a la coartada del Cetro

Grupo `south` (`ch37-doom-cola:41` declara «r13 north→south»):

```
16 enemigos: 6× Daemon (range 9, mobile) + 10× MongBat (mobile)
BFS 15 celdas · MELÉ 2/16 · LÍNEA DE TIRO 2/16
```

Y **7 placas con `at=(5,5)`, tile `0x05`, PISABLE** — la party sí puede dispararlas. Pero **no
abren nada: siembran `0x8f`** (la docstring de `fireTriggers` lo nombra: «abre muros (0x4F→0x44) o
**siembra lava (0x8F)**») sobre
`(5,5) (4,5) (4,4) (4,6) (3,4) (3,6) (2,4) (2,6) (2,5) (1,5) (3,3) (3,7) (4,3) (4,7)` —
**incluida (5,5), la celda donde está el que la pisa.**

⇒ #125 tiene **dos** mecanismos capaces de mover su veredicto: la coartada del Cetro **y** una
placa de lava pisable que cae sobre 14 celdas del interior. Su discriminador
(«¿todas las bajas con `sceptreUsed===true`?») **ya no es suficiente por sí solo**: una baja sin
Cetro no prueba fabricación si la lava la explica. Hay que leer las dos cosas juntas.

---

## Resumen de estado

| sello | antes | ahora |
|---|---|---|
| **#29 / ch16b** | dead-end sospechoso | **FABRICADO, confirmado** — y arrastra el dead-end del ASCENSO |
| **#65** | «dead-end fabricado por `0xff`» (mío) | **atribución RETIRADA**; 7/7 disparables con las dos tablas; pista = arnés (remolinos 0-HP) |
| **#125** | coartada del Cetro | coartada **+ placa de lava pisable**; discriminador insuficiente |
| **#103** | victoria fabricada | **EXONERADA** (dragones móviles) |

---

## ADENDA #125 — cruce del repo ANTES del binario (doctrina nueva): la placa de lava YA ESTÁ ACTIVA

Aplicando la regla que el lead acaba de elevar a primera comprobación («lo que buscas puede estar ya
derivado en otra carpeta»), cruzo `#125` con quien la juega de verdad:

`ch37-doom-cola.spec.ts:101-103`
```ts
{ label: "r13", cm: 125, room: { f: 6, x: 3, y: 7 }, tp: { f: 7, x: 3, y: 7 },
  actions: [{ do: "klimb-up", facing: "north" }], sceptreClear: true,
  note: "klimb-UP f7(3,7)=Lu; facing north (grupo south real); 8 tiles 0x7X → cetro; tile-201 interior" }
```

Dos cosas que cambian el cuadro:

1. **El grupo es `south`** («grupo south real»), que es **exactamente** el que usé en la sonda ⇒ mis
   números (`MELÉ 2/16`, `LOS 2/16`, 16 enemigos móviles) son los de la entrada REAL, no los de una
   hipótesis.
2. **`plates: true` NO es opt-in aquí: `conquerRoom` lo pasa SIEMPRE** (`nav.ts`:
   `resolveArenaCombat(page, { maxRounds, plates: true, sceptre: opts.sceptreClear })`). ⇒ **el
   resolvedor de `#125` YA tiene encendida la capacidad de ir a pisar placas**, y la placa de esa
   sala está en `(5,5)` sobre `0x05` **PISABLE**, sembrando lava `0x8f` en 14 celdas del interior.

⇒ **La lava no es un mecanismo hipotético en `#125`: está viva en la corrida que produce el
VICTORY.** Y la nota del capítulo atribuye el resultado **sólo** al Cetro («8 tiles 0x7X → cetro»).

**Consecuencia para la 2ª pasada**: el discriminador del Cetro no sólo es insuficiente en teoría —
compite con un mecanismo que **sabemos encendido**. Hay que leer en el JSONL **las dos cosas a la
vez**: `sceptreUsed` por ronda **y** si la ronda de la baja coincide con el disparo de la placa
(celdas del interior pasando a `0x8f`). Una baja sin Cetro NO prueba fabricación; una baja con Cetro
tampoco prueba que fuera el Cetro.

**Sigue SIN adjudicar** — pero ahora el residual está bien planteado: no es «¿fue el Cetro?», es
«¿cuál de los DOS, ronda a ronda?».

---

## ★ #125 ADJUDICADA — desde la telemetría del resello-2, SIN ventana nueva

El lead señaló que el run definitivo ya corrió con `U5_TOUR_TELEMETRY`
(`scratchpad/resello2-telemetria.jsonl`, 15,8 MB). **Es lectura pura y basta.**

**Localización del episodio**: en `ch37-doom-cola` hay 30 episodios de combate; los que arrancan
con **16 enemigos en `['4,3','4,7','7,2','7,3',…]`** son cm125 — coinciden celda por celda con las
16 unidades-enemigo de la posición 125 de `combatmaps.json`. Son **ep8 / ep18 / ep28**: la misma
sala jugada **3 veces**.

**Determinismo perfecto de las 3**: 391 rondas, 16→0 enemigos, primer Cetro en la **ronda 11**,
y **0 rondas con el actor en (5,5)** — las tres idénticas.

### Los dos mecanismos, medidos

| pregunta | medida |
|---|---|
| ¿Se usa el Cetro? | **SÍ**, desde la **ronda 11** (381 de 391 rondas con `sceptreUsed=true`) |
| ¿Se pisa la placa de lava `(5,5)`? | **NUNCA.** 0 rondas, en las 3 repeticiones. Celdas de actor usadas: sólo `(3,4)`, `(3,6)`, `(4,5)` |
| ¿Todas las bajas son post-Cetro? | **NO**: 2 bajas ANTES (rondas **4** y **9**, `sceptreUsed=false`); las otras 14, después |

### Veredicto

1. **La placa de lava NO es el mecanismo.** Mi objeción era legítima *a priori* —`plates:true` va
   siempre y la placa es pisable— pero **el resolvedor no la pisa nunca**. La retiro: en `#125` no
   compite con el Cetro. Queda como aviso vivo para OTRAS salas con placa pisable, no para ésta.
2. **La coartada del Cetro NO es total, y no hacía falta que lo fuera.** Hay 2 bajas previas — y mi
   sonda estática había dado **exactamente 2 enemigos alcanzables** (`MELÉ 2/16`, `LOS 2/16`) desde
   el grupo `south`. **Los números coinciden.**
3. ⇒ **`#125` NO es victoria fabricada.** Lectura coherente: el resolvedor mata a los 2 alcanzables
   (rondas 4 y 9), se queda sin objetivos, **usa el Cetro en la ronda 11** y con las barreras
   `0x7X` disueltas liquida a los 14 restantes. **Sello VICTORY sostenido.**

### Honestidad sobre lo que NO puedo afirmar

**No puedo decir QUÉ dos enemigos mueren antes del Cetro.** Los 16 son móviles (6 Daemon + 10
MongBat, todos `DoNotMove:false`) y `enemyCells` cambia cada ronda por MOVIMIENTO: en la ronda 3
«desaparecen» 6 celdas sin que baje el conteo. **La única señal fiable de baja es el campo
`enemies`**, que es por conteo, no por identidad. Que el número coincida con mi predicción estática
(2) es concordancia fuerte, **no** identificación.

Con esto, de los cuatro sellos en riesgo: **#103 exonerado · #29/ch16b fabricado y retirado ·
#65 con causa raíz en el core (arreglada por el fix del roster) · #125 sostenido.** Cero pendientes
de telemetría.
