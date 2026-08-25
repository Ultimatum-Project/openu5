# ACTA — carril `ventana-salas`: re-adjudicación de Wrong (ch23) y Covetous (ch24)

**Fecha:** 2026-07-28 · **Rama:** `e2e/ventana-salas` · **Base:** `main` @ `21fdedf5`
**Disparador:** FASE 3 de la ventana de validación. La corrida de ventana del lead dejó
`ch23-salas-wrong` FASE-2 en ROJO y `ch24-salas-covetous` FASE-2 en ROJO, con 2 tests
posteriores sin correr.

---

## 0. Qué cambió debajo y por qué los dos capítulos tenían que ponerse rojos

La **pieza 14 del lote #54** (`main 13b46ee6`) cableó el mecanismo real de la familia de
sprite `0xEC` (tiles 236-239, los «remolinos»):

- `DNGLOOK.OVL 0x1273-0x128c` — al montar la escena de sala se tira `rand(0,7)` **cuatro
  veces** contra la tabla de 8 índices de DS `0x385e` (= `DATA.OVL` fileoff `0x386e`,
  volcada con `xxd`: `14 15 16 22 21 18 1f 18` = Giant Rat · Bat · Giant Spider · Python ·
  Skeleton · Slime · Insect Swarm · Slime) y se guarda ese **pool de 4**.
- `DNGLOOK.OVL 0x12ee-0x12f7` (`and bx,3` sobre el tile) — cada unidad lee `pool[tile & 3]`
  ⇒ **236 → pool[0] … 239 → pool[3]**: tiles de la MISMA familia dan enemigos DISTINTOS.

Antes de la pieza 14 el port no colocaba **nada** por esas unidades. Los dos capítulos
sellaban sus veredictos sobre esa premisa: salas que se ganaban **por ausencia** y salas
que «perdían remolinos». La premisa está **retirada por derivación** (no por medida), y con
ella la caveat `PENDIENTE-ORÁCULO 0xec` que encabezaba ambos specs.

**Los sellos viejos eran el DETECTOR y dispararon exactamente como debían**
(`specs-detector-vs-veredicto`): el rojo decía «el port cambió», y el port cambió.

---

## 1. WRONG — `ch23-salas-wrong` (loc 36, combatmap = 48 + roomNo)

Elenco estático del `.CBT` (censo sobre `game/assets/maps/combatmaps.json`, clasificando
con las mismas reglas del cargador: `sprite < 0x40` y familias `0xB4`/`0xE8` = objeto de
arena, familia `0xEC` = grupo aleatorio, resto = índice `(sprite−0x40)>>2`).

| sala | cm | elenco del `.CBT` | ANTES | AHORA | roster JUGADO → vivos:bajas |
|---|---|---|---|---|---|
| r0 | 48 | 4 Orc · **0 unidades 0xEC** | VICTORY | **VICTORY** | `4xOrc` → `e0:d0` — el lote no la toca |
| r1 | 49 | **sólo 0xEC**: 3×t236 + 4×t237 (+2 objetos) | VICTORY | **DEADEND** ⚑ | `4xInsect Swarm+3xSkeleton` → `e7:d0` (los 7 en pie) |
| r2 | 50 | **sólo 0xEC**: 6×t236 + 8×t237 (+2 objetos) | VICTORY | **DEADEND** ⚑ | `8xInsect Swarm+6xSkeleton` → `e14:d0` (los 14 en pie) |
| r3 | 51 | 3 Ghost + 3 Skeleton + 4×t236 | DEADEND | **DEADEND** | `3xGhost+7xSkeleton` → `e10:d0` — de 6 a 10 y NO se mueve |
| r4 | 52 | 4 Mimic + 5×t236 + 3×t237 | VICTORY | **VICTORY** | `3xInsect Swarm+4xMimic+5xSkeleton` → `e0:d0` — victoria **peleada sobre 12**, antes sobre 4 |
| r5,r6,r15 | — | muradas | SKIP | SKIP | `SKIP-pend-entrada-murada` |
| r7-r14 | — | plantas 2-7 | SKIP | SKIP | `SKIP-pend-entrada-2b` |

