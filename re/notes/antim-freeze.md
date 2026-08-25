# An Tym (parar el tiempo) — congelación de sprites: derivación + fix

Testigo del usuario: con **An Tym** activo, en el ORIGINAL los sprites de los
animales/criaturas del overworld se quedan CONGELADOS (la animación de frames se
detiene). «No sé si cataratas u otros [también]» → el ALCANCE (¿sólo criaturas? ¿también
terreno animado: agua/cataratas/banderas/llamas?) se DERIVA aquí, no se asume. En el port
(antes de este fix) las criaturas NO se congelaban.

## 1. El hechizo — `g_time_spell` = `'T'` (0x54)

- Nombre en pantalla: **AN TYM** (círculo 8, el más poderoso; `docs/manual/companion/
  scroll-content.js`). El código lo modela con el global `g_time_spell` (DS:0x587A) +
  `g_time_spell_turns` (DS:0x588E), UN único par para todos los efectos temporales.
- Cast: `CAST.OVL 0x0da4` → `g_time_spell = 0x54` ('T'), `g_time_spell_turns = 0x0a`
  (10 turnos). Scroll/pergamino: 20 turnos (`useScroll.ts`). El port ya lo implementa como
  mecánica (`magic/tables.ts timeStop {status:"T", turns:10}`, `state.timeSpell/Turns`).
- Cuenta atrás: `SJOG.OVL 0x201e-0x2032` decrementa `g_time_spell_turns` por turno; al
  llegar a 0 pone `g_time_spell = 0` (0xFF = permanente, no decrementa). El port: `world/
  survival.ts` (turno) — bajo 'T' además salta el consumo/eventos de supervivencia (0x143).

## 2. Qué congela el binario — SÓLO las criaturas, NO el terreno

**Criaturas (SÍ se congelan).** `move_all_monsters` (MAINOUT.OVL `0x1a60`) es la rutina
de turno de los monstruos del overworld. Su PRIMERA instrucción tras el prólogo:

```
1a6d: cmp byte ptr [g_time_spell], 0x54   ; ¿An Tym?
1a72: jne 0x1a7a
1a74: sub ax, ax
1a76: jmp 0x1b38                          ; RETORNO EN SECO (ax=0)
```

Con `g_time_spell=='T'` retorna ANTES de sus dos bucles: (a) el bucle de MOVIMIENTO por
slot (`0x1abc`, call `0x131a` = mueve el monstruo) y (b) el bucle de REDIBUJO por slot
visible (`0x1af0`, call sprite-draw). Es decir: bajo An Tym los monstruos ni actúan ni se
re-dibujan por su rutina → su frame se queda FIJO. (Comparar: `0x51`='Q' Quickness y el
transporte 0x12/0x14 sólo saltan el proceso 1 de cada 2 turnos — media velocidad, no
congelación.)

**Terreno animado (NO se congela).** El reloj maestro de tiles
`advance_tile_anim_frames` (`ULTIMA.EXE 0x44b8`) cicla el banco de TERRENO (agua 0xd4,
fuente 0xd8, rótulos de serpiente 0xec, toggles tortura/reloj 0x80/0xfa) mutando la tabla
`DS:0x4ee2`. **NO está gateado por `g_time_spell`**: se llama incondicionalmente desde el
compositor de pantalla (`0x46f7`, dentro de la rutina de refresco que termina en `0x4701`,
sin ningún `cmp g_time_spell`). ⇒ agua, cataratas, fuentes, antorchas, banderas y demás
terreno SIGUEN animando con An Tym puesto. (Responde la duda del testigo sobre «cataratas
u otros»: el terreno NO se congela.)

**Party/Avatar.** El líder actúa cada turno del jugador (que An Tym no bloquea) → su pose
sigue avanzando en el original. Congelarlo o no es visualmente inapreciable (medido
~congelado en reposo, `sprite-anim-cadence.md §2`); ver decisión del port abajo.

