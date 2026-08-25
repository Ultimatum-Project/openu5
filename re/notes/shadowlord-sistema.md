# El SHADOWLORD como SISTEMA — parte propio del carril `asm-town-zstats`

Carril `asm-shoppes-4` (cuarta generación) · rama `re/asm-shoppes-4` · **2026-08-06**.
**SHA de main al escribir: `d7bdc46d`.** Toda cifra de este parte es función de ese árbol.

Es el cuarto punto del encargo original, el que tres generaciones dejaron sin tocar.

---

## 1. 🔴 La premisa del encargo era falsa, y eso decide la forma del parte

El traspaso lo describía como trabajo sin empezar. **Medido sobre el ledger: las SIETE filas del
subsistema ya estaban `verified` con cita.**

| fila | bytes | cites antes de este parte |
|---|--:|--:|
| `CS CMDS.OVL:0x1030` `summon_shadowlord_by_name` | 466 | 7 |
| `CS TOWN.OVL:0x0212` `town_shadowlord_blight` | 156 | 2 |
| `CS TOWN.OVL:0x02ae` `town_place_shadowlord` | 346 | 8 |
| `CS TOWN.OVL:0x10f2` `shadowlord_possess_slot` | 100 | 1 |
| `CS TOWN.OVL:0x1156` `shadowlord_apply_effect` | 98 | 7 |
| `CS TOWN.OVL:0x11b8` `shadowlord_announce` | 56 | 8 |
| `CS SJOG.OVL:0x1ea4` `combat_absorb_shadow` | 130 | 8 |

Abrí **las dos con menos cites** por si el sello estaba flojo. **No lo está**: la de `0x10f2`
es una lectura de cuerpo entero instrucción a instrucción y la de `0x0212` es un barrido de
verificación que además **corrige** una nota previa que la etiquetaba de «redibujo». No hay
trabajo de sellado aquí y **no lo he fabricado**.

⇒ Lo que sí faltaba es lo que ningún lector de UNA fila puede ver: **cómo componen las siete**.
Y un sitio donde la evidencia era fina de verdad: el **punto de entrada**, la fila más grande
del subsistema, cuyas siete cites eran **cinco sin texto** más un resumen de barrido. Ése lo he
leído. Es aditivo sobre una fila que ya estaba `verified`: **no mueve contadores** y no reclama
la fila pendiente de nadie.

---

## 2. `CS CMDS.OVL:0x1030` `summon_shadowlord_by_name` — 466 B, `ret 2`, CUADRA

Cuerpo entero, **sin un byte de relleno**: el `ret 2` está en `0x11ff` y `0x1030 + 466 = 0x1202`,
que es el arranque de la fila siguiente. **Un argumento** = puntero a lo tecleado.

### 2.1 Las tres puertas, en orden

1. **`g_location`** debe valer `0x1e`, `0x1f` o `0x20`. Si no, mensaje y fuera.
2. **El nombre**, contra una **tabla** de tres punteros de cadena, con `stristr`
   (`CS ULTIMA.EXE:0x6f1e`, resuelto en vivo). Si ninguno casa, el índice queda en 3 y cae al
   mensaje.
3. **La casilla y el estado del Shadowlord**: `g_party_y` no puede ser menor que 2, y el byte de
   la **tabla** de localizaciones indexada por el nombre no puede valer `0xFF`.

### 2.2 ★★ El nombre es la AGUJA y lo tecleado el PAJAR — se casa por SUBCADENA

El orden de empuje pone la cadena de la **tabla** en la ranura de aguja de `stristr` y **lo
tecleado en la de pajar**. Y `stristr` busca la aguja **en cualquier posición** del pajar.

⇒ **Teclear algo que CONTENGA el nombre convoca igual.** No hay comprobación de frontera de
palabra ni de longitud: lo que el jugador escriba alrededor no estorba.

Y hereda el plegado de `stristr` tal cual: el que **quita el bit 7 antes de comparar** y pliega
**todo** lo que supera `0x60`, no sólo las letras. Es el mecanismo del §34 del acta del carril,
aquí con un consumidor nuevo. **Grado**: que se usa `stristr` y en qué ranura va cada cadena es
**MEDIDO** por mí; las propiedades del plegado son **RELAYADAS** de esa lectura.

