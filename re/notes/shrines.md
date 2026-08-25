# Santuarios, mantras, pozo de deseos y moongates (Task 3.8)

Reglas re-derivadas del asm del binario DOS (citas `addr: instr → regla`) y
portadas al clon (`game/src/core/world/shrines.ts`, `world/wishingwell.ts`,
`world/moongates.ts`; edge de teleport en `core/game.ts`). Las 4 mecánicas son
**deterministas: 0 `call rand_range`** en los handlers. Fuentes: `re/disasm/`
(ULTIMA.EXE kernel, CAST2.OVL, CMDS.OVL, LOOKOBJ.OVL) + bytes de DATA.OVL.

Convención de offsets: kernel = offset sobre la imagen post-cabecera de
ULTIMA.EXE; overlays = offset local (CBASE); DS-relativo → globals `[0x5xxx]`.

## 0. Globals (re/ledger/globals.json)

| DS | nombre | qué es |
|----|--------|--------|
| 0x5830 | `g_moonstone_x[8]` | X de destino de cada moongate |
| 0x5838 | `g_moonstone_y[8]` | Y de destino |
| 0x5840 | `g_moonstone_loc[8]` | **LOCATION de destino** (0=overworld; 0xFF=en inventario/sin puerta) — RENOMBRADO desde `g_moonstone_buried` |
| 0x5848 | `g_moonstone_floor[8]` | **FLOOR de destino** (0=Britannia, 0xFF=Underworld) — RENOMBRADO desde `g_moonstone_z` |
| 0x5885 | `g_felucca_phase` | fase de Felucca hoy (byte crudo 0x30-0x37) |
| 0x5886 | `g_trammel_phase` | fase de Trammel hoy (byte crudo 0x30-0x37) |
| 0x5887 | `g_moongate_anim` | contador de animación 0..16 (cosmético) |
| 0x5888 | `g_karma` | karma del Avatar (byte, clamp 0..0x63) |
| 0x58CC | `g_shrine_quest_bitmap` | bit v = quest del santuario v activa |
| 0x58CE | `g_shrine_visited_bitmap` | bit v = santuario v ya visitado |
| 0x58D8 | `g_shrine_destroyed[8]` | bit alto (0x80) = destruido por un Shadowlord |

**HALLAZGO clave**: el ledger/Redux llamaban a 0x5840/0x5848 "buried flag"/"z".
El asm los usa como el par (location, floor) de DESTINO — ver §1.1. Renombrados.

## 1. MOONGATES — kernel ULTIMA.EXE 0x4702-0x4a84 (ALTA, asm directo)

### 1.1 Teleport — `kernel_moongate_teleport` (0x47f4), VERIFICADO en asm

```
47fa: mov bx,[bp+4]                    ; bx = phase
47fd: cmp byte [bx+0x5840], 0xff       ; g_moonstone_loc[phase]==0xFF?
4802: jne 0x480a                       ;   sí → AX=0, return (sin puerta)
483d: mov al,[bx+0x5840]; 4841: mov [g_location],al   ; loc destino → g_location
4844: mov al,[bx+0x5830]; 4848: mov [g_party_x],al    ; x   destino → g_party_x
484b: mov al,[bx+0x5838]; 484f: mov [g_party_y],al    ; y   destino → g_party_y
4852: mov al,[bx+0x5848]; 4856: mov [g_floor],al      ; floor destino → g_floor
```

Los 4 arrays son el DESTINO directo, no un flag booleano + z. Para una moonstone
enterrada en el overworld loc=0 y floor=z, así que el clon (que modela la stone
como {x,y,buried,z}) es numéricamente equivalente: `buried ⇔ loc!=0xFF`, `z ⇔ floor`.

### 1.2 Visible — `kernel_moongate_visible` (0x4702)

```
4713: cmp [bx+0x5840], g_location   ; ¿moonstone en mi location?
471c: cmp [bx+0x5848], g_floor      ; ¿y en mi floor?
4722: si overworld: dx=x-chunk_origin_x, dy=y-chunk_origin_y
4741:   exige 0 <= dx,dy < 0x20      ; ventana 32×32 de pantalla
→ AX=1 si la puerta está en el mapa actual y visible
```

### 1.3 Render — `kernel_moongate_render` (0x475a)

