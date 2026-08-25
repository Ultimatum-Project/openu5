# Monstruo errante de mazmorra 3D — derivación COMPLETA (carril monster-3d, 2026-07-24)

Cierra el hallazgo D1 de `auditoria-cobertura-completa.md:73` (sistema censado como NO portado).
Fuentes: `re/disasm/DUNGEON.OVL.asm`, `re/disasm/DNGLOOK.OVL.asm`, `re/disasm/ULTIMA.EXE.asm`,
DATA.OVL (regla DS+0x10 = fileoff, verificada con las strings de emboscada §7). Complementa
`dungeon.md §9` (esqueleto previo) y `dungeon3d-audit.md` (bancos MON*.16, ítem
mon16-corridor-sprites). Todas las citas son offsets de fichero del overlay correspondiente.

## 1. Estructura y persistencia

El errante vive en la tabla de anim-states/objetos `g_char_anim_states` DS 0x5C5A (= SAVED.GAM
0x6B4, 32 slots × 8 B — la MISMA tabla que los errantes de overworld, #57 ya espejada
nativamente por el port):

- **Slot 1 (0x5C62) = errante ACTUAL**: +0 banco MON (0-7), +1 banco (copia), +2 x, +3 y,
  +4 planta, +5 TIPO de monstruo (tabla 0x173C; **0xFF = INACTIVO**), +6 attr-anim
  (tabla 0x1744), +7 estado (**0xFF = OCULTO**, sólo araña/slime).
- **Slot 2 (0x5C6A) = posición PREVIA** (+2/+3): la usa la emboscada para la dirección y el
  revert (el monstruo nunca ocupa la celda de la party).
- dng_enter_room (DUNGEON 0x0092-0x00a7 / 0x010f-0x0124) SALVA y RESTAURA ambos slots
  alrededor del combate de SALA: el errante sobrevive intacto a las salas.
- 0x5F86 (mainline) intercambia toda la tabla 0x5C5A↔0xA9FC alrededor de CUALQUIER combate.

## 2. Ciclo de vida — respawn (DUNGEON 0x0134, `dng_after_room`-init)

`0x0134(flag)`: con flag≠0 re-arma el errante:
- `rand(0,7)` (0x0151-0x0155) → banco MON; +0=+1=banco; +7=0; +6=[0x1744+banco];
  +5=[0x173C+banco]; +4=g_floor (0x0164-0x017d).
- Si había banco cargado (+5 previo ≠0xFF) libera el handle [0xA9C6] (0x0180-0x018e).
- `call 0x0252` (spawn de posición); si falla → +0/+1=0, **+5=0xFF (inactivo)** (0x019b-0x01a7).
- Si queda activo: carga perezosa del banco `push [banco*2+0x25FA]; call load` con reintento
  hasta handle≠0 (0x01ab-0x01c8). Tabla 0x25FA = nombres MON0.16..MON7.16 (DATA.OVL 0x260A).

**Sitios de respawn** (todos con flag=1 y precedidos de `fa3e(1)`→DNGLOOK 0x109E que DESACTIVA
+5=0xFF y resetea +2/+3=0xFF, +0/+1=0 @0x10eb-0x10fb):
- Entrada a mazmorra: preámbulo del bucle (DUNGEON 0x0F06-0x0F12, arg del main loop).
- Cambio de planta (dng_change_level, call 0x134 @0x1CDB).
- Caída por foso (dng_pit_fall, @0x0B73).
- Tras combate de pasillo: emboscada (@0x0C64) y attack del jugador (@0x1DE3).

## 3. Spawn de posición (DUNGEON 0x0252, `dng_spawn_wanderer`)

Hasta **8 intentos** (0x0304-0x030d): `off = rand(0,63)` (0x0271-0x0278) sobre el grid de la
planta actual (0x595A + floor·64):
- Celda permitida si hi-nibble **< 0x6 ó == 0x7** (0x028a-0x0290): Nothing/escaleras/cofre/
  fuente/OpenChest. Excluye trampa(6), campos(8), marker(9), RoomsBroke(A), muros(B-D),
  puertas(E), salas(F).
- y = off>>3, x = off%8 (0x0292-0x02ad). Rechaza si **x==party_x O y==party_y** (0x02b1-0x02c3)
  — el errante nunca nace en la fila NI la columna de la party (no aparece de golpe a la vista).
