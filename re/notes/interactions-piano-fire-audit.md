# Auditoría de interacciones: tocar el clavicémbalo + "entrar en fuegos" (task #54)

**Mandato**: el usuario reporta DOS features del original (avisa que NO las ha
comprobado): (1) "sentarse junto al piano y tocarlo"; (2) "entrar en fuegos de
habitaciones, a veces hay pasadizos". Contrato de fidelidad: **asm = autoridad**;
el veredicto derivado ES el entregable.

Binarios: `original/u5/ultima5/` (TOWN.OVL, DATA.OVL, ULTIMA.EXE, CMDS.OVL,
MAINOUT.OVL). Disasm regenerado con `re/tools/disasm.py`. Mapeo de datos:
**DATA.OVL `fileoff = DS_off + 0x10`** (command-dispatch.md §4).

---

## FEATURE 1 — Tocar el clavicémbalo (Harpsichord) → **EXISTE** (derivado byte a byte)

### 1.1 El tile y el gate de adyacencia
- **Tile 0x8D = `Harpsichord`** (TileData.json "141"; `IsWalking_Passable:false`
  → no se pisa, uno se **sienta al lado**).
- La condición de "estar al clavicémbalo" es `g_unk_abc7 == 0x8D`
  (TOWN.OVL `0e3f: cmp byte ptr [g_unk_abc7], 0x8d`).
- **RESUELTO (antes INDETERMINADO): `g_unk_abc7` = el tile INMEDIATAMENTE AL SUR
  de la party.** Derivación por geometría del buffer (doble confirmación estática,
  sin oráculo):
  1. `g_vis_buffer` (DS **0xAB02**, ventana 11×11 centrada en party, **stride 0x20**;
     ledger globals.json + kernel-sweep-2.md:113 `[si+base-0x54fe]=0xab02`). El tile
     propio de la party cae en el centro (fila 5, col 5) = `0xAB02 + 5·0x20 + 5 =
     **0xABA7**`. Los 4 vecinos: N=`0xAB87`, **S=`0xABC7`**, O=`0xABA6`, E=`0xABA8`.
     ⇒ `g_unk_abc7 (0xABC7) = vecino SUR`. Coincide con las lecturas de CMDS
     (cañón: O=`0xABA6`, E=`0xABA8`, S=`0xABC7`) y MAINOUT (`0xABC7`, tile 0xD4-D7).
     No hay escritura directa `[0xABC7]` en ningún binario (el barrido lo llena
     por puntero calculado) — congruente con "celda de un buffer".
  2. **Layout del mapa** (CASTLE.DAT): en las DOS instancias del clavicémbalo
     (0x8D) el tile **al NORTE es `0x92 ChairBackBack` (silla, PISABLE)** y
     S/O = muro, E = planta. ⇒ la party se **SIENTA en la silla mirando al sur**,
     con el clavicémbalo justo debajo → el vecino sur (`abc7`) ES el clavicémbalo.
     El "sentarse junto al piano" del usuario es **literal** (hay silla).

### 1.2 El disparo: dígitos 0-9 en el bucle de pueblo
Bucle de entrada de small-map (TOWN 0x1580): con la tecla leída en `[bp-6]`,
```
1580: cmp [bp-6], 0x30 ; '0'
1586: cmp [bp-6], 0x39 ; '9'
1594: push [bp-6]; call 0xe34   ; dígito 0-9 → HANDLER DE NOTA
158f: (si no dígito) call 0xafa8 ; despacho normal de comando
```
Es decir: en small map, **cualquier dígito 0-9 se enruta al handler de nota**
(TOWN 0x0E34), no al dispatch de comando. Tocar una nota devuelve 3 → el caller
`jmp 0x148f` **re-lee tecla sin consumir turno** (159d: `cmp ax,3; je 0x148f`).

### 1.3 El handler de nota (TOWN 0x0E34)
```
0e34: [bp-2]=3
0e3f: if [abc7] != 0x8d -> 0xef0 (NO adyacente: pasa el dígito al dispatch normal 0xbeb0)
0e49: [bp+4] -= 0x30            ; ASCII dígito -> nota 0..9
0e4d: if [a9ce]==0 -> 0xe70     ; a9ce = flag de sonido; si 0, no suena
0e54: bx = nota; shl bx,1
0e59: push [bx+0x2746]          ; freq = tabla_notas[nota]
      tone_sweep(freq, 1, 0xFA0, 0x4E20, 0xFFFC)  ; = (freq,1,4000,20000,-4)
0e70: <matcher de secuencia>    ; ver 1.4
0ef0: (no adyacente) push [bp+4]; call 0xbeb0; ret
```
Los **params de tone_sweep coinciden EXACTO** con el cue `instrument-note` ya
cableado en el port (`speaker.ts §4.1`): `toneSweep(nota,1,4000,20000,-4)`.