```
4762: tile = 0xDC
4767: si g_hour>=0x14 (20:00) O g_hour<5 → NOCHE: g_moongate_anim++ (cap 0x10)
4786: si 5<=g_hour<20 → DÍA: g_moongate_anim--; si llega a 0 → tile=5 (hierba)
47a2: por cada moonstone visible → pinta `tile` en (x,y) si difiere
```

De noche se pinta la puerta en TODAS las moonstones enterradas visibles.
`g_moongate_anim` (0x5887) es un contador de aparición/desaparición 0..16, no una
fase. Cosmético (no toca advance_clock).

### 1.4 Enter (trigger al pisar) — `kernel_moongate_enter` (~0x48a8, fase en 0x4902)

```
490d: g_moongate_anim = 0xF           ; 15 frames de animación de cierre
492d: kernel_tile_ptr(party_x,party_y); [ptr]=5   ; borra la puerta (hierba)
494d: si g_hour==0 && g_minute<0x0A:   ; 00:00-00:09 → NO teleporta (return 1)
      si g_hour < 0x0C: fase=g_felucca_phase (madrugada)
      si g_hour >=0x0C: fase=g_trammel_phase (noche)
      fase -= 0x30
4977: kernel_moongate_teleport(fase)
```

- **EDGE de medianoche** (00:00-00:09): la puerta se cierra pero NO teleporta — la
  ventana en que las fases del día acaban de cambiar. Portado: `isMidnightGateEdge`
  en moongates.ts + guarda en `Game.checkMoongate`.
- La fase activa = Felucca si hour<12, Trammel si hour>=12. Como la puerta solo
  existe de noche, hour<12 ⇔ madrugada (0-4) y hour>=12 ⇔ noche (20-23), así que
  coincide con "hour<=4 Felucca / hour>=20 Trammel".
