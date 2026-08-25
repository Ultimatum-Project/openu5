# BONUS — rand-count del picker de summon `0x9cb6` · ✅ **CERRADO 2026-07-25 POR LECTURA** (era resoluble; ver §0)

## §0 — Cierre (barrido de citas, carril frontera-verify)

**No hacía falta witness vivo.** `0x9cb6` no es «kernel 0x9cb6 [= CS 0x7e96 → COMBAT.OVL:0x120e random_board_cell]»: es el destino near-call
CRUDO que imprime el disasm de CAST2/COMSUBS, que están en la **banda 4**
(`near_call_base` = 0xe1e0). Regla de `overlay-load-layout.md §3`:
`(0xe1e0 + 0x9cb6) & 0xFFFF = 0x7E96` → cae en el pool de stubs kernel→overlay → salta a
**COMBAT.OVL:0x120e `random_board_cell`** (40 B, sin prólogo). Cuerpo completo:

```
120e  mov ax,0xf / push / call 0xffff981e   ; = CS 0x3aae rand_range  → g_cmb_scratch_x
1218  mov ax,0xf / push / call 0xffff981e   ; = CS 0x3aae rand_range  → g_cmb_scratch_y
1222  cmp g_cmb_scratch_x,0xa / jg → ax=0   ; fuera del tablero 11x11
1229  cmp ax,0xa            / jle→ ax=1     ; dentro
1235  ret
```

**Respuesta a la pregunta del encargo:** el picker consume **exactamente 2 tiradas por
invocación**, ambas `rand_range(0x0f)` (0..15), en el orden **x primero, y después**. El
rechazo por caer fuera de 0..10 **no** consume tiradas adicionales: es una comparación, y
quien reintenta es el llamante (hasta 8 intentos en `CAST2:0x04c2`). Para la paridad de
stream: `intentos × 2` tiradas, más las que gaste la validación del llamante.

---

## Registro histórico (2026-07-19) — por qué se declaró bloqueado

**Carril:** oracle-queue · **Fecha:** 2026-07-19 · Encargo bonus del lead: contar las tiradas
de rand DENTRO del picker `0x9cb6` (llamado por CAST2:0x04ec daemon y COMSUBS:0x0260) para la
paridad de stream del summon (carril cast-line-aoe). Timebox 20 min. **Resultado: NO cerrado;
la dirección de runtime de 0x9cb6 no es resoluble por las vías rápidas. Defiero a witness vivo
con fixture de summon sólido (autorizado por el lead).**

## Vías intentadas y por qué NO cierran

1. **Dump estático de `load_seg:0x9cb6`** (probe `probe_9cb6_dump.py`): kernel+overlays
   comparten CS = load_seg (0x0824). Volqué 0x0824:0x9600-0x9e00 → **los bytes en 0x9cb6 son
   TODO 0x00** (no es código). ⇒ 0x9cb6 NO está en el CS principal. Coherente con el techo del
   disasm (ULTIMA.EXE.asm sólo cubre 0x0000-0x86ee; 0x9cb6>0x86ee → **seg2**, base de runtime
   distinta y desconocida sin la tabla de segmentos de la EXE).
2. **Rebase MAINOUT `(0x9cb6+0x81D0)&0xFFFF = 0x1E86`**: examiné 0x1E86 en ULTIMA.EXE.asm →
   es una rutina **GETSTRING/entrada de texto** (lee chars, maneja backspace 0x8 / ESC 0x1b /
   Enter 0xd, eco 0x16ba), NO un picker de celdas. ⇒ la fórmula MAINOUT NO aplica a los
   overlays CAST2/COMSUBS; el rebase correcto de esos overlays a la EXE es otro (desconocido).
3. `0x9cb6` **no es local** a CAST2 (acaba en 0x11be) ni a COMSUBS (0x145e) → es un símbolo
   kernel de seg2.

## Lo que SÍ está firme (de mi witness #5 previo, `witness-summon-position.md`)

La ESTRUCTURA del picker está derivada del ASM de los callers (no del cuerpo de 0x9cb6):
- daemon-cast `CAST2:0x04c2`: bucle de HASTA 8 intentos; cada intento = `call 0x9cb6` (pick
  local al caster, radio 8 cast / 5 scroll) + `0x9b96` (pasable) + `0x6222` (libre==0xFF).
- COMSUBS:0x0260: 1 intento del mismo picker.
- Tras colocar: `0x8326`/`0x6506` (makeEnemy) consume **1 rand0(7)** de velocidad.
El nº de rands DENTRO de `0x9cb6` por intento (¿1 rand para x, 1 para y? ¿rand con reintento
interno?) es lo que falta — es el cuerpo de seg2 no barrido.

## Cómo cerrarlo (para la sesión con fixture de summon sólido)

- **Vía live-BP fiable**: arma BP en kernel `0x2092` (rand_range, fiable) y dispara un summon
  en combate (Kal Xen Corp del jugador, o la posesión Sword-of-Chaos 0x023e que auto-summona
  daemon). Cuenta los hits de rand entre la entrada a la rutina de summon y el spawn (0x8326),
  leyendo la pila (SS:SP) para atribuirlos al frame del picker. El bloqueo es SÓLO disparar el
  summon (el fixture #44 no clava el cast apuntado/summon todavía).
- **Vía tabla de segmentos**: resolver la base de runtime de seg2 (de la cabecera de
  ULTIMA.EXE o del mapa de relocación) → leer/desensamblar 0x9cb6 desde RAM en la base
  correcta y contar los `e8` a rand estáticamente (como intenté, pero en el segmento bueno).

## Evidencia
- Probe: `re/notes/probe_9cb6_dump.py` (dump load_seg:0x9600, salida `dump_9cb6.json` = ceros
  en 0x9cb6). ASM: `re/disasm/ULTIMA.EXE.asm:1e38-1ea8` (getstring, NO picker). Callers:
  `re/disasm/CAST2.OVL.asm:517-569`, `COMSUBS.OVL.asm:248-269`. Ver `witness-summon-position.md`.
