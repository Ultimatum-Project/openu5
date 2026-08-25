# COVERAGE.md — informe final de cobertura del binario (Task F.1)

Migración exacta de Ultima V (DOS): informe de cierre del **ledger de cobertura**.
Cada uno de los **202.800 bytes** de `ULTIMA.EXE` + los 24 overlays + `DATA.OVL`
pertenece a exactamente un segmento `code` / `data` / `inert` con **nombre y
nota**. Verificable con:

```bash
python3 re/tools/ledger.py     # TOTAL 202800 / 202800  100.0%  (0 bytes pendientes)
cd re/tools && python3 -m pytest test_ledger.py -q   # 2 passed
```

Fecha de cierre: 2026-07-11. Fase 3 (13/13) completa; esta es la Fase Final F.1.

## 1. Cobertura por fichero

| Fichero | Bytes | code | data | inert | Segmentos | Catálogo |
|---|---:|---:|---:|---:|---:|---|
| ULTIMA.EXE | 34.544 | 32.586 | 1.909 | 49 | 198 | `kernel_catalog.py` |
| DATA.OVL | 48.464 | 0 | 48.447 | 17 | 143 | `dataovl_catalog.py` |
| CAST.OVL | 8.560 | 8.464 | 96 | 0 | 31 | (Task 3.3) |
| CAST2.OVL | 4.544 | 4.544 | 0 | 0 | 16 | (Task 3.3) |
| COMBAT.OVL | 7.408 | 7.398 | 0 | 10 | 24 | `combat_catalog.py` |
| COMSUBS.OVL | 5.216 | 5.213 | 0 | 3 | 24 | (Task 3.2) |
| DUNGEON.OVL | 8.016 | 8.016 | 0 | 0 | 36 | (Task 3.4) |
| DNGLOOK.OVL | 5.040 | 5.040 | 0 | 0 | 15 | (Task 3.4) |
| NPC.OVL | 4.912 | 4.912 | 0 | 0 | 18 | (Task 3.5) |
| TALK.OVL | 4.880 | 4.880 | 0 | 0 | 16 | (Task 3.5) |
| SHOPPES.OVL | 5.936 | 5.936 | 0 | 0 | 25 | (Task 3.6) |
| SHOPPES2.OVL | 2.848 | 2.848 | 0 | 0 | 14 | (Task 3.6) |
| SHOPPES3.OVL | 2.528 | 2.528 | 0 | 0 | 8 | (Task 3.6) |
| MAINOUT.OVL | 7.344 | 7.344 | 0 | 0 | 36 | (Task 3.7/3.13) |
| OUTSUBS.OVL | 2.464 | 2.460 | 0 | 4 | 13 | (Task 3.7) |
| TOWN.OVL | 6.256 | 6.256 | 0 | 0 | 32 | (Task 3.13) |
| **CMDS.OVL** | 7.440 | 7.436 | 0 | 4 | 24 | **`cmds_catalog.py` (F.1)** |
| SJOG.OVL | 8.800 | 8.790 | 0 | 10 | 36 | `sjog_catalog.py` |
| BLCKTHRN.OVL | 3.184 | 3.174 | 0 | 10 | 10 | `blackthorn_catalog.py` |
| **INTRO.OVL** | 8.400 | 8.375 | 16 | 9 | 20 | **`intro_catalog.py` (F.1)** |
| FONT.OVL | 3.744 | 3.735 | 0 | 9 | 11 | `font_catalog.py` |
| ENDGAME.OVL | 2.800 | 2.798 | 0 | 2 | 9 | `endgame_catalog.py` |
| ZSTATS.OVL | 4.880 | 4.879 | 0 | 1 | 18 | `zstats_catalog.py` |
| LOOKOBJ.OVL | 4.560 | 4.556 | 0 | 4 | 17 | `lookobj_catalog.py` |
| FLAMES.OVL | 32 | 17 | 0 | 15 | 2 | `flames_catalog.py` |
| **TOTAL** | **202.800** | **152.185** | **50.468** | **147** | **835** | — |