- Acepta: +18=+10=x, +19=+11=y (0x02c5-0x02d3). Si tipo (+5) ∈ {0x16 araña, 0x18 slime}:
  `rand(0,99) > 0x30` → **+7=0xFF OCULTO** (0x02d6-0x02f3) — 51% de arañas/slimes invisibles
  hasta el combate.
- 8 fallos → posiciones 0xFF y return 0 (0x0310-0x0324).

Consumo de rand por intento: 1×rand(0,63); al aceptar araña/slime: +1×rand(0,99).

## 4. Turno del monstruo (cadencia + movimiento)

**Cadencia** (dng_main_loop 0x0E2E): tras CADA acción que consume turno (`si≠0` @0x0F7B),
`call 0x0C76 on_enter_cell(di, celda)` (0x0F84). `di` = "mundo avanza": **1 normal**
(0x0FEA), **0 bajo An Tym** ('T' 0x54, 0x0FD6→0x0F1E→0x0F34), **alterna 1/0 bajo Quickness**
('Q' 0x51, `di^=1` 0x0F25), 0 en la primera iteración ([bp-4] init 0). on_enter_cell:
1. Despertar dormidos: por cada miembro con status 'S': `rand(0,63) < 4` → 'G' (0x0CA3-0x0CB7;
   la tirada la consumen SÓLO los 'S').
2. Si di≠0: `call 0x07E2` mover; si devuelve 1 → `call 0x0B7E` emboscada (0x0CD9-0x0CEB).

**Movimiento** (0x07E2, `dng_move_wanderer`):
- Inactivo (+5==0xFF) → return 0 (0x0803). **Tipo 0x1B (Reaper) NO se mueve** (0x0810,
  coincide con DoNotMove del port) pero SÍ chequea emboscada final.
- Hasta 8 intentos (0x08e4-0x08ed): `rand(0,3)` → dir (0x083e-0x0848); tablas dx 0x24D6 =
  (0,1,0,-1), dy 0x24DE = (-1,0,1,0) ⇒ **dir 0=N,1=E,2=S,3=W**. Destino con WRAP-clamp
  (>7→0, <0→7; 0x0858-0x087f).
- Celda destino RECHAZADA si hi == 0x60 (trampa) ó == 0x80 (campo) ó ≥ 0xA0 (0x08a0-0x08b0)
  — puede pisar pasillo/escaleras/cofres/fuente/OpenChest/marker(0x90).
- Si destino == party: **gate `rand(0,7)==1`** para atacar; si no, cuenta como intento fallido
  (0x08be-0x08d4).
- Commit: prev←cur, cur←destino (0x08f7-0x0914). Si cur==party: **revert cur←prev y return 1**
  (¡ataca!; 0x0917-0x093e). 8 fallos → no se mueve.

**Bloqueo del paso del jugador** (dng_move 0x067c-0x0691): si el DESTINO del paso de la party
== posición del errante → imprime **"Blocked!\n"** (DS 0x2D23) y no anda.

**Beep de paso** (0x0694-0x069e + 0x1020): cada paso fija contador [0xA9FB]=0xF y llama 0x1020,
que suena en llamadas ALTERNAS (toggle [0x24E7]^=1): NB(0x4E20, contador, 1) + decay kernel
0x3F36(4,&contador). (Cue de audio Clase-B; catálogo sfx.)

## 5. Emboscada (DUNGEON 0x0B7E, `dng_ambush`)

1. Dirección del atacante por la posición PREVIA (slot 2) con wrap &7 (0x0b90-0x0bd0):
   (px-1)&7==party_x → dir 1 (Este); (px+1)&7 → dir 3 (Oeste); (py-1)&7==party_y → dir 2 (Sur);
   else dir 0 (Norte). g_dng_anim_dir=dir.
2. Texto: **"Attacked"** (0x2D92); si dir ≠ facing: **" from the "** (0x2D9B) + dirección
   minúscula ("north/east/south/west" 0x2DA6/2DAC/2DB1/2DB7) y **GIRA a la party**
   (facing:=dir, 0x0c1c); siempre cierra **"!\n"** (0x2DBC).