El pool de Wrong salió `pool[0] = Skeleton`, `pool[1] = Insect Swarm` en las cuatro salas con
unidades `0xEC`; el censo estático cuadra unidad a unidad con el roster jugado (r3: 3 Skeleton
fijos + 4 del t236 = los 7 medidos; r4: 5 del t236 + 3 del t237 + 4 Mimic = los 12).

**2 flips, los dos en el mismo sentido y por la misma causa.** r1 y r2 son las dos únicas
salas de la pasada cuyo elenco es **íntegramente** de la familia `0xEC`: ganarlas era
cruzar un tablero vacío. Con enemigos reales dentro, la party no alcanza a ninguno —
`e7` y `e14` significan **roster entero en pie**, y `d0` que **no hubo ni una baja**: no es
una pelea perdida, es una sala a la que no se llega.

r3 y r4 conservan outcome, y eso también es información: el mismo veredicto se sostiene
ahora sobre una sala **más poblada** (r3 de 6 a 10, r4 de 4 a 12), así que ninguno de los
dos sellos colgaba de que la sala estuviera despoblada.

---

## 2. COVETOUS — `ch24-salas-covetous` (loc 37, combatmap = 64 + roomNo)

| sala | cm | elenco del `.CBT` | ANTES | AHORA | roster JUGADO y vivos al cerrar |
|---|---|---|---|---|---|
| r0 | 64 | 1 Ghost + 4×t236 + 6×t237 | DEADEND | **DEADEND** | `1xGhost+6xGiant Spider+4xSkeleton` → `e4:d0` (mata 7 de 11) |
| r1 | 65 | 1 Ghost + 6×t236 + 6×t237 | DEADEND | **DEADEND** | `1xGhost+6xGiant Spider+6xSkeleton` → `e6:d0` (mata 7 de 13) |
| r2 | 66 | 2 Ghost + 4×t236 + 4×t237 + 2×t238 | DEADEND | **DEADEND** | `4xBat+2xGhost+4xGiant Spider+2xSlime` → `e8:d0` |
| r3 | 67 | 1 Ghost + 9×t236 + 3×t237 | DEADEND | **DEADEND** | `9xBat+1xGhost+3xSlime` → `e9:d0` |
| r4 | 68 | **sólo 0xEC**: 7×t236 + 7×t237 | VICTORY | **DEADEND** ⚑ | `7xInsect Swarm+7xSlime` → `e14:d0` (0 de 14) |
| r6 | 70 | 4 Giant Rat + 9×t236 | VICTORY | **DEADEND** ⚑ | `4xGiant Rat+9xGiant Spider` → `e9:d0` (mata las 4 Rat, las 9 Spider selladas) |
| r7 | 71 | 16 Ghost · 0 unidades 0xEC | VICTORY | **VICTORY** | `16xGhost` → `e0:d0` |
| r8 | 72 | 1 Gazer + 4 Headless + 6×t236 + 3×t237 | VICTORY | **VICTORY** | `6xBat+1xGazer+3xGiant Spider+4xHeadless` → `e0:d0` — **victoria sobre 14, antes sobre 5** |
| r9 | 73 | 6 Daemon · 0 unidades 0xEC | VICTORY | **VICTORY** | `6xDaemon` → `e0:d0` |
| r10 | 74 | 2 Ghost + 1 Skeleton + 5×t236 + 5×t237 | DEADEND | **DEADEND** | `2xGhost+1xSkeleton+10xSlime` → `e11:d0` |
| r11 | 75 | 2 Ghost + 1 Reaper + 3 Daemon · 0 unidades 0xEC | DEADEND | **DEADEND** | `e1:d0` (mata 5 de 6) |
| r15 | 79 | 2 Bat + 2 Reaper + 3 Daemon · 0 unidades 0xEC | DEADEND | **DEADEND** | `e7:d0` |
| r5,r12,r13,r14 | — | room-locked / muradas / inalcanzables | SKIP | SKIP | `SKIP-pend-entrada` |

**Reparto:** 3 VICTORY `[7,8,9]` + 9 DEADEND `[0,1,2,3,4,6,10,11,15]`. Las doce con **cero
bajas de party**.