### 1.4 La partitura y el SECRETO (pasadizo, NO trampilla)
Datos en DATA.OVL (DS→fileoff +0x10):

- **Tabla de notas `DS:0x2746`** (10 words, indexada por dígito):
  `[0x1EAB, 0x0C2C, 0x0DA9, 0x0F56, 0x103F, 0x123C, 0x1478, 0x16FA, 0x1857, 0x1B53]`
  → dígito **0 = nota más aguda** (0x1EAB, la 10ª tecla sobre la octava);
  dígitos **1-9 = escala ascendente** 0x0C2C…0x1B53. (El port tenía placeholders
  nominales — ver §1.6.)
- **Melodía objetivo `DS:0x275A`** (13 bytes de dígitos):
  **`6 7 8 9 8 7 8 7 6 7 6 5 3`**
- **Contador de progreso `DS:0x2767`** (byte, 0 al cargar).

El matcher (0e70-0ee8) es tipo-KMP: en acierto `[0x2767]++`; en fallo rebobina a
3/2/1/0 según coincidencias parciales. Al **completar las 13 notas**
(`[0x2767]==0xD`), y **sólo si `g_location==0x11` (Castillo de Lord British) y
`g_floor==2`**:
```
0e9e: xor byte [0x67b9], 0xb   ; conmuta UN tile del buffer de mapa cargado
0ea3: call 0xaea2              ; repinta
0ea6: [g_unk_24e6] = 1         ; flag "repintar"
```
**El `xor 0xb` conmuta un tile de muro↔suelo = revela un PASADIZO SECRETO** (NO
una trampilla; el `0x8C`+"A TRAPDOOR!" `DS:0x2768` es mecánica SEPARADA cuya
string sólo estaba contigua en DATA.OVL).

**CELDA FIJADA CON EL ORÁCULO (G2b, testigo runtime):** `0x67b9` = celda **(17,13)**
del buffer de mapa de la planta actual (base DS **0x6608**, stride 32; correlación
**1024/1024** del volcado vs CASTLE.DAT LB floor -1). En LB castle floor 2 esa
celda es **`0x4F StoneBrickWall` → `0x44 BrickFloor`** (`0x4F^0xB=0x44`): abre el
muro al NORTE del clavicémbalo (corredor 17,17→17,14 es BrickFloor; la sala tras
el muro tiene la Fireplace 0xBC en (15,12)). Confirmado en vivo: forcé
loc=0x11/floor=2/[abc7]=0x8D/progreso=12, envié la nota "3" → `[0x67b9]` pasó de
`0x44→0x4f` (xor 0xb) y el progreso se reseteó a 0 (melodía completada).

- `g_location 0x11 = 17 = Castillo de Lord British` (shop.ts "17 = LB Castle";
  LOCATIONS: id 17, CASTLE.DAT, floors `[-1,0,1,2,3]` consecutivos). El
  clavicémbalo disparador está en la **rebanada 3 de CASTLE.DAT = floor 2**,
  en **(x=17, y=18)**, con la silla en (17,17) → coincide EXACTO con el gate
  `g_location==0x11 && g_floor==2`. (Hay un 2º clavicémbalo en la rebanada 1 =
  floor 0, DECORATIVO: suena pero no dispara el secreto, floor≠2.)
- **Persistencia**: `0x67b9` cae en `dgroupScratch6616` (0x6616..0x6A9A), POR
  ENCIMA de la `savedGamWindow` (0x55AC..**0x6616**) → el toggle vive en el buffer
  de mapa RUNTIME, **NO se serializa al SAVED.GAM**. Además el mapa pequeño se
  recarga de CASTLE.DAT al entrar. ⇒ el pasadizo es **POR-SESIÓN** (se re-oculta
  al salir/recargar). La celda exacta del toggle depende de la base real del
  buffer 32×32 (~~kernel 0xC232 [= CS 0x4402 → ULTIMA.EXE:0x4402 get_tile_ptr] en seg2~~; **RESUELTO estáticamente 2026-07-25**: `0xC232` era el destino crudo desde TOWN/MAINOUT (banda 1, base 0x81d0) ⇒ `(0x81d0+0xc232)&0xFFFF = 0x4402` = **`get_tile_ptr`** del residente, ya derivada — no hace falta ni G2 ni testigo para fijar la base del buffer).

