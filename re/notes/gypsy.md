# Creación de personaje — el cuestionario de la gitana (Task 3.11)

Re-derivado del asm de **FONT.OVL** (la creación va empaquetada ahí porque
comparte el renderizador de texto; el nombre "FONT" engaña) con datos en
**DATA.OVL**. Citas `fileoff: instrucción → regla` sobre `re/disasm/FONT.OVL.asm`.
Portado a `game/src/core/creation/gypsy.ts`; integrado en
`game/src/core/state.ts:createNewGame`. Paridad: `re/tools/gypsy_parity.py` +
`game/src/core/__parity__/gypsy-run.ts`. Fidelidad: `re/verified/gypsy.md`.

La gitana ("The Summoning") corre desde la ruta **"Create New Character"** del
menú de portada — PRE-mundo, no carga SAVED.GAM. Escribe el registro 0 (Avatar)
de la ventana del roster (`0x55A6`) y vuelca `SAVED.GAM` a disco; "Journey
Onward" lo recarga verbatim.

## Mapa de funciones (FONT.OVL, la gitana = trío [0x0998, 0x0E52))

| fileoff | nombre | qué hace |
|---|---|---|
| `0x0998` | `pick_virtue` | rand_range(0,7) con rechazo usada-esta-ronda/eliminada; marca usada |
| `0x09C8` | `matchup` | elige 2 virtudes, ordena, muestra pregunta, lee A/B, puntúa, elimina perdedora |
| `0x0B0A` | `create_character_main` | INIT.GAM→roster, nombre, sexo, torneo 4+2+1, finalize, escribe SAVED.GAM |

(El resto de FONT.OVL — render de glifos, escenas — es territorio de Task 3.12.)

## Datos (DATA.OVL). Mapeo DS→fileoff = **DS + 0x10** (verificado)

- **8 virtudes, orden canónico U4/U5**: `0=Honesty, 1=Compassion, 2=Valor,
  3=Justice, 4=Sacrifice, 5=Honor, 6=Spirituality, 7=Humility`.
- **Tablas virtud→atributo** (8 bytes cada una):
  - INT `DS:0x5164` (fo 0x5174): `[2,0,0,1,0,1,1,0]`
  - DEX `DS:0x516c` (fo 0x517c): `[0,2,0,1,1,0,1,0]`
  - STR `DS:0x5174` (fo 0x5184): `[0,0,2,0,1,1,1,0]`

  Por virtud (STR,DEX,INT) — el mapeo canónico de Ultima; cada virtud suma 2 pts
  al ganar (Spirituality 3, Humility 0):

  | idx | virtud | STR | DEX | INT |
  |---|---|---|---|---|
  | 0 | Honesty | 0 | 0 | 2 |
  | 1 | Compassion | 0 | 2 | 0 |
  | 2 | Valor | 2 | 0 | 0 |
  | 3 | Justice | 0 | 1 | 1 |
  | 4 | Sacrifice | 1 | 1 | 0 |
  | 5 | Honor | 1 | 0 | 1 |
  | 6 | Spirituality | 1 | 1 | 1 |
  | 7 | Humility | 0 | 0 | 0 |

- **Matriz 8×8 de offsets de pregunta** en `DS:0x517c` (fo 0x518c, words) =
  offset de fichero en `QUESTION.DAT`. Simétrica, diagonal 0, **28 preguntas
  distintas** = C(8,2), offsets 0x6c2..0x1d87. Lookup (matchup 0x0a8d-0x0a99):
  `matriz[a*16 + b*2]`.
- **Posiciones en pantalla** (cosmético): col `DS:0x51fc` `[40,48,48,40,40,48,40,48]`,
  fila `DS:0x5204` `[5,7,4,10,8,0,5,6]`.
- **Acumuladores** (BSS byte): `0xbd3c`=INT, `0xbd3d`=DEX, `0xbd3e`=STR.
  **Flags** (BSS 8B): `0xbd2a`=usada-esta-ronda, `0xbd32`=eliminada.