### ★ Trampa que este capítulo tiende y hay que decir en voz alta

El reparto `[7,8,9] / [0,1,2,3,4,6,10,11,15]` **coincide con el baseline pre-fix**, pero
**no es continuidad**: entre medias fue `[4,6,7,8,9] / [0,1,2,3,10,11,15]`. Es la misma
etiqueta sobre salas distintas — r8 se gana ahora sobre 14 enemigos y no sobre 5; r1 sella
dejando 6 en pie y no 1; r0 mata 7 donde antes no mataba a nadie. Contar sólo
VICTORY/DEADEND borra justo lo que el lote cambió. Por eso el sello nuevo lleva la cuenta
de vivos-al-cerrar, no sólo la etiqueta.

---

## 3. Las notas vivas que había que re-examinar

**(a) «#65 = r1 NO se libera, refuta la hipótesis "sin remolinos es ganable"».**
El outcome SIGUE SIENDO DEADEND, pero **la nota se queda sin objeto**: la sala nunca pierde
sus unidades `0xEC`, así que «sin remolinos» ya no describe ningún estado del port. Lo que
hoy se mide es más informativo que lo que la nota discutía: de 13 combatientes el port mata
7 y deja 6 físicamente inalcanzables. La hipótesis que se refutaba no se resucita; se
declara **disuelta por cambio de premisa**, no confirmada.

**(b) `PENDIENTE-ORÁCULO 0xec` (cabecera de los dos specs).** **RETIRADA.** No hace falta
sonda: los 4 bytes que la nota daba por «pila sin inicializar» los inicializa el bucle de
`DNGLOOK 0x1273-0x128c`. Sustituida por la formulación nueva (§4).

**(c) cm66 (r2) = «Slimes varados en el void tras roca opaca 0x4d».** Esta razón ya había
sido retirada una vez (07-27, por apoyarse en `CanPassThroughWalls`, campo muerto del
port). **Ahora cae por tercera vez y en el SUJETO**: los únicos combatientes fijos del
`.CBT` de cm66 son **2 Ghost**. Los Slimes que se ven al jugarla son 2 unidades del tile
238 = `pool[2]`, es decir **una tirada** — otra alineación del stream puede no traer ni un
Slime. Toda frase «cm66 es dead-end porque los Slimes…» tiene, además de razón sin suelo,
sujeto equivocado. El OUTCOME (DEADEND, 8 de 12 en pie, 0 bajas) queda en pie como baseline
del port.

**(d) «SPAWN FIEL P0a: 0 FLIPS» (cabecera de ch24).** Se conserva como histórico pero con
aviso: hoy volver a leer «3 VICTORY + 9 DEADEND» invita al error de §2.

---

## 4. Qué está derivado y qué no (por qué los dos specs SIGUEN siendo DETECTOR)

- **DERIVADO** (binario, con cita): que la familia `0xEC` coloca **enemigos reales**, que
  salen de una tabla de 8 índices en DS `0x385e`, que se pre-tiran 4 y que el tile elige
  cuál por sus 2 bits bajos.
- **NO DERIVADO**: **qué especie** toca en una corrida concreta. El pool depende de por
  dónde va el stream RNG al montar la escena, y que el stream del port esté alineado byte a
  byte con el del original en ese punto **no está derivado**.

★ **Y esto no es una cautela teórica — hay control positivo de que muerde.** El testigo YT
de cm64 (una sala de este mismo capítulo, r0) vio **237 → Giant Rats y 236 → Bats**. Esta
corrida da, en la MISMA sala, **237 → Giant Spider y 236 → Skeleton**. Mismo mecanismo,
elenco distinto. ⇒ El MECANISMO es derivación; el ELENCO de una corrida es medida del PORT.
Formulación obligatoria nueva: «el PORT la gana/sella con ESTE roster (especie dependiente
del stream)», nunca «la sala se gana» a secas.

