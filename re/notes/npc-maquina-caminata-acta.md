# La máquina de caminata de los NPC — derivación completa (2026-08-08)

Acta de CONGELACIÓN (opción O3 de la ficha #84-nueva). El port **no** implementa esto y no
se va a implementar hoy: se escribe para que nadie tenga que re-derivarlo, y para que quien
abra el carril (#108) arranque de aquí y no del disasm en frío.

Sujeto: el BINARIO. Todas las direcciones son offsets de listado de `re/disasm/NPC.OVL.asm`
salvo donde se diga `DS:`.

---

## 0. El resumen en una frase

El binario decide «¿este NPC camina hacia su puesto o hace su IA?» con un **PESTILLO DE
ESTADO persistido**, armado **sólo en la hora en que arranca una ranura de horario** y
cerrado **al llegar**; el clon lo decide **recomputando la distancia al puesto en cada
tick**. No son dos formas de escribir lo mismo: producen comportamientos distintos, y el
pestillo arrastra cuatro estructuras más.

---

## 1. 🔴 La razón por la que esto se congela en vez de arreglarse a medias

> **Un pestillo sin buffer de camino deja al NPC desplazado QUIETO PARA SIEMPRE.**

Hoy lo único que devuelve a un NPC a su puesto en el clon es la guarda derivada de la
distancia (`stepToward`). Si se sustituye esa guarda por el pestillo del binario **sin
portar antes el buffer de camino y sus contadores**, el NPC que se separó de su puesto —
persiguiendo, huyendo, o cargado de un save— deja de tener quien lo devuelva: el pestillo
sólo se arma en la transición horaria, y hasta entonces no hay nada que camine. El híbrido
es **peor que la divergencia que venía a arreglar**.

De ahí la regla que dejó este caso: **el radio se mide ANTES de abrir**, no a mitad. La
ficha decía «destapa la guarda»; la guarda resultó ser la punta de una máquina de estados
con persistencia en el save.

---

## 2. El reparto por aiType — `npc_ai_step` 0x0d00

`si = [bp+6] << 4`; `[bp-2] = si + 0x5f5e` (registro **VIVO**), `[bp-4] = si + 0x5d5e`
(registro de **HORARIO**). Los dos arrays están separados **0x200 = 32 × 16 B**.
El aiType se lee de `[bx+di]` con `bx = [bp+4]` (índice de ranura) y `di = [bp-4]` ⇒ vive
en los bytes `+0..+2` del registro de horario.

Tabla de saltos en `0x0d9c`, alcanzada por `0d30 jmp word ptr cs:[bx-0x4fd4]` con
`bx = aiType*2`. `-0x4fd4` sin signo = `0xB02C`; la base near-call de NPC.OVL es `0xA290`,
luego **offset de listado = valor − 0xA290**. Las ocho entradas, descodificadas:

| aiType | entrada | destino | qué hace |
|---|---|---|---|
| 0 | `0xb03c` | `0x0dac` | nada |
| 1 | `0xaff0` | `0x0d60` | `npc_wander` modo 3 (radio Manhattan 3) |
| 2 | `0xafc8` | `0x0d38` | `npc_wander` modo 0 (sin límite) |
| 3 | `0xb006` | `0x0d76` | distancia al **NPC VIVO**; `< 4` → `0x06e4` |
| 4 | `0xafd0` | `0x0d40` | distancia al **PUESTO**; `≥ 4` → wander 3, `< 4` → `0x06e4` |
| 5 | `0xb021` | `0x0d91` | `0x06e4` directo, **sin** puerta |
| 6 | `0xb006` | `0x0d76` | igual que el 3 |
| 7 | `0xb021` | `0x0d91` | igual que el 5 |

El brazo del **4** (`0x0d40`) mide con `si = [bp+4] + [bp-4]` y los campos `[si+3]`/`[si+6]`
= X/Y del **puesto**. El del **3/6** (`0x0d76`) mide con `bx = [bp-2]` y `[bx+2]`/`[bx+4]`
= X/Y **vivas**. Esto es lo que decía #84 y está confirmado; **el port ya lo modela por
separado** (`AI_MERCHANT` mide al puesto y llama a `chaseMove`; `AI_CHASE` usa `chaseStep`
con la puerta del 3/6). Nada que arreglar ahí.

---

## 3. El pestillo — quién lo arma y quién lo cierra

### 3.1 El bucle: `npc_tick_all` 0x0db4

Por cada índice 0..0x1f con `[bx+0x659e] != 0` (activo):

```
1281  [bp-6] = idx*16 + 0x5f5e          ; registro vivo
1290  cmp word [bx],1                   ; ESTADO
1293  jg  0x12a2                        ; estado > 1 → máquina de caminata
1295  call npc_check_schedule(hora, idx) ; estado ≤ 1
12a0  je  0x124e                        ; devolvió 0 → gate de planta + call 0xd00 (IA)
12a2  ... reparto por estado: ≤3 → 0xf94 · 4/5 → 0x12bc · resto → 0xea6
```

### 3.2 `npc_check_schedule` 0x0938 — el predicado que arma

```
095c  j = 0
0964  bx = sched_base + j
096a  al = [bx+0xc]                     ; hora de arranque de la ranura j
096f  cmp ax, [bp+4]                    ; ¿== hora ACTUAL?
0972  je 0x977   / 0974 jmp 0xa2c       ; si no, j++ (tope 4) y sigue
```

⇒ **sólo busca ranura cuando la hora actual coincide con la hora de arranque de alguna**.
Fuera de ese instante `di` sigue en `-1`, `[bp-8] = -1` y **devuelve 0** ⇒ el llamador cae en
`0x124e` → `call 0xd00` = `npc_ai_step`, **sin mirar si el NPC está en su puesto**. Ésta es
la divergencia raíz.

Si SÍ hay coincidencia: `di = npc_schedule_index(hora, idx)`; si `live[+0xe] != di` es un
cambio de ranura y se fija el estado de caminata (2/4/5/6/7/8 según el reparto de plantas de
`0x09cc-0x0a28`).

### 3.3 Quién CIERRA el pestillo — `live[+0xe]`

Censadas **todas** las escrituras a `+0xe` del registro vivo en NPC.OVL: **dos**, y las dos
en el cierre de la caminata, no en la detección:

- `0x0ee6` (brazo de cambio de planta): `[bx+0xe] = [bp-0xc]` · `path = -1` · `[bx] = 1`.
- `0x1089` (al agotar el buffer de camino con `[bp-0xe] == 2`): lo mismo.

⇒ **el pestillo se cierra AL LLEGAR.** Mientras no llega, cada tick de esa hora vuelve a
recalcular el estado de caminata.

### 3.4 🔴 Consecuencia no prevista: la HORA INERTE

Con el pestillo ya cerrado (`live[0xe] == di`) y las coordenadas cuadrando, `check_schedule`
pone `[si] = 1`, hace `[bp-8] = 0` y **devuelve 1 (≠ 0)**. El llamador entonces NO ejecuta
`npc_ai_step`: va a `0x12a2` → estado 1 ≤ 3 → `0xf94` → `path == -1` → `0x10e0` → estado ≠ 3
→ `0x1124` → `0x112d`: **`cmp [bx],1` / `je 0x1264` = no hace NADA**.

⇒ **durante toda la hora de juego en que arranca una ranura, un NPC que ya está en su puesto
queda inerte**: no vaga, no persigue y **no consume RNG**. Tres ranuras ⇒ tres horas de 24
por NPC. Esto **no estaba en la ficha #84** y es la pieza más barata de portar por separado
(queda como fase 1 del carril #108).

---

## 4. Las CINCO piezas de estado por NPC — y **van en el SAVE**

| pieza | dirección | tamaño | cita |
|---|---|---|---|
| `state` (1..8) | `DS:0x5f5e + idx*16 + 0` | word | `1290 cmp word [bx],1` |
| `servedSlot` | `+0xe` del registro vivo | word | `0982 cmp [si+0xe],di` · escrito en `0ee6`/`1089` |
| `pathBuffer` | `DS:0x615e + idx*32` | 32 B | `0fae cmp byte [bx+di+0x615e],0` · `103a dec byte [bx]` (¡lleva **repeticiones**!) |
| `pathIndex` (−1 = sin camino) | `DS:0x655e + idx*2` | word | `0f99 cmp word [si+0x655e],-1` |
| `stuckCtr` (satura 0xc8, se resetea pasando 0xcc) | `DS:0x65c2 + idx*2` | word | `1141 cmp si,0xc8` · `11f1`/`1202`/`1208` |

### 4.1 🔴 El bloque TESELA, y eso acredita los tamaños

Los tramos encajan sin solaparse, y cada frontera está confirmada por una instrucción leída:

```
0x5D5E..0x5F5D  horarios            32 × 16 B
0x5F5E..0x615D  vivos               32 × 16 B   (separación 0x200 de #84)
0x615E..0x655D  buffer de camino    32 × 32 B
0x655E..0x659D  índice de camino    32 ×  2 B
0x659E..0x65BD  flags de activo     32 ×  1 B   (1270 cmp byte [bx+0x659e],0)
0x65BE, 0x65BF  dos singles                     (0dc1 / 0dc6)
0x65C2..0x6601  contador de atasco  32 ×  2 B
```
Cada array empieza **exactamente** donde acaba el anterior (salvo 4 B sin adjudicar entre
`0x65BE` y `0x65C2`, que se declaran como no censados).

### 4.2 La afirmación fuerte: ese estado se PERSISTE

`INIT.GAM` y `SAVED.GAM` miden **4192 B = 0x1060** (medido con `stat`, no relayado). El
oráculo localiza el bloque en `DS:0x55A6`, luego la ventana del save es
**`0x55A6..0x6605`**. Las cinco piezas caen dentro, y el contador de atasco **termina en
`0x6601`, a cuatro bytes del borde**: encaja justo. ⇒ **la máquina de caminata es estado
GUARDADO**, no runtime efímero. Portarla toca la serialización y el import/export de
partida, no sólo el tick.

---

## 5. El presupuesto de UN escaneo por tick

`[bp-0x12]` se inicializa a 0 en `0x0dbc` — **una vez por llamada a `npc_tick_all`**, o sea
por tick de mundo. Se incrementa en `0x116c` (justo antes de `call 0x32c npc_scan`) y se
fuerza a 1 en `0x0f14` y `0x12c2`. La guarda:

```
1124  cmp word [bp-0x12], 1
1128  jl  0x112d        ; presupuesto libre → puede escanear
112a  jmp 0x120e        ; GASTADO → gate de planta + call 0xd00 (npc_ai_step)
```

⇒ **sólo un NPC por tick recalcula camino; los demás caen en la IA aunque les tocara
caminar.** Un port que deje escanear a todos cambia el comportamiento *y* el orden de
consumo del RNG.

## 5.1 🔴 El reintento de camino CONSUME RNG

```
114a  or si, si          ; si = stuckCtr
114c  je 0x1160          ; 0 → escanea directo
114e  push 0 ; push 2 ; call 0x7e02      ; = rand_range(2, 0)
1158  cmp ax, 1
115b  je 0x1160          ; sólo re-escanea si sale 1
115d  jmp 0x11e8         ; si no, envejece el contador
```

La ficha #84 decía «mueve stream» sin nombrar consumidor. **Éste es el consumidor**, y es
CONDICIONAL al contador de atasco. El otro es `npc_wander` (1 × `rand(0,255)` siempre, más a
veces `rand(0,64)`), ya modelado en el port.

---

## 6. Lo que hace el port hoy, y por qué es distinto

`game/src/core/npc/manager.ts::tick`:

```ts
const dist = manhattan(npc.x, npc.y, tx, ty);
if (dist > 0 && !isWanderer) { this.stepToward(...); continue; }
```

Disparador **derivado de la distancia**, recomputado cada tick, con A\* determinista
(`findPath`) en vez del escáner voraz `npc_scan` + `npc_path_backtrace` y su buffer.
`NpcRuntime` no tiene ninguna de las cinco piezas y no se serializa nada
(`grep npcRuntime|serializeNpc|npcState` sobre `state.ts` + `manager.ts` = 0 aciertos).

Diferencias observables, en orden de tamaño:
1. un NPC desplazado (tras perseguir/huir) **vuelve al puesto al tick siguiente** en el clon;
   en el binario **no vuelve hasta la siguiente transición horaria**;
2. la **hora inerte** de §3.4 no existe en el clon;
3. el clon deja «escanear» a todos los NPC cada tick (no hay presupuesto);
4. el clon no tiene el reintento con moneda ⇒ le falta ese consumo de RNG.

---

## 7. ★ Corrección MÍA, fechada — las ranuras son TRES, no cuatro

**El 2026-08-08, en mi primera entrega de este carril, escribí «slot index 0..3». Es
FALSO y lo retiro yo.** `npc_schedule_index` (`0x12e0`) compara la hora contra los cuatro
bytes `+0xc..+0xf` y devuelve `dx ∈ {0,1,2}` (`1308 xor dx,dx` · `1310 inc dx` ·
`1317 mov dx,2` · `131e mov dx,1`): **TRES ranuras de actividad y CUATRO fronteras
horarias**. Los campos encajan sin colisión sólo con tres (X en `+3..+5`, Y en `+6..+8`,
Z en `+9..+0xb`); con cuatro, `X[3]` y `Y[0]` caerían los dos en `+6`.

**El port ya lo tenía bien** (`aiTypes`/`schedX`/`schedY`/`schedZ` de 3, `times` de 4).
Se registra la corrección en vez de callarla porque la frase falsa llegó a un mensaje de
entrega y alguien podría citarla.

---

## 8. Estado y siguiente paso

- **NO portado.** El port se queda con su disparador por distancia, declarado en una tarjeta
  Clase-C en `manager.ts::tick` que apunta aquí.
- El carril completo está encolado (#108). Su **fase 1** natural es la hora inerte de §3.4:
  aislada, sin buffer de camino, y **reduce** consumo de RNG (el wander de esa hora deja de
  tirar) ⇒ necesita ventana, pero pequeña.
- Sin medir: si algún NPC de fábrica tiene las cuatro fronteras horarias distintas — de eso
  depende cuántas horas inertes hay de verdad por partida.

---

## 9. ADDENDUM 2026-08-17 (carril fix-84) — el PESTILLO está PORTADO; §6 y el «NO portado» de §8 CADUCAN

La opción que este acta congeló (O3) se reabrió: el lead adjudicó #84 = pestillo solo,
#108 = el resto. Desde la rama `fix/pestillo-horario-84`:

- `npc_check_schedule` (0x0938) está portada EXACTA (`manager.ts::npcCheckSchedule`),
  con la hora inerte de §3.4, el quirk del presupuesto gastado (0x1124→0x120e, IA con la
  ranura SERVIDA) y el presupuesto de UN escaneo por tick de §5. El §6 («el port decide
  por distancia recomputada») ya NO describe el árbol.
- La trampa de §1 (pestillo sin buffer = NPC quieto para siempre) se esquivó SIN abrir
  #108: el caminante sigue siendo el A\* (stand-in declarado del escáner), con buffer
  EFÍMERO recortado a 16 tramos. Siguen fuera y bloqueadas en #108: las CINCO piezas en
  el save (§4), el atasco + la moneda de §5.1, `npc_change_floor` y el estado 3.
- Careo, mutantes, censo de veredictos que caducan y predicción anclada:
  `re/notes/pestillo-84-acta.md`.

## 10. ADDENDUM 2026-08-19 (carril fix-108) — la máquina COMPLETA está portada; el «siguen fuera» del §9 CADUCA

Desde la rama `fix/108-caminata-npc`: las CINCO piezas del §4 van en el save
(`GameState.npcWalk`), el escáner 0x032C + backtrace 0x04AC sustituyen al A\*
(el buffer RLE es el REAL, con su tope de 16 pares y su inversión), el atasco +
la moneda del §5.1 están portados (saturación 0xC8 y enfriamiento de 5 ticks
incluidos), y `npc_change_floor` + los estados 3-8 caminan de verdad (aparición
en la escala, estado 3 con su aborto de pasada 0x12d8). Derivación re-verificada
a nivel de instrucción, adjudicaciones declaradas, mutantes y ventana:
`re/notes/caminata-108-acta.md`.
