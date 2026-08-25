# Acta #237 — NPC.OVL 0x0632, guarda transpuesta: INERTE y con DOS defectos

Carril `re/clamps-237` (worktree `.claude/worktrees/clamps-237`), rama desde `main` @`45084f71`.
Cabo (a) de #229 (acta `re/notes/scratch-229-acta.md` §3.4).

## VEREDICTO, primero

**Guarda TRANSPUESTA pero INERTE, y NO modelada por el port — que es lo correcto.** No es hueco
de paridad. Portarla sería **fabricar un efecto que el original no tiene**, porque otra rutina
aguas abajo acota bien y se come el caso entero.

Y la guarda no tiene UN defecto sino **DOS independientes**: el eje cruzado (#229) **y una cota
off-by-one** (0x20 donde el mapa real acaba en 0x1F). Dos defectos en la misma guarda muerta es
la corroboración de que es vestigial: nadie la ha ejecutado nunca con efecto.

---

## 1. Paso 1 — CALLERS: cuatro, todos intra-overlay

Instrumento: `routine_census.disasm_file` + `resolve_near_call` sobre los 30 ficheros de código
(**nunca grep**: hay callers con crudo `0xffffXXXX` que un grep de texto pierde — familia #173).

| caller | qué hace con el resultado |
|---|---|
| `NPC.OVL:0x0789` | genera CANDIDATA (dentro del bucle de 4 rumbos) → valida con `0x0b9e` |
| **`NPC.OVL:0x0909`** | **COMMITEA**: escribe a `[bx+2]/[bx+4]` del record Y a 0x5C5A (`[si+0x5c5c/5d]`) |
| `NPC.OVL:0x0c8b` | pasa el resultado a otra rutina (no leída — §6) |
| `NPC.OVL:0x0fd2` | pasa el resultado a otra rutina (no leída — §6) |

**Control positivo antes de firmar la cifra:** el mismo barrido sobre `ULTIMA.EXE 0x368e` da
**18**, la cifra ya establecida en #149. Un 4 sin ese control sería un 4 sin crédito.

Los cuatro tienen la MISMA forma: siembran `g_cmb_scratch_x/y` desde `[bx+2]/[bx+4]` de un record
de NPC, llaman, y releen. ⇒ `0x0632` es `npc_step_dir`: **desplaza un cursor absoluto** un paso en
el rumbo del arg (`ret 2`) y «acota» a 0..0x20. Confirma la clasificación de #229 §3 (mutador sin
base, absoluto presupuesto).

## 2. El flujo que lo usa — `NPC.OVL 0x06e4` (IA de persecución)

```
0714-071d: call 0x6a0 (party_anim_x/y, npc_x/y)  → DISTANCIA actual → [bp-4]
0779-07d8: bucle si = 1..4  (los cuatro rumbos)
   0779-0785: siembra base = npc x/y ; 0789: call 0x632  ← CANDIDATA (caller A)
   0798-07a4: call 0xb9e (celda_desplazada, npc_idx, 0xFFFF)   ← VALIDADOR
   07a7: or ax,ax / je → si RECHAZA: [bp-0xe+2(si-1)] = 0x63 (centinela «bloqueada»)
         si acepta:      slot = distancia de la candidata al party (call 0x6a0)
07fc-0890: elige `di` = el rumbo cuya distancia MEJORA (desempate por rand, call 0x7e02)
08f1: cmp [bp-0x18],-1 / jle → sin rumbo válido: NO se mueve
08f7-092a: COMMIT (caller B): siembra, call 0x632, y escribe x/y al record Y a 0x5C5A
```

⇒ **ningún rumbo llega al commit sin pasar por `0x0b9e`.** Ése es el eslabón que decide todo.

## 3. Paso 2 — ALCANZABILIDAD: el clamp dispara CERO veces (medido)

Transcribí la semántica literal de las cuatro ramas y la simulé sobre **todo el dominio que la
propia guarda declara legal** (0..0x20 × 0..0x20 × 4 rumbos = **4356 casos**):

| | n |
|---|---:|
| casos en que el clamp **TRANSPUESTO** dispara | **0** |
| casos en que difiere del clamp correcto | 132 |
| resultados **fuera** de 0..0x20 que produce | **132** |
| **CONTROL DE SENSIBILIDAD:** casos en que el clamp **CORRECTO** dispararía | **132** |

El control es la mitad que da crédito al cero: si el correcto también hubiera dado 0, mi arnés
estaría roto y el «0» no valdría nada. Da 132 ⇒ el arnés distingue, y el cero del transpuesto es
real.

**Por qué es cero, en una frase:** la guarda testea el eje que NO acaba de mover. Ese eje sigue
dentro de rango por construcción, así que la condición nunca se cumple — y justo por eso el eje
que SÍ se movió se escapa a −1 o 33 sin recorte. **La transposición no hace que recorte mal:
hace que NO RECORTE NUNCA.**

## 4. ★ Por qué la fuga tampoco llega a mecánica — NPC.OVL `0x0b9e`, que acota BIEN

```
0ba9: cmp [bp+0xa],0    / jl  0xbc1     ← y < 0     ⇒ rechaza
0baf: cmp [bp+0xa],0x1f / jg  0xbc1     ← y > 0x1F  ⇒ rechaza
0bb5: cmp [bp+8],0      / jl  0xbc1     ← x < 0     ⇒ rechaza
0bbb: cmp [bp+8],0x1f   / jle 0xbc6     ← x > 0x1F  ⇒ rechaza
0bc1: sub ax,ax → return 0
```

**Cuatro tests, cada uno sobre SU PROPIO eje, ANTES de cualquier otra cosa.** Toda candidata
fuera de 0..0x1F se marca `0x63` y queda excluida de la elección ⇒ **las 132 fugas que produce
0x0632 se generan pero NUNCA se commitean.**

## 5. ★★ El SEGUNDO defecto: la cota de la guarda es 0x20; la real es 0x1F

`0x0632`, que recorta a **0x20 = 32**. El validador acota a **0x1F = 31** — el mapa de pueblo 32×32,
índices 0..31. ⇒ incluso una versión de `0x0632` con los ejes BIEN habría permitido la columna/fila
**32**, una fuera del mapa, y habría vuelto a depender de `0x0b9e`, o sea del validador, para taparlo.

Dos defectos independientes (eje cruzado + cota off-by-one) en una guarda cuyo efecto medido es
cero: la lectura honesta es **código vestigial**, no una guarda que alguien tuvo funcionando.

## 6. Paso 3 — EL PORT: no la modela, y hace lo correcto

- Un `git grep` del offset del validador sobre `game/src` ⇒ **0 aciertos** (los 3 hits de
  `0xb9ee` son otra tabla, la de ítems de trama).
- El port **no tiene ningún clamp** en el paso de NPC (`grep clamp|Math.min|Math.max` en
  `manager.ts` ⇒ **0**), coherente con #229 §5: no existe ranura espejo de `g_cmb_scratch`.
- Lo que sí tiene es el **validador**: `manager.ts:390`
  `if (x < 0 || y < 0 || x >= SMALL || y >= SMALL) return true;` con `SMALL = 32` (línea 77)
  ⇒ acota a **0..31 = 0..0x1F**, que es **exactamente la cota efectiva del binario**.
- Ese `destBlocked` cita `0x0D55-0x0D8B` — un validador HERMANO del que leí (`0x0b9e`), en la vía
  de `guard_wander`. Que dos validadores distintos acoten al mismo 0..0x1F **corrobora por vía
  independiente** que ésa es la cota real y que 0x20 es el error.

⇒ **El port es correcto y no hay nada que portar.** Reproducir el clamp transpuesto no cambiaría
ninguna conducta observable (dispara 0 veces) y reproducir uno «arreglado» introduciría un recorte
a 32 que el original **efectivamente** no aplica: sería fabricar.

## 7. Declarado y NO cerrado

1. **Callers C (`0x0c8b`) y D (`0x0fd2`)**: viven en OTRAS rutinas y **no leí su aguas abajo**. El
   veredicto cubre la vía que COMMITEA (A genera + B escribe) de punta a punta; C y D quedan
   **declarados, no verdes**. Si alguna de las dos commiteara sin pasar por un validador, la fuga
   sería alcanzable por ahí — es la única puerta que dejo abierta, y está nombrada.
2. **No he medido si el bucle puede elegir un rumbo hacia el borde con el NPC EN el borde**: es
   irrelevante para el veredicto (el validador rechaza igual), pero nadie lo lea como medido.
3. `0x0632`, sin nombre en el ledger todavía. Propuesta: `npc_step_dir_clamped_dead` o similar —
   **no la siembro yo desde la prosa** (regla del `seed_gate`); si el lead la quiere, vía capa
   manual `frontier-manual.json` con esta acta como cita.

## 8. Alcance

Sólo DOCUMENTACIÓN: 1 acta. **Cero código, cero prosa de `game/src`** (no hacía falta: el port
está bien), cero mecánica, cero tests, no `main.ts`, no se regeneró `routine-census.json`.