## Init de acumuladores (create_character_main `0x0ca2-0x0ccb`)
```
0ca2: al=[g_party_records+14](INT); [0xbd3c]=al   → acc INT = base del reg (INIT.GAM 15)
0ca8: al=[g_party_records+13](DEX); [0xbd3d]=al   → acc DEX = 15
0cae: al=[g_party_records+12](STR); [0xbd3e]=al   → acc STR = 15
0cb4-0ccb: for cl=0..7: [0xbd2a+si]=0; [0xbd32+si]=0  (limpia flags)
```
Los acumuladores parten de los stats del registro (INIT.GAM = 15/15/15) y el
quiz suma encima.

## Driver: bracket de eliminación 4+2+1 = 7 preguntas (`0x0cd0-0x0d2c`)
```
0cd0: si=4; do { matchup() } while --si          ; Ronda 1: 4 matchups (8→4)
0ce4-0cf5: repne stosw cx=4 → limpia 0xbd2a[8]   ; reset "usada esta ronda"
0cfb: si=2; do { matchup() } while --si          ; Ronda 2: 2 matchups (4→2)
0d0f-0d20: limpia 0xbd2a[8]
0d26: matchup()                                  ; Ronda 3: 1 matchup (2→1)
```
`0xbd32` (eliminadas) persiste entre rondas; `0xbd2a` (usada-esta-ronda) se
resetea. Cada ronda empareja TODAS las virtudes vivas.

## Selección de par (pick_virtue `0x0998`, matchup `0x09c8`)
```
pick_virtue:
  099f: push 0; push 7; 09a6: call rand_range → si = rand(0,7)
  09ab: cmp [0xbd2a+si],0; jne retry     (rechaza usada esta ronda)
  09b2: cmp [0xbd32+si],0; jne retry     (rechaza eliminada)
  09be: [0xbd2a+si]=1; return si
matchup:
  0a0d: X=pick_virtue(); 0a13: Y=pick_virtue()
  0a19: si X<=Y → a=X,b=Y,[bp-0xa]='A'(0x41); si no → a=Y,b=X,[bp-0xa]='B'(0x42)
        (ordena a=min, b=max para indexar el triángulo superior de la matriz)
```
El RNG es el del kernel (`rand_range` 0x2092, ver `rng.md` — `OriginalRng` en el
clon).