### 2.3 🔴 CORRECCIÓN a la cita ya aterrizada: la puerta es `>= 2`, no `== 2`

La cita que la fila traía dice *«y `g_party_y`**==**2»*. El cuerpo dice otra cosa: la
comparación va seguida de un salto **si es MENOR**, o sea la puerta es **`g_party_y >= 2`**.

**Y el motivo está medido, que es lo que convierte la corrección en algo más que un signo**: la
rutina coloca al Shadowlord en **`g_party_y − 2`**, y esa resta aparece **tres veces** en el
cuerpo (el registro visible, el registro de runtime y la entrada de horario). La puerta es
exactamente **la guarda de desbordamiento de esa resta**. Una cita que dice `== 2` pierde la
condición **y** su razón de ser.

### 2.4 ★★ Sólo puede haber UN Shadowlord, y el candado es el propio tile

Antes de colocar nada, barre las **32** ranuras de actor buscando una cuyo byte valga `0xFC`.
**Si encuentra alguna, imprime el mensaje y sale.** Y `0xFC` es exactamente el valor que esta
misma rutina escribe al final, tanto en la ranura de actor como en la **tabla** de tipo de NPC.

⇒ el candado de exclusión mutua **no es una bandera aparte**: es la presencia del tile. Un clon
que guarde «hay un Shadowlord» en un booleano propio y no lo derive del contenido de las ranuras
puede desincronizarse con el mundo — y al revés, uno que limpie ese tile por cualquier otra vía
**reabre la convocatoria** sin querer.

### 2.5 ★★ Con el plantel de NPC LLENO no falla: DESALOJA la última ranura

La búsqueda de ranura de NPC libre va **hacia abajo** desde la 31 buscando tipo 0. Cuando se
agota, el índice baja de 0 y **el cuerpo cae dentro del camino de éxito igualmente** — pero el
registro que gobierna la escritura no es el índice agotado, sino uno que **se quedó con el 31**
de la inicialización. ⇒ **con las 32 ranuras ocupadas, la convocatoria escribe encima de la 31**.

No es un rechazo, no es un cuelgue: es un **desalojo silencioso** del NPC que hubiera ahí. Un
clon que se niegue a convocar con el plantel lleno diverge, y uno que agrande el plantel también.

**Grado**: el mecanismo está **MEDIDO** en el cuerpo. La **alcanzabilidad NO** — no he medido si
un pueblo puede tener las 32 ranuras ocupadas en el momento de la convocatoria, y **no lo
afirmo**.

### 2.6 Lo que escribe cuando pasa, y una aparición en DOS fases

Registra **qué** Shadowlord es en el byte **inmediatamente posterior** a la **tabla** de
localizaciones; pide una ranura de actor a `alloc_actor_slot` y la rellena con `set_actor_record`;
marca el registro de runtime como vivo con su ranura de actor, su X, su Y menos dos y su planta;
**pone a cero dos words del horario** y luego escribe **tres** entradas de horario con la misma
posición; y marca el tipo de NPC como `0xFC`.

★ **La aparición tiene dos fases medidas**: escribe en la ranura visible el tile `0x16`, llama a
`fx_tile_fizzle_in` y **sólo después** escribe el `0xFC` definitivo. Un clon que ponga el tile
final de golpe pierde la fase intermedia.

### 2.7 ★ El valor de retorno no es lo que parece, y su inicializador está MUERTO

El éxito devuelve **0**. Los tres caminos de fallo **no devuelven un código**: saltan al epílogo
justo detrás de la llamada de impresión, así que devuelven **lo que esa rutina dejara**. Y el
cuerpo inicializa una variable local a 1 que **ningún camino llega a devolver** — el único sitio
que la lee es el de éxito, que acaba de ponerla a 0. Es un **store muerto**.

⇒ el retorno **sólo distingue el éxito, y por el valor 0**. Quien porte esto con `true`/`false` o
con un enumerado de errores le está dando una estructura que el original no tiene.

---

