# FASE 3 — REPLAY DE INTERIORES DE MAZMORRA 3D (diseño + ruling + lo que midió 3a/3b)

> Documento de DISEÑO del relevo-3b, **con el ruling del lead aplicado y las CORRECCIONES que
> el instrumento real obligó** (relevo-4). Lo que el diseño supuso y resultó FALSO va marcado
> `⚠ CORREGIDO EN 3a`, no reescrito: la traza de por qué el modelo cambió es el valor.

## 0. RULING DEL LEAD (2026-07-25) y estado

| # | pregunta del §10 | ruling | estado |
|---|---|---|---|
| 1 | política del errante | **A — CONGELADO**, con la costura DECLARADA Y CONTADA, implementada por instrumento del ARNÉS (no tocando la lógica del core) | HECHO (`freezeWanderer`, `wandererFrozen` en cada segmento) |
| 2 | hooks de core | APROBADOS y aterrizados por este carril: `setDungeonPos` cero-rand (probado con contador de rand) + `dungeonPos()` read-only, dev-only, con el por-qué-no-`teleportDungeon` en el JSDoc | HECHO (main 16754030) |
| 3 | métrica | **APARTE** hasta que 3c cierre: `conformidad-smallmap` y `conformidad-interiores` como dos líneas | HECHO (`report.interior`, `summarize` con dos líneas) |
| 4 | (V)iew de gema | **para 3e**, no en 3b: `pending` y contada | HECHO (34 beats de gema contados en AD, 0 conducidos) |

## 0b. LO QUE 3a ENCONTRÓ Y EL DISEÑO NO SABÍA (dos correcciones)

1. **El material no estaba curado.** Los `ctx:dungeon` llegaban con ~99% de sus ops en `todo` y
   **CERO nav** (part16-g05: 536 de 539 ops). El diseño contaba los 22 100 bloques atrapados como
   material listo para medir; abrirlos tal cual habría dado conformidad ~0 con el port **sin
   pulsar una sola tecla** — instrumento, no port. De ahí `tools/derive-dungeon-ops.mjs`.
2. **Los segmentos son MIXTOS** (pasillo + SALA en el mismo segmento: el segmentador cortó por
   banners, no por fronteras de sala), así que «los 48 segmentos `dungeon`» NO son 48 pasillos y
   el SEGMENTO no es la unidad que separa pasillo de sala. La separación se hace a nivel de
   BLOQUE (`sala-diferida`), que además es más informativa.
3. **Corolario bueno**: el vocabulario del pasillo es RELATIVO AL FACING. El diseño lo leyó como
   pérdida (§2.2, «el eco no dice la dirección») y para el REPLAY es una GANANCIA: reproducir la
   secuencia relativa desde el mismo estado de entrada reproduce la ruta EXACTA sin conocer la
   celda. La celda deja de ser necesaria; la PLANTA sigue siendo el ancla (§3).

## 1. Qué abre — el censo, que es más grande de lo que parece

Los segmentos marcados `skip: "pendiente-runner"` se atraviesan **nav-only**: sin diff, sin
combate, sin costura. Hoy son:

| corpus | segmentos | con SKIP | bloques `expect` atrapados |
|---|---|---|---|
| AD (`ad01..25`) | 646 | **245** | **22 100** |
| LP1 (`part01..06`) | 386 | 84 | (no censado) |

Los 22 100 bloques atrapados en AD **superan a los ~14 900 comparables que la suite mide hoy**.
Abrir los interiores no es un incremento marginal: más que dobla el corpus comparable del
espejo. Por contexto declarado del segmento, los SKIP de los dos corpus se reparten así:

```
post-combat 209   dungeon 48   combat 23   resume 20   overworld 20   start 9
```

El nombre engaña: `post-combat` no es «después del combate», es **el interior de la mazmorra
tras un combate de pasillo** — el grueso del material. Los tres primeros (280 de 329) son la
familia de mazmorra; los `resume/overworld/start` son otra cosa (re-entradas y arranques) y NO
entran en esta fase.

## 2. Por qué el interior no es «lo mismo pero dentro»

Tres diferencias estructurales rompen el instrumento que funciona en pueblo/overworld:

1. **El FACING es estado oculto y load-bearing.** En smallmap la party tiene (x,y) y los
   comandos llevan su dirección explícita (`Look-East`). En 3D, `DungeonState.pos` es
   `{dungeon, floor, x, y, facing}` y **el facing decide qué se ve, qué se abre y hacia dónde
   se avanza**. El OCR del LP casi nunca lo dice: el eco de avance es `Advance` (DUNGEON
   `move()` 0x0502, rama `dir==3` @0x0542) — sin dirección. Dos party en la misma celda con
   facing distinto producen transcripts distintos y ninguna ancla de posición lo detecta.
2. **El eco de movimiento es POBRE.** El replay-por-inputs del espejo se apoya en que el OCR
   del LP es el input-log del humano (`>North`, `>Ride East`). Dentro, el vocabulario colapsa a
   `Advance` / `Turn` / `Klimb` / `Descend` / `Blocked!`: el mismo eco para pasos que llevan a
   celdas distintas según el facing acumulado. La deriva se vuelve **invisible hasta que es
   grande**, justo lo contrario que en el overworld.
3. **El ERRANTE mueve el stream RNG.** `core/dungeon/wanderer.ts` consume aleatoriedad en cada
   turno del mundo: hasta 8 intentos `rand(0,3)` para su dirección, gate de ataque
   `rand(0,7)==1`, y al re-armarse `rand(0,7)` de banco + hasta 8 `rand(0,63)` de posición +
   `rand(0,99)` del roll de oculto. **El stream del port y el del LP divergen en el primer
   turno de mazmorra y no vuelven a converger.** Consecuencia dura: dentro de una mazmorra, la
   comparación beat-a-beat de todo lo que dependa del errante es estructuralmente imposible.

## 3. Anclas dentro: ¿qué sirve?

La pregunta del encargo era «¿facing+planta+celda?». Respuesta: **los tres, pero en jerarquía
distinta y con fuentes distintas** — y ninguno se deriva del OCR como se derivan las anclas de
cara en smallmap (donde `Look-East ...a hot stove` era invertible por LOOK2).

| ancla | fuerza | de dónde sale en el OCR del LP | verificable en el port |
|---|---|---|---|
| **mazmorra (id)** | fuerte | banner de entrada + Word of Power | `pos.dungeon` |
| **planta** | fuerte | ecos `Klimb`/`Descend` contados + «You are on level N» de la gema | `pos.floor` |
| **celda (x,y)** | débil | NO derivable directo; sólo por conteo de `Advance` desde la entrada | `pos.x/y` |
| **facing** | fuerte pero ESCASO | ver §4 | `pos.facing` |

Propuesta: **el ancla primaria dentro NO es la celda, es la PLANTA**, y la costura de resync es
el cambio de planta (`Klimb`/`Descend`), no el beat de interacción. Las plantas son pocas (8),
sus transiciones sí dejan eco inequívoco en el OCR, y la entrada de cada planta es una celda
conocida. Eso convierte el interior en una cadena de tramos cortos re-anclados — la misma
receta que arregló la deriva en smallmap, pero con la planta como unidad.

## 4. El oráculo del FACING (la joya que ya está en el core)

`dungeon.ts:1392` — la emboscada del errante imprime dos mensajes DISTINTOS según el facing:

```ts
const facingDir = DIR_TO_FACING[dir]!;
if (facingDir !== this.pos.facing) {
  events.push({ kind: "message", text: tf("Attacked from the {}!", DIR_WORDS[dir]!) });
  this.pos.facing = facingDir;          // ⚠ y MUTA el facing
  events.push({ kind: "turned" });
} else {
  events.push({ kind: "message", text: "Attacked!" });
}
```

Esto tiene tres consecuencias para el diseño, y la tercera es una trampa:

- **«Attacked from the west!» es un ORÁCULO DE FACING.** Si el LP dice `Attacked from the west!`
  y el port dice `Attacked!` (o *from the north*), el facing del port ≠ el del LP en ese beat.
  Es la única lectura directa del facing que el corpus regala.
- La **palabra de dirección es comparable** (`DIR_WORDS`, plantilla i18n compuesta ya en el
  manifest), así que entra en el diff como cualquier bloque: no hace falta instrumento nuevo.