**⇒ El "piano" del recuerdo del usuario = clavicémbalo del Castillo de LB;
tocando la melodía `6-7-8-9-8-7-8-7-6-7-6-5-3` se abre un PASADIZO secreto
(muro 0x4F→suelo 0x44).** Esto explica ADEMÁS su memoria de "pasadizos".

### 1.5 Estado del port
- **G1 [HECHO, landed]**: tabla de notas real `DS:0x2746` en `speaker.ts`.
- **G2a [HECHO, commit 2ffa896]**: `world/harpsichord.ts` (matcher puro) +
  `game.ts` (`harpsichordSeated()`, `playHarpsichordNote()`, flag por-sesión
  `harpsichordPassageOpen`) + hook de dígitos en `main.ts`. Toca notas y detecta
  la melodía. Sin efecto VISIBLE todavía.
- **G3 [HECHO, landed]**: daño "Burning!" en Fireplace/Lava (feature 2).

### 1.6 G2b — revelado VISIBLE del pasadizo (PENDIENTE, necesita oráculo)
El único bloqueo es la CELDA exacta que conmuta `xor [0x67b9],0xb`. Hallazgos:
- El toggle es **StoneBrickWall `0x4F` → BrickFloor `0x44`** (0x4F^0xB=0x44): abre
  un muro sólido = pasadizo. (Antes escribí 0x4E↔0x45; ambos pares valen bajo
  xor 0xb, pero floor 2 no tiene 0x4E; sí muchos 0x4F.)
- `0x67b9` tiene **una sola** referencia literal en TODO el binario (el propio
  xor); la región 0x66xx-67xx NO es un buffer de mapa plano (0x67e0 tiene 43
  refs = variable caliente). ⇒ no es una celda de mapa direccionable en claro;
  la actualización del mapa la hace la rutina residente/seg2 tras el xor (0xAEA2).
- Topología del mapa: el clavicémbalo está en una **sala pequeña** de LB floor 2;
  hay **13** muros `0x4F` candidatos entre la sala y el resto → **ambiguo**, no
  fija la celda por sí solo.
- **Plan G2b (oráculo DIFF, autorizado por el lead)** — receta DE-RIESGADA (la
  celda OFFSET es independiente del mapa, así que sirve CUALQUIER small map; no
  hace falta craftear un save de interior):
  1. `boot()` + `send_keys_until_main_menu()` + entrar a UN pueblo cualquiera
     (bucle TOWN activo). Alternativa a craftear save: `combat_parity` /
     navegación por `send_keys`.
  2. `write_mem_gameseg` para forzar las precondiciones del handler:
     `g_location`=0x11 (**DS 0x5893**), `g_floor`=2 (**0x5895**),
     `[0xABC7]`=0x8D (abc7=sur, dispara el gate del asiento), progreso
     `[0x2767]`=0x0C (12, una antes de completar). (Leer 0xABC7 antes = confirma
     empíricamente abc7=sur si estás sentado a un clavicémbalo real.)
  3. Volcar DGROUP (`read_mem_gameseg`), `send_keys("3")` (la 13ª nota =
     MELODY[12]=3 → completa → `xor [0x67b9]` + `call 0xAEA2` revela), volcar de
     nuevo, **DIFF**. Cambios esperados: `0x67b9` (el xor) + la CELDA de mapa que
     escribe 0xAEA2. La dirección del byte de mapa cambiado → base real del buffer
     32×32 → offset → (x,y) de la celda del pasadizo, y su transición (0x4F→0x44).
  4. Cablear: consumir `harpsichordPassageOpen` en `activeMap.tileAt` (celda
     derivada, muro→suelo) + verificación en navegador visible.
  Addrs listas: g_location 0x5893 · g_floor 0x5895 · g_party_x/y 0x5896/0x5897 ·
  abc7 0xABC7 · progreso 0x2767. Coste: el oráculo no tiene helper de "entrar a
  location" (hay que conducir input crudo con el flush de type-ahead de
  oracle-input.md); tanda propia enfocada.

---

## FEATURE 2 — "Entrar en fuegos de habitaciones + pasadizos" → **MAYORMENTE NO** (matizado)

Autoridad de pisabilidad: **bitmap DS:0x54D4** (32 bytes, 1 bit/tile; bit puesto =
**BLOQUEADO**). Leído por `kernel_tile_passable 0x2C4C` → predicado `0x2BD4`
(`ax=0x80>>(tile&7); test [tile>>3 + 0x54d4]`). Validado contra el port en 25/26
tiles de control (agua, montañas, hierba, sillas, muros).