**Estabilidad medida:** el elenco NO es inestable entre corridas bajo `reseed(0)`. Los
rosters de ch24 salieron **byte-idénticos** en dos corridas independientes (medición y
verificación), y el test ×2 de cada capítulo compara digests de dos pasadas frescas dentro
de la misma corrida. El sello descansa por tanto sobre el outcome, que es reproducible; lo
que no se sella es su *fidelidad*, por la razón de arriba.

---

## 5. Timeouts subidos (declarados) y el «TIMEOUT 60s» del lead

| dónde | antes | ahora | razón |
|---|---|---|---|
| `ch23` test 1 | 900 000 | 1 800 000 | hay que PELEAR donde antes se cruzaba un tablero vacío |
| `ch23` test 2 (×2) | 900 000 | 3 600 000 | son dos pasadas del test 1 |
| `ch24` test 1 | 1 200 000 | 2 700 000 | 12 salas peleadas, no cruzadas |
| `ch24` test 2 (×2) | 1 200 000 | 5 400 000 | dos pasadas del test 1 |

Techo de reloj, **cero cambio de conducta** (precedente r15: timeout ancho declarado).

★ **El «TIMEOUT de 60 s» que reportó la ventana NO era el techo del capítulo.** Reproducido
en la primera corrida de este carril: el test falló por aserción a los **4,0 min** (con
`setTimeout` de 30 min vigente) y *además* imprimió `Test timeout of 60000ms exceeded`. Los
60 000 ms son el `timeout` de la config del tour aplicándose al **teardown**, donde
`trace: "retain-on-failure"` serializa el trace de un test de 4 minutos. O sea: es un coste
**del fallo**, no de la conquista. Con los capítulos en verde no se graba trace y no vuelve
a aparecer; las corridas de medición de este carril usaron `--trace off`.

Los **«2 did not run»** eran los tests ×2 de cada capítulo: `describe.serial` salta el resto
del bloque cuando el primero falla. Ambos corridos aquí.

---

## 6. Instrumento nuevo: `ConquerVerdict.roster`

`conquerRoom` (`game/e2e/grandtour/nav.ts`) lee ahora el **censo de enemigos ANTES de
resolver** y lo devuelve en `roster` (`n×Nombre`, p. ej. `4xGiant Rat+9xGiant Spider`).
Motivo: desde la pieza 14 «con qué roster salió la sala» ya **no se puede leer del `.CBT` a
ojo** — cuatro tiradas del montaje deciden qué especie ocupa cada tile 236-239, y después
de resolver el elenco ya no existe (la victoria desmonta `game.combat`, la huida lo cierra).

Es una **lectura pura** (`page.evaluate`, sin pulsar tecla): no toca el stream RNG. Campo
**opcional y diagnóstico** — ninguna aserción cuelga de él; ch23 y ch24 sólo lo imprimen en
su línea `detail=`. Control de que no perturba: ch23 dio los mismos 5 outcomes antes y
después de añadirlo, y ch24 dio rosters byte-idénticos en dos corridas.

---

## 7. Humo visual de la pieza (g) del lote — trampilla y TPK

Conducción manual con navegador VISIBLE (`headless:false`), deep-link DEV
(`?loc=…&x=…&y=…&floor=…`) + una sola flecha. Script:
`scratchpad/humo-trampilla.mjs`. **No es un test de la suite** — es la mirada en vivo que
pedía el cierre del lote. Capturas en
`…/47a1588d-…/scratchpad/humo-shots/`:

| # | captura | qué se ve |
|---|---|---|
| 1 | `humo-1-blackthorn-antes.png` | Blackthorn (loc 18) planta 0, party en (3,2) mirando al sur, la trampilla en (3,3) |
| 2 | `humo-2-blackthorn-despues.png` | tras UNA flecha: `A TRAPDOOR!` + planta **−1** en (3,3) |
| 3 | `humo-3-stonegate-antes.png` | Stonegate (loc 29) planta 0, party en (15,13), trampilla en (15,14) |
| 4 | `humo-4-stonegate-despues.png` | tras UNA flecha: `A TRAPDOOR!` + `An unending darkness engulfs thee...` + `Thou hast found refuge.` y **los 3 personajes a 0 HP / `D`** |