## 3. El bug del port y el fix

Modelo de animación del port (`sprite-anim-cadence.md`): el frame de los sprites de ACTOR
(banco alto ≥0x100: criaturas/NPCs/party) avanza por `personTurnCount`, un contador GLOBAL
que sube 1 por turno del mundo (`skin/fiel/skin.ts onTurn`). El terreno anima por el reloj
de render libre `phase`. Bajo An Tym el jugador sigue jugando → `onTurn` dispara →
`personTurnCount` sube → las criaturas seguían animando. **Ese era el bug.**

**Fix** (render/piel, el shader hereda):
- `skin/api.ts` — nuevo `ViewSnapshot.timeStopped?: boolean`.
- `skin/coreview.ts` — snapshot de MAPA: `timeStopped: game.state.timeSpell === "T"`.
- `skin/fiel/skin.ts onTurn` — no avanza `personTurnCount` cuando `snapshot().timeStopped`.
  ⇒ criaturas/NPCs/party CONGELADOS al frame en que se paró el tiempo; el terreno sigue
  (nunca dependió de `personTurnCount`). Al expirar, el contador reanuda sin salto. La piel
  shader lee `faithful.personTurn` → hereda la congelación sin cambios propios.

Decisión de alcance: se congela TODO el banco de actor (criaturas + NPCs + party) por
simplicidad y robustez. La única desviación estricta respecto al binario es el idle FINO
del party-leader (que el original seguiría avanzando por turno); es imperceptible (Avatar
medido ~congelado en reposo) y el party SIGUE MOVIÉNDOSE (su tile/pose viene de `snap.
actors`, no de `personTurnCount`). Combate ya tenía su propia congelación fiel de An Tym
(`combat/combat.ts` 0x0418) — intacta.

## 4. Verificación

- Unit: `tests/skin-coreview.test.ts` fija `snapshot().timeStopped` (true con `timeSpell:
  'T'`, falsy sin él) y su ausencia fuera de mapa.
- Careo AV: no hay clip con An Tym en `original/av-referencia/`. Verificación opcional en
  el DOSBox del usuario: con partida cargada, `Cast` → círculo 8 → **AN TYM**, y observar
  en el overworld con criaturas a la vista que sus sprites dejan de ciclar mientras el
  agua/olas siguen animando (~10 turnos). La derivación del ASM manda.

---

## CORRECCIÓN (#169, medida en el árbol de `7c4aa56c`) — el gate SÍ existe, y está en el CALLER

★ **§2 «Terreno animado (NO se congela)» está REFUTADO.** La afirmación en negrita
«**NO está gateado por `g_time_spell`**» es falsa, y su derivación se paró un nivel corto:
acertó que el call-site de `advance_tile_anim_frames` es único (`0x46f7`) y acertó que en
el cuerpo `0x4552-0x4701` no hay ningún `cmp g_time_spell` — pero **el gate no está en esa
rutina, está en quien la llama**.

La cadena, leída entera:

```
0x591D  cmp byte ptr [g_time_spell(DS:0x587A)], 0x54   ; 'T' = An Tym
0x5924  mov byte ptr [0x5891], 0                       ; ← LATCH a 0, en la CABECERA
0x5933  cmp byte ptr [0x5891], 0
        je 0x5954                                      ; ← SALTA por encima de...
0x5941  call 0x4552                                    ;   ...el tick de animación
0x5944  call 0x2f62                                    ;   ...y de maybe_change_wind
```

`viewport_redraw` (CS 0x5910) se re-arma el latch a 1 en su cola (`0x5A1D`), pero lo
vuelve a poner a 0 en cada redibujo mientras dure el hechizo. Y el salto de `0x5933` se
lleva por delante `0x4552` entero — y con él sus dos colas, `0x46F7 call 0x44b8` (el remap
de terreno `DS:0x4EE2`) y `0x46FA call 0x6fd6` (la pasada fn32 del DRV: firenoise +
flagswap), que **no tienen ningún otro call-site en el .EXE**.