Reparto global: **code 75,04 % · data 24,89 % · inert 0,07 %**. `inert` = relleno
de ceros del linker Phoenix entre funciones y tras la última (cada bloque con nota
de tamaño). `data` está dominado por DATA.OVL (48.447 B de strings + tablas, 100 %
en chunks) y la zona de datos CS-relativa del kernel en ULTIMA.EXE (1.909 B: blob
de protección XOR 0xDC, jump-table del dispatcher, registros/nombres del gestor de
overlays PLINK86).

### Lo que cerró F.1 (los 15.642 B que quedaban)

- **CMDS.OVL (7.440 B)** — `cmds_catalog.py`. 22 prólogos `55 8B EC` + 1 función
  hoja sin frame (`cmd_ignite_torch` @0x0D98, entrada de dispatch propia) + 4 B de
  padding. Todas las entradas mapeadas al `command-dispatch.md` (Board/Fire/Ignite/
  New-Order/X-it/Push/Yell/Mix/Klimb/Camp) y a las notas de sus tasks (3.3/3.7/3.8/
  3.9). 0 decodificaciones basura → todo código + cola; no hay tablas de datos
  intercaladas.
- **INTRO.OVL (8.400 B)** — `intro_catalog.py`. Menú de portada + ruta de
  transferencia de Ultima IV. 16 B de preámbulo de datos + 18 funciones (los 17
  prólogos del mapa de `gypsy.md` + una 18ª cuyo prólogo `55 8B EC` @0x0010 queda
  enmascarado en el disasm lineal por el preámbulo) + 9 B de padding. La
  "jump-table de clase" @0x1288 (`jmp word ptr cs:[bx-0x6b7e]`) referencia una
  tabla **externa** al overlay (segmento kernel/DGROUP), así que NO hay tabla de
  datos inline que separar — verificado: 0 runs de ceros ≥6 B intermedios, 1 sola
  decodificación basura (el último byte de padding).

## 2. Metodología

1. **Partición por prólogo.** Cada overlay se parte en `[prólogo_i, prólogo_{i+1})`
   (`55 8B EC` = `push bp; mov bp,sp`). El límite es el prólogo siguiente, así que
   un segmento `code` puede incluir tablas de salto inline, funciones hoja sin
   frame y padding — es un catálogo de **cobertura**, no la verdad byte a byte de
   cada instrucción.
2. **Datos y padding.** Las tablas se marcan `data` (con la forma inferida por el
   patrón de acceso de los overlays); los ceros del linker, `inert` con nota de
   tamaño. DATA.OVL se catalogó al 100 % en Fase 2 (strings + tablas numéricas).
3. **Nombres.** Cada función lleva el nombre semántico derivado por su task (con
   cita `re/notes/<subsistema>.md`). Las rutinas del kernel derivadas por algún
   subsistema se re-bautizan desde `kernel_catalog.KNOWN_NAMES` (F.1 subió el
   diccionario a **44 entradas** = 23 previas + 21 de F.1).
4. **Verificación.** El invariante `mark()` rechaza solapes; cada catálogo asegura
   `gaps(FILE) == []`; `test_ledger.py` valida el modelo; `test_dispatch.py` valida
   la partición exacta del kernel y sus estructuras (dispatcher, jump-table,
   registros PLINK).

## 3. Funciones kernel provisionales (honestidad)

De los ~181 prólogos del kernel, **130** conservan el nombre provisional
`kernel_fn_<addr>`. Cada uno lleva la nota: *"nombre provisional… cuerpo no
re-derivado en detalle — ningún subsistema migrado depende de su semántica fina
(cobertura, no verdad byte a byte)"*. No es una laguna de cobertura: son bytes
`code` justificados por prólogo. Los 44 que **sí** ejerce un subsistema están
nombrados (RNG `rand0`/`rand30`, `apply_damage`, `chest_trap`, `camp_holeup`,
`advance_clock`, `spawn_actor`, `wind_anim_tick`, dispatcher, getkey, print…).

