# Escena de acampada (H)ole up & camp — brief para fase 2 visual

Derivación asm de la ESCENA de campamento que el port NO pinta (reporte del usuario
2026-07-15: "el fuego de campamento donde duerme la party, con o sin guardia, y donde
aparece el Avatar"). Las MECÁNICAS ya están portadas como eventos (aparición 25%,
emboscada 1/64/h, watch count, heal — ver `re/notes/camp-ambush-spec.md`,
`oracle-camp-event.md`, `game.ts::camp/campSleepStep/campWake`). Lo AUSENTE es sólo el
PINTADO. Este documento es el brief citable para el implementer de la escena (task #28).

**Veredicto:** el original SÍ monta una escena al acampar; el port sólo emite
"Zzzz..." + timer de reloj + SFX de la aparición + mensajes sobre el mapa normal
(`main.ts` startCamp, `skin/fiel/speaker.ts` apparition-*). Escena = presentación pura
(Clase C): el único `rand` del montaje está gateado por status y no toca el stream.

---

## 1. Dispatch — el prólogo de `camp()` elige montaje (CMDS.OVL 0x002d-0x0061)

```
002d: test [bp+8], 2          ; flag&2 del contexto de camp
0031: je   0x5e               ; flag&2 CLARO  → 0x5e
0033-0054: mapTile = mapa[party] ; (sólo si flag&2 puesto)
0058: call 0x7C3E (arg0=0, mapTile)  ; escena de TERRENO (arena por bioma) — mazmorra
005b: jmp  0x61
005e: call 0x6936             ; ESCENA DE PARTY sobre el mapa actual — overworld a pie
0061: g_cmb_actor = 0xff
```

`0x6936` = `(0xBF80+0xa9b6)&0xFFFF` (call `0xffffa9b6` en 0x5e; regla de wrap de CMDS,
`oracle-camp-event.md §aritmética`). El **camp de overworld a pie** tiene `flags=0x0004`
(RAM viva, `oracle-camp-event.md §D`) ⇒ `flag&2=0` ⇒ **vía `0x6936`**, NO carga arena
separada: explota el party como actores individuales SOBRE el mapa actual. La vía
`0x7C3E` (flag&2 puesto) es el otro contexto (terreno/mazmorra) y sí es un montaje de
arena. La emboscada, si dispara, entra a combate en la arena **CampFire** (BRIT.CBT idx
0) — ver `camp-ambush-resolution.md §3`.

---

## 2. `0x6936` (kernel ULTIMA.EXE, línea disasm 11119) — el montaje de la escena

Función que puebla el array de actores de escena/combate `0xba14` con la party en
formación de campamento. Anatomía:

**a) Limpia 32 slots de actor (0x696d-0x69cc).** Zera `0xba14`+ y los campos paralelos
`0x5c5a..0x5c61` (tile/estado/dir por actor), stride 8, 32 entradas.

**b) Por cada miembro del party (loop 0x69da-0x6b7b), idx `bp-4` = 0..g_party_size-1:**
- `69e1`: si roster status (`[idx<<5 + 0x55b3]`) == 0x44 ('D', muerto) → **skip** (0x6b6e).
- `69f0/6a02`: si el **anillo equipado** (`[idx<<5 + 0x55c5]`) == 0x2a (42, Invisibility) o
  0x2c (44, Regeneration) — *corregido 2026-07-28: esto NO es un «marcador de status»; es el
  byte de anillo (kernel-sweep-4 §MISLABEL 18-07 + ring-expiry-derivation.md); el rand de
  abajo es la EXPIRACIÓN 1/16 «A ring has vanished!»*
  → arma `bp-0xe`; entonces (0x6a13-0x6a4b) **`rand(0,15)`** (call 0x2092) y si ==0xb
  imprime `DS 0xa422` + efecto (0x43ae timer/anim + 0x6e60). ⚠️ **ÚNICO rand del
  montaje**, y **gateado** por ese marcador — un party sano NO lo consume ⇒ el montaje
  es 0-RNG en el caso normal (presentación pura, no altera el stream de camp).
- `6a52/6a59`: **posición de formación** — X = `[idx + 0x1724]`, Y = `[idx + 0x172c]`.
- `6a60-6a73`: `kernel_spawn_actor 0x6506(idx, kind=1, X, Y, g_floor)` → coloca el actor;
  el SPRITE se deriva del TIPO/clase (no del byte crudo), mismo patrón que la emboscada
  (`camp-ambush-resolution.md §1`).
