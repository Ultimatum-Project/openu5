# Acta #241 — cableada la mecánica ausente de `bedSleep`: snap POR PASO + gate de casilla propia

Carril `re/cama-241` (worktree `.claude/worktrees/cama-241`), rama desde `main` @`7dc4f360`.
Cablea lo que #230 dejó derivado (`re/notes/eslabon-230-acta.md`). **No re-litiga la derivación**:
la usa, la extiende donde el bucle decía algo distinto de lo que la tarjeta suponía, y lo declara.

## 0. VEREDICTO

`camp.ts::bedSleep` corre ahora, **por cada hora dormida y en este orden**: `advanceClock(60)` →
snap de NPCs (TOWN 0x1694) → `find_object_at_xy(party_x, party_y, floor)`; si el gate acierta,
imprime `Thrown out of bed!\n` (DS 0x422a) y **termina el sueño**. Antes no hacía ninguna de las
dos cosas y el snap se llamaba UNA vez, después del bucle.

## 1. ★ LO QUE LA TARJETA SUPONÍA Y EL BUCLE DESMINTIÓ

La tarjeta (y el acta #230 §1, y el test de #158) describen `CMDS 0x0552` como **«recorre las
HORAS y en cada una llama al snap»**. Leído el bucle entero, **el paso no es la hora**:

```
0631  jmp 0x63b                      ; ENTRA por la comprobación: se comprueba ANTES de avanzar
0634  push 1 / call 0x617a           ; DELAY de fotograma — ULTIMA.EXE 0x20FA (instala int 1Ch
                                     ; y hace busy-wait). NO toca el reloj.
063b  cmp si, g_hour / je 0x692      ; ¿ya es la hora de destino? → sale del bucle
0647  push 0xa / call 0xffff8ffc     ; ★ advance_clock(10) — raw 0x8FFC + base 0xBF80 = 0x4F7C,
                                     ; leído: escribe g_minute/g_prev_hour, Quickness 0x51,
                                     ; An Tym 0x54 (= el `advanceClock` del port)
064e  si la hora CAMBIÓ y vale 20 o 5 → call 0xffffbb1a   ; transición día/noche
0667  di = g_hour                    ; memoria de la hora anterior
0671/0674  call 0x6b68 / 0x6980      ; repintado + panel
0677  call 0xffffbb0e                ; ★ SNAP → TOWN.OVL 0x1694
067a/0680/0684  push g_party_x, g_party_y, g_floor
0688  call 0x770e                    ; ★ GATE → ULTIMA.EXE 0x368E find_object_at_xy
068b  or ax,ax / je 0x634            ; 0 ⇒ OTRA VUELTA ; ≠0 ⇒ cae a 0x068f
068f  mov si,0xffff  → 0x692 → 0x0698 cmp si,-1 → 0x069d print DS 0x422a
```

Tres consecuencias que la lectura «por horas» no tenía:

1. **El paso son 10 MINUTOS**, no una hora ⇒ el binario corre snap+gate **seis veces por hora**.
   `0x617a` NO es el reloj (es el delay de fotograma); el reloj es `0xffff8ffc` = 0x4F7C.
2. **El orden dentro del paso es reloj → snap → gate**, no snap→gate a secas: el avance del
   reloj, CS 0x0647, va por delante del snap, CS 0x0677.
3. **El acierto del gate TERMINA el sueño**: 0x068f no vuelve a 0x0634, cae al epílogo común de
   0x0692. La tarjeta preguntaba «¿despierta? ¿sigue?» — **despierta**.

## 2. RE-VERIFICACIONES QUE LA TARJETA MANDABA MEDIR (hechas antes de cablear)

Sonda temporal en `game/tests`, corrida sobre los assets reales y **borrada** (no se commitea).

### (a) ¿El snap por hora tira RNG?

Método de pasos del generador: se sustituye el rng por un contador y se cuenta el delta contra
el turno gemelo.

| medida | resultado |
|---|---|
| `enterMap` ×k, k = 1..8 | `[0,0,0,0,0,0,0,0]` — **0 tiradas, delta k-vs-1 = 0** |
| `bedSleep(N)` en main, sin cruzar medianoche (N = 1,2,3,6) | 0 |
| `bedSleep(N)` en main, **cruzando medianoche con 3 Shadowlords sueltos** | **7** |

★ La tercera fila existe porque las dos primeras eran un **control degenerado**: sin Shadowlords
sueltos el flujo entero tira 0, y un «0 antes = 0 después» no distingue «el snap no tira» de «el
instrumento no mide». Sembrando `shadowlordLocs=[1,2,3]` el rollover de día SÍ tira (0x4FF5 →
`relocateShadowlordsAtMidnight`) y el baseline pasa a ser **7**. Ese 7 es el número
pre-registrado; tras cablear el snap por hora **sigue siendo 7** (sellado en el test §5).

### (b) Efectos colaterales de N llamadas a `enterMap` vs 1

| medida | resultado |
|---|---|
| estado final tras snap por-hora 6→10 **vs** snap único a la hora 10 | **idénticos**, campo a campo (32 slots) |
| contraste hora 6 vs hora 10 | **distintos** (si no, la medida anterior no probaría nada) |
| `tributeDemanded` tras 1 llamada / tras 6 | **igual**: UNA llamada ya lo limpia ⇒ delta N-vs-1 = **0** |

⇒ llamar `enterMap` por hora **no añade efecto colateral** respecto a lo que `bedSleep` ya hacía
(que ya lo llamaba una vez). Lo que cambia son los estados INTERMEDIOS — que es exactamente el
mecanismo que se quería: el gate ve la colocación de cada hora.

## 3. LO CABLEADO

- `camp.ts::CampCtx` — dos entradas nuevas: `snapNpcsToSchedule()` y
  `objectOrNpcAt(x,y,floor)`. Van en el ctx (no en `Game.bedSleep`) porque el binario las llama
  DENTRO del bucle.
- `camp.ts::bedSleep` — el bucle, con el orden del §1 y `break` al acertar el gate.
- `game.ts::objectOrNpcAt` — equivalente de `find_object_at_xy`. **Consulta las DOS
  estructuras** (`state.worldObjects` y `NpcManager`) porque el binario tiene objetos y actores
  en la MISMA tabla 0x5C5A (objects.md:16). Sin la mitad de actores el gate sería ciego justo a
  la población que el snap recoloca. La planta es ARGUMENTO, no la viva (por eso no reusa
  `worldObjectAt`).
- `game.ts::bedSleep` — deja de llamar al snap por su cuenta; delega.

## 4. i18n — TRES capas revisadas, DOS ya estaban

- **es.json**: ★ la clave `"Thrown out of bed!\n"` **YA EXISTÍA** (línea 16314, `¡Echado de la
  cama!\n`). Mi inserción creó un DUPLICADO que `json.load` se comió en silencio: el conteo
  seguía dando 3998 y no hubo error. Detectado por el conteo que NO subía (la firma de
  `clave-json-duplicada-tras-merge`). **Revertido: `es.json` queda byte-idéntico a main.**
- **Consecuencia sobre la traducción**: era una **huérfana** — traducción viva de un string que
  NINGÚN emisor del port producía (género #47/#86). Este cableado le da emisor; no es una
  traducción nueva, es una que pasa a estar alcanzable.
- **approved-strings.json**: entrada NUEVA (era la que faltaba), con cita DS 0x422a / DATA.OVL
  fileoff 0x423a y bytes verificados contra `original/u5/ultima5/DATA.OVL`:
  `b'Thrown out of bed!\n'`.
- **lang=en**: byte-exacto por construcción — el core emite el literal inglés y `t()` es la
  identidad estricta en 'en'.

## 5. TESTS

`game/tests/bed-sleep-thrown.test.ts` (14) + reescrito el bloque 2 de `inn-wake-npc-snap.test.ts`.

**Fixture NO degenerada (#187)**: el NPC del horario existe en los datos, se coloca de verdad, y
hay aserción de precondición (`npcAt` ≠ null a la hora 8) **y** su contraste (null a la hora 7).

★ **El test discrimina el ORDEN, no sólo la existencia del gate.** El horario da al NPC una
**ventana de UNA hora** sobre la cama (`times=[0,8,9,9]`: hora 7 lejos · hora 8 encima · hora 9
lejos otra vez). Con snap→gate el mensaje sale en la hora 8; con gate→snap el gate vería la
colocación de la hora 7 (lejos) y a la hora 9 el NPC ya se fue ⇒ **no saltaría nunca**.

**Verificado por MUTACIÓN** (no por «pasa en verde»):

| mutante | rojos |
|---|---|
| M1 — gate desactivado | **4** (los 3 de NPC + el de objeto) |
| M2 — snap FUERA del bucle (= comportamiento de main) | **3** (los de NPC; el de objeto sigue verde, y debe) |

Que M2 deje verde el de objeto es correcto: el objeto no depende del snap. Que M2 ponga rojos los
tres de NPC prueba que el test mide **el snap por paso**, no sólo el gate.

Controles negativos: horario que nunca pisa la cama (duerme las 5 horas enteras, sin mensaje) ·
mapa sin NPCs · **adyacente no cuenta** (#149) · **otra planta no cuenta** (0x36cf) · objeto en la
casilla de al lado no dispara. Stream: 0 tiradas sin medianoche, **7** cruzándola (= el baseline
pre-registrado del §2a) + control de sensibilidad del contador.

### Corrección a un test heredado
`inn-wake-npc-snap.test.ts` sellaba el cableado con `expect(String(Game.prototype.bedSleep))
.toContain("wakeSnapNpcs")`. **Ese literal era compatible con la llamada única y tardía que este
carril ha tenido que corregir**: el test comprobaba que el nombre aparecía, no que se llamara
donde toca. Sustituido por una medida de conducta: **4 horas ⇒ 4 snaps, 1 hora ⇒ 1 snap**.

## 6. CABOS — declarados, NO cableados (cada uno pide tarjeta)

1. **CADENCIA 6× más gruesa.** El binario muestrea el gate cada 10 min; el port, cada hora. Total
   de minutos idéntico; probabilidad de pillar a un NPC de paso, menor. Clase C, ahora escrita
   con su número.
2. **★ La HORA DE DESTINO del original está mal calculada y el port no la modela.** 0x05a8 hace
   `target = g_hour + hours`; 0x05ab: si `> 0x17`, **`sub 0x17` — resta 23, no 24**. Así 24→1,
   25→2: al envolver por medianoche el original **despierta una hora tarde**. Además el binario
   sale cuando `g_hour == target`, o sea duerme **hasta el filo de hora**, no `hours` horas
   completas (si empiezas a y media, duermes media hora menos). El port duerme N horas exactas.
   Bug-for-bug candidato; NO tocado porque cambia cuánto dura el sueño y el HOLD de e2e impide
   medir el impacto en digests.
3. **El epílogo de 0x0692 no está portado** (ni antes de este carril): `inc g_party_x` (0x06d5 —
   la party sale de la cama **un paso al este**), `g_unk_24e6 = 1` (0x06d9),
   `inc g_char_anim_states+2` (0x06de), y el ciclo de estado `'G'→'S'→'G'` (0x05fa/0x06bf).
   El `inc g_party_x` es mecánica visible y emparenta con #227 (el caballo del pozo, mismo
   patrón de «coloca en x+1 sin test»).
4. **Sigue SIN MEDIR** (heredado de #230 §5.1) si algún horario real de `.NPC` coloca a un NPC en
   la casilla de una cama de posada. Alcanzable POR CONSTRUCCIÓN ≠ frecuente. Es un barrido de
   datos sobre CASTLE/TOWNE/DWELLING/KEEP.NPC; los tests de este carril usan fixture sintética y
   **no afirman nada sobre la frecuencia en juego real**.
5. **El gate devuelve el byte +0 del slot** (0x36d4), así que un slot que casara la posición pero
   tuviera +0 == 0 se leería como «no hay nadie». El port devuelve un booleano por presencia. No
   medido si existe algún registro con +0 == 0 y posición válida.
6. `find_object_at_xy` deja su índice en `g_cmb_scratch_x` (0x36d8) y el port no modela ese efecto
   lateral. Aquí nadie lo lee después; en otros llamadores (p. ej. el (B)oard de #130) sí.

## 7. ALCANCE

Tocado: `game/src/core/world/camp.ts`, `game/src/core/game.ts`,
`game/tests/fixtures/approved-strings.json`, `game/tests/bed-sleep-thrown.test.ts` (nuevo),
`game/tests/inn-wake-npc-snap.test.ts`, esta acta.
**NO** tocado: `main.ts` (embargo), `es.json` (byte-idéntico a main), `re/tools`,
`routine-census.json`, e2e (HOLD vigente = cero playwright).

---

# ANEXO #250 + #227 — el `+1` al ESTE: el mismo patrón, DOS veredictos distintos

Segundo commit del carril, sobre `main` @`ac5a929b`. GO del lead para adjudicar los dos
juntos «con la misma pregunta: ¿el binario comprueba antes del +1 o escribe a ciegas, y hay
algo aguas abajo que lo corrija?». La respuesta es **la misma para el código y distinta para
el resultado**, y esa asimetría es el hallazgo.

## A1. ★★ La tercera escritura del epílogo NO era una tercera escritura

La tarjeta #250 —que escribí yo— listaba el epílogo como cuatro cosas sueltas, una de ellas
`inc byte ptr [g_char_anim_states+2]`. **Los bytes dicen otra cosa.** CMDS 0x06de es
`fe065c5c` = `inc byte ptr [0x5C5C]`, y 0x5C5A + 2 = 0x5C5C = **el campo +2 del SLOT 0** de la
tabla que `find_object_at_xy` barre (slot 1 arranca en 0x5C62, stride 8; 0x36a6/0x36ed).

Qué es ese campo, por DOS testigos independientes que copian los tres ejes seguidos:

| sitio | hace |
|---|---|
| TOWN.OVL 0x160d-0x161c | `g_party_x`→[0x5C5C] · `g_party_y`→[0x5C5D] · `g_floor`→[0x5C5E] |
| ULTIMA.EXE 0x53a6-0x53b5 | idéntico, instrucción por instrucción |

⇒ **el slot 0 es el registro del PROPIO party** —por eso `find_object_at_xy` empieza en el
slot 1: para no encontrarse a sí mismo, que es justo lo que #241 necesitaba— y 0x06de es
**el mismo `+1` de 0x06d5 replicado en el espejo**, no una animación ni un tercer efecto.
El port tiene UNA representación de la posición, así que el `+1` se aplica UNA vez;
replicarlo sería andar dos casillas. Hay test anti-regresión para eso.

**Esto es evidencia directa para #251** (el nombre de 0x5C5A): el ledger la ficha como
`g_char_anim_states` «animation states», y su propio campo `size: 256` = 32 × 8 concuerda con
la tabla de actores y no con un contador de animación. El nombre es el que está mal, no el
tamaño. **No he tocado el ledger** (es de #251); lo dejo medido.

## A2. ¿Escribe a ciegas? SÍ las dos. ¿Es peligroso? SÓLO una.

Código, en los dos casos: `inc` pelado, cero tests, y nada aguas abajo lo corrige (tras
CMDS 0x06de sólo quedan `call 0x6980` + `call 0xffff9990` + `ret`).

Lo que los separa es el DATO, medido sobre los assets del port:

| | #250 cama | #227 caballo del pozo |
|---|---|---|
| población | 264 casillas LeftBed (0xAB) en las 32 small maps | 15 pozos → 56 posiciones de party plausibles |
| destino (x+1, y) transitable | **264/264 (100 %)** — siempre RightBed (0xAC) | **29/56; NO transitable en 27 = 48,2 %** |
| contraejemplos | **cero** | mayoría `LargeRockWall` (0x4D) |

La cama es de DOS tiles, sólo se duerme en la izquierda (el despacho acepta únicamente 0xAB,
0x32b9) y ambos tiles son `walkable` ⇒ **el `+1` es ciego en el código y seguro por
invariante de datos**. Calcado sin más.

## A3. Por qué en #227 NO se ha retirado la guarda (y no es prudencia)

El lead fijó el criterio «si el binario escribe a ciegas, el port fiel escribe a ciegas»,
con #237 de precedente. **La premisa no se cumple aquí porque las dos escrituras no van a la
misma capa:**

- el binario escribe un REGISTRO en la tabla de objetos DS:0x5C5A y **el terreno de debajo
  queda intacto** — el caballo se dibuja encima del muro;
- el port escribe en la capa de TERRENO (`setMapOverride`), así que colocar «a ciegas»
  **borraría el muro** y dejaría una casilla montable donde había roca.

Reproducir la ceguera sobre la capa equivocada no reproduce la conducta: **fabrica una
mecánica que el original no tiene** (atravesar paredes deseando en un pozo), y con el 48,2 %
medido no es un caso de borde. ⇒ la coordenada SÍ se calca (fijo (x+1, y), sin barrido); la
retirada de la guarda queda **GATED** tras la migración a `worldObjects` (#152/F1.5), que a
su vez espera a #137 (hoy `board()` lee el tile del TERRENO). Divergencia declarada con su
cifra en el docblock de `spawnWishHorse`.

## A4. Los tests que ya existían NO discriminaban

`wishing-well.test.ts` fijaba el caballo en (4,22) y **pasaba con los dos algoritmos**: su
fixture pone el POZO justo al norte del party, así que el barrido viejo (N,E,S,O) descartaba
el norte y elegía el este — la misma celda que la coordenada fija. Cambié el código y los 7
casos siguieron verdes. Los dos casos nuevos ponen el pozo al OESTE y dejan el norte LIBRE,
que es la única geometría donde las dos reglas difieren.

**Verificación por MUTACIÓN** (cuatro mutantes, todos con el rojo esperado):

| mutante | rojos |
|---|---|
| M3 — restaurar el barrido N,E,S,O | 2 (los dos nuevos; los 7 viejos siguen verdes ⇒ confirma que no discriminaban) |
| M4 — quitar el `+1` del epílogo | 3 |
| M5 — duplicar el `+1` (x += 2) | 3 (incluido el anti-regresión del espejo) |

El ciclo `'G'→'S'→'G'` va cableado con su propio control. CS 0x05f5 sólo pasa `'G'`(0x47) a
`'S'`(0x53) y CS 0x06ba sólo devuelve `'S'` a `'G'`, así que **un `'P'` envenenado atraviesa el sueño
intacto**; sin ese caso, un port que hiciera «todos a `'G'` al despertar» pasaría el test del
miembro sano y CURARÍA al envenenado.

## A5. Declarado y NO cableado

1. `g_unk_24e6 = 1` (0x06d9): marca de repintado de #228 (58 accesos, un solo lector). El
   port no modela esa capa y no se inventa un campo. Anotado para #228 — es una de sus 21
   `mov ,1`.
2. La retirada de la guarda de #227, gated como en §A3.
3. El nombre de 0x5C5A, medido aquí y adjudicable en #251 — no toco el ledger.

---

# ANEXO #231 — el desempate O,S,E,N del Yell: **INERTE**, y la tarjeta planteaba mal la población

Tercer tramo del carril, sobre `main` @`1071ebbc`. Método del lead: (1) alcanzabilidad PRIMERO
sobre los datos reales; (2) si es alcanzable, calcar; (3) si no, declarar INERTE con el barrido
como prueba (precedente #237). **Resultado: (3).** Cero código tocado.

## B1. La cota del bucle, leída (no supuesta)

`13f9: cmp si, 8 / jge` ⇒ el escaneo recorre **8 entradas**. Y las tablas: buscando los 40 bytes
del asset del port DENTRO de `DATA.OVL` (única ocurrencia cada una) salen en fileoff 0x1e9a y
0x1ec2 ⇒ **DS 0x1e8a (X) y DS 0x1eb2 (Y)**. La cita de la tarjeta, DS 0x1eaa/0x1ed2, está
**+0x20 exactos**: no es un error, es que el Yell indexa la SUB-tabla de las 8 mazmorras
(entradas 32..39 de locationsX/Y). Cuadra con el `cmp si,8`.

## B2. ★ La población NO es «dos entradas de mazmorra compitiendo»

El escaneo de los 4 vecinos vive **DENTRO** del bucle por mazmorra, detrás del gate de la
PALABRA (0x12e7 compara lo gritado contra la palabra de `si`; si no casa, `si++`). Así que
nunca compiten dos mazmorras: se busca **cuál de mis 4 vecinos lleva el tile que espera ESTA
mazmorra**. Y el test acepta TRES cosas (0x1302/0x1308/0x130c, replicado en los 4 vecinos):

| criterio | qué es |
|---|---|
| `[si+0x4512]` | tile de entrada POR MAZMORRA — leído en DS 0x4512: `0x16` CaveEntrance ×3, `0x17` MineEntrance ×2, `0x18` DoomEntrance ×3 |
| `0xDF` | **BlockEntrance** = la entrada SELLADA |
| `0x1A` | **BrokenShrine** |

★ Y `0x1A` no es un comodín más: en 0x1373 `cmp [bp-0xa],0x1a / jne 0x139a` se va por una rama
propia que **retorna sin el chequeo de coordenada** (0x1398 `jmp 0x140f`) ⇒ la misma rutina
sirve DOS mecánicas, y la del santuario es hermana del «The Shrine is restored!» de CMDS 0x1298.
`0xDF` tampoco es decorativo: 0x13da-0x13e0 hace `al = [si+0x4512] xor 0xdf; xor [bx], al`, o sea
**alterna el tile del mapa entre la entrada y BlockEntrance** — es el sello.

## B3. Las mediciones

Sobre los datos reales (`data.json` verificado byte a byte contra `DATA.OVL`, y `overworld.json`):

| medición | resultado |
|---|---|
| pares de entradas que comparten vecino ortogonal — `(\|dx\|,\|dy\|) ∈ {(1,1),(2,0),(0,2)}` | **0** |
| par MÁS CERCANO de las 8 | **manhattan 37** (`(126,20)`–`(156,27)`); harían falta ≤2 |
| ocurrencias de `0xDF` BlockEntrance en el overworld | **0** |
| ocurrencias de `0x1A` BrokenShrine en el overworld | **0** |
| tiles de entrada en el mapa | **7**: 2×`0x16`, 2×`0x17`, 3×`0x18` — y cada uno EXACTAMENTE en su coordenada de tabla |
| 8ª entrada de la tabla, `(128,128)` | tile `0x01` (agua profunda) ⇒ centinela, no mazmorra |

Control de que el medidor mide: con un par FABRICADO a `(dx,dy)=(2,0)` lo caza (no degenerado).

⇒ Los dos comodines **no existen en el mapa distribuido**: son estados de RUNTIME que escribe el
propio XOR del sello. Así que en cualquier estado alcanzable un vecino sólo casa por ser la
entrada de ESA mazmorra, y como las entradas están a ≥37 casillas **dos vecinos no pueden casar
a la vez**. El desempate O,S,E,N **nunca se ejerce**.

## B4. El port, careado

`game.ts` escanea en orden **N,E,S,O** — distinto del binario — pero su criterio es
`locationAt(locationsX, locationsY, …)`, o sea la COORDENADA, y acumula en un array. Por la misma
medición ese array **no puede tener dos elementos**, así que el orden es inobservable.
**No se toca**: cambiarlo a O,S,E,N sería mover código que ningún estado alcanzable distingue, y
el port quedaría igual de fiel con una diferencia cosmética más que mantener.

**Segundo cabo de la tarjeta** («el port pierde la distinción tile-que-casa vs 0xdf/0x1a —
¿cambia el conjunto?»): **NO lo cambia**, y ahora medido. En el mapa distribuido tile-match y
coord-match coinciden (los 7 entrances están en su coordenada con su tile). Al sellarse, el tile
pasa a `0xDF` y el binario sigue casando por comodín mientras el port sigue casando por
coordenada — que no cambia. Los dos criterios coinciden en todo estado alcanzable.

## B5. Declarado

1. Lo anterior vale para la GEOGRAFÍA DISTRIBUIDA. Un save que moviese una entrada (o un mod)
   rompería la premisa; el veredicto es sobre los datos del juego, no un teorema.
2. La rama `0x1A` (santuario) y el XOR del sello quedan LEÍDOS pero no careados contra el port —
   no era el encargo. Cabo para quien toque `shrine_restore`.
3. `0x58D0` (el `xor [si+0x58d0],0x80` del sello, 0x13bd) es una de las direcciones que #253
   tiene abiertas como AMBIGUAS; aquí se ve consumida como **bitmap de sello por mazmorra
   indexado por `si` 0..7**. Dato para esa tarjeta; no la toco.