## 3. ★★ Lo que este cuerpo CIERRA de otra tanda: la X y la Y dejan de ser relayadas

El §7.1 del acta del carril adjudicó los tres bytes de horario —`0x5d61`, `0x5d64`, `0x5d67`—
como X, Y y planta, y **declaró el grado**: la planta por lectura propia, **la X y la Y por
posición en el registro más una derivación ajena sin re-verificar**.

Este cuerpo las nombra **por construcción, desde el lado del ESCRITOR**: escribe `g_party_x` en
el primero, `g_party_y − 2` en el segundo y `g_floor` en el tercero.

⇒ **X e Y ya no son relayadas.** Es una segunda vía genuina: el §7.1 leyó al consumidor, esto lee
a un productor distinto, y coinciden sin que yo cruzara nada.

---

## 4. El sistema: seis puntos de costura, y ninguna contradicción

Crucé las direcciones que citan dos o más filas del subsistema. **Ninguna pareja se contradice**
en lo que le atribuye a cada una — el control salió limpio.

| lo que cosen | quiénes lo tocan |
|---|---|
| **tabla** de localizaciones + el byte de «cuál está aquí» | la convocatoria y la colocación |
| índice de presencia en el pueblo | la colocación y la marchitez |
| **tabla** de tipo de NPC | la convocatoria, la colocación y la posesión |
| **registros** de horario | la convocatoria, la colocación y la posesión |
| **registro** de runtime | la convocatoria y la colocación |
| ranuras de actor | la convocatoria y la colocación |

**El ciclo de vida, compuesto de las siete lecturas:** el jugador grita un nombre y la
convocatoria materializa al Shadowlord como NPC con horario propio; al entrar al pueblo la
colocación lo vuelve a poner, y **también después de cada ataque consolidado** —eso lo midió el
§2 del acta y no es una sola vez—; mientras está, la marchitez transforma el terreno del pueblo
con un sorteo **sembrado por el día**, o sea estable dentro de la jornada; la posesión decide con
tres condiciones en AND —incluida **una moneda**— de qué NPC se apodera; el efecto y el anuncio
lo ejecutan; y en combate la absorción lo retira.

★ **Dos puntos del ciclo consumen aleatoriedad** —la moneda de la posesión y el sorteo de la
marchitez— y el segundo **se re-siembra**, así que su consumo no es libre: quien audite paridad
de flujo de números tiene que contar los dos.

**Grado del §4 entero**: la composición es **mía**; cada eslabón que no es la convocatoria está
**RELAYADO** de la cita de su fila y **no re-verificado por mí**. El cruce de direcciones sí es
**MEDIDO** — es un barrido mecánico sobre los textos de las siete citas.

---

## 5. VENTANA DE TERRITORIO — `CMDS.OVL`, declarada

`CMDS.OVL` **no estaba reclamado por ningún carril** (el de kernel lleva `ULTIMA.EXE`), y el
lead adjudicó a este carril la fila de la convocatoria. Lo declaro aquí para que quede en el texto y no
en un mensaje: **he entrado en un fichero que no es el de mi encargo, con permiso, y sólo para
esa fila.** No he tocado ninguna otra de `CMDS.OVL` ni la reclamo.

El motivo por el que la fila merecía el viaje es de contabilidad del goal, no de cortesía: su
`verified` venía de **cinco cites sin texto más un resumen de barrido**, y el criterio del goal
es «cuerpo leído instrucción a instrucción», no «citada varias veces». Es una fila que el
contador daba por hecha y no lo estaba.

---

## 6. ★★ COTEJO CONTRA EL PORT — las cuatro puertas son FIELES, y el port CORROBORA mi corrección

Esto lo hago porque el lead lo pidió expresamente al adjudicar: si la lectura del ritual
contradecía el modelo del clon, había que traer **las dos fuentes sin declarar perdedor**.
**No hay contradicción**, y de propina hay una corroboración que vale más que el cotejo.

