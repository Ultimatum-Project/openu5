# Derivaciones del paquete de fixes careo-combate (T1-T11)

**Carril:** combate-fixes (fiel/combate-fixes) · 2026-07-22 · Implementación de los
tickets de `careo-combate-detalle.md`. Aquí viven las derivaciones ASM nuevas que
el careo no traía (el careo dio el QUÉ; esto es el CÓMO). Offsets: DS = fileoff
DATA.OVL − 0x10; kernel = ULTIMA.EXE fileoff − 0x800.

## T1 — Mapa completo de mensajes de resultado (COMSUBS 0x0312 + 0x00D2)

`0x0312(target_idx, attacker_idx)` — impresor único post-golpe. Orden de gates:

| Condición | Print | DS |
|---|---|---|
| `g_cmb_result_flags & 0x20` (grazed) | nombre(target) + " grazed!\n" | 0x99f2 |
| flags(target)==0 ∨ &0x20 (muerto) | nombre(target) + " killed!\n" — y SALE (sin línea de golpe/herida) | 0x99fc |
| `g_cmb_result_flags & 4` (slept) | nombre(target) + " slept!\n" | 0x9a06 |
| `g_cmb_result_flags & 8` (poisoned) | NADA (el print del veneno es del propio 0x18BA) | — |
| target PJ (flags&0x80) y atacante Corpser 0x2D | " dragged under!\n" | 0x9a10 |
| target PJ | nombre + **" hit!\n"** (03fc) | 0x9a22 |
| target ENEMIGO | wound classify (0x1A5C) → barely/lightly/heavily/critical | 0x9a2a-0x9a64 |

⇒ **No existe ninguna línea "X hits Y for N."** — era fabricación del clon.

`0x00D2(victim_idx)` — impresor de FALLO: `g_cmb_is_spell` → "Failed!\n" (DS 0x99a0);
si no → **nombre(VÍCTIMA)** + " missed!\n" (DS 0x99aa). Llamado SOLO desde los caminos
del PJ: melé 0x0BF8 @0c48 (push [bp+6]=víctima) y ranged 0x0A68 @0bc5 (víctima
original si el scatter no golpeó a nadie). La IA: melé fallido silencioso (COMBAT
0x0226 0349-035d) y ranged sin ocupante en la celda final TAMBIÉN silencioso
(COMBAT 0x014E 01fb `or ax,ax; jl 0x21c` — salta daño Y print).

Port: los eventos `attacked`/`died` llevan el texto fiel y `combatOut` (main.ts)
los imprime; miss del PJ nombra al objetivo; hit a PJ = "{} hit!"; hit a enemigo
sin línea (la herida es el mensaje); muerte solo "{} killed!".

## T2 — Eco de dirección del paso de combate (SJOG 0x1C56)

Claves 1-4 → imprime ANTES de resolver: "West\n"/"East\n"/"North\n"/"South\n" =
DS 0x8ece/0x8ec8/0x8eb8/0x8ec0 (copias PROPIAS del overlay, ≠ familia getdir
0xa2a6). Se imprime en TODO pulsado (éxito, Blocked!, borde). Port: hud.echo en
el branch de flechas de handleCombatKey.

## T4 — Composición del grupo de encuentro (kernel 0x6bc2)

**Corrección de censo**: `kernel-sweep-2.md §6` etiqueta 0x6bc2 como
`render_animated_tile` — MISNOMBRE. La rutina imprime "*** CONFLICT ***" (DS
0xa438 @0x6c56), coloca al party (0x6936 si !(flags&4)), y spawnea el BANDO
ENEMIGO (0x6506 = kernel_spawn_actor). Es `combat_spawn_encounter(tipo, flags)`;
caller verificado: 0x6028 con (flags=1, tipo=(sprite−0x40)>>2) al abrir combate
contra un actor. flags: 1=campo, 4=camp (baraja posiciones Fisher-Yates
rand(0,15)×16, sin banner), 0x80=sala (sin banner).

COUNT (0x6c5d-0x6ccf):
- pueblo (`g_unk_5894` ∈ [1,0x20]) y tipo != 0xc (GUARD) → 1.
- base = `[tipo<<3 + 0x13c2]` = **ENEMY_STATS[tipo] campo +6 = maxPerMap**
  (stats en DS 0x13bc, fileoff 0x13CC — 0x13c2 = base+6).
- base ∈ {1, 8, 0x10} → EXACTO (guardias=8; bats/slimes/mongbats=16).
- si no: `count = rand(1, base)` (0x2092); si `[0x5959] != 0` → `count =
  rand(1, count)` (re-tirada a la baja). Clamp >0x19 → 0x1a.
- `0x5959` = byte de SAVED.GAM offset **0x3B3** (base de la ventana = 0x55a6);
  INIT.GAM lo trae a **1** ⇒ la doble tirada está activa en juego normal. Su único
  write estático es el CERO de fin de mes (kernel 0x506f) — mismo grupo de ceros
  mensuales que survival.ts ya omite; el port lo modela SIEMPRE activo.

