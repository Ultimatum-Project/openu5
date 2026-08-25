# CAREO DEL PORT contra los hallazgos de TOWN (tarea #38) — 2026-07-27

Careo punto por punto de los 8 hallazgos de TOWN (lotes 7 y 24-1). Método por punto:
censo del port → careo contra el binario (`re/disasm/`, **28/28 `.asm`**, lección del
corpus incompleto) → veredicto FIEL / HUECO / DIVERGE. Los fixes con radio se REPORTAN,
no se cablean.

**Estado: 2 de 8 adjudicados** (a, d). Los otros 6 van con su estado exacto en §3 — sin
veredicto, porque un veredicto flojo cuesta más que ninguno.

---

## (a) CLAVICÉMBALO — **FIEL**, nada que calcar

El port modela los tres elementos del hallazgo **y** el rebobinado del matcher.

| elemento | binario (`TOWN.OVL.asm`) | port |
|---|---|---|
| 13 notas | `0e81 inc [0x2767]` · `0e85 cmp [0x2767],0xd / jne` | `HARPSICHORD_MELODY` (13 dígitos) |
| gate doble | `0e90 cmp [g_location],0x11 / jne` · `0e97 cmp [g_floor],2 / jne` | `game.ts:1938` `location === 0x11 && floor === 2` |
| celda | `0e9e xor [0x67b9],0xb` | `HARPSICHORD_PASSAGE` (17,13) `0x4F↔0x44` |
| terremoto | `0ea3 call 0xffffaea2` | evento `{kind:"quake"}` |
| rebobinado | `0eae cmp [0x2767],0xa` | `advanceMelody`: `progress === 10` |

**La celda no necesita oráculo**: `0x67b9 − 0x6608 = 0x1B1 = 433 = 13·32 + 17` con stride
32 ⇒ (x=17, y=13). Era aritmética, no testigo.

**Defecto documental arreglado** (commit `cfff3117`): la cabecera de `harpsichord.ts`
declaraba «celda exacta pendiente de fijar con el oráculo» y **se contradecía con
`HARPSICHORD_PASSAGE` veinte líneas más abajo**, que ya la daba por fijada. Prosa
auto-infiel EN CÓDIGO (género de #40). Efecto colateral: retira una entrada viva de la cola
del usuario — el A2 del lote-D constaba CERRADO POR DERIVACIÓN, pero quien leyera el módulo
lo re-encolaba.

---

## (d) GUARDA `y == 4` de `town_place_shadowlord` — **HUECO**, y la nota afirmaba lo contrario

### El binario
`town_place_shadowlord` = **TOWN.OVL 0x02AE** (ledger `frontier.json`: file TOWN.OVL,
start 686, size 346, `verified: true`). Su primera decisión:

```
02b6: mov byte [g_unk_5958], 0xff   ; g_shadowlord_here_idx = 0xFF (ninguno)
02bb: cmp byte [g_party_y], 4       ; ← LA GUARDA
02c0: je 0x2dd                      ;   si party_y == 4 → SALTA todo el escaneo
02c2: sub si, si                    ; (si no) escanea g_shadowlord_locs[0..2]
02cc: cmp byte [si + 0x58c8], dl    ;   ¿alguno está en g_location?
02d9: mov [g_unk_5958], cl          ;   sí → guarda su índice
02dd: cmp byte [g_unk_5958], 0xff   ; ¿ninguno? → salir por 0x401
```

**La guarda mira SÓLO la fila.** No hay comprobación de `x` por ninguna parte: dispara en
**cualquier columna de la fila 4**, no sólo en la celda de entrada. Eso es el quirk del
hallazgo, y está en el binario tal cual.

### El port
- **No existe equivalente de `town_place_shadowlord`** (la colocación FÍSICA del Shadowlord
  en un slot NPC del pueblo): censo negativo — ni `town_place_shadowlord` ni
  `placeShadowlord` ni nada equivalente en `game/src`.
- Lo que sí hay es `shadowlordPresentIndex` (`game/src/core/world/blackthorn.ts:459`), un
  port **PARCIAL** de la misma rutina: implementa el escaneo de la tabla (0x02c2-0x0306) y
  **omite la guarda de 0x02bb**.
- Y su JSDoc **cita el rango `TOWN 0x02b6-0x0306`** — un rango que INCLUYE la guarda que no
  implementa. Cita de más.

### ★ La nota decía que el clon lo calcaba, y no
`re/notes/shadowlord-urban.md §1` cierra el gate con: «**Bug-for-bug: registrado; el clon
calca el gate.**» **Es falso**: el clon no tiene la guarda. Prosa auto-FIEL de manual —
afirma fidelidad que no existe — y encima en el sitio donde alguien iría a comprobarlo.

### Veredicto y radio (NO cableado, como pediste)
**HUECO** en dos capas: falta la rutina de colocación entera, y la parte que sí se portó
perdió su guarda.

**Radio medido, y por eso no lo toco:** `shadowlordPresentIndex` no es un adorno —
lo consumen `postPurchaseGoldDrain` (`blackthorn.ts:476`, la merma de oro de la Falsedad,
SHOPPES 0x019a) y las listas de anuncio de `game.ts:3264` y `game.ts:3667`. Meterle la
guarda `y == 4` cambiaría el comportamiento de la merma de oro **en toda la fila 4 de cada
pueblo**, que es justo la fila de entrada estándar: toca specs de tienda y de entrada a
pueblo. Decisión tuya antes de cablear.

**Matiz honesto sobre la equivalencia:** la rutina del binario es un SPAWN y la función del
port es una CONSULTA reutilizada para otra cosa. No son la misma pieza, así que «añadir la
guarda» no es una traducción mecánica: hay que decidir primero si el port quiere modelar la
colocación física del Shadowlord o sólo su presencia lógica. Esa decisión es de diseño de
port, no de derivación.

---

## 3. LOS 6 QUE NO LLEVAN VEREDICTO (estado exacto, para el siguiente carril)

| pto | qué es | estado real |
|---|---|---|
| (b) | loc 0x1d + Cetro borra slot 9 + anuncia los TRES SL | sin censar a fondo; rastro en `game.ts:3610` (Stonegate slot 9 como objeto plot) |
| (c) | `town_klimb` montado «-On foot!» | hay «On foot!» en `main.ts:3989` y `use-tools.ts:93`, **NO verificado** que sea la rama de klimb — puede ser falso amigo |
| (e) | pezuña 1×/2× montado | sin censar |
| (f) | cadencia NPC montado (turnos alternos · T congela · Q mitad) | sin censar; **radio potencial** en specs de pueblo |
| (g) | trampilla Stonegate TPK (Lava + roster HP=0) | sin censar; **radio potencial** (muerte de party) |
| (h) | veneno de pantano `DEX < rand(29,0)` · despertar 1/16 · tabla DS 0x13A5 | sin censar |

Sugerencia de orden para quien siga: (c) es el más barato (confirmar o descartar el falso
amigo), y (f)/(g) son los que hay que reportar antes de cablear.