⇒ **Con An Tym puesto, en el original se congelan también el terreno animado, el fuego,
las banderas y el cambio de viento.** La respuesta que esta nota daba al testigo («el
terreno NO se congela; las cataratas siguen») es exactamente al revés.

**El corpus ya se contradecía a sí mismo**, y conviene decirlo porque es la señal que
había que haber leído: `re/notes/ambient-audio-audit.md:81` describe bien el latch («se
rearma a 0 al tope de `0x5910` si `g_time_spell==0x54`») y
`re/deliberate-divergences.md:1240` dice de `0x51b8` «Congelable con `g_time_spell==0x54`».

**CONSECUENCIA EN EL PORT — mecánica AUSENTE, y sellada por esta nota.** §3 justifica el
fix con «*el terreno sigue (nunca dependió de `personTurnCount`)*». Censado en el árbol
del ancla: `timeStopped` tiene **un único consumidor** en todo `game/src`
(`game/src/skin/fiel/skin.ts:2296`, el gate de `personTurnCount`); ni `tileanim`, ni
`waterfn32`, ni `firenoise`, ni `flagswap` lo leen. La congelación de terreno/fuego/
banderas/viento **no está portada**, y esta nota es la que autorizaba no portarla.

**NO se porta aquí** (fuera del encargo de #169, que es censar y adjudicar). Queda con
tarjeta y con las señas de arriba. Firma del género de #151 (aserto de AUSENCIA sobre la
capa equivocada): el «no hay gate» era cierto *de la rutina* y falso *del comportamiento*.

### PORTADO (#177, rama `fix/antym-177`)

La corrección de #169 dejó la mecánica declarada y sin portar. Ya está portada, y la
lectura del ASM en este carril **amplía la cadena** respecto a lo que #169 apuntó:

| offset | qué se salta con el latch a 0 | ¿lo modela el port? |
|---|---|---|
| `0x5941 call 0x4552` | intérprete de bytecode de animación | sí — `progRunner`/`actorProg` |
| └ `0x46f7 call 0x44b8` | reloj MAESTRO de terreno (remap DS:0x4EE2) | sí — `phase` |
| └ `0x46fa call 0x6fd6` | blit de las celdas animadas (selector 0x60) | n/a (el port no tiene el pipeline DOS) |
| `0x5944 call 0x2f62` | cambio de viento | **ya estaba** (`game.ts`, `timeSpell !== "T"`) |
| `0x594e call 0x475a` | compositor de ambiente (sube la moongate) | ⚠ NO — ver residuo |
| `0x5951 call 0x70a6` | pulso del faro | ⚠ NO — sin equivalente censado |
| `0x5a1a call 0x4102` | ambiente por proximidad | sí — `tickAmbient` |

★ **DOS refinamientos que #169 no tenía**, ambos leídos del cuerpo:

1. **El latch es TRI-ESTADO, no binario.** Entre el `je` de 0x5938 y la llamada hay una
   segunda comparacion, en CS 0x593a: `cmp byte ptr [0x5891],0xff` y `je 0x5944` en
   CS 0x593f. Con el latch a
   **0xFF** se salta SÓLO el intérprete y el viento SÍ corre; con el latch a **0** se
   salta el bloque entero. An Tym usa el camino del 0 (`0x5924`), pero quien modele el
   latch para otra cosa no debe aplanarlo a un booleano.
2. **El latch se consulta DOS veces**, no una: además del `0x5933` de la cabecera, la
   COLA vuelve a mirarlo en `0x5a13` para saltarse `0x5a1a call 0x4102`. El re-armado a 1
   es posterior (`0x5a1d`), así que dentro del mismo redibujo las dos consultas ven el
   mismo valor.