- **TRAMPA: el mensaje muta el facing** (`this.pos.facing = facingDir`). Así que un `Attacked
  from the …` divergente no es sólo un síntoma: **desincroniza el facing hacia delante**. Y
  como el errante depende del RNG (§2.3), esa desincronización llega por una vía que el replay
  NO controla. Corolario de diseño: **el facing hay que re-anclarlo DESPUÉS de cada emboscada**,
  no sólo en las costuras de planta.

Segundo oráculo, más rico y hoy sin usar: **la gema de mazmorra**. `View a gem!` aparece 71×
en el corpus AD y está en la lista `AD_PENDING` (flujo sin conducir). Una gema es un volcado
de la planta ENTERA (22×22 con wrap + flood-fill, ya implementado y calcado). Si el runner
conduce la (V) donde el LP la usó, obtiene una comparación de **planta + celda + revelados de
una vez**. Es el ancla más fuerte disponible dentro y la más barata de conducir (una tecla).
Su pega: el contenido de la gema es GRÁFICO, así que el OCR del LP no lo trae como texto — la
comparación tendría que ser del eco («You are on level N») más, si el lead quiere ir lejos,
pixel-diff contra el frame del vídeo (protocolo `tools/evidence.sh`, fuera de esta fase).

## 5. El errante y el stream RNG — la decisión de POLÍTICA

Es el punto que necesita ruling. Cuatro opciones, con lo que cada una cuesta y lo que cada una
DEJA DE PROBAR:

| # | política | qué gana | qué pierde / riesgo |
|---|---|---|---|
| A | **Errante congelado** durante el replay (instrumento declarado, `wanderer` inactivo) | el interior se vuelve determinista: celda/planta/facing comparables beat a beat | deja SIN EJERCITAR al errante y sus emboscadas — justo el subsistema recién portado; y los beats de emboscada del LP quedan como huecos declarados |
| B | **Errante vivo, emboscadas NO-COMPARABLES** (clase `rng`, como los encuentros del overworld) | el errante se ejercita de verdad; cero fabricación | el facing se desincroniza sin control (§4) → hay que re-anclar tras cada emboscada, y los tramos entre emboscadas se acortan mucho |
| C | **Errante vivo + comparación por CLASE** (no «¿dijo esto?» sino «¿hubo emboscada con dirección legible?») | mide la MECÁNICA sin exigir el mismo roll | métrica nueva que hay que definir con cuidado para que no se auto-absuelva |
| D | Sembrar el RNG para reproducir el stream del LP | comparación exacta | **inviable**: el stream del LP arrastra toda su partida previa; no es reconstruible |

**Recomendación del carril: A para la primera pasada, B/C después.** Razón: la Fase 3 debe
primero demostrar que el runner sabe NAVEGAR el interior (planta, facing, escaleras, celdas) —
y eso no se puede medir si el errante mete ruido no-controlado en la misma pasada. Con el
interior navegable y re-anclado, soltar el errante (B+C) es un incremento medible. Mezclar las
dos cosas en la primera pasada es exactamente el error que hundió la conformidad AD del
estreno: dos fuentes de deriva simultáneas y ningún modo de atribuir la culpa.

⚠ Si el lead elige A, el congelado del errante **debe ser una costura de arnés declarada y
contada** (como `typedSkipped`/`recruit`/`dismiss`), no un flag silencioso: cada segmento con
errante congelado tiene que decirlo en su reporte, o la conformidad miente por omisión.

## 6. Escaleras y plantas

`Klimb` / `Descend` son la costura natural (§3). Lo que hace falta:

- **Contador de plantas del OCR**: los ecos de `Klimb-Up`/`Klimb-Down`/`Descend` del LP dan la
  planta esperada por conteo desde la entrada (que es conocida). Derivable OFFLINE, en el
  pipeline de `segment.mjs`, igual que las anclas de cara: sale en `op.anchor` como
  `{kind:"floor", floor:N}`.
- **Aviso**: el modelo `dungeonDescendTo` es DESCENT-ONLY (lección ya aprendida en el carril
  de salas: bolsillos aislados). Un resync de planta hacia ARRIBA no puede ir por ahí.
