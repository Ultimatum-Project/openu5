# Verificado: mazmorra — DUNGEON.OVL + DNGLOOK.OVL (Task 3.4)

Reglas re-derivadas del asm con citas (`re/notes/dungeon.md`) y portadas al clon
(`game/src/core/dungeon/{dungeon,light}.ts`) con tests. El arnés de paridad
`re/tools/dungeon_parity.py` cruza dos modelos INDEPENDIENTES del mismo evento —
la predicción asm-derivada en Python (`KernelRng` + reglas) y la reproducción del
core del clon (`game/src/core/__parity__/dungeon-run.ts`, `OriginalRng`) —
exigiendo que calquen ESTADO final Y semilla (misma filosofía que
test_rng_parity). Escenarios en `re/parity/dungeon/` (14).

## Estado de la verificación (2026-07-10)

VERDE: `re/tools/test_dungeon_parity.py` — 19 passed, 1 skipped (live opt-in).
- `KernelRng` (modelo Python del rand del kernel) casa con la inversa VERIFICADA
  `parity.rng_unstep` (re/notes/rng.md) para 6 semillas.
- Los 14 escenarios: la predicción asm-derivada y el clon coinciden en HP/estado
  de cada PJ, posición, planta, tipo de evento de salida **y semilla final**
  (stream de rand idéntico). Cubren: fuego, sueño/veneno (contest DEX), energía
  (bloqueo+daño), bomba, foso encadenado multi-nivel, las 4 fuentes, Klimb→salida,
  despertar de dormidos, **WRAP de bordes** y **contest DEX con un miembro muerto**
  (la tirada la consume también el muerto).
- Suite del clon `npm test -w game`: 484 passed (dungeon.test.ts reescrito a las  <!-- F.1 2026-07-11: total de la suite completa (484) -->
  mecánicas exactas: hoyo simple, fuentes reales, cofre).

## ✅(asm + cruce modelo↔clon) Mecánicas exactas — las 11 divergencias cerradas

Portadas con paridad de stream (KernelRng↔OriginalRng). Ver `re/notes/dungeon.md
§5,§6` para las citas asm:
- **Bordes = WRAP toroidal** (0x057a/0x0583): salir por un borde te lleva al lado
  opuesto de la fila/columna (antes el clon bloqueaba).
- **Campos por low-nibble** (orden REAL 0=sueño,1=veneno,2=fuego,3=energía).
  Sueño/veneno = **contest DEX** (`aflige si rand(1,30) ≥ DEX`), no daño plano;
  sueño limpia el tile, veneno no. La tirada la consume **cada miembro, incluidos
  los muertos** (sólo la escritura del status salta a los 'D').
- **Fuego / bomba** = `party_random_damage` (rand(1,8) a cada miembro vivo);
  bomba limpia el tile.
- **Campo de energía** = rebote (no entra) + rand(1,8) a CADA miembro; sólo el
  tile EXACTO 0x83 (antes: daño a 1 solo, y sub&7==3 aceptaba 0x8B).
- **Fuentes** por tile EXACTO (no sub&3; 0x59 → daño) sobre el PJ activo; el
  veneno escribe 'P' incondicional.
- **Foso** = caída de 1 nivel por foso, rand(1,8) por caída a cada miembro,
  **encadena**; atravesar el fondo (floor→8) sale al Underworld.
- **Despertar dormidos**: `rand(0,63) < 4` (1/16) por PJ dormido y turno.
- **Trampa de escalera ELIMINADA**: el binario no la tiene; Klimb no daña.
- **Salida**: Klimb up desde floor 0 → Britannia; down desde floor 7 →
  Underworld (regla `exit_dungeon` 0x1D08).

## ⚠️→formulado (asm-derivado, paridad runtime pendiente)

Reglas con cita asm pero SIN verificación runtime contra DOSBox (convención de
3.2/3.3). Se verificarán por otra vía:
- **Coste de tiempo en mazmorra** (§1): el asm no muestra `advance_clock` por
  paso normal; el clon no resta minutos por paso. Confirmar en runtime.
- **RNG del render** (§3): 0x111E consume 2×rand(0,100)/frame (flicker) salvo
  Time-stop; Look-0xC0 consume rand(0,255). El núcleo puro del clon NO renderiza
  por frame, así que EXCLUYE ese consumo del stream — **divergencia de alcance
  deliberada** (como el idle de survival §2 y el movimiento de IA de combate 3.2):
  la paridad de mazmorra se hace sobre eventos de trampa/campo/foso/fuente, cuyo
  stream sí se modela entero.
- **Monstruo errante** (§9): ~~spawn/IA/emboscada citados pero NO portados~~ **RETIRADO #327**
  — medido: `core/dungeon/wanderer.ts` (355 líneas) produce, `dungeon.ts` consume y
  `skin/coreview.ts` lo dibuja en el cono 3D. La fidelidad de su IA/emboscada sigue SIN medir
  (eso NO se retira). Texto original: citados pero NO portados al
  núcleo (excluido por alcance, como el movimiento de IA en 3.2).
- **Attack cambia-nivel** (§10, g_unk_58A0==5/6): semántica a verificar; no
  portado.
- **Muro especial 0xC0** (§8): el revelado exacto vive en SJOG Search (Task 3.9),
  no en DUNGEON/DNGLOOK. El clon conserva su modelo previo (nibble 0xD revelable
  por Search) para no romper la conectividad de datos; la reconciliación de
  nibble (0xC0 vs 0xD0) queda para 3.9.
- **g_grapple** (§4.4): permite Klimb-up sin escalera sobre celda visitada; no
  portado.

## Divergencia de alcance del canal de captura (paridad live)

`test_dungeon_state_parity_live` (opt-in `U5RE_LIVE=1`) queda como skip
documentado: teleportar la party a un grid sembrado y aislar el stream de rand
del render (flicker por frame) requiere un arnés dedicado. Las reglas están
ancladas por asm + el cruce modelo↔clon, que ya prueba la paridad del stream de
los eventos de juego (no cosméticos). Precedente: la exclusión del movimiento de
IA en `re/verified/combat.md`.