### 2.1 Fuegos NO pisables (bloqueados en el binario, port coincide)
| tile | nombre | bitmap |
|---|---|---|
| 0xB0/0xB1 | RightSconce/LeftSconce (antorchas de pared) | BLOQUEADO |
| 0xB2 | Brazier (brasero) | BLOQUEADO |
| 0xB3 | CampFire (hoguera) | BLOQUEADO |
| 0xA3 | FireLogs | BLOQUEADO |
| 0xDE | BlueFlame | BLOQUEADO |

→ **No se puede "entrar" en un fuego ardiendo.** El port ya lo bloquea (todos
`IsWalking_Passable:false`).

### 2.2 Tiles de fuego SÍ pisables = **tiles de daño "Burning!"**
| tile | nombre | bitmap | port |
|---|---|---|---|
| **0xBC** | **Fireplace (chimenea)** | PASABLE | `IsWalking_Passable:true` |
| **0x8F** | **Lava** | PASABLE | `IsWalking_Passable:true` |
| 0x8C | BrickFloorHole (trampilla, §1.4) | PASABLE | true |

`Fireplace` y `Lava` **se pisan**. En small map, TOWN post_turn 0x0F02 mira el
tile bajo la party (`[bp-8]`, calc. de `tileAt(party_x,party_y)`) y:
```
10ac: cmp [bp-8], 0xbc      ; Fireplace
10b3: cmp [bp-8], 0x8f      ; Lava
10ba: call 0xffffd740       ; tick de viento KERNEL 0x5910 (extra)
10bd: push 0x2780; call print   ; str DS:0x2780 = "Burning!\n"
10c4: call 0xffffa8d8       ; party_random_damage = rand(1,8)/miembro (kernel 0x2AA8)
```
(Además tile 4 = pantano de pueblo → "Poisoned!" con `rand(0,29)>DEX`; tile 0x8C
= trampilla → "A TRAPDOOR!".)

**⇒ "Entrar en la chimenea" SÍ existe**: se pisa el tile `Fireplace 0xBC` (y
`Lava 0x8F`), imprime **"Burning!"** y **daña `rand(1,8)` HP a cada miembro**.

### 2.3 "Pasadizos"
No hay mecánica genérica de "un fuego oculta una puerta secreta que se revela al
entrar". Los "pasadizos" del recuerdo son (a) la **trampilla del clavicémbalo**
(§1.4) y/o (b) que las **chimeneas `0xBC` son atravesables** en interiores (se
entra en el hogar y se sale por el otro lado / a un hueco).

### 2.4 Estado del port + Fase B (feature 2)
- **Pisabilidad: correcta** (se puede caminar sobre Fireplace/Lava).
- **GAP: el daño "Burning!" NO está cableado.** El caller de `townTurn`
  (game.ts 1108) nunca pasa `damageTile`, y el propio ramal `damageTile` de
  `turn.ts` (líneas 269-273) sólo modela el **tick de viento** (parity de RNG),
  nunca imprime "Burning!" ni aplica `partyRandomDamage`. `partyRandomDamage`
  (rand(1,8)/miembro) YA existe (`survival.ts:166`, kernel 0x2AA8) — falta
  invocarlo.
- **Fase B recomendada**: en el post-move de small map, si el tile bajo la party
  es `0xBC`/`0x8F` → `damageTile=true` + mensaje "Burning!" + `partyRandomDamage`.
  (Y tile `0x8C` → trampilla/caída, ligado a feature 1.) Toca el bucle de turno
  vivo → coordinación con carriles de loops/town.

### 2.5 G3 landed + REGRESIÓN de paridad corregida (task #67)

**G3 cableado** (commit `5a3f3f7`): el ramal `damageTile` de `turn.ts` ya emite
la secuencia completa (tick de viento → "Burning!" → `partyRandomDamage`).

**REGRESIÓN detectada**: `re/parity/loops` (`test_loops_parity`) quedó ROJO en
`town-postturn` porque el MODELO Python (`loops_parity.py town_turn`) NO se
actualizó con G3: su rama `damageTile` sólo rodaba el **tick de viento**
(`damageTick`) y saltaba el `party_random_damage`. En el índice 6 el modelo
predecía `swampTown` mientras el clon (correcto) emitía `burn` → la traza del
clon tenía 33 items de más (los `rand(1,8)` de fuego acumulados en 20 turnos).