- El hoyo (`fall`) cambia de planta SIN eco de Klimb — hay que tratarlo como transición
  legítima y no como deriva.

## 7. Combates de pasillo

`combat-corridor` (causa `ambush`) ya está implementado y con política de resolución en el
runner (`policy: auto|escape`). Dentro del interior, dos cambios:

- El combate de pasillo **hereda la posición y el facing** de la mazmorra: al salir hay que
  verificar `pos` contra lo esperado (el carril de emboscadas ya enseñó que un combate sucio
  contamina los GOAL aguas abajo).
- El texto de combate es el que más ruido RNG trae (el censo de divergentes de AD lo confirma:
  los patrones RNG calibrados con aulddragon no casan la firma de combate de AD). **Antes de
  abrir los 209 `post-combat`, hay que recalibrar los patrones RNG de combate para el corpus
  AD** — si no, se añaden ~20k bloques al denominador que van a divergir por instrumento y la
  conformidad global se hunde otra vez. Esto es prerrequisito, no trabajo posterior.

## 8. Lo que hace falta del CORE (petición al lead, no lo toco desde aquí)

`__u5debug.teleportDungeon(dungeonId, floor, x, y)` existe pero **no sirve tal cual** para el
resync:

1. **No fija el facing** (su JSDoc: «El facing se conserva») — y el facing es el ancla que más
   importa dentro (§4).
2. **No es cero-rand**: si no estás ya dentro, entra por el flujo real (`game.enterDungeon`),
   que puede tocar el stream. Todas las costuras sancionadas del espejo (`goToLocation`,
   `teleportSmallMap`, `teleportOverworld`) son cero-rand a propósito; ésta rompe la regla.

Petición concreta: **un `setDungeonPos(dungeon, floor, x, y, facing)` cero-rand** (fijar
`dungeonState.pos` sin recarga ni entrada, análogo a `setPosition`) más un hook read-only
`dungeonPos()` para leer `{dungeon,floor,x,y,facing}` desde el arnés. Con esos dos, el resync de
interior es de la misma clase que el de smallmap y no hay que inventar nada.

## 9. Plan por fases (con puntos de corte)

- **3a — instrumento, sin abrir SKIP.** ✅ HECHO (relevo-4): hooks del core (§8) + `dungeonPos` en
  el reporte + **derivación de OPS de pasillo** (`tools/derive-dungeon-ops.mjs`), que el diseño no
  previó porque suponía el material curado (§0b.1).
- **3b — abrir los `dungeon` de PASILLO** con errante congelado (§5-A) y ancla de planta.
  ⚠ CORREGIDO EN 3a: no son «los 48» — 9 de los 27 AD son pasillo con material y mazmorra
  determinable; el resto queda cerrado con RAZÓN declarada (sala: 13, material insuficiente: 4,
  no clasificable: 2, mazmorra indeterminable: 1). Los 21 de LP1 son INALCANZABLES esta
  encarnación: viven en part16-22 y la cadena LP1 sólo tiene checkpoints hasta part06 (part16
  exige el de part15 → 9 partes largas de por medio). **Punto de corte** (orden del lead): si la
  conformidad de interior no supera la de smallmap, el modelo está mal y se PARA.
  Tres roturas de instrumento aparecieron y se cerraron ANTES de pronunciar el veredicto, porque
  con cualquiera de ellas el número habría sido una mentira:
   1. la costura no disparaba sin `enter.loc` → el runner pulsaba las teclas del pasillo **sobre
      el overworld** (ad23: «North / Blocked! / Slow progress!»);
   2. las `nav`/`key` viejas del material de SALA seguían conduciéndose dentro del 3D y sacaban a
      la party de la mazmorra (ad15: «Klimb-U/D- / Up! / Exit to Britannia!»);
   3. la clasificación pasillo/sala no era idempotente y re-cerraba pasillos ya abiertos.
- **3c — recalibrar los patrones RNG de combate para AD** (§7). ✅ HECHO (relevo-5): `AD_COMBAT_RNG`
  + `isRosterTail` sobre `probeFold`, en la ÚLTIMA posición del diff (monótono sobre `matched`);
  material MIXTO abierto (interiores 9 → 17, clase `mixed`); interior 15.5% → **20.5%** con el
  denominador CRECIENDO 232→293; smallmap 7.3% → **10.0%** con el numerador IDÉNTICO (1862).
  Detalle y descomposición en el README §FASE 3c. De paso: un interior FALSO cazado
  (`enter.loc` de PUEBLO abierto como mazmorra → `isDungeonLoc`) y el candidato `(O)pen`
  ADJUDICADO como sapo real (§11).