| puerta, según mi lectura del cuerpo | qué hace el clon |
|---|---|
| el nombre casa **por subcadena**, con el nombre de aguja | `game/src/core/quest/ritual.ts:116-121` — pone en mayúsculas y usa **contención de subcadena** pelada (los tres nombres en `:41`) ⇒ **FIEL** |
| `g_party_y >= 2` | rechaza si es **menor que 2** ⇒ **FIEL** |
| el byte de la **tabla** de localizaciones distinto de `0xFF` | mismo test, y el clon le da además el significado «sigue vivo» |
| no puede haber ya un tile de Shadowlord | pregunta por **presencia en el mapa**, no por una bandera propia ⇒ **FIEL en la forma que el §2.4 pedía** |

★★ **Y la corroboración**: el clon implementa la puerta como **«menor que 2 ⇒ nada»**, o sea
`>= 2`. Es decir que **el clon ya era fiel a lo que yo he medido, y la cita del ledger era la
que estaba sola** con su «== 2». Dos fuentes independientes contra una: mi lectura del cuerpo y
el clon, que llegó ahí por su cuenta. Eso convierte el §2.3 de corrección plausible en
corrección **triangulada**.

★★ **Y el control que lo cierra**: el matcher **fronterizado** del diálogo, `keywordMatches`, vive
**sólo** en `game/src/core/dialogue/conversation.ts:252` y sus únicos usos son de ese mismo fichero
(`:448`, `:453`, `:608`, `:612`). **Cero usos en el camino de la convocatoria** — no es que coincidan
por casualidad: son **dos matchers distintos para dos subsistemas distintos**, igual que el binario
llama al mismo `stristr` desde los dos sitios y pone la frontera **sólo** en el llamador de diálogo.
La unidad de fidelidad es **el llamador**. Quien unificara los dos matchers del clon «por limpieza»
metería la divergencia justo al revés del riesgo habitual: encontraría **menos** de lo que el original
acepta.

★ **Tercera coincidencia**: el clon documenta que la convocatoria es **determinista, sin
aleatoriedad**. Mi lectura del cuerpo no encuentra ninguna llamada al generador. Concuerdan.

### 6.1 Lo que el clon NO modela — y su tamaño

- **El desalojo de la ranura 31 con el plantel lleno** (§2.5). El clon no tiene un plantel de 32
  ranuras con desalojo: añade un objeto a una lista. Es el **único hueco de mecánica** que el
  cotejo encuentra, y hereda el grado del §2.5: **mecanismo medido, alcanzabilidad no**. Sin
  medir la alcanzabilidad **no propongo tocar el port**.
- **La aparición en dos fases** (§2.6). El clon coloca el tile definitivo de golpe. Es material
  audiovisual y probablemente ya esté declarado por otro carril; **no abro ficha sin comprobarlo**.

### 6.2 Lo que este cotejo NO cubre — dicho para que nadie lo lea de más

El lead señaló que el clon modela un **re-sorteo a medianoche** de los Shadowlords. **Mi lectura
no dice nada de medianoche**: la convocatoria no toca el reloj. ⇒ **no puedo ni confirmarlo ni
contradecirlo**, y no lo hago. Quien quiera cerrar ese cabo tiene que leer el cuerpo que
gobierna el paso de día, que no es ninguna de las siete filas de este subsistema.

**Grado del §6 entero**: las cuatro filas de la tabla son **MEDIDAS por los dos lados** — el
binario por mi lectura de cuerpo, el clon por lectura directa de su código. Lo del §6.1 y el
§6.2 es **ausencia observada**, no medición de intención.

---

## 5. Lo que NO adjudico

- **NO he tocado el port.** Ninguna afirmación de este parte dice nada del clon.
- **NO he leído** `alloc_actor_slot`, `set_actor_record`, `tone_sweep` ni `fx_tile_fizzle_in`:
  resueltos en vivo por identidad y usados por su rol.
- **NO adjudico** qué representan los tiles `0x16` y `0xFC` más allá de su papel aquí, ni qué
  significan los tres valores de la **tabla** de localizaciones, ni los parámetros del barrido de
  frecuencia.
- **NO he medido la alcanzabilidad** del desalojo del §2.5.
- **NO he re-verificado** las seis filas que no son la convocatoria; su grado viaja marcado en
  el §4.