- **Piedra de la fase activa EN LA MOCHILA** (#149): el teleport `0x47f4` guarda con
  `0x47fd cmp [bx+0x5840],0xff` → `0x4804 sub ax,ax` = devuelve 0 **sin tocar estado**,
  y TODA la presentación de arriba (sonido 0x48e5, disolución 0x1068, cierre
  0x4912-0x492b, `[ptr]=5` en 0x493c) ya corrió ANTES de la llamada de 0x4977 ⇒ la
  puerta se cierra sobre el party y no lo lleva a ninguna parte — mismo desenlace
  observable que el edge de medianoche. Alcanzable porque el DIBUJO (§1.3) no consulta
  fase: las otras 7 puertas siguen pintándose con la piedra activa desenterrada.
  Portado: brazo `!dest` de `Game.checkMoongate` (hook(false) + sfx, party quieto).

### 1.5 Fases del día — MOON_PHASES (kernel_time_refresh 0x4a84; DATA.OVL 0x1EEA)

```
4adf: bl=g_day; 4ae5: shl bx,1                       ; bx = day*2 (day 1-based)
4ae7: al=[bx+0x1ed8]; mov [g_felucca_phase],al       ; byte crudo +0x30
4b21: al=[bx+0x1ed9]; mov [g_trammel_phase],al
```

`bx = g_day*2` sobre base DS 0x1ed8 = fileoff 0x1eea + (day-1)*2 → **coincide con
`moonPhasesForDay((day-1)*2, 0x1EEA)` del clon (no hay off-by-2)**. Mes de 28 días.
Los 56 bytes de fileoff 0x1eea son todos 0x30-0x37. `kernel_time_refresh` es de
survival (co-propietario); aquí solo documentamos el feed de fases.
`felucca(day)=DATA[0x1eea+(day-1)*2]-0x30`, `trammel(day)=…+1-0x30`.

## 2. SANTUARIO VIVO — CAST2.OVL 0x0966 `shrine_visit` (ALTA)

Empareja la posición del party con las 8 coords de santuario; `[bp-8]` = virtud
(0..7). Fallback si el bucle no empareja: `[bp-8]=6` (Spirituality, coord 0,0).

**CUERPO ENTERO LEÍDO 2026-08-07** — `[0x0966, 0x0D24)` = 958 B declarados = 958 B reales
(957 de código + 1 `nop`; un solo `ret` PELADO en 0x0D22 ⇒ **cero argumentos**).

### 2.0 🔴 LA PUERTA DE 260 B QUE ESTA NOTA SE SALTABA

El pseudocódigo de §2.2 arrancaba en `0x0a6c` y **`0x0966-0x0a69` no aparecía en ninguna
parte** — y el §3 llegaba a afirmar que en el santuario vivo el mantra «sólo se muestra».
Es falso: **`shrine_visit` teclea y compara CUATRO veces antes de tocar ningún estado.**

```
0x09a1: sprite slot 0 ← tile 0x6c; viewport_redraw (kernel 0x5910)
0x09ac: print 0xb58b "...and thou dost kneel before the Altar.\n\n"
0x09ba: print 0xb5b6 "Upon what virtue dost thou meditate?\n\n:"
0x09c1: input_string(max=0x0C, buf=DS 0xbd08)   ; cadena VACÍA ⇒ SALIR (0x09cc)
0x09e3: stristr(buf, virtuePrefix[v]) == -1 ⇒ flag=0        ; tabla DS 0x4b3e
0x0a09: ×3 { print 0x958e "\nMantra:"; input_string(0x0C, 0xbd08)
            vacía ⇒ SALIR; stristr(buf, mantra[v]) == -1 ⇒ flag=0 }  ; tabla DS 0x1f5e
0x0a5e: flag==0 ⇒ print 0xb5de "\n\nThine thoughts are unfocused.\n" y SALIR
0x0a6c: (sólo con las CUATRO buenas) → máquina de estados de §2.2
```

**La tabla DS 0x4b3e NO son los nombres de virtud: son PREFIJOS DE CUATRO LETRAS**
(`hone comp valo just sacr hono spir humi`).

**Y la comparación es de SUBCADENA, con la aguja en la tabla.** Leído el cuerpo de
`stristr` (kernel 0x6f1e): `[bp+6]` = AGUJA (es su `strlen` el que va a 0x6aa4 y el que se
rechaza por más largo), `[bp+4]` = PAJAR. Aquí se empuja primero la entrada de tabla y
después el búfer ⇒ **aguja = mantra/prefijo, pajar = LO QUE TECLEAS**. Con plegado a
mayúsculas (`and 0x5f`) y **SIN comprobación de frontera de palabra** — que es justo lo que
`talk_find_keyword_section` SÍ añade tras el mismo `stristr`. ⇒ en el Santuario de la
Honestidad, `AHMED` y `BLAHM` valen de mantra, y `dishonest` vale de virtud. El port ya lo
modela (`shrineWordMatches`, `game/src/core/world/shrines.ts`).

🔴 **RNG: profundidad 1 = 0, pero COMPLETAR QUEST MUEVE EL STREAM.** Ninguno de los 13
destinos de kernel es un thunk de azar, pero `0x0c88` llama a `screen_shake_fx` (0x3072),
que tiene CUATRO `call rand_range` dentro de bucles. La cifra no se acota aquí (ese cuerpo
es de otra fila). Y los callers de 0x3072 en CAST2 son **CUATRO**: 0x0c88 + los tres del
Codex (0x0dc0/0x0dd7/0x0dee).

### 2.1 Datos (DATA.OVL, fileoffs directos = catálogo dataovl_catalog.py)

| tabla | fileoff | contenido (índice=virtud 0..7) |
|-------|---------|--------------------------------|
| virtudes | 0x0B98 | Honesty,Compassion,Valour,Justice,Sacrifice,Honor,Spirituality,Humility |
| mantras | 0x0BE0 | Ahm,Mu,Ra,Beh,Cah,Summ,Om,Lum |
| shrineX | 0x1F7E | 233,128,36,73,205,81,0,231 |
| shrineY | 0x1F86 | 66,92,229,11,45,207,0,216 |
| STR flag | 0x4B8E | 0,0,1,0,1,1,1,0 (DS 0x4B7E) |
| DEX flag | 0x4B96 | 0,1,0,1,1,0,1,0 (DS 0x4B86) |
| INT flag | 0x4B9E | 1,0,0,1,0,1,1,0 (DS 0x4B8E) |

### 2.2 Máquina de estados (máscara = 1<<v; bitmaps 0x58CE Codex / 0x58CC quest)

⚠️ **CORREGIDO**: la ramificación de 0x0a74 es sobre el bit del **CODEX**
(g_shrine_visited_bitmap 0x58CE), NO "primera visita". El ÚNICO escritor de 0x58CE
en TODO el binario es el Shrine of the Codex (CAST2 0x0d7d), no shrine_visit.

```
0a6c: ax = 1<<[bp-8]   ; máscara de la virtud
0a74: cl = g_shrine_visited_bitmap; 0a7a test cx,ax
0a7c: je 0xa81  → bit del Codex NO puesto: MOSTRAR MANTRA
0a88:   g_shrine_quest_bitmap |= mask   (SOLO quest; NO toca 0x58CE)
        imprime virtud + "Mantra:" + mantra + descripción de la quest
0a7e: else (Codex aprendido) → 0xb08:
0b10:   cl = g_shrine_quest_bitmap; 0b16 test cx,ax
0b18:   je 0xb1d  → sin quest: DONACIÓN (0x0b1d)
        else      → COMPLETAR QUEST (0x0c18)
```

Flujo real de juego: santuario (fija quest) → **peregrinaje al Codex** (fija el bit
visitado) → volver al santuario (completa la quest, recompensa) → visitas posteriores
= donación. El santuario NUNCA marca visitado por sí solo.

**PEREGRINAJE — Shrine of the Codex (CAST2 0x0d24, despachado desde 0x0e76 cuando
tile==0x11; else→0x966):**
```
0d47: si = g_shrine_quest_bitmap
0d4e-0d72: busca la virtud de índice MÁS BAJO con quest activa (dx=0..7); si ninguna
           (dx==8) → 0x0d64 imprime y sale sin efecto
0d7d: g_shrine_visited_bitmap |= (1<<dx)   ; ← ÚNICO write de 0x58CE
0d88: imprime la lección (answerPtrs 0x4b6e[dx]*2 + base 0xb21e)
0da2: si g_shrine_visited_bitmap == 0xFF → ceremonia final de las 8 virtudes (0x0dac-0x0e5b)
```

**DONACIÓN (0x0b1d)** — confirma FIDELITY "+1 karma / 100 oro":
```
0b26: push si; call putchar — ECO del dígito tecleado, ANTES de la bifurcación
0b2a: si = n = dígito-0x30
0b2d: si n==0 → sale (jmp 0xd1d) sin donar; la pantalla ya lleva el dígito + " gp" (0x959c)
0b47: ax = 100*n; cmp ax,g_gold; jg → "not enough" (0x0b52) y re-pregunta en bucle
0b87: g_gold -= 100*n
0b91: g_karma += n; 0b95: clamp g_karma a 0x63 (99)
```

**COMPLETAR QUEST (0x0c18)**:
```
0c18: g_shrine_quest_bitmap &= ~mask
0c8b: g_karma += 3 (clamp 99)
0c9c: si STR_flag[v]: Avatar.STR += 1 (cap 0x1E=30) → "Strength +1"
0cbd: si DEX_flag[v]: Avatar.DEX += 1 (cap 30)      → "Dexterity +1"
0cde: si INT_flag[v]: Avatar.INT += 1 (cap 30)      → "Intelligence +1"
0cff: si v==7 (Humility): g_karma += 3 extra
```
(Avatar = party_records[0], STR/DEX/INT en +0x0C/0x0D/0x0E del roster.)

## 3. RESTAURAR SANTUARIO + MANTRAS — CMDS.OVL 0x1202 `shrine_restore` (ALTA)

Meditar en un santuario DESTRUIDO (bit alto de g_shrine_destroyed[v]; BLCKTHRN
0x0570 lo pone a 0xFF). Firma `(virtue_idx [bp+8], x [bp+6], y [bp+4])`, `ret 6`.

```
120f: print "Upon what virtue dost thou meditate?"
1216: lee texto (max 0xF)
1226: strcmp(input, virtueNamePtrs[idx]) → si != → flag=0
1249: si=3  ; pide el mantra 3 veces
124f: (×3) print "Mantra:"; lee; strcmp(input, mantraPtrs[idx]); si != → flag=0
1278: si flag==0 → fallo
127c: exige shrineX[idx]==x && shrineY[idx]==y
1293: g_shrine_destroyed[idx] &= 0x7F      ; RESTAURA (limpia bit alto)
12a2: kernel_tile_ptr(x,y); [ptr]=0x19     ; repinta el tile de santuario
```

Único punto donde el mantra se TECLEA y se compara (en el santuario vivo solo se
muestra). Requiere virtud + mantra×3 + coord exacta, TODO simultáneo.

## 4. POZO DE DESEOS — LOOKOBJ.OVL 0x0042 `wishing_well` (ALTA)

Firma `(?, x [bp+6], y [bp+4], dir [bp+8])`, `ret 6`. Easter egg.

```
0048: print "a well.\n\nDrop a coin?"
0052: getkey; 'N'→"No", fin. 'Y'→sigue
0075: si g_gold==0 → fin (sin moneda)
0086: g_gold--                       ; la moneda cuesta 1 oro
008a: lee el deseo (max 0xC)
0095: si vacío → "Nothing", fin
00a2: substring-match (call 0xcc8e) del deseo vs {Corvette,Ferrari,Lamborghini,
      Lotus,Porsche,Horse}
00fd: si NINGUNO casa → "No effect..."
0102: si casa PERO g_location != 0x16 (Paws) y != 0x1F (Empath Abbey) → "No effect..."
0116: si casa Y en Paws/Empath → "Poof!" (0x7284)
0132: mov ax,0x10; ...; 014e: call kernel_spawn_object (0x97e4) → CABALLO delante del party
```

Cadenas byte-exactas leídas de DATA.OVL (DS ptr → fileoff = DS+0x10), verificadas
con binfiles/lectura cruda:

| palabra | DS ptr | fileoff |
|---------|--------|---------|
| Corvette | 0x7242 | 0x7252 |
| Ferrari | 0x724c | 0x725c |
| Lamborghini | 0x7254 | 0x7264 |
| Lotus | 0x7260 | 0x7270 |
| Porsche | 0x7266 | 0x7276 |
| Horse | 0x726e | 0x727e |

El **tile del objeto spawneado es 0x10 (caballo)**: LOOKOBJ 0x0132 `mov ax,0x10`
se empuja a kernel_spawn_object (0x014e call 0x97e4). Coincide con
`world/transport.ts TILE_HORSE = 0x10`. (Contexto: 0x720c "Drop a coin?", 0x722c
"Thy wish?", 0x7238 "Nothing", 0x7274/0x728c "No effect...", 0x7284 "Poof!".)

**Coord del spawn — cuerpo presente, algoritmo por derivar (F1.4 T3).** El bloque
0x0132-0x014e SÍ está desensamblado (corrige una lectura previa que lo daba por
ausente): tras `mov ax,0x10` empuja coords derivadas de `[bp+8]+1` / `[bp+6]` /
`[bp+4]` y llama a `kernel_spawn_object` (0x97e4). Falta derivar el ALGORITMO de
coord de 0x97e4 (qué son esos params y cómo se mapean a la casilla; el `inc ax`
sobre `[bp+8]` = +1 en un eje). El clon aproxima con "1ª adyacente transitable
N,E,S,O" (paridad de VALOR: caballo MONTABLE en Paws/Empath). **Remitido a T4 /
follow-up**, se cierra en la unificación `worldObjects` de F1.5. Ficha Clase C en
`re/deliberate-divergences.md §3`.

- Deseos válidos (substring case-sensitive): Corvette, Ferrari, Lamborghini,
  Lotus, Porsche, Horse → todos spawnean caballo (tile 0x10).
- Solo en **location 0x16 (Paws)** y **0x1F (Empath Abbey)**. Coste 1 oro (la moneda
  se gasta incluso si el deseo no tiene efecto). Sin RNG.
- `gurgling_fountain` (0x0162) es OTRA cosa: "a gurgling fountain!" + "Who will
  drink?" + select_player → según el estado del PJ elegido imprime "Incapacitated!"
  (dead 'D'/asleep 'S') o "Refreshing...".
  **⚠ CORRECCIÓN (verificado en re/disasm/LOOKOBJ.OVL.asm 0x0162-0x01a3):** el
  handler **SÓLO IMPRIME — NO cura**. Lee el byte de estado `[idx*32+0x55b3]`
  únicamente para ELEGIR el string (0x018f `mov al,[bx+0x55b3]`; 0x0192 `cmp 'D'`;
  0x0196 `cmp 'S'`) y no escribe HP en ninguna rama. "Refreshing..." es puro flavor.
  La afirmación previa "cura al miembro elegido" era imprecisa. (El drink que SÍ
  tiene efecto es el de MAZMORRA, DNGLOOK 0x013b, otra rutina.)

## 5. Divergencias con el clon corregidas (Task 3.8)

1. `moongates.ts`: renombrada la semántica de 0x5840/0x5848 a location/floor de
   destino (documentada); añadido el edge de medianoche 00:00-00:09 (sin teleport).
   `moonPhasesForDay((day-1)*2, 0x1EEA)` era ya correcto (verificado).
2. Santuarios/mantras/pozo: NO existían en el clon; creados
   `world/shrines.ts` + `world/wishingwell.ts` con las reglas exactas.
3. globals.json: renombrados g_moonstone_loc/g_moonstone_floor; añadidos
   g_felucca_phase/g_trammel_phase/g_moongate_anim.

## 6. Paridad

`re/tools/test_shrines_parity.py` cruza el modelo asm-derivado en Python
(`shrines_parity.py`) contra el core del clon (`__parity__/shrines-run.ts`) sobre
`re/parity/shrines/*.json` (27 escenarios). Todo determinista (sin RNG). Runtime
DOSBox opt-in (`U5RE_LIVE=1`): `test_lunar_phase_feed_live` (siembra g_day, fuerza
un cambio de hora, exige que g_felucca_phase/g_trammel_phase = MOON_PHASES[day]) y
`test_moongate_teleport_live` (best-effort). Nivel de fidelidad en
`re/verified/shrines.md`.

## RE-DERIVACIÓN F2-T6 (espejo fase 2, 2026-07-22): la ceremonia cuelga del (E)nter, NO del paso

**Claim viejo (misderivación):** «el dispatch 0x0e76 corre la ceremonia AL PISAR, sin
getkey» — sobre él se montaron T-003 (checkShrineEntry on-step) y e2e/shrines.spec.
El scout leyó CAST2 0x0e76 EN AISLAMIENTO: al no ver getkey dentro, infirió que era un
hook de movimiento. La ausencia de getkey tiene otra causa: **la tecla ya la consumió
el despachador de comandos** — 0x0e76 es el DESTINO del comando (E)nter.

**Cadena REAL, offset a offset (verificada instrucción a instrucción):**
```
(E) → kernel dispatch 0x3254
  → MAINOUT cmd_enter 0x08de
      08ea: print DS 0x2a6f "Enter "                 (eco común de TODO Enter)
      0907-0930/09da-09ec: dispatch por TILE bajo la party
      caso tile 0x19 (santuario vivo), 0x9da→0x936:
        0936: print DS 0x2a76 "the shrine of\n"
        0947-0951: busca i por coord party vs tablas 0x1f6e/0x1f76 (shrineX/Y)
        095a: print [DS 0x1f4e + i·2]  = nombre de la VIRTUD
        0961: putchar 0x0a
        0968: call 0xfffff89a           ; = (0xf89a+0x81d0)&0xFFFF = STUB 0x7a6a
      caso tile 0x11 (Codex), 0x91c→0x986:
        0986: print DS 0x2a89 "the Shrine of the Codex!\n"
        098d: jmp 0x968                 ; MISMO call al stub
  → stub 0x7a6a: lcall PLINK 0x72e:0x2ec + ljmp 0:0xf056
      0xf056 − 0xe1e0 (load_seg CAST2) = **CAST2 0x0e76**   ← el "dispatch"
  → CAST2 0x0e76: re-lee el tile (0x0e8d call 0x6222 por party x/y), suspende el
      mundo (0x0ea4 g_location=0xFF) y despacha 0x19→shrine_visit 0x0966 /
      0x11→codex 0x0d24 — sin getkey PORQUE su caller es un comando, no un hook.
```
**Qué hace el on-step de verdad:** nada especial — 0x19/0x11 son terreno pisable; el
bucle de movimiento de MAINOUT no tiene ningún hook de santuario (los únicos triggers
on-step del overworld son moongate y el guardián del Codex 0x0c8a, que es OTRA rutina).

**Testigo:** aulddragon P09 — las 3 visitas muestran el eco «>Enter the shrine of X»
(y «>Enter the Shrine of the Codex!») ANTES de «Thou dost approach…»: el LP PULSÓ E.
El eco con bullet '>' es la firma del despacho de comando, imposible en un hook de paso.

**Port:** enter() (game.ts) emite el eco (DS 0x2a6f+0x2a76+virtud / +0x2a89) y corre
runShrineCeremony; checkShrineEntry conserva SOLO el santuario destruido (restore,
CMDS 0x1202 — pendiente de careo propio). shrines.spec re-baselineado (paso + 'e').