> 🔴 **PREMISA REFUTADA por #186** (`rng-186-acta.md §6`). Este párrafo decía: «como al
> arrancar `g_rng_seed=0` y **nada re-siembra** entre el boot y la gitana (rng.md: 0 sitios
> srand/time_hash en INTRO/FONT …), el bracket es **determinista** desde seed 0.
> Verificado en vivo: g_rng_seed==0 en el título».
>
> De sus tres cláusulas, **dos se confirman y una es FALSA**:
> - ✔ «INTRO con 0 rand» — `near_calls_to_kernel('INTRO.OVL', 0x2092)` → `[]`.
> - ✔ «el único rand de FONT es `pick_virtue`, en 0x9a6» — y FONT tiene 0 srand/time_hash.
> - ✘ «0 sitios srand/time_hash en **INTRO**» — **INTRO.OVL 0x0CC9** (`e8 ca 91` →
>   CS 0x2056, la de `rng_time_hash`) y **0x0CCD** (`e8 ee 91` → CS 0x207E, la de `rng_srand`), bytes
>   del fichero, base 0x81C0 validada con el control positivo `0x0ABD → CS 0x1D5E
>   kernel_getkey`. Están en `intro_main_controller 0x0986`, y **los dos únicos caminos
>   que llegan al menú de portada pasan por ahí** (0x0B02 `jmp 0xcc9` y el fall-through
>   de 0x0CC4); los seis `jmp 0xcd0` de re-pintado entran DESPUÉS. La creación de
>   personaje se elige con 'C' en ese menú (0x0E54 → 0x0FA8).
>
> **El testigo vivo no rescata la conclusión: mide en el sitio equivocado.**
> `test_seed_zero_at_title_live` lee en «el PRIMER sondeo de teclado del título», que es
> el de los créditos/attract (0x0ABD `kernel_getkey` / 0x0BE1 `read_key_timed`),
> **upstream de 0x0CC9**. El verde es real y NO prueba lo que su docstring dice.
>
> **Estado: lo de abajo queda EN SUSPENSO, no invertido.** Lo establecido es estático (la
> re-siembra existe y está en el camino; los únicos escritores de `g_rng_seed` son `srand`
> y `rand_range`, y no hay más `srand` en INTRO ni en FONT). Falta el testigo que lea
> `g_rng_seed` con BP en `pick_virtue` FONT 0x0998 en **dos arranques a horas distintas**
> (predicción pre-registrada: dos valores distintos en [0,0x0FFF] y bracket distinto;
> `time_hash` da 12 bits, así que 1/4096 arranques daría 0 por casualidad). Tarjeta T1 del
> acta. **El port NO se ha tocado**: el bracket determinista sigue vivo en `gypsy.ts` a la
> espera de decisión del lead (mismo dilema que D6 #180). El emparejamiento de
rondas 2-3 depende de las respuestas (la eliminación filtra el rechazo del RNG),
así que RNG y respuestas están entrelazados.

Secuencia `rand(0,7)` desde seed 0: `[2,4,4,4,4,7,6,4,4,4,...]`. Bracket ronda 1:
`Valor–Sacrifice · Spirituality–Humility · Honesty–Justice · Compassion–Honor`.

## Respuesta y puntuación (`0x0ab4-0x0b07`)
```
0ab4-0ac4: lee tecla; solo 'A'(0x41)/'B'(0x42)
0ac6: al=[bp-0xa] (la letra que hace ganar a "a"); cmp con tecla
0acc: si != → swap [bp-4]<->[bp-6]  (deja [bp-4]=virtud GANADORA)
0ae0: bx=ganadora
0ae3: [0xbd3c]+=INTtbl[bx]; 0aeb: [0xbd3d]+=DEXtbl[bx]; 0af3: [0xbd3e]+=STRtbl[bx]
0afb: bx=perdedora; [0xbd32+bx]=1   (elimina)
```
**Regla:** 'A' hace ganar la virtud de índice MENOR (`a`), 'B' la MAYOR (`b`); la
posición A/B es solo presentación. La virtud GANADORA suma sus (STR,DEX,INT); la
perdedora se elimina. Un virtud campeona gana 3 veces (suma 3×), la finalista 2×,
etc. — 7 victorias repartidas sobre 15/15/15.

## Finalize — acumuladores → registro (`0x0dc8-0x0de4`)
```
0dc8: al=[0xbd3c](INT); 0dcb:[+14]=al(INT); 0dce:[+15]=al(MP)
0dd1: al=[0xbd3d](DEX); 0dd4:[+13]=al(DEX)
0dd7: al=[0xbd3e](STR); sub al,0x14; sbb cl,cl; not cl; and al,cl; add al,0x14  → max(STR_acc,20)
0de4: [+12]=al(STR)
```
**Reglas finales:**
- `INT = 15 + Σ INT(ganadoras)`; **`MP = INT`** (currentMP = INT final).
- `DEX = 15 + Σ DEX(ganadoras)` (sin suelo).
- `STR = max(15 + Σ STR(ganadoras), 20)` — **suelo 20 solo en STR**.
- **HP, maxHP, exp, level, clase, equipo NO se tocan**: quedan los de INIT.GAM
  (HP=maxHP=60, exp=150, level=2, clase 'A', equipo fijo).

## Nombre y sexo (create_character_main)
- **Nombre** (`0x0bab-0x0bcc`): prompt "By what name shalt thou be known?" (DGROUP
  0xa06a, `call 0x3670`); input `0bc4: push 0x55a8` (buffer del nombre del reg 0),
  `0bc8: push 8` (**máx 8 caracteres**), `0bcc: call 0x3c58` (rutina de input de
  string del kernel).
- **Nombre vacío ABORTA** (`0x0bcf`): `cmp byte[g_party_records],0` (primer byte
  del nombre); `0bd4 jne 0xbd9` continúa si hay nombre; `0bd6 jmp 0xe40` salta al
  final SIN escribir SAVED.GAM si está vacío. El clon: nombre vacío → cancela.
- **Sexo** (`0x0be8-0x0c1b`): lee tecla, solo 'M'(0x4d)/'F'(0x46). `[+9]=0x0b` (M)
  o `0x0c` (F). No toca stats; clase queda 'A'.

## Textos y pantalla (cableado en el clon)
- **QUESTION.DAT** → `game/assets/questions.json` (extractor `parseQuestions`): 2
  narraciones + 28 preguntas en orden combinatorio i<j. Par (a,b) → índice de
  pregunta con `k=28−(8−i)(7−i)/2+(j−i)` (`questionIndexForPair` en gypsy.ts). El
  original indexa la matriz de DATA.OVL con los picks X,Y SIN ordenar (0x0a8d,
  pre-swap), pero la matriz es simétrica → mismo registro.
- **Pantalla**: `game/src/ui/creation.ts` (botón "Create New Character" del título)
  → nombre → género → 7 preguntas → `applyGypsyCreation`.

## Mapa de funciones de INTRO.OVL (17 prólogos `55 8bec`; menú de portada + transfer U4)

Enumeración completa de los 17 prólogos reales (fileoffs) de `re/disasm/INTRO.OVL.asm`.
INTRO es el menú de portada y la ruta de transferencia de U4 — **NO la gitana** (esa está
en FONT). `rand/srand/time_hash` = 0 call sites en todo INTRO (rng.md). El byte-marking
preciso en coverage.json (con las tablas de datos intercaladas, p.ej. la jump-table de clase
en ~0x1288) queda para Task F.1; aquí el mapa de roles:

| fileoff | stub | rol (evidencia; draft §4) |
|---|---|---|
| `0x0050` | — | hit-test de región del título (recorre 0x55A6, tile-map de la portada) |
| `0x014e` | — | helper de portada (sin analizar a fondo) |
| `0x043e` | 0x7CC2 | dibuja caja/realce de menú centrado (filas 0xC0..0xC7) |
| `0x04e0` | — | helper de menú/dibujo (sin analizar) |
| `0x05b0` | — | helper (sin analizar) |
| `0x0676` | — | helper (sin analizar) |
| `0x06bc` | — | helper (sin analizar) |
| `0x072e` | — | helper (sin analizar) |
| `0x094e` | — | input de tecla / temporización (retorno cmp 1) |
| `0x0986` | 0x7A2E | **controlador principal del intro**: menú "Journey Onward/Create/Transfer U4"; carga SAVED.GAM a 0x55A6 |
| `0x1016` | — | commit de nombre (fn interna llamada desde la entrada de nombre) |
| `0x12ea` | — | `u4_stat_rescale` (transfer U4→U5; ver abajo) |
| `0x132a` | — | hoja de personaje / ZSTATS-like en "Journey Onward"; jump-table por clase en ~0x1288 |
| `0x1e22` | — | helper de finalize/dibujo (sin analizar) |
| `0x1e62` | — | helper (sin analizar) |
| `0x1f26` | — | helper (sin analizar) |
| `0x2090` | 0x7CF2 | música intro START (`mov [g_snd_driver_fn],0x69; lcall`) |

## Ruta de TRANSFER de Ultima IV (INTRO.OVL) — secundaria, NO es el quiz
Al importar un personaje U4 (gate `[0x3304]`, INTRO `0x132a`): reescala stats
U4→U5 (`0x12ea`: `v<10→v`; `10≤v<30→10+(v-9)/2`; `v≥30→20+(v-30)/4`), deriva
level/HP de exp (`0x1a16`: `level=1; cx=exp/100; while cx>0 {level++; cx>>=1}`;
`HP=maxHP=30·level`), STR con suelo 20. **Esta ruta produce stats arbitrarios del
personaje importado — NO el quiz determinista.** La muestra "Elwood" 20/24/17/17
que aparece en drafts previos (imposible desde el bracket seed-0 con cualquier
guion de respuestas) provenía de esta ruta de transfer, no de la gitana.
(Reescala documentada; port opcional — el clon no tiene import de U4.)