**★ La captura 2 enseña el BUCLE, no sólo la caída.** El log dice, en este orden:
`South` → `A TRAPDOOR!` → **`Burning!`**, y Shamino (que iba a 5 HP) queda a `0 D`. La razón
está en los datos: la celda (3,3) de la planta **−1** de Blackthorn es el tile **`0x8F`**
(lava) — comprobado sobre `smallmaps.json`. O sea que la caída aterrizó sobre una casilla de
daño y el bucle `0x0f48-0x10c7` volvió a evaluar los peligros **con el tile de la planta
nueva**, dentro del MISMO turno. Es exactamente la estructura que la pieza (g) declaró haber
descubierto al cablear, vista de fuera y sin instrumentar.

**Stonegate = caso especial confirmado**: una sola planta (`z=[0]`), así que no hay adónde
caer y salta el TPK de lava; la party se queda en (15,14) de la planta 0, muerta entera.

**Observación NO adjudicada, para el lead:** en la captura 4 el mapa se ve **negro**, no de
lava, aunque `stonegateLavaWipe` repinta el 32×32 a `0x8F`. La hipótesis barata es que con la
party entera muerta no hay fuente de luz y el visor sólo dibuja la casilla propia (en la
captura 2, con la party viva, la lava SÍ se ve). No lo he investigado ni tocado: lo dejo
apuntado porque la pieza se pidió mirar en vivo y esto es lo que se ve.

---

## 8. Gates

Exits leídos **sin pipe** (`cmd; echo EXIT=$?`) — el pipe a `tail` devuelve el exit de `tail`.

| gate | resultado |
|---|---|
| `ch23-salas-wrong` (config del tour, `U5_TOUR_PORT=5223`, workers 1) | **2 passed** (6,4 min) · EXIT 0 |
| `ch24-salas-covetous` (idem) | **2 passed** (16,4 min) · EXIT 0 |
| suite e2e general (`npx playwright test`, `U5_E2E_PORT=5197`) | **220 passed + 17 skipped** (3,7 min) · EXIT 0 |
| `tsc --noEmit -p tsconfig.e2e.json` | EXIT 0 |
| `tsc --noEmit` | EXIT 0 |

Los cuatro tests de capítulo incluyen los **dos «did not run»** de la ventana (los `×2`
determinista de cada capítulo), ahora verdes: ch23 en 4,5 min y ch24 en 11,9 min.

La suite general sube de los 219 passed de la ventana a **220** porque el rojo esperado de
aquella corrida (el spec del esquife) ya está re-sellado en `main 21fdedf5`. **Ningún otro
digest se movió**: fuera de ch23 y ch24 no hay un solo test tocado por este carril.

**Higiene de recursos:** puerto del tour `5223` y suite general `5197` (ambos propios);
servidor de humo en `5224`, arrancado y matado **por su PID** (6138). El `:5199` del usuario
no se tocó. `U5_VITE_CACHE_DIR` propio por corrida, en el scratchpad.

---

## 9. Ficheros tocados

- `game/e2e/grandtour/ch23-salas-wrong.spec.ts` — cabecera `0xEC` reescrita (premisa retirada),
  2 valores de aserción movidos (r1, r2: VICTORY → DEADEND), 4 mensajes re-redactados,
  2 timeouts subidos, log `detail=`.
- `game/e2e/grandtour/ch24-salas-covetous.spec.ts` — cabecera `0xEC` reescrita, tercera
  retirada de la razón de cm66, 2 valores de aserción movidos (victorias `[4,6,7,8,9]` →
  `[7,8,9]`; dead-ends `[0,1,2,3,10,11,15]` → `[0,1,2,3,4,6,10,11,15]`), `cov.note`
  reescrita, 2 timeouts subidos, log `detail=`.
- `game/e2e/grandtour/covered.ch24-salas-covetous.json` — re-sellado por la corrida serial
  (lo reescribe `Coverage.write()`; refleja la `cov.note` nueva).
- `game/e2e/grandtour/nav.ts` — campo diagnóstico `ConquerVerdict.roster` + su lectura.
- `re/notes/ventana-salas-acta.md` — este documento.
