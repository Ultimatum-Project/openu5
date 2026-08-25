# ACTA LOTE #251 + #252 — el nombre de `0x5C5A`, y los ocho accesos base-ajustados de los dos bitmaps

> Rama `re/lectura-244` (tercer commit encima, como pidió el lead). Base main `7dc4f360`;
> #244 y #248 aterrizados en main `b1db4f86` y `aa006e1f` (picados, blobs verificados
> idénticos). `re/ledger/globals.json` **sin deriva** entre mi HEAD y main (`5dd5950e` en
> los dos) antes de empezar. RETENIDA: aterriza el lead.

---

## 0. LO QUE YA SÉ AL ESCRIBIR ESTO (y por tanto NO cuenta como predicción)

Medido antes de abrir un solo cuerpo de rutina, porque decide el eje de #251:

| medida | valor |
|---|---|
| símbolo que el **disasm imprime** para `0x5C5A` | **`g_char_anim_states`, 142 veces** |
| ocurrencias de `g_world_objects` en los 28 `.asm` | **CERO** |
| `name` en el ledger | `g_char_anim_states` (coincide con el disasm) |
| `size` en el ledger | 256 B |
| `evidence` en el ledger | «censo: **7 refs** desde 3 ficheros» |

★ Y ahí ya hay un choque de cifras que no requiere leer nada: la ficha dice **7 refs** y
#245 midió **172 accesos genuinos**. La ficha no está sólo posiblemente mal de nombre:
tiene una cifra de censo **obsoleta en un factor de 24**, hecha con un canal que no veía
lo indexado (el defecto de #240).

★★ **Declaración de parte, por delante**: `g_world_objects` no es sólo cosa de #230/#240 —
**yo mismo lo usé en el acta de #244** («POSITIVO `0x5C5A` (`g_world_objects`, el pin de
#240)»), heredado del relevo de #242 sin cuestionarlo. Soy parte de la cadena de
propagación que esta tarjeta viene a cortar, y eso va dicho antes del veredicto, no
después.

---

## 1. ★ PREDICCIONES PRE-REGISTRADAS (escritas ANTES de leer ningún cuerpo)

**#251**

**P1 — El nombre del ledger es un CAMPO ascendido a REGISTRO, no una fabricación.** De los
ocho desplazamientos `0x5C5A..0x5C61` que #245 midió, **al menos uno** será un campo de
tile/animación, y eso explicará de dónde salió «anim_states».
**FRACASA si** ninguno de los ocho es de tile/animación — en ese caso el nombre del ledger
es simplemente falso, que es un veredicto distinto y peor.

**P2 — NO voy a renombrar, y el motivo es el coste medido**: 142 símbolos impresos por el
disasm. La salida honesta será `meaning` ampliado + la cifra de censo corregida, con el
`name` intacto — que es exactamente la vía que el lead marcó y el precedente de #75.
**FRACASA si** la lectura obliga a renombrar (p. ej. si el nombre resulta activamente
engañoso para portar, no sólo estrecho).

**P3 — `g_world_objects` no tiene ninguna base** y las actas que lo usan deberían
declararlo. Es contable: mediré en cuántas aparece.
**FRACASA si** aparece en el disasm, en `old_names`, o en algún documento con derivación.

**#252**

**P4 — Los ocho accesos son la MISMA forma**: `[bx + (BASE − 4)]` con `bx = g_location*4`,
sobre bitmaps de 32 bits por location (dos mitades de 16). Los cuatro de `TALK` serán
lectura+escritura del bitmap de **conocidos**, y los cuatro de `TOWN` del de **muertos**.
**FRACASA si** alguno de los ocho indexa otra estructura o usa otro paso.

**P5 — El «1-based» NO lo voy a poder cerrar con el corpus.** La tarjeta ya avisa de que
está derivado de la geometría, no de un testigo. Doy **~70 %** a que siga abierto al
acabar, y lo digo por delante para no racionalizar después un cierre flojo.
**FRACASA si** encuentro en el corpus el gate que impide `g_location == 0` en esas rutas —
eso sí lo cerraría, y sería un resultado mejor del que espero.

---

## 2. #251 — NO hay un nombre bueno y otro malo: hay DOS UNIVERSOS DE NOMBRES, y la ficha es la costura

**El encuadre de la tarjeta («o el ledger va corto, o el nombre de las actas está
inventado») es una falsa disyuntiva, y lo desmonta un conteo.**

| nombre | dónde vive | cuántas |
|---|---|---|
| `g_char_anim_states` | **el disasm lo imprime** | **142** |
| `g_world_objects` | el resto del proyecto | **68 en 38 ficheros** |

Y el segundo **no es cosa de dos actas**: está en los comentarios del **propio port**,
atado explícitamente a la dirección y al paso — `game/src/core/game.ts:800` («Capa de
objetos del mundo (g_world_objects 0x5C5A)»), `:3486` («sobre `g_world_objects` DS:0x5C5A,
stride 8»), `:3582`, y `game/src/core/state.ts:52` y `:375` («espejo de un slot de
g_world_objects (DS:0x5C5A…»).

⇒ **Las dos formas describen la MISMA tabla y las dos son de uso corriente.** El defecto
no es de nomenclatura: es que **la ficha no dice que existen las dos**, así que quien
llegue por un lado cree que el otro es un error. Exactamente lo mismo que #248: una
costura entre documentos, no un hueco de conocimiento.

### 2.1 Qué ES la tabla, derivado

Re-derivado por mí, sin usar `re/tools/idx_particion.py` (está en main pero **no** en mi
base, y heredar su cifra sin re-medir sería justo lo que el régimen prohíbe). Leyendo los
28 `.asm` en Python: **172 accesos con corchete**, en **12 overlays**, repartidos en
**exactamente ocho desplazamientos +0..+7**, **basura cero** — **coincide exacto con la
cifra de #245 por vía independiente**, que es el control de acuerdo que quería.

256 B / 8 = **32 registros de paso 8**. Campos con cita:

| campo | n | qué es, y por qué |
|---|---|---|
| +0 | 48 | el más usado; sirve de base a los `lea` de registro |
| +1 | 32 | escrito con constante (`CAST.OVL:0x0b12`, `mov byte ptr [bx + 0x5c5b], 0x1d`) y comparado en `COMBAT.OVL:0x0135` |
| +2 | 25 | **X** — recibe DELTA: `add byte ptr [si + 0x5c5c], al` (`CMDS.OVL:0x17cc`) |
| +3 | 26 | **Y** — gemelo exacto: `add byte ptr [si + 0x5c5d], al` (`CMDS.OVL:0x17d3`) |
| +4 | 4 | sólo escrituras |
| +5 | 19 | **banderas**, con el bit 7 en uso: `or byte ptr [si + 0x5c5f], 0x80` (`COMBAT.OVL:0x175e`) |
| +6 | 6 | escrito con `0x20` y con `0` |
| +7 | 12 | lectura y escritura |

★ **P1 FALLA.** Predije que al menos un campo sería de tile/animación y explicaría el
nombre del ledger. **No lo he derivado.** Que no lo encuentre no prueba que no exista —el
+0 podría ser el tile y en U5 los bits bajos del tile animan—, pero **no puedo citarlo**,
así que la descripción vieja («animation states de los characters del entorno actual») se
queda como **no corroborada por ningún campo leído**, y describía como mucho UN byte de un
registro de ocho.

### 2.2 La decisión: NO se renombra (P2 acierta)

Coste medido: **142 símbolos impresos**. Es el precedente #75 al pie de la letra. Aplico
la vía que el lead pre-autorizó: **`name` intacto**, `meaning` ampliado con el registro y
sus campos, y la costura de los dos nombres **escrita en la ficha** para que se vea.
`old_names` **no se toca**: existe para que el canal de símbolo resuelva lo que el disasm
imprime, y `g_world_objects` **nunca** lo imprimió — meterlo ahí sería contaminar el canal
con vocabulario de proyecto.

### 2.3 ★ La cifra de la ficha estaba obsoleta en un factor de 24

`evidence` decía «censo: **7 refs** desde 3 ficheros». Lo medido son **172**. La cifra
vieja venía de un canal ciego a lo indexado (el defecto de #240) y llevaba ahí desde
entonces. Corregida.

---

## 3. ★★ Y AUN ASÍ 172 ES UNA COTA: aparece OTRA forma de acceso

Cazada por un error mío de instrumento: mi primer muestreo por campo fue un `grep` de
texto ingenuo, no el contador de corchetes, y al ver la discrepancia entre los dos
aparecieron líneas como `add si, 0x5c5a`. Medido en serio:

**36 accesos por la forma `add reg, BASE`** — la base sumada a un índice ya calculado, sin
corchetes. **Invisible a los canales de corchete Y al canal `mov reg, imm` de #242**, que
sólo casa `mov`.

Y no siempre es la base: hay **punteros A CAMPO** — `BLCKTHRN.OVL:0x01d9` `add ax, 0x5c5d`
y `0x01e2` `add ax, 0x5c5c` (o sea `&reg.Y` y `&reg.X`), `CAST.OVL:0x0c15`/`0x0c26`,
`CMDS.OVL:0x0a6e` `add ax, 0x5c5f`. Reparto: `FONT.OVL` 7, `CAST.OVL` 4, `TOWN.OVL` 3,
`COMSUBS.OVL` 3, `BLCKTHRN.OVL` 4, y sueltos en 9 overlays más.

⇒ **séptima forma de la familia**, y otra vez encontrada **leyendo**, no razonando. Va con
tarjeta propia; aquí sólo queda medida y declarada, no explotada.

---

## 4. #252 — los ocho accesos, adjudicados

**P4 ACIERTA en la forma, y de paso sale una corrección.**

### 4.1 Lo que son

| par | rutina | qué hace |
|---|---|---|
| `TOWN.OVL:0x001f` + `0x0023` | getter en `0x0000` | lee los 4 B de la location, construye la máscara **en línea** y devuelve 1/0 |
| `TOWN.OVL:0x00a1` + `0x00a5` | setter en `0x0052` | marca el bit con `or` |
| `TALK.OVL:0x0d6c` + `0x0d70` | setter en `0x0d42` | ídem, pero la máscara la construye `call 0x44f6` |
| `TALK.OVL:0x0d9e` + `0x0da2` | getter en `0x0d7a` | `and` + `or dx,ax` + `je` |

Los cuatro sitios usan **la misma forma**: `bx = g_location*4` (dos `shl bx,1`) y base
`ADDR − 4`. Dos ejes: **location 1-based**, **NPC 0-based y acotado a 0..0x1f**
(`TOWN.OVL:0x0058`-`0x0062`). 32 × 32 bits = 128 B. ✔

★ **Gate del setter, que no estaba escrito en ninguna parte**: `TOWN.OVL:0x0052` sólo
marca muerto si el tile del NPC (leído de `0x659E` y enmascarado con `and ax, 0xfc` — los
dos bits bajos son el **fotograma de animación**, y se tiran) vale `0x70`, o es `>= 0x80`
y vale exactamente `0xb4`. Es mecánica portable y va a la ficha.

### 4.2 ★ CORRECCIÓN: el orden de bits NO es MSB-first

La ficha de `g_npc_dead_bitmap` decía «32 locations × 32 npcs, **MSB-first**». La máscara
se construye desde `ax = 1` desplazando **hacia arriba** N veces (`shl ax,1` / `rcl dx,1`,
`TOWN.OVL:0x0099`-`0x009f`) y la palabra baja va a la dirección menor ⇒ **el NPC n es el
bit n**, o sea **LSB-first**. Quien vuelque el `.GAM` suponiendo MSB-first **invierte los
32 bits de cada location** — un NPC muerto se lee como otro NPC. Corregido en las dos
fichas.

### 4.3 El «1-based»: mucho mejor corroborado, y aun así NO cerrado

**P5 acierta a medias**: predije ~70 % de que siguiera abierto, y sigue abierto — pero he
llegado más lejos de lo que esperaba. Tres patas independientes, **ninguna un testigo**:

1. **Aritmética**: 128 B / 4 = 32 ranuras; con base−4, el rango 1..32 llena la extensión
   fichada **exacta**, mientras que 0..31 dejaría 4 B muertos al final **y** leería 4 B
   antes de la global.
2. **Las vecinas TESELAN sin huecos**: `g_dng_map` 0x595A+512 = 0x5B5A → +128 = 0x5BDA →
   +128 = 0x5C5A. Los límites no salen de una sola ficha.
3. **`g_location = 0` es el EXTERIOR** — lo leí yo en #248 (`DNGLOOK.OVL:0x108c`, que pone
   `g_location` a 0 al salir de la mazmorra) — y en el exterior no hay NPCs de pueblo,
   que es donde viven estas dos rutas.

**Lo que cerraría**: un gate que impida `g_location == 0` en estas rutas, o un testigo.
No lo tengo, y la ficha lo dice.

---

## 5. Predicciones, adjudicadas

| | resultado |
|---|---|
| **P1** campo tile/animación que explique el nombre | ❌ **FALLA** — no lo derivé; el nombre queda no corroborado |
| **P2** no renombrar, coste 142 símbolos | ✅ acierta |
| **P3** `g_world_objects` sin ninguna base | ❌ **FALLA, y de las buenas** — tiene 68 usos en 38 ficheros, incluido el código del port. Mi predicción daba por hecho el encuadre de la tarjeta en vez de medirlo |
| **P4** los 8 accesos, misma forma, met/dead | ✅ acierta, y añade el gate del setter |
| **P5** el 1-based sigue abierto (~70 %) | ✅ acierta, con tres patas nuevas |

**2 fallos de 5, y los dos por el mismo vicio**: dar por buena la premisa que me llegaba
escrita (P1 y P3 heredaban el encuadre de la tarjeta) en vez de medirla primero. Es el
mismo vicio que #248 §3. Va anotado.

---

## 6. Lo tocado en el ledger

`re/ledger/globals.json`, **tres entradas, seis campos**, por sustitución de cadena
(jamás round-trip). `--stat` = **6 insertions / 6 deletions**, exactamente mis seis
líneas, sin reformateo. JSON revalidado: 194 globales, **cero nombres duplicados**,
`size` de las tres intacto. Todo lo anterior **conservado** con `||`.

## 7. Lo que este carril NO ha hecho

- **No he renombrado nada** (§2.2), ni tocado `old_names`.
- **No he explotado la séptima forma** (§3): 36 medidos, sin cruzar contra el ledger.
- **No he cerrado el 1-based** (§4.3) ni derivado los campos +0/+1/+4/+6/+7.
- **No he corregido las 68 menciones** de `g_world_objects`: la ficha ahora declara la
  costura, que es lo barato y lo reversible. Cambiar 38 ficheros es decisión del lead.
- **No he tocado `re/tools`, `game/src` ni `main.ts`.** Nada de e2e.

## 8. Cabos

1. **Séptima forma `add reg, BASE`** (§3): 36 en esta sola dirección; sin censar el ledger.
2. **Los campos +0/+1/+4/+6/+7** de la tabla (§2.1), sin derivar.
3. **El 1-based** (§4.3): pide gate o testigo.
4. **La costura de nombres**: ¿cuántas globales más tienen un nombre de disasm y otro de
   proyecto? Es el gemelo de #255 en el eje del NOMBRE, no del documento.

## 8bis. ★★ ADENDA POST-CIERRE — P1 estaba BIEN y yo la declaré fallada

Escrito **después** de que el lead aterrizara este lote (main `a631b3d7`) y me pasara
material de `cama-241` (main `567ae5b2`) que llegó tarde a mi lectura. Lo verifiqué contra
el disasm yo mismo, y **da más de lo que el mensaje decía**:

| offset | instrucción | campo |
|---|---|---|
| `ULTIMA.EXE:0x53a6`-`0x53a9` | `mov al, byte ptr [g_party_x]` / `mov byte ptr [g_char_anim_states+2], al` | +2 = X |
| `0x53af` | ídem con `g_party_y` | +3 = Y |
| `0x53b5` | ídem con `g_floor` | +4 = planta |
| ★ `0x53bb` y `0x53be` | `mov al, byte ptr [g_transport_tile]` → `+0` **y** `+1` | **+0 y +1 son BYTES DE TILE** |
| `TOWN.OVL:0x160d`-`0x161c` | los tres ejes, instrucción por instrucción | segundo testigo |
| `ULTIMA.EXE:0x36a6` | `mov si, 0x5c62` = base+8 | el barrido empieza en el **slot 1** |

⇒ **el SLOT 0 es el registro del propio party**, y sus campos +0/+1 —los dos que en §2.1
dejé como «el más usado» y «escrito con constante», sin nombrar— **son tiles**.

★ **Rectifico mi propia adjudicación**: en §5 puse **P1 FALLA** («ningún campo corrobora
animation states»). **P1 estaba bien y el fallo era mío de método**: muestreé los campos en
vez de leer al escritor del slot 0, que es donde los cinco se nombran de una vez. Un par de
bytes de tile por actor es justo donde vive un estado de animación en U5, así que el nombre
`g_char_anim_states` **sí** nombra +0/+1. Lo que sigue en pie del veredicto es lo otro: el
nombre es **ESTRECHO** (dos bytes de ocho), no falso — y por eso la decisión de no renombrar
no cambia, sólo se refuerza.

⚠ **Lo que sigue SIN derivar**: que `+1` sea el fotograma y `+0` el tile base. En el slot 0
los dos reciben el mismo valor, así que no discrimina; pide leer un escritor de slot ≥ 1.

★ **Y la lección, que es la tercera vez esta sesión**: el material existía en el repo
(`cama-241` lo midió y dejó escrito «no toco el ledger, es de #251»), y yo cerré #251 sin
cruzarlo. Es **exactamente** el defecto que yo mismo levanté en #248 §3 y convertí en la
tarjeta #255. Lo he cometido otra vez, y esta vez sobre una tarjeta que el propio autor me
había dejado servida.

---

## 9. Overlays nombrados aquí (sección FINAL a propósito)

`TOWN.OVL`, `TALK.OVL`, `CMDS.OVL`, `COMBAT.OVL`, `CAST.OVL`, `BLCKTHRN.OVL`, `FONT.OVL`,
`COMSUBS.OVL`, `DNGLOOK.OVL`, `ULTIMA.EXE`.