COMPAÑERO (0x6d11-0x6d76): spawn 0 = tipo base; spawns i=1..count-1 con
i < count/4+1 tiran `rand0(8)` (0x3aae) y con ==0 usan `[tipo + 0x16d4]`
(fileoff 0x16e4, **stride 1** — 0x6d36 lee sin shl). Tabla verbatim con parejas
canónicas: ORC→TROLL, DAEMON→DRAGON, SKELETON→WIZARD, GHOST/RAT→SKELETON,
SHADOWLORD→DAEMON, GREMLIN→MIMIC… (`ENCOUNTER_FRIEND_TYPE`, encounters.ts).

Port: `rollEncounterGroup` en encounters.ts; las tiradas van al stream VIVO antes
del fork del seed (como el binario). Verificado en vivo: 4 muestras dieron
1/5/2/7 orcos, la de 7 con un TROLL líder. Control de paridad: ch35 (rooms, sin
encuentros aleatorios) byte-idéntico al baseline ×2.

## T5 — Banner "armed with" (COMBAT 0x0701-0x07af + helper 0x05b6)

buffer = nombre + ", armed with " (DS 0x6da4) + items filtrados + ":" (DS 0x6dbe).
Items EN ORDEN casco (+0x19) / mano izq (+0x1b) / mano dcha (+0x1c); el helper
0x05b6 añade el nombre SOLO si id != 0xFF y `ATTACK_VALUES[id] != 0` (tabla DS
0x15fc, gate 0x05c5), con ", " (DS 0x6da0) entre ellos; si ninguno ataca →
"bare hands" (DS 0x6db2). Mismo criterio que el triple golpe (COMSUBS 0x0D96).

## T6 — Word-wrap: capacidad = wrapWidth+1 (kernel print_string 0x1850)

- Copia por línea (0x18ca-0x18f2): la cota es **INCLUSIVE** (`0x18dc cmp si,di;
  jg`) sobre `di = remaining = (rightCol-leftCol) − curCol` ⇒ admite
  **remaining+1** chars ⇒ una fila de 16 col alberga 16 chars EXACTOS
  ("*** CONFLICT ***", "Iolo, armed with").
- Delimitador de fila llena CONSUMIDO: tras el backtrack/trim, si `s[[bp-6]] != 0`
  se hace `inc [bp-6]` (0x19bc) — el espacio/LF que sigue se salta; y el LF
  entre líneas ([bp-2], 0x19bf-0x19c7) SOLO se arma si la fila quedó corta
  (lastIndex < remaining). El feed de la fila llena ya lo hizo el wrap EAGER de
  putchar (0x173d→0x1742). ⇒ ni fila en blanco ni espacio huérfano tras una
  fila exacta.
- Port: `TextWindow.wrapPending`/`consumeWrapPending` + comparación
  `wordLen > remaining + 1`; layoutConsole consume el LF inter-entradas tras
  fila llena; el "+1 del eco" queda subsumido (printString ancho único).

## T9 — Leave!/Escape! y el ESC de combate

- **Walk-off por el borde** (SJOG 0x1bb2): 0x1b6c cuenta el bando contrario vivo
  en `g_cmb_scratch_x`; ==0 → **"Leave!\n"** (DS 0x8ea6) — la salida
  post-victoria, UNA POR MIEMBRO (j-exit-sheet) — ; !=0 → **"Escape!\n"**
  (DS 0x8eae). Mismo sitio: "\nAll must use the same exit!\n" (DS 0x8e88) si el
  borde difiere del latcheado (gate sala 0x80), "\nStay with ship!\n" (DS
  0x8e76) sobre tile de nave.
- **endCombat NO imprime cierre**: el "Leave!" del vídeo-O f140 era el eco del
  último miembro. El print único del port duplicaba.
- **ESC** (COMBAT 0x09dc → stub kernel 0x7d8e → **CMDS.OVL 0x17ec**): "Escape"
  (DS 0x4574) SIEMPRE; sala (g_unk_58a1&0x80) → "-Not here!" (DS 0x457b) sin
  retirar; enemigos vivos → "-Not yet!" (DS 0x4587) sin efecto; victoria en campo
  → '!' (putchar 0x21 @0x1853) + retirada total. Los probes esc-flee-verdict.md
  (estado) quedan intactos; los PRINTS no los habían medido.
- ⚠ El gate de sala post-victoria queda como **divergencia declarada** (el port
  retira también en sala): ver `re/deliberate-divergences.md` addendum T9 —
  aplicar el gate fiel atasca el cierre del arnés de salas (ch35 r7 verificado).

## T3/T10/T11 — Cadencias (medidas del careo)

- Recuadro del activo: parpadeo ~9 Hz (fase 55 ms del reloj F-A; medición J/O).
- Starburst: 120 → 196 ms (yellow-jump vídeo-J 22.044→22.240).
- Tanda enemiga: beat 400 ms en la piel (main.ts stepCombatPump), teclas
  ENCOLADAS durante el beat (buffer BIOS) y drenadas al terminar; bajo
  `navigator.webdriver` beat=0 (síncrono, byte-idéntico al flujo previo — los
  drivers e2e pulsan sondeando estado); `?combeat=<ms>` fuerza el valor.
