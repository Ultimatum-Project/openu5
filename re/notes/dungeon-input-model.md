# Modelo de input de mazmorra — RELATIVO vs. compás absoluto

> Carril SCOUT (flota del team-lead), 2026-07-18. Derivación de disasm; **sin código**.
> Responde la pregunta abierta del censo de teclado (`docs/censo-teclado-refcard.md` §4,
> ítem 6 del apéndice): la refcard IBM (pág. 4) dice que `ENTER`/`PERIOD` en mazmorra
> "turn you around" y sugiere un modelo de **compás absoluto** (flechas = N/S/E/W). El
> port modela el movimiento en **relativo** (`main.ts handleDungeonKey`). ¿Cuál es el real?
>
> Doctrina `disasm-mata-resumen`: se cita SIEMPRE `re/disasm/DUNGEON.OVL.asm` + offset.
> Los resúmenes (`re/notes/dungeon.md`) solo orientan; aquí se rederiva del ASM.

---

## TL;DR (3 líneas)

1. El binario usa movimiento **RELATIVO al rumbo** (`g_dng_facing`): avanzar/retroceder/
   girar-izq/girar-der/girar-180. NO es compás absoluto. La refcard adorna: "turn you
   around" es literal (giro 180°), pero **no implica** un esquema N/S/E/W absoluto.
2. El port (`dungeon.ts` `forward/back/turnLeft/turnRight`) es **FIEL al modelo**: dir
   ↑=advance, ↓=back, ←=turnLeft, →=turnRight, idéntico byte a byte al despachador ASM.
3. Único hueco real: `ENTER`(0x0D)/`PERIOD`(0x2E) → **giro 180°** existe en el binario
   (caso *default* de `move()` @0x0502, `facing += 2`) y **falta** en el port. Su efecto
   ya es alcanzable con dos giros ⇒ **(c) QoL / alias de fidelidad barato**, NO F-algo.

---

## 1. Despachador de teclas — DUNGEON:0x06C4

`sub_06C4(key)` recibe la tecla cocida en `[bp+4]` y despacha (`re/disasm/DUNGEON.OVL.asm`):

```
06d0: mov ax,[bp+4]
06d3: cmp ax,0xb   / je 0x6f2      ; 0x0B → karma/quit
06d8: jle 0x6dd    ; ax < 0xb
06da: jmp 0x7a8    ; ax > 0xb  → tabla ENTER/PERIOD/otros (§2)
06dd: cmp ax,1 / jge 0x6e5         ; ax==0 → jmp 0x7bc  [ver CORRECCIÓN 16-08 abajo]
06e5: cmp ax,4 / jle 0x744         ; ax ∈ {1,2,3,4} → 0x744 (move)
06ea: cmp ax,5 / je 0x710          ; ax==5 → prompt Y/N (descenso)
06ef: jmp 0x7bc                    ; resto → 0x7bc  [ver CORRECCIÓN 16-08 abajo]
```