3. Redraw + g_unk_58a0=0, g_unk_58a1=2 (0x0c39-0x0c3e) + combate `0x5F86(0, tipo, 2)` (0x0c46-0x0c53).
4. Post-combate: `fa9e` → DNGLOOK 0x0FDA (§8) + `fa3e(1)` + `0x134(1)` respawn + redraw.

## 6. (A)ttack del jugador (DUNGEON 0x1D4A) — sustituye al stub del port

- "Attack\n" (DS 0x6CAA). Objetivo = party + (dx,dy)[facing] **&7** (0x1d5d-0x1d85, mismas
  tablas 0x24D6/24DE).
- ≠ posición del errante → "What?\n" (DS 0x6CB2), return 0 SIN turno (0x1e00).
- == errante: 58a1=2 y combate `0x5F86(0, tipo, 2)` (0x1d9a-0x1db5). Post-combate SÓLO códigos
  5/6 inline (0x1db8-0x1dfe): 5 → floor-- (floor==0 → dng_exit 0x1D08, sale a Britannia);
  6 → floor++ (floor==7 → dng_exit, sale al Underworld). (Los códigos 1-4 NO se procesan en
  attack: huir por un borde deja a la party donde estaba.) Luego `fa3e(1)` + `0x134(1)`.

## 7. Combate de PASILLO — montaje (0x5F86 modo 2 + DNGLOOK 0x0D3E/0x117E)

Cadena: `0x5F86(0, tipo, 2)` → thunk 0x7C3E = **DNGLOOK 0x117E setup(2,0)** → COMBAT.OVL
0x0B94 run (thunk 0x7C32). La familia de modos de 0x117E: 0=escena camp, 1=combate por
terreno, **2=pasillo de mazmorra**, 3=sala (.CBT ya copiado a 0xAD14 por dng_enter_room).
El builder de la arena procedural es **DNGLOOK 0x0D3E** (via fa56→0x7C26), ANTES del setup:

**Arena procedural** (buffer 0xAD14, layout .CBT 11 filas × stride 0x20):
- 11×11 de SUELO = tile `bb15` (0x05 Grass, ó 0x45 MetalFloor en Deceit/Wrong/Covetous —
  tabla de variantes en dungeon3d-audit.md) (0x0d4b-0x0d65).
- MUROS = tile `bb14` (0x4D LargeRockWall, ó 0x4F StoneBrickWall en D/W/C): filas 1 y 9
  completas + columnas 1 y 9 completas (0x0c74-0x0cba) ⇒ caja interior 7×7 con ANILLO
  exterior de suelo (bordes de huida). Esquinas del anillo = 0xFF BlackSquare (0x0cbc-0x0cc7).
- **FEATURE de la celda** de la party al CENTRO (5,5)=+0xA5 (0x0cca-0x0d0d): tabla 0x244A por
  hi-nibble: [1]=0xC8 LadderUp, [2]=0xC9 LadderDown, [3]=0xC8 (+flag bb16 vía extra 0x0d16),
  [4]=0xDC cofre, [5]=0xD8 fuente — pelear sobre una escalera PONE la escalera en la arena
  (por eso existen los códigos 5/6 de klimb-escape en pasillo).
- **HUECOS en los muros**: por cada lado 0-3 (0x0d29-0x0d33 → 0x0B9E): mira la celda VECINA
  del grid de mazmorra en esa dirección (&7 wrap); si hi < 0xA0 (pasable) → abre el hueco
  (call 0x0AEE); vecino muro-familia 0xB0/0xC0/0xD0 → variante de muro. La arena ESPEJA la
  topología local: sólo se puede huir hacia donde el pasillo continúa.
- **playerStarts** (4 grupos, x en +0x0B..+0x10 e y en +0x11..+0x16 de las filas 1-4):
  g1 ESTE x=[6,7,7,8,8,8] y=[5,4,6,3,5,7]; g2 OESTE x=[4,3,3,2,2,2] mismo y;
  g3 SUR x=[5,4,6,3,5,7] y=[6,7,7,8,8,8]; g4 NORTE mismo x, y=[4,3,3,2,2,2]
  (0x0d8e-0x0e50; tablas DATA 0x245E/0x2464/0x246A/0x2470).