- `6a8f-6b02` + jump-table `cs:[bx + 0x6b04]` sobre la clase-letra (`[idx<<5 + 0x55b2]`,
  'A'..'T'): fija el tile de **cara/dirección** del actor en `0x5c5a` = 0x40 / 0x44 /
  0x48 / 0x4c (las 4 orientaciones del sprite de party).
- `6b52`: si roster status == 0x53 ('S', dormido) → `0x68ae`; else `0x6794` (finalize
  por-miembro: la variante 'S' es la pose DURMIENDO — el party se pinta tumbado).

**c) Objeto especial / HOGUERA (0x6b7e-0x6bb8), gateado por `g_unk_adb9==0xdc`:**
`kernel_spawn_actor 0x6506(1, kind=2, x=5, y=5, g_floor)` con el sprite calculado de
`g_floor` (`al = floor*3+7`, 0x6bad) → coloca la **hoguera** cerca del centro-arriba de
la formación; luego `g_unk_adb9 = g_unk_bb15` (consume el flag, una vez).

### Tablas de formación (DATA.OVL, regla `fileoff = DS+0x10`; cross-validadas: la tabla
de emboscada adyacente DS 0x1734→fileoff 0x1744 = `29 14 15 18 16 19 24 14`, byte-exacta)

| slot | 0 | 1 | 2 | 3 | 4 | 5 | (6,7) |
|------|---|---|---|---|---|---|-------|
| **X** (DS 0x1724 / fo 0x1734) | 5 | 4 | 6 | 3 | 5 | 7 | 0,0 |
| **Y** (DS 0x172c / fo 0x173c) | 7 | 8 | 8 | 9 | 9 | 9 | 0,0 |

⇒ 6 miembros en **semicírculo/V** en la mitad inferior de la ventana (X 3..7, Y 7..9),
con la **hoguera en ~(5,5)** por encima. Los 2 últimos slots (0,0) no se usan (party
máx 6). Coordenadas en la rejilla de la ventana de juego (mismo espacio que la arena de
combate 11×11).

---

## 3. Estado del port y qué falta pintar

- **Modelado (correcto):** `game.ts::camp` → `campSleepStep` (emboscada por hora, orden
  de rands exacto) + `campWake` → `campHoleUp`/`campApparition` ("An apparition!" + cura
  total + status='G' + level-up + SFX). La piel conduce los pasos para hacer VISIBLE el
  paso del tiempo (`main.ts` startCamp timer).
- **Ausente (esta tarea):** el PINTADO de la escena — party como 6 actores en la
  formación de §2, cada uno con su cara/dirección y la pose DURMIENDO (status 'S' →
  0x68ae), la HOGUERA en ~(5,5), y la figura de la aparición cuando cruza el gate 25%.
  Hoy el mapa se queda en la vista normal del overworld.

## 4. Brief para el implementer (task #28)

1. Al entrar a camp (overworld a pie), montar una vista de escena que coloque los 6
   miembros vivos en `(X[idx], Y[idx])` de §2, con el sprite de su clase y la pose
   correcta (dormidos salvo el de guardia), + la hoguera en ~(5,5). Reusa la infra de
   pintado de actores de arena/combate del port (la misma que la emboscada CampFire y
   las dungeon rooms).
2. Animar el paso de las horas SOBRE esa escena (ya hay timer en `main.ts`); NO alterar
   el orden de rands del core (patrón #71: pintar no muta el core — aquí trivial, el
   montaje es 0-RNG salvo el `rand(0,15)` gateado por status '*'/',' que el core no
   modela).
3. La aparición (25%) pinta su figura + el discurso; los SFX ya existen
   (`apparition-materialize/arpeggio/heal-chime/chord`).
4. Clase C fino (cadencia/layout exacto de la pose, timbre): adjudicar con testigo de
   vídeo en la ventana visual conjunta.

**Autoridad:** asm (CMDS 0x002d, kernel 0x6936, DATA.OVL fo 0x1734/0x173c). El vídeo del
usuario NO captura una emboscada (evento ~10%/noche) pero SÍ el campamento normal — usar
como testigo de la formación/pose en fase 2.