- **3d — abrir los 209 `post-combat`.** Es el 85% del material; sólo tras 3b+3c verdes.
  ✅ **DEBERES PREVIOS CERRADOS (relevo-6)**, detalle y números en el README §FASE 3d:
   1. `sala-diferida` movida a la ÚLTIMA posición del diff → ya no puede retirar matches. Al
      medirlo salió algo que el diseño no esperaba: era **casi enteramente REDUNDANTE** con lo ya
      calibrado (de 949 bloques que retiraba, 680 los reconocía el `RNG_AUTO` histórico y 257 el
      `combat-rng` de 3c). Lo único que hacía de más era lo que la deuda predecía: **1 match REAL
      borrado**. Se conserva porque 7 de 741 siguen necesitándola.
   2. `resolveDungeonForPostCombat` = retroceso ESTRICTO con parada en la salida (`leavesDungeon`)
      y sin el atajo «única mazmorra de la ruta». **Corrección al enunciado del deber**: el gate
      `isDungeonLoc` era necesario pero NO suficiente — el agujero real de un `post-combat` no es
      que su `enter.loc` sea un pueblo (no tiene `enter` en absoluto), sino que el retroceso
      ingenuo le encuentra un banner de mazmorra ARBITRARIAMENTE lejos, cruzando salidas. Lo que
      cierra el agujero es la PARADA, no el rango.
   3. ⚠ CORRECCIÓN AL MODELO DE COSTURA: un post-combat **no se puede teletransportar**. La única
      celda que la costura de 3b sabe fijar es la de ENTRADA de la mazmorra, y a mitad de visita
      el LP no está ahí. La costura de 3d es `carryover`: COMPRUEBA que la party siga dentro y, si
      no lo está, declara y no conduce. Es el mismo principio que el `floorUnknown` de 3b — no se
      inventa profundidad, y ahora tampoco celda.
  **Material abierto**: 72 segmentos AD (17 → 89 interiores), 7 465 bloques, 809 ops. LP1 abre 20
  más, todos en part16-22 = inalcanzables esta encarnación.
  **PENDIENTE**: la medida EN VIVO (la ventana estaba ocupada por otro carril). El listón está
  fijado y es auditable: la línea base «sin conducir» del propio material de 3d es 8.4%
  (`.espejo-r3b`, 69 segs) / 16.1% (`.espejo-3c`, 27 segs), y en 3b/3c conducir valió ~×2 sobre
  esa misma línea base.
- **3e — errante vivo (§5-B/C) + gema como ancla (§4).**
- **PENDIENTE NUEVO de 3b/3d: la PLANTA DE ENTRADA de un segmento del medio.** Hoy la costura entra
  por la cima y el `Klimb-Up!` del LP la falsifica (`floorUnknown`). Es derivable OFFLINE contando
  los Klimb desde la entrada de la mazmorra, **pero el conteo cruza los `post-combat`**, que 3d aún
  no abre: la derivación completa del contador de plantas (§6) es trabajo de 3d, no de 3b.
  **Confirmado por 3c (relevo-5), y es MÁS de 3d que antes**: en el lote medido `floorUnknown` = 0
  y las plantas casan (ad17: 8✓/2↷/0?), así que el pendiente NO está bloqueando la medición de hoy
  — pero al abrir los mixtos el conteo de Klimb pasa a cruzar TAMBIÉN las salas de esos segmentos,
  no sólo los `post-combat`. Sigue sin tocarse: no se inventa profundidad.

## 11. DIVERGENCIA DE PORT **ADJUDICADA** (relevo-5): `(O)pen` sin cofre imprime «What?», no «No chest here.»

El candidato que 3a dejó abierto queda **ADJUDICADO como sapo REAL del port**. La mitad que
faltaba no era la del port (que ya se tenía) sino la del ORIGINAL, y no hacía falta correr LP1
part16: sale del binario.

