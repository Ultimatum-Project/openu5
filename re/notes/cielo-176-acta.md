# ACTA del carril CIELO — #176 (latch de fases lunares) + #183 (An Tym congela la moongate)

> Rama `fix/cielo-176`, worktree `.claude/worktrees/cielo-176`, base **main @ `8a5516b8`**.
> Dos commits, uno por tarjeta. Toda cifra medida en este árbol. RETENIDA: aterriza el lead.

---

## 0. Lo que este carril cambia respecto al encargo

El encargo llegó con la parte derivada SELLADA y con una instrucción explícita de dónde NO
poner el cableado de #176. **Esa instrucción era incorrecta, y la corrección es el hallazgo
principal del carril** (§1). El resto es cableado.

## 1. ★ El «call-site del dibujo de la banda» ES `advance_clock`

El relevo (`ui-text-layer.md`, commit `8a5516b8`) dice, en negrita, que las tres guardas
«**NO están en `advance_clock`**, están en el CALL-SITE del dibujo de la banda (CS 0x5161)»
y avisa: «ponerlo en `advanceClock` refrescaría también en mazmorra, EXACTAMENTE el defecto
que se persigue». Medido sobre `re/disasm/ULTIMA.EXE.asm`:

```
4f7b: c3          ret                 ; fin de la rutina anterior
4f7c: 55          push bp             ; ← ÚNICO prólogo de la banda 0x4f7c-0x519c
4f7d: 8bec        mov bp, sp
4f7f: 83ec0a      sub sp, 0xa
4f82: 57          push di
4f83: 56          push si
…
514a: a08058      mov al, byte ptr [g_prev_hour]
514d: 38067f58    cmp byte ptr [g_hour], al
5151: 7433        je 0x5186                        ; (1) ¿cambió la hora?
5153: 803e935821  cmp byte ptr [g_location], 0x21
5158: 730a        jae 0x5164                       ; (2) mazmorra → NO
515a: 803e955880  cmp byte ptr [g_floor], 0x80
515f: 7303        jae 0x5164                       ; (3) bajo tierra → NO
5161: e820f9      call 0x4a84                      ; draw_sky_strip → LATCHEA
…
519b: 5d          pop bp
519c: c20200      ret 2                            ; ← ÚNICA salida
```

**Un solo `push bp`, un solo `ret`** en toda la banda ⇒ UNA rutina, y es `advance_clock`
(el propio port la ancla ahí: `0x4F8D` Quickness, `0x4FA0` prev_hour, `0x4FA6` time-stop,
`0x4FB4/0x4FBE` antorcha y luz, `0x4FC8-0x509A` rollovers). `0x5161` es **su cola**.

El equívoco tiene una causa concreta y comprobable: **el port tenía la rutina partida en
tres** y nadie había vuelto a mirar los límites.

| tramo | qué hace | dónde está en el port |
|---|---|---|
| `0x4f8d-0x509e` | Quickness · prev_hour · minutos · antorcha/luz · rollovers | `advanceClock` |
| `0x50a1-0x5145` | nivel de luz + flag de repintado | `lightLevel` (PURA, on-demand; cita `0x50BA`) |
| **`0x514a-0x5161`** | **las 3 guardas + el latch** | **no existía** ← esta tarjeta |
| `0x5164-0x5183` | hora en 12 h para la barra | la piel |

Y el aviso estaba **invertido**: las tres guardas viven ahí y son precisamente lo que
impide refrescar bajo tierra. Ponerlo en `advanceClock` no reproduce el defecto: lo cierra.

★ **Y no podía ir en ningún otro sitio.** El flanco se compara contra `g_prev_hour`, que
escribe la propia rutina en `0x4fa3`, justo antes de avanzar ⇒ `0x514d` pregunta «¿cambió la
hora en ESTA llamada?». Fuera de ella el flanco ya no existe: el housekeeping lo **consume**
(`0x2b9c mov [g_prev_hour],al`, portado en `turnHousekeeping`). Un refresco a final de turno
—que era la alternativa natural— habría estado midiendo un flanco ya borrado.