Globals: los `g_unk_<addr>` funcionan como **identificadores estables por
dirección** (referenciados en los 24 `.asm`, notas y fuente del clon). F.1 rellenó
su `meaning`: los derivados por una nota tienen semántica; los genuinamente
desconocidos llevan *"sin derivación fina: BSS/scratch cross-overlay… no requerido
para la paridad"*. Ninguno queda como `pendiente`.

## 4. Reglas ✅ RUNTIME-VERIFICADAS contra DOSBox (valor byte a byte)

Estas se cotejaron tirada a tirada / valor a valor contra el binario ejecutándose,
no sólo por asm:

- **Combate — fórmula de acierto + daño/defensa + veneno + trayectoria de HP**
  (`test_combat_trace_parity_live`, 1 passed en 635 s): `rand30() ≥ (dexDef −
  statAtk + 30)/2`, calcado en un escenario de melé sembrado. Iniciativa (velocidad
  de spawn `dex ± rand0(7) − 4`) verificada en vivo.
- **Órbita/semilla del RNG del kernel** — `OriginalRng` reproduce la secuencia del
  LCG; `g_rng_seed == 0` leído en el título antes del menú (ancla de la gitana).
- **Viento — valor por turno** (`test_wind_value_live`, kernel 0x2F62): 1×rand(0,63)
  por world-turn; g_wind del turno siguiente casó EXACTO para N/S/E/O/Calm.
- **Feed lunar — fases del día** (`test_lunar_phase_feed_live`, 0x4a84→DATA 0x1EEA):
  g_felucca_phase/g_trammel_phase byte-idénticos a MOON_PHASES para días 1/8/15/22.
- **Semilla de la gitana == 0** (`test_gypsy_parity::…live`): bracket determinista
  desde seed 0; el clon replica `rand_range(0,7)` con `OriginalRng(0)`.
- **Movimiento** (Task 3.1): bloqueo (pueblo 1 min / exterior sin coste) y
  reloj/comida/hambre/antorchas verificados en DOSBox.

## 5. ⚠️ restantes en FIDELITY.md — conteo y dueño

`docs/FIDELITY.md` tras F.1 contiene 89 glifos ⚠️, pero eso incluye los 4 de la
leyenda del encabezado y 10 continuaciones inline dentro de una entrada. Las
**entradas ⚠️ reales son 75**, todas con dueño explícito según la convención:

- **37 entradas ⚠️→formulado** — regla asm-derivada + cruce modelo↔clon; **dueño =
  Task F.2** (paridad runtime contra DOSBox). Suben a ✅ cuando el live las mida.
- **38 entradas ⚠️** (a secas) — cada una declara su dueño: **Task F.2** (cableado al
  bucle de juego / escenario runtime aún no montado) o **pregunta de oráculo** (un
  valor del original sin medir todavía, p.ej. duración de puerta abierta, curva de
  precio por karma, paleta EGA).

**Ninguna ⚠️ apunta ya a una task 3.x cerrada**: las Tasks 3.1–3.13 se citan sólo
como PROCEDENCIA de una regla; el dueño de todo trabajo pendiente es F.2 o el
oráculo. F.1 no cerró ninguna ⚠️ nueva (sólo consistencia y dueños).

## 6. Divergencias de alcance deliberadas

No son lagunas de modelado, son fronteras conscientes (todas documentadas en las
notas de su subsistema):

- **Paridad de STREAM vs runtime** para cofres/objetos (CMDS/SJOG) y mazmorra: los
  registros de 8 B de cofre/objeto no se siembran headless, así que se verifican por
  cruce modelo↔clon (Python asm-derivado ↔ `OriginalRng` del clon), no contra
  DOSBox. Igual que el flicker de render de mazmorra (RNG cosmético excluido del
  núcleo puro).