**IMPACTO DE STREAM: CERO, y no por suerte.** El único consumidor de RNG de la cadena es
el cambio de viento de CS 0x2f62, y el port **ya** lo gateaba por `timeSpell !== "T"` en el
world-turn (`game.ts:1068` y `:1091`) desde antes de esta tarjeta. Lo que se ha portado
aquí es exclusivamente el reloj de PRESENTACIÓN, que en el port corre sobre `phase` (reloj
de render libre) y un PRNG local de vista, no sobre el stream compartido. Ninguna semilla
se mueve.

**RESIDUO DECLARADO, no portado:** el compositor de ambiente de CS 0x475a (que re-incrementa
la etapa de la moongate) y el pulso del faro de CS 0x70a6 están DENTRO del bloque saltado, pero
sólo cuando `g_location < 0x80` (`0x5947 cmp / 0x594c jae`). En el port la etapa de la
moongate avanza a reloj de PARED, fuera del bucle de ticks, así que este fix no la toca.
Estrictamente, bajo An Tym también debería congelarse. Queda con dueño y sin fabricar.

### PORTADO (#183, rama `fix/cielo-176`) — el residuo de arriba, cerrado

El residuo tenía DOS piezas y sólo UNA era un hueco. Medido antes de tocar:

| pieza | CS | ¿productor en el port? | qué se hizo |
|---|---|---|---|
| compositor de ambiente de la moongate | `0x475a` | **sí** — `skin/fiel/skin.ts`, el avance de `moongateStage` a reloj de pared dentro del rAF | **GATEADO** por `timeStopped` |
| pulso del faro | `0x70a6` | **no** — `core/world/visibility.ts:52` y `:125` declaran el HAZ DEL FARO (0x2A) fuera de alcance, «mecánica aparte» | **NADA que congelar**; se declara, no se fabrica |

El avance de ambiente vivía inline en el bucle rAF; se extrajo a `tickMoongateAmbient(dt)`
—hermano de `tickAnimClock`— y ahí va la guarda. Es el mismo patrón de #177: la piel deja de
avanzar el contador mientras dure el hechizo, sin acumular (el original SALTA la llamada, no la
aplaza) ⇒ al expirar la puerta sigue desde la etapa en que se quedó, sin brinco.

★ **Lo que NO se congela, y por derivación:** el CIERRE del cruce (`kernel_moongate_enter`
0x48a8, bucle DESCENDENTE 0x4912-0x492b con su propio `delay(2)`) es una secuencia *scripted*
que vive FUERA del bloque saltado por el latch. Por eso la guarda va en `tickMoongateAmbient`
y no en la rama `this.transit` del rAF, que sigue corriendo con An Tym puesto.

⚠ **Guarda NO portada, declarada:** `0x5947 cmp [g_location],0x80 / 0x594c jae` acota las dos
llamadas a `g_location < 0x80`. No se replica: en juego normal las localizaciones van 0..0x28,
así que la guarda no discrimina nada observable, y derivar qué significa `g_location >= 0x80`
en el port (¿combate? ¿otro modo?) es tarjeta propia. Se deja dicho, no adivinado.

**IMPACTO DE STREAM: CERO, y verificado igual que en #177.** `moongateStage` es un float de la
piel movido por `requestAnimationFrame`; `advanceMoongateStageMs` es pura y no toca `OriginalRng`
ni ningún consumidor del stream compartido. El compositor 0x475a tampoco tira dados en el
original (`re/notes/shrines.md §1.3`: `g_moongate_anim` es un contador cosmético). Ninguna
semilla se mueve.

**Verificación:** `game/tests/antym-freeze.test.ts`, bloque `#183` — 5 tests con control
positivo (sin hechizo la etapa SÍ sube), congelación de subida y de bajada, reanudación sin
salto y CANDADO del literal `MOONGATE_STAGE_MS`. Failing-first MEDIDO sobre el árbol con el
método ya extraído y sin guarda: **3 rojos / 7 verdes**; con la guarda, **10/10**.