**Firma del género:** una cota de rutina heredada de cómo el PORT partió el código, no de
cómo lo partió el binario. Prima hermana de `prologos-ocultos-no-son-agujeros`.

## 2. Aritmética del índice, cerrada de paso

`draw_sky_strip` indexa `[bx+0x1ed8]` con `bx = g_day*2` (`0x4adf-0x4ae7`), mientras
`moonPhasesForDay` indexa `raw[(day-1)*2]` sobre el array que arranca en fo `0x1EEA`. Es
consistente: fo 0x1EEA ↔ DS 0x1EDA, que es DS 0x1ED8 más 2. Por tanto `[0x1ed8 + day*2]` es la misma celda
que `[0x1eda + (day-1)*2]`.
No es una discrepancia; queda escrito para que nadie la «arregle».

## 3. Cableado de #176

- `state.feluccaPhase` / `state.trammelPhase` — **bytes CRUDOS** (0x30..0x37), como
  `g_felucca_phase` DS:0x5885 y `g_trammel_phase` DS:0x5886. El `-0x30` lo hace el lector,
  igual que `moongate_enter` en `0x4973`.
- `saveNative`: `FELUCCA_PHASE_OFFSET = 0x2df`, `TRAMMEL_PHASE_OFFSET = 0x2e0`; escritura
  condicional (como `prevHour`) y roundtrip byte-idéntico verificado.
- `refreshMoonPhaseLatch(state, sky, hourChanged)` en `survival.ts`, llamada al final de
  `advanceClock`, **después** del rollover (porque `draw_sky_strip` indexa `g_day`, que el
  rollover acaba de incrementar en `0x5051`).
- `latchedMoonPhases()` / `activeGatePhase(time, raw, state?)` en `moongates.ts` — leen el
  latch; `moongateAt` y `moongateDestination` ya tenían `state` y lo pasan.
- `skin/coreview.ts`: la banda del cielo dibuja el par LATCHEADO (el original relee
  `[0x5885]`/`[0x5886]` en `0x4b13`/`0x4b4d`, no recalcula).