**Re-derivación del ORDEN exacto de `post_turn` (TOWN 0x0F02)** contra
`re/disasm/TOWN.OVL.asm` (regenerado con `disasm.py TOWN.OVL`). El tile bajo la
party se lee UNA vez a `[bp-8]` (`0f5c: mov al,[bx]`) y las ramas de daño son
**mutuamente excluyentes** sobre ese único valor:

```
0f18-0f43  DESPERTAR: bucle roster; por cada 'S' rand(0,15)==0xF → 'G'   (0f2a call rand)
0f63       cmp [bp-8],0x8c  → tile 0x8C = trampilla (rama A, salta a 10c7)
0f68       jmp 1050         (si no es trampilla)
1050       cmp [bp-8],4     ; 1056 cmp [g_transport_tile],0x1c (a pie)
1054/105b  jne 10ac         → tile 4 = PANTANO de pueblo (rama B)
108d       call rand(0,0x1d)=rand(0,29); 1096 cmp DEX,roll; DEX<roll → 'P'
           (la rama B termina con jae 10c7 = FIN; NUNCA cae al fuego)
10ac       cmp [bp-8],0xbc  ; 10b3 cmp [bp-8],0x8f  → FUEGO (rama C)
10ba       call 0x5910      ; tick de viento (damageTick)
10bd       print DS:0x2780  ; "Burning!"
10c4       call party_random_damage (kernel 0x2AA8): rand(1,8) por miembro NO 'D'
10c7       housekeeping (kernel 0x2AE8): 0 rands de RNG (food>0, hora estable);
           'P' pierde 1 HP (0x2B14) — puede MATAR
```

Es decir el orden textual/control-flow del asm es **pantano (0x1050) ANTES que
fuego (0x10ac)**, y son excluyentes (un tile 4 nunca es 0xBC/0x8F). El escenario
`town-postturn` dispara AMBAS guardas en un mismo turno como **estrés sintético
del orden de RNG** (el arnés modela `post_turn` como sub-efectos con guarda
independiente, ctx `damageTile`/`onSwampTile`); no representa un tile alcanzable.

**Alineación de las 3 patas (task #67)** — el clon YA era correcto (asm-fiel); se
corrigió el modelo Python:
- `loops_parity.py town_turn`: la rama `damageTile` ahora emite `rand(1,8)`
  (`site:"burn"`) por miembro NO muerto tras el `damageTick`, replicando
  `party_random_damage`/`apply_damage`. Como el fuego MATA a lo largo de 20
  turnos (HP 50 del stub `loops-run.ts`), el modelo ahora **rastrea HP** y la
  merma de veneno del housekeeping (`'P'` −1 HP) para que el roster evolucione
  igual que el clon (un muerto deja de tirar en despertar/burn/pantano futuros).
- Clon (`turn.ts`) y escenario (`town-postturn.json`): sin cambios.
- Gate: `re:parity:all` VERDE 254/254 (0 skips) + `tsc` + `npm test -w game`
  (1351) + los tests G3 de `loops.test.ts` (orden viento→daño, 1 tirada/vivo,
  muerto sin tirada) siguen en verde.

---

## Resumen de veredictos

| Feature | Veredicto | Evidencia |
|---|---|---|
| Tocar el clavicémbalo | **EXISTE** | TOWN 0x0E34; dígitos→nota; tabla `DS:0x2746`; params = cue del port |
| Melodía → secreto | **EXISTE** | melodía `DS:0x275A` = `6 7 8 9 8 7 8 7 6 7 6 5 3`; LB castle (loc 0x11) floor 2 → trampilla `0x8C` "A TRAPDOOR!" |
| "Entrar en fuegos" (antorchas/brasero/hoguera) | **NO** | bitmap `DS:0x54D4`: 0xB0-B3/0xA3/0xDE bloqueados |
| Entrar en chimenea/lava (con daño) | **EXISTE** | Fireplace 0xBC / Lava 0x8F pisables; TOWN 0x0F02 → "Burning!" + rand(1,8)/miembro |
| "Pasadizos" por fuego | **NO (mecánica dedicada)** | los pasadizos son la trampilla del clavicémbalo y/o chimeneas atravesables |

### Gaps del port (para el orquestador)
- **G1** (hecho aquí): tabla de notas real del clavicémbalo (era placeholder).
- **G2**: interacción completa del clavicémbalo + trampilla (feature grande).
- **G3**: daño "Burning!" al pisar Fireplace/Lava (cue + `partyRandomDamage`).