- **Posiciones de monstruo** (16 slots, x en +0xC0.., y en +0xE0..): tablas espejadas POR
  FACING (0x0e53-0x0ee1; DATA 0x2476/0x2486/0x2496/0x24A6) — los monstruos aparecen DELANTE:
  facing N → lado norte (y 0-4), E → x 8-10, S → y 6-10, W → x 0-4.
- **Barajado + conteo** (0x0efd-0x0fd3): baraja los 16 slots con 16 swaps `rand(0,15)`; limpia
  la lista de tiles (+0xAB..); tipo = slot1+5 (el errante); **count = rand(1, max)** con
  max = byte 0 del registro `DS 0x13C2 + tipo·8`, salvo max==8 ó ==0x10 → count EXACTO.
  Maxes: rata 10, murci 16(fijo), araña 4, fantasma 6, slime 16(fijo), gremlin 13, reaper 3,
  gazer 4. Tile de combate = **0x40 + tipo·4** escrito en los `count` primeros slots barajados.

**Setup** (0x117E, modo 2): grupo de party = **OPUESTO del facing** — facing 0→g3, 1→g2,
2→g4, 3→g1 (0x119e-0x11c1) = la MISMA regla P0a de salas (roomEntry.ts, ahora confirmada
ESTÁTICAMENTE). Coloca 6 miembros de los starts y crea los enemigos vía mainline 0x6506
(floor, x, y, 0, tipo) leyendo tiles/x/y de +0xAB/+0xCB/+0xEB (0x1291-0x1391). (Los markers
0xEC-0xEF de mapas de terreno = tipo aleatorio pre-rolleado 4×rand(0,7)→tabla 0x385E; los
códigos si==1/2 escalan nivel con la planta: floor·3+7 / rand(1,floor·10+10) — sólo terreno.)

## 8. Post-combate de pasillo (DNGLOOK 0x0FDA, vía fa9e) — códigos g_unk_58a0

1 → party_x-- facing/anim W; 2 → x++ E; 3 → y-- N; 4 → y++ S (huida por borde: la party DA UN
PASO a la celda vecina, con clamp-wrap 0..7); 5 → floor-- (floor==0 → salida a Britannia,
location=0, 0x1089); 6 → floor++ (floor==7 → salida Underworld); anim_dir 4/5 en 5/6.
(La sala ya portada usa el mismo 58a0 para 5/6 = escapeFloorDelta del port.)

## 9. Render (compositor 3D) y animación

- Bancos MON0-7.16: formato derivado y parser LISTO (`extractor/src/parsers/monview.ts`,
  dungeon3d-audit.md): 2 frames × 3 profundidades (24×66 / 16×25 / 8×6), 4bpp + AND-mask.
  Atlas `dungeon-mon.png/json` (pendiente de generar en game/assets).
- Tick de animación DUNGEON 0x111E: +6 (attr 0x1744: bits &0x80/&0x60/&0xF de cadencia);
  congelado bajo An Tym; **+7==0xFF → oculto** (no se dibuja). Banco = slot1+0.
- El sprite se dibuja cuando la celda del errante cae en la cadena frontal visible del
  corredor, a la profundidad correspondiente (pipeline X-fija/depth del compositor M2 del
  port, mismo esquema que features ITEMS.16; el original lo compone en el render de pasillo
  con el banco cargado en [0xA9C6]).

## 10. Tipos (tabla 0x173C, banco→tipo) y nombres

banco 0→0x14 Rata gigante · 1→0x15 Murciélago · 2→0x16 Araña · 3→0x17 Fantasma · 4→0x18
Slime · 5→0x19 Gremlin · 6→0x1C Gazer · 7→0x1B Reaper. attr-anim 0x1744 =
[0x60,0xA0,0,0x90,0x80,0x60,0,0]. Los tipos son índices de EnemyDef del port (tile de combate
0x40+t·4 ✓ N_FIRST_SPRITE+idx·4).

## 11. Strings nuevas (approved-strings, todas verificadas en DATA.OVL fileoff DS+0x10)

"Attacked" (0x2D92) · " from the " (0x2D9B) · "north"/"east"/"south"/"west" (0x2DA6/2DAC/
2DB1/2DB7) · "!\n" (0x2DBC) · "Blocked!\n" (0x2D23). ("Attack\n"/"What?\n" ya en el port.)