**Mitad ORIGINAL** — `re/disasm/SJOG.OVL.asm`, handler de (O)pen de mazmorra en `0x12d4`. Lee el
tile de la celda de la party (`0x595a`, indexado `floor<<6 | (y&7)<<3 | (x&7)`) y despacha por el
nibble alto con TRES salidas, no dos:

```
130b: 24f0        and al, 0xf0
130d: 3c40        cmp al, 0x40      ; ¿COFRE?
130f: 7549        jne 0x135a
  ...             ; trampa (test 7 → call 0x7050), tile ← (tile&8)+0x70
1355: b8968b      mov ax, 0x8b96    ; → "Chest opened"
135a: 8a46fc      mov al, [bp-4]
135d: 24f0        and al, 0xf0
135f: 3c70        cmp al, 0x70      ; ¿COFRE YA ABIERTO?
1361: 7505        jne 0x1368
1363: b8a68b      mov ax, 0x8ba6    ; → "Already Open!"
1366: eb03        jmp 0x136b
1368: b8b68b      mov ax, 0x8bb6    ; ← NI COFRE NI ABIERTO
136b: 50          push ax
136c: e86145      call 0x58d0       ; imprime
```

Y el despachador de (O)pen en `0x1374` manda a `0x12d4` **sin prompt de dirección** cuando la
location es mazmorra: `cmp g_location,0x20 / jbe 0x138e` + `cmp 0x29 / jae 0x138e` → sólo
`0x21..0x28` (= 33..40) entran. En mazmorra el (O)pen NO pregunta dirección.

**Los bytes de la tabla** (`DATA.OVL`, fileoff = offset DS + 0x10; la convención se AUTO-VALIDA
porque 0x8ba6 sale exactamente «Already Open!», que el port ya citaba):

```
0x8b90+10: 7074 7921 0a00 0a43 6865 7374 206f 7065   pty!...Chest ope
0x8ba0+10: 6e65 640a 0000 416c 7265 6164 7920 4f70   ned...Already Op
0x8bb0+10: 656e 210a 0000 5768 6174 3f0a 0000 4974   en!...What?...It
```

→ **0x8b96 = «\nChest opened», 0x8ba6 = «Already Open!», 0x8bb6 = «What?»**. Idéntico en las 3
copias de DATA.OVL (`ultima5/`, `play/`, `ultima5/upgrade/`).

**Mitad PORT** — `src/core/dungeon/dungeon.ts:1041`:
```ts
if (cell.type !== CellType.Chest) return [{ kind: "message", text: "No chest here." }];
```

**Veredicto.** El original imprime **«What?»**; el port imprime **«No chest here.»**, una cadena
que **no existe en NINGÚN binario del original** (`strings -a` sobre todos los .OVL/.EXE: 0 hits
de «chest here»). El OCR de LP1 part16-g05 traía «Open-What?» = eco del comando `Open-` + la
respuesta `What?`: **el OCR tenía razón y el port fabricó el mensaje**. La rama
`"Already Open!"` (0x8ba6) sí es correcta — la divergencia es EXACTAMENTE la tercera salida.

Ticket para el lead: cambiar `"No chest here."` → `"What?"` en `openChest` (DATA.OVL 0x8bb6,
SJOG.OVL 0x1368). Ojo, «What?» es genérico (14 ocurrencias en DATA.OVL): la cita que lo fija a
este beat es el `mov ax, 0x8bb6` de 0x1368, no la cadena.

## 10. Preguntas para el ruling

1. **Política del errante**: ¿A (congelado, con la costura declarada y contada) para 3b, como
   recomienda el carril? ¿O B directo?
2. ¿Se aprueban los dos hooks de core de §8 (`setDungeonPos` cero-rand + `dungeonPos()`
   read-only), y los pide el carril del espejo o los aterriza el lead?
3. ¿Cuenta la conformidad de interiores en el MISMO número global que hoy, o como métrica
   aparte hasta que 3c cierre? (Mezclarlas antes de recalibrar el RNG de combate hunde el
   número global por instrumento — la lección del estreno AD.)
4. ¿Se conduce la (V)iew de gema (hoy `pending`, 71× en AD) en 3b, o se deja para 3e?