- `Game.skyRefreshCtx` produce `{ moonPhasesRaw, location }` con **`effectiveLocation`**
  (#123): `position.location` vale 0 dentro de una mazmorra, así que leerlo a secas dejaría
  pasar justo el caso que la guarda 2 cierra.

### Censo del enhebrado (dónde llega el contexto y dónde NO)

| camino | llega | por dónde |
|---|---|---|
| turno de exterior + turno naval | sí | `OutdoorTurnCtx.sky` |
| turno de pueblo | sí | `TownTurnCtx.sky` |
| `advance_clock` EXTRA del terreno lento | sí | `game.ts` directo (cada llamada re-snapshotea el flanco; el binario también lo evalúa por llamada) |
| camp / bed / campSleepStep | sí | `CampCtx.sky` |
| noche de posada (12×5 + N×9) | sí | `innNightPass(..., sky)` |
| mazmorra (3 call-sites) | sí | `DungeonCmdsCtx.sky` — llega para que la guarda **RECHACE**, no para latchear |
| (I)gnite y el otro `advanceTurn` de `game.ts` | sí | directo |
| `tryMove` y `__parity__/run.ts` | **NO** | arneses puros sin `data`; sin contexto el latch no se toca, y los lectores caen al cálculo por día |

## 4. La ÚNICA divergencia deliberada, declarada

`isLatchedPhaseByte()` exige que el byte esté en `0x30..0x37`. **El original no comprueba
nada** (`0x4971 sub ah,ah / 0x4973 sub ax,0x30` y a indexar). Se comprueba porque, medido
sobre `game/assets/init.gam`, **`+0x2DF = 0x00` y `+0x2E0 = 0x00`**: el estado inicial que
reparte el port no ha latcheado nunca. En el original eso tampoco se observa (arrancas a las
8:00 y para la primera noche la hora ha cambiado doce veces en superficie), pero un estado
sintético o un salto de reloj del editor de saves sí llegaría a la noche con los ceros, y
`0 - 0x30` es un índice negativo de moonstone. Ante byte inválido este port cae al cálculo
por día — la conducta que tenía antes de la tarjeta. Está declarado en el propio código.

## 5. #183 — el residuo de #177, cerrado; y el faro no era un hueco

El bloque que el latch `[0x5891]` se salta con An Tym tiene CUATRO llamadas, no dos:

```
5924: mov byte ptr [0x5891], 0     ; camino de An Tym (0x591d cmp g_time_spell,'T')
5938: je  0x5954                   ; latch a 0 ⇒ salta todo lo de abajo
5941: call 0x4552                  ; intérprete de animación          (#177)
5944: call 0x2f62                  ; maybe_change_wind                (ya estaba)
5947: cmp byte ptr [g_location], 0x80 / 594c: jae 0x5954
594e: call 0x475a                  ; ★ compositor de moongate (anim++/--)
5951: call 0x70a6                  ; ★ FARO (pulso)
```

**MEDIDO ANTES DE TOCAR**, y el residuo eran dos piezas de las que sólo una era hueco:

- **moongate (0x475a): SÍ había productor** — el avance de `moongateStage` a reloj de PARED
  dentro del rAF de la piel fiel. Extraído a `tickMoongateAmbient(dt)` y gateado por
  `timeStopped`.
- **FARO, CS 0x70a6: NO hay productor.** `core/world/visibility.ts:52` y `:125` ya declaran el
  HAZ DEL FARO (0x2A) fuera de alcance, «mecánica aparte». Nada que congelar. Es la misma
  forma que el viento de #177 (que ya estaba gateado): se declara, no se fabrica.

★ **Lo que NO se congela, por derivación:** el CIERRE del cruce (`kernel_moongate_enter`
0x48a8, bucle DESCENDENTE `0x4912-0x492b`, con su propio `delay(2)`) es *scripted* y vive
FUERA del bloque saltado. Por eso la guarda va en `tickMoongateAmbient` y no en la rama
`this.transit` del rAF.

⚠ **Guarda no portada** — ★ RESUELTA 30-07 (#184), y **SÍ discrimina**: `0x5947
cmp [g_location],0x80 / jae 0x5954`, que acota las dos llamadas a `location < 0x80`.
`g_location >= 0x80` **es MAZMORRA**: `dng_enter_room` (DUNGEON.OVL 0x00a8, IDENT) escribe
`mov byte ptr [g_location], 0xff` (y hay 4 escritores más del mismo 0xFF, en CMDS 0x0332,
BLCKTHRN, CAST2 y ULTIMA.EXE 0x5fb4). Confirmado por el otro extremo en #226:
`resolve_command_char` (ULTIMA.EXE 0x4988) usa el MISMO umbral —`cmp [g_location],0x80 /
jbe`— para separar la rama de mazmorra de la de superficie.

⇒ Lo que la guarda dice es: **bajo tierra el original NO compone la moongate ni pulsa el
faro** — coherente, porque en mazmorra no hay lunas ni faro a la vista. La frase anterior
(«en juego normal las localizaciones van 0..0x28, así que no discrimina nada observable»)
era un CERO EN FALSO por olvidar la mazmorra, que es justo el caso que la guarda existe
para excluir. Para el port: el gate de `tickMoongateAmbient` debería excluir también el
estado de mazmorra, no solo `timeStopped`.

## 6. Movimiento de stream: CERO en las DOS tarjetas, con predicción falsable

Precedente que obliga a medir (#177 midió que el viento ya estaba gateado y declaró CERO):

- **#176.** `refreshMoonPhaseLatch` es una lectura de tabla y dos escrituras de byte: no
  llama a `rand`, no toca `OriginalRng`, y su llamada está **después** del re-sorteo de
  Shadowlords del rollover (`0x4FF5`), que sigue exactamente donde estaba. **Predicción
  falsable:** ningún sello de paridad ni de tour cambia. **Verificado:** los 298 ficheros de
  vitest —incluidos los arneses de paridad de stream y los sellos— pasan sin re-baselinear
  ni un valor.
- **#183.** `moongateStage` es un float de la piel movido por `requestAnimationFrame`;
  `advanceMoongateStageMs` es pura. Y `0x475a` tampoco tira dados en el original
  (`shrines.md §1.3`: `g_moongate_anim` es un contador cosmético).

## 7. Failing-first MEDIDO (no declarado)

| tarjeta | árbol de medición | resultado |
|---|---|---|
| #183 | método ya extraído, **sin** la guarda | **3 rojos / 7 verdes**; con la guarda **10/10** |
| #176 | con la llamada a `refreshMoonPhaseLatch` desconectada | **8 rojos / 5 verdes**; conectada **13/13** |

⚠ **La primera versión del test de #176 no medía nada, y por qué.** Sembraba el latch a
mano en el helper de estado; con el refresco desconectado, los casos «no refresca» pasaban
igual (los bytes estaban ahí porque los había puesto el test) y sólo caía 1 de 9. Re-escrito
para que el latch se ADQUIERA por el camino real —una frontera de hora en superficie, que es
el único escritor— antes de mover al jugador bajo tierra. Y el control positivo se endureció
para comprobar los BYTES CRUDOS: sin eso pasaba en verde EN FALSO, porque
`latchedMoonPhases` cae al cálculo por día cuando el latch está vacío y el número coincidía.

## 8. Trinquete ajeno que saltó (y era su diseño)

`tests/save-editor-completeness.test.ts` exige que TODA clave de `GameState` esté CUBIERTA o
EXCLUIDA en el editor de saves. Las dos claves nuevas salieron en rojo. Se **CUBREN** (no se
excluyen): dos campos numéricos en la sección de tiempo runtime, con `RuntimeNumberField`
ampliado, etiquetados como byte crudo 48-55 para que nadie teclee «3» esperando la fase 3.

## 9. Gates (EXIT leído por separado, sin pipes, re-corridos tras el `git add`)

```
npx tsc --noEmit -p game/tsconfig.json     EXIT=0
npm run typecheck:e2e                      EXIT=0
npx vitest run  (COMPLETO)                 EXIT=0   298 files · 3838 passed · 1 skipped
python3 re/tools/seed_gate.py              EXIT=0
python3 re/tools/genero.py                 EXIT=0
```

Nada de e2e/playwright (mutex ajeno). `routine-census.json` NO regenerado (EMBARGO). Ningún
proceso vite/dosbox ajeno tocado.

## 10. Cola que deja este carril

1. ~~**`advanceClock(0)`**~~ — ★ CERRADA 30-07 (#184), **calcada**. El binario, con
   `minutes==0`, salta a `0x50a1` (la COLA de la propia rutina, no el `ret`): se salta el
   reloj y también el snapshot `g_prev_hour = g_hour` de 0x4fa0, pero corre el refresco,
   comparando el flanco contra el prevHour de la llamada ANTERIOR. El port retornaba en
   seco. Y el «no se ha encontrado un llamador con 0» se sustituyó por MEDICIÓN: censo de
   los 14 call-sites del repo entero — todos positivos o gateados; el único 0 que el port
   produce (`resolveStep`, salidas sin coste) se consume como BOOLEANO en game.ts:1206.
   Inalcanzable, calcado igualmente. Negativos: DECLARADOS (exigirían fabricar byte-wrap).
2. ~~**`g_location >= 0x80`**~~ (§5) — ★ CERRADA 30-07 (#184): es **MAZMORRA** (0xFF, escrito
   por `dng_enter_room` DUNGEON.OVL 0x00a8 + 4 escritores más). Ver §5.
3. **Testigo del oráculo para #176**: entrar en mazmorra a las 23:5x, cruzar medianoche
   dentro, salir y pisar una moongate antes de la siguiente frontera de hora — comprobar que
   el original teleporta a la moonstone de AYER. La derivación manda, pero el testigo cerraría
   el caso por observación.
