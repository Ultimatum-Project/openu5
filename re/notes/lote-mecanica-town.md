# LOTE DE MECÁNICA pre-ventana (#54) — rama RETENIDA `fix/lote-mecanica-town`

Rama que **NO aterriza** hasta que el lote entero pague UNA sola ventana de re-sello.
Piezas: **(e)** pezuña · **(f)** cadencia NPC montado · **(g)** TPK de Stonegate · **#32**
esquife · (#48 clase-movimiento y #52 flag-SL van aparte pero al mismo lote).
Protocolo: **derivación reportada ANTES de escribir cada fix**. Corpus 28/28 `.asm`.

---

## (e) pezuña 1×/2× — DERIVADO

### ★ Corrección a la cita de partida: `0x433E` NO es «el golpe de pezuña»
Es un **emisor de secuencia de tonos genérico** del kernel: empuja `(1, 0x19, 0x3e8)` →
`call 0x223c`, luego `(1, 0x14)` → `call 0x20c8`, etc. Y tiene **10 call-sites en 6
overlays** — BLCKTHRN (3), CAST2, ENDGAME, MAINOUT (2), SJOG, TOWN (2). Un sonido compartido.

⇒ **Lo específico de la pezuña es el CALL-SITE, no la rutina.** Nombrar 0x433E «pezuña» en
el ledger sería un nombre-marcador equivocado (familia de `frontier-placeholder-names`).

### El mecanismo, en el sitio correcto
En la rutina de MOVIMIENTO de pueblo, tras aplicar el paso:
```
0810-081a: g_party_x += dx ; g_party_y += dy
081e:      g_unk_24e6 = 1              ; turno consumido
0823:      al = [g_transport_tile] & 0xFE
0828:      cmp al, 0x12                ; ¿caballo? (0x12/0x13)
082a:      jne 0x82f                   ; a pie → salta
082c:      call 0x433E                 ; ★ GOLPE EXTRA, sólo montado
082f-0835: call 0x52e                  ; el paso normal…
```
…y **`0x52e` contiene el otro call-site, `0x617`**, que se ejecuta SIEMPRE.

⇒ **1× a pie (0x617) · 2× montado (0x082c + 0x617).** Confirmado por barrido: los ÚNICOS
dos call-sites de TOWN.OVL a 0x433E son exactamente esos dos.

Resolución del sesgo: `call 0xffffc16e` con base TOWN `0x81D0` → `(0xc16e+0x81D0)&0xFFFF =
0x433E` ✓ (cuadra con la cita del lote 1 de frontera-24).

### El port: HUECO DE SFX, acotado
El port **sí** tiene cue de paso — `sfxEvent("move-step")` en `game.ts:1018` — pero lo emite
**una sola vez siempre**, sin la duplicación montada. No hay cue de pezuña separado (censo de
#38: 0 de `pezuñ|hoof|clop`).

⇒ **Ticket de SFX**, familia del cue de la gota del lote-D. **Radio mínimo**: el cue es
presentacional, no toca estado ni RNG.

### PENDIENTE antes de escribir el fix
Falta comprobar si **MAINOUT** repite el patrón (tiene 2 call-sites, `0x4c8` y `0x52d`): si
uno está gateado por caballo, el fix es overworld+pueblo; si no, sólo pueblo. **No escribo el
fix hasta cerrarlo** — sería inventar el alcance.

---

## (f) cadencia de NPC — DERIVADA

Las tres patas del hallazgo («turnos alternos · T congela · Q mitad») son **tres puertas
consecutivas de la MISMA cadena**, dentro del bucle de actualización de NPC. Todas saltan al
mismo destino **`0x1686` = este NPC NO actúa este turno**.

```
161f: cmp [g_transport_tile], 0x12 ; jb  0x1642   ┐ rango [0x12,0x16) =
1626: cmp [g_transport_tile], 0x16 ; jae 0x1642   ┘ caballo 0x12/0x13 + alfombra 0x14/0x15
162d: cmp [bp-6], 0x20             ; je  0x1642   ← EXCEPCIÓN (ver abajo)
1633: cmp [bp-4],1 ; sbb ax,ax ; neg ax           ← TOGGLE: ax = ([bp-4] < 1) ? 1 : 0
163b: [bp-4] = ax
1640: jne 0x1686                                  ← ★ MONTADO: salta uno de cada dos
1642: cmp [g_time_spell], 0x54 ; je 0x1686        ← ★ «T»: CONGELA (salta SIEMPRE)
1649: cmp [g_time_spell], 0x51 ; jne 0x165f
1650: cmp [bp-0xe],1 ; sbb ax,ax ; neg ax         ← TOGGLE
165d: jne 0x1686                                  ← ★ «Q»: MITAD (uno de cada dos)
```

- El idiom `cmp X,1 / sbb ax,ax / neg ax` es un **toggle** (`ax = NOT X` para 0/1): el estado
  vive en la variable de pila y se invierte en cada pasada ⇒ mitad de cadencia, no aleatorio.
- **Montado incluye la ALFOMBRA**, no sólo el caballo: el rango es `[0x12,0x16)`. Ojo, es más
  ancho que el `&0xFE==0x12` de (c)/(e), que era caballo puro.
- Los dos toggles son **variables distintas** (`[bp-4]` montado, `[bp-0xe]` Quickness), así
  que **se componen**: montado + Quickness ⇒ dos filtros encadenados.
- `g_time_spell` 0x54 = congelación total, 0x51 = mitad.

⏸ **PENDIENTE antes del fix**: la excepción `[bp-6] == 0x20` (salta el filtro de montado y
cae directo a la puerta de `g_time_spell`). Hay que identificar qué es `[bp-6]` — si es el
índice/tipo de NPC, algún NPC se mueve a ritmo normal aunque vayas montado. **No escribo el
fix sin eso**: sería inventar una excepción o borrarla.

---

## Solapamiento 0x13A5 (apuntado, de #38-h)
`game.ts:4586` usa `DS:0x13a5` como **tabla de Y de spawn del Shadowlord por location**,
mientras que el hallazgo (h) del lote 7 la cita para el **veneno de pantano**. O el hallazgo
apunta a otra tabla, o hay solapamiento. **Queda declarado**; se resuelve si (f)/(g) se
cruzan con ella.

---

## Estado de las piezas
| pieza | derivación | fix |
|---|---|---|
| (e) pezuña | ✅ salvo el alcance MAINOUT | ⏸ pendiente del alcance |
| (f) cadencia NPC montado (0x161F/0x1642) | ⏳ | ⏸ |
| (g) TPK Stonegate (0x0FA0-0x1037) | ⏳ | ⏸ |
| #32 esquife (prólogo `[bp-2]=0` + consumidor) | ⏳ (parcial heredado) | ⏸ |