🔴 **CORRECCIÓN 16-08-2026 (carril `dungeondeck-348`, ficha #348) — tachado, no borrado.**
Las dos anotaciones de arriba decían ~~«jmp 0x7bc (kernel_cmd_dispatch)»~~ y ~~«resto →
kernel_cmd_dispatch 0x3178»~~. **La transcripción del ASM es correcta; la anotación no.**
`0x07bc` NO es el despachador: es el **gate de DÍGITOS** (`cmp [bp+4],0x30 / jb 0x7a0` —
la propia nota lo transcribe cuatro líneas más abajo, en §2). Lo que NO es dígito cae en
**`0x07a0`**, y ahí está el call de verdad:

```
07a0: ff7604            push word ptr [bp + 4]
07a3: e802a8            call 0xffffafa8     ; → kernel_cmd_dispatch 0x3178
```

Resuelto con `re/tools/dispatch_table.py` (jamás leyendo el destino crudo en el `.asm` del
residente): `load_seg` 0x081D ⇒ `overlay_near_call_base` = 0x81D0, y `(0xafa8 + 0x81D0)
mod 2^16` = **0x3178**. Control positivo: `near_calls_to_kernel("DUNGEON.OVL", 0x3178)`
devuelve exactamente `0x7a3` y ningún otro; MAINOUT (`0x0c00`) y TOWN (`0x158f`) dan los
otros dos bucles de contexto.

El VEREDICTO de esta nota (§5) **no cambia**: el modelo de movimiento sigue siendo
relativo y el port sigue siendo fiel. Lo que cambia es a dónde mira quien copie la
dirección — y de ahí cuelga el censo de comandos de mazmorra, que vive en
[`dungeon-dispatch-gates.md`](dungeon-dispatch-gates.md).

Rama `> 0xb` (0x07a8), tabla de teclas crudas:
```
07a8: cmp ax,0x0d / je 0x744       ; ENTER  → move  (dir crudo = 0x0d)
07ad: cmp ax,0x13 / je 0x776       ; ^S     → toggle g_unk_a9ce (sonido)
07b2: cmp ax,0x16 / je 0x73a       ; ^V     → 0x73a
07b7: cmp ax,0x2e / je 0x744       ; PERIOD → move  (dir crudo = 0x2e)
07bc: cmp [bp+4],0x30 / jb …       ; '0'..'9' → selección de PJ (kernel 0xbeb0 [= CS 0x4080 → ULTIMA.EXE:0x4080 set_active_player_prompt])
```

**Clave:** las flechas llegan **ya cocidas** por el getkey como `1,2,3,4` (no como
scancodes ni ASCII). ENTER/PERIOD llegan como sus códigos crudos `0x0d`/`0x2e` y caen —
igual que los `{1,2,3,4}` — en `0x0744`, que llama al resolutor `move()` con ese código.

## 2. Puente 0x0744 → move()

```
0744: … calcula tile en (g_floor,g_party_y,g_party_x) → [bp-4]
0768: push [bp+4]        ; ← código de dirección (1/2/3/4 ó 0x0d/0x2e)
076d: push ax            ; ← tile bajo el pie
076e: call 0x502         ; move(dir, tile)
```

`move()` recibe el **código de tecla** como `dir` en `[bp+6]`. Ahí está el corazón del
modelo.

## 3. `move(dir,tile)` — DUNGEON:0x0502  (RELATIVO al facing)

Dispatch sobre `dir=[bp+6]` (`re/disasm/DUNGEON.OVL.asm:548-565`):

| `dir` | destino | acción | facing / paso |
|-------|---------|--------|---------------|
| **3** (↑) | 0x0542 | **Advance** | `[bp-4]=+1`, mueve +1 en la dir de facing |
| **4** (↓) | 0x064a | **Back up** | `[bp-4]=-1` (0xffff), mueve −1 en facing; facing sin tocar |
| **2** (→) | 0x0628 | **Turn right** | `facing = (facing+1)&3` (0x063d), sin paso |
| **1** (←) | 0x065a | **Turn left** | `facing = (facing+3)&3` (0x0675, +3≡−1), sin paso |
| **else** | 0x0533 | **Turn around 180°** | `facing = (facing+2)&3` (0x0533→0x0642), sin paso |

La **rama `else`** (0x0533) es exactamente donde caen `ENTER`(0x0d) y `PERIOD`(0x2e), y
cualquier otra tecla que llegara a `move()`:
```
0533: mov ax,0x2d0b   ; string de eco ("turn around")
0536: push ax / call print
053a: mov al,[g_dng_facing]
053d: add al,2         ; ← giro 180°
053f: jmp 0x642        ; 0x642: and al,3 ; mov [g_dng_facing],al
```

Movimiento (casos 3/4), tras fijar `[bp-4]=±1`, computa destino con las **mismas tablas
de vector que overworld/combat/CAST**: `dx[facing]@0x24D6=[0,+1,0,-1]`,
`dy[facing]@0x24DE=[-1,0,+1,0]` (0x0568/0x0596), con **WRAP toroidal por eje** (0x057a,
0x0583) — salir por un borde = aparecer en el opuesto de la misma fila/columna. `facing`
(`g_dng_facing`@DS:0x6603) es 0=N,1=E,2=S,3=O (0x01D2 imprime North/East/South/West).

⇒ El movimiento es **RELATIVO al rumbo**: no hay N/S/E/W absolutos ligados a teclas. La
tecla ↑ siempre avanza *hacia donde miras*, no "al norte". Girar puro (1/2/else) **no
cuesta paso**; sólo cambia `facing` y re-renderiza.

## 4. Cotejo con el port — `handleDungeonKey` (main.ts:641-651) + `dungeon.ts`

```
ArrowUp    → "forward" → ds.forward(state)   // +DELTA[facing]      == dir 3
ArrowDown  → "back"    → ds.back(state)      // -DELTA[facing]      == dir 4
ArrowLeft  → "left"    → ds.turnLeft()       // facing=LEFT[facing] == dir 1
ArrowRight → "right"   → ds.turnRight()      // facing=RIGHT[facing]== dir 2
```
(`game.ts:5016-5037`, `core/dungeon/dungeon.ts:202-248`). El estado `facing` + tablas
`DELTA/LEFT/RIGHT` reproducen 1:1 el modelo relativo del binario. **El modelo del port es
FIEL.** No hay ninguna tecla mapeada a `Enter`/`Period`: el `cmd` de esos `key` es `null`
(0x652 `if (!cmd) return;`).

## 5. VEREDICTO

**(a) El port es FIEL al modelo de movimiento** — es RELATIVO, tal como el binario. La
lectura de "compás absoluto" que insinuaba la refcard (y que el censo dejó como
*needs-oracle*) queda **descartada por el ASM**: no existen direcciones absolutas
atadas a teclas; todo es fwd/back/turnL/turnR sobre `g_dng_facing`.

**Único hueco: `ENTER`/`PERIOD` → giro 180°.** Es un binding REAL del binario (rama
*default* de `move()` @0x0533, `facing+=2`, con eco de string y sin coste de paso), y el
port no lo cablea. Pero su **efecto es alcanzable** con dos giros (←← o →→), así que **no
hay mecánica inaccesible** ⇒ clasificación **(c) QoL / alias de fidelidad**, NO F-algo.
Coincide con la propuesta del censo (§4: "a lo sumo (c) QoL").

Matiz de fidelidad (para el lead, no bloqueante): en el original esas teclas *hacen algo*
(giran 180° + emiten eco); en el port hoy son no-ops en mazmorra. Como el mandato es calco
100%, cablearlo es un fix barato que sube fidelidad. Recomendado, prioridad baja.

## 6. Spec de cableo (si el lead lo aprueba)

En `game/src/core/dungeon/dungeon.ts`, añadir método:
```ts
turnAround(): DungeonEvent[] {
  this.pos.facing = LEFT[LEFT[this.pos.facing]];  // (facing+2)&3 ; == ASM 0x0533 add 2 & 3
  return [{ kind: "turned" }];
}
```
En `game.ts` `dungeonCommand`, añadir case `"turnAround"` → `ds.turnAround()`; ampliar la
unión de `cmd`. En `main.ts handleDungeonKey`, dentro del mapa de `cmd` (líneas 641-651):
```ts
: key === "Enter" || key === "." ? "turnAround"
```
Sin coste de turno (girar puro no gasta paso: 0x0502 no ejecuta el monster-turn 0x1020 en
las ramas de giro; ver `dungeon.md` §2 "Girar puro no gasta paso"). Sin prompt. El eco
(`{kind:"turned"}`) ya lo consume el HUD como los demás giros.

**Fe de erratas para el censo** (`docs/censo-teclado-refcard.md` §4 / apéndice ítem 6):
resuelto — el modelo NO es compás absoluto, es relativo; el port es fiel; el giro-180 de
`ENTER`/`PERIOD` es (c) QoL, cableo trivial arriba. Puede cerrarse el *needs-oracle*.