- **Movimiento de la IA en combate**: su stream de rand no se captura con fiabilidad
  por el canal pty (~1/12 tiradas legibles); el escenario de combate siembra a los
  enemigos ya en melé. La fórmula sigue asm-derivada con cita.
- **Ruta de transferencia de Ultima IV** (INTRO): derivada y documentada, no
  portada (el clon no importa personajes de U4).
- **QoL aditivo** (❌): música XMI comunitaria (el DOS era mudo), tiles HD xBR,
  cámara suave con viewport 21×15. No afectan la lógica.

## 7. Estado de las suites (2026-07-11)

- `python3 re/tools/ledger.py` — **202800 / 202800 (100 %)**, 0 pendientes.
- `npm test -w game` — **484 passed** (31 ficheros).
- Extractor — 107 passed.
- Suite RE `pytest -k "not live"` — **293 passed** (los 11 live son opt-in con DOSBox).
- `npm run re:parity:all` (F.2) — **239 passed / 132 s**: los 13 arneses de paridad
  puros en un solo comando (incl. el escenario maestro gitana→endgame).

Tag del cierre de cobertura: **`re-complete`**. Tag del cierre de F.2: **`re-parity-suite`**.

## 8. Cierre F.2 — suite de regresión + ruta crítica (2026-07-11)

La task final añadió la **red de regresión maestra** y cerró la deuda de fidelidad:

- **`npm run re:parity:all`** (`re/tools/parity_all.py`): corre TODOS los arneses de
  paridad puros modelo↔clon en un comando (~2 min); con `U5RE_LIVE=1` encadena
  SECUENCIAL los 11 tests live opt-in con limpieza de dosbox huérfano entre runs
  (un emulador a la vez, pgrep+kill).
- **Ruta crítica gitana→endgame** (`test_master_scenario.py` + `master_parity.py` +
  `master-run.ts`): el escenario de regresión maestro. Encadena en UN SOLO stream de
  RNG (`g_rng_seed`) la creación de personaje (seed 0) → bucle exterior → emboscada de
  trolls → bucle de pueblo → informe de endgame, exigiendo semilla + traza de rands
  idénticas clon↔modelo en cada frontera de fase. **Cierra la unificación del stream a
  nivel MODELO↔CLON**: demuestra que el ORDEN de RNG del binario está bien modelado con
  una sola semilla threadeada por los motores puros (`turn.ts`/`hazards.ts`/`gypsy.ts`
  con `OriginalRng`). **NO cierra la unificación del stream VIVO** del clon jugable:
  `game.ts` todavía corre el housekeeping dentro de `tryMove` ANTES del viento de
  `tickTurn` y usa fuentes de RNG separadas (`encounterRng = Math.random`, `Rng`-hash
  por turno para spawn/npc/combate) — eso sigue ABIERTO como Clase B en
  `deliberate-divergences.md §2`. Ancla live re-verificada: `g_rng_seed == 0` en el
  título de DOSBox.
- **`re/deliberate-divergences.md`**: catálogo de toda divergencia deliberada
  (clases A–E) con qué/por qué/cómo-cerrarla. **FIDELITY.md ya no tiene ⚠️ huérfanas**:
  cada una es `✅` o una divergencia catalogada con su vía de cierre.

Estado final del proyecto: ledger 100 %, reglas asm-derivadas con cita, **6
subsistemas verificados en vivo**, el resto en paridad de stream modelo↔clon, y el
ORDEN del stream del binario demostrado con una sola semilla threadeada en los motores
puros. Quedan ABIERTOS (Clase B, `deliberate-divergences.md §2`) la unificación del
stream VIVO de `game.ts` (`encounterRng = Math.random` es no-determinismo real en el
clon jugable) y el cableado interactivo; y como preguntas de oráculo (§3) los cierres
live nuevos (BP pick_virtue, [0x5891], BP tiendas, sembrado NPC).
