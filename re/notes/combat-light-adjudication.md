> **⚠️ SUPERSEDED por `combat-light-verdict.md` (2026-07-15).** Tercera lectura ciega
> + witness runtime (g_location=0xFF durante todo el combate, 8 lecturas incl. un hit
> del compositor 0x5910) refutan la premisa central de esta nota: el combate corre
> `loc=0xFF` (≥0x80), toma la rama DIRECTA de 0x5910 (copia cruda sin máscara), y el
> flood 0x5A28 NUNCA se alcanza. **NO hay censura por luz en combate.** El error fue
> asumir `loc<0x80` en combate sin verificar el bracket 0x5F86 ni el gate `loc≥0x80`.
> Conservada como registro histórico; para el veredicto y el fix del port ver
> `combat-light-verdict.md`.

# Adjudicación — ¿censura por luz en la PANTALLA DE COMBATE? (task #33, SCOUT)

**VEREDICTO: SÍ.** El original censura la arena de combate 11×11 exactamente igual
que el mundo: usa el MISMO compositor con LOS/luz (`kernel 0x5910` → `0x5D0A` →
flood `0x5A28`), centrado en la celda del **combatiente cuyo turno es**, con radio =
`g_light_level` ambiental (2 de noche, 0x32=50 de día, 0x12=18 con Light, 0x0A=10 con
antorcha). NO es "fiel tal cual": el port muestra la arena entera siempre, lo cual
coincide con el caso de día / antorcha (radio ≥ 11 cubre toda la arena) pero
**diverge de noche sin luz** (el original deja a negro todo salvo un rombo alrededor
del activo). No es regresión (el clon nunca censuró), pero es infidelidad de combate
nocturno.

> **Convención de offsets.** `COMBAT.OVL`/`COMSUBS.OVL` = fileoff del OVL;
> `kernel 0xNNNN` = offset de imagen de `ULTIMA.EXE.asm`. Las llamadas near de
> COMBAT al kernel se resuelven `real = (base0 + load_seg*16) & 0xFFFF` con
> **load_seg(COMBAT) = 0x0A29 ⇒ LB = 0xA290** (`command-dispatch.md §2`,
> `seg2_resolve` verificado: COMBAT `0x8670→0x2900`; y `combat.md §0`: "CS = fileoff
> + 0xA290"). Nombres reconciliados contra `re/ledger/globals.json` + las notas
> `ui-render-map.md`, `kernel-flood-0x5a28.md`, `flood-adjudication.md`, `combat.md`.

---

## 1. El único mecanismo de censura y por dónde se alcanza

La censura de "negro" del juego es **el flood de visibilidad `kernel 0x5A28`**
(Moore 8-conexo, radio = `light+1`; `kernel-flood-0x5a28.md`, `flood-adjudication.md`
task #23). Tiene **exactamente 2 call-sites en todo el corpus**:
`0x5D61` (dentro de `0x5D0A`, pase de la PARTY) y `0x5F57` (dentro del emisor
`0x5E4A`, pase de FUENTES DE LUZ). `0x5D0A` a su vez sólo lo llama **`0x5910:0x5987`**
(el compositor). Por tanto **la censura a pantalla sólo ocurre a través de la rama LOS
del compositor `0x5910`**.

`kernel 0x5910` (leído 5910-5a27) ramifica por `g_location`:

```
5954: cmp byte[g_location], 0x80
5959: jb  0x595e         ; loc < 0x80  → rama LOS/flood (CENSURA)
595b: jmp 0x59f8         ; loc >= 0x80 → copia directa 0xAD14→0xAB02 (SIN máscara)
595e: cmp byte[g_unk_24e6], 0
5963: je  0x5992         ; 24e6==0 → relleno manual (preserva la máscara existente)
5965: mov al,[g_light_level] ; push light
      ...push (g_party_x - g_chunk_origin_x), (g_party_y - g_chunk_origin_y), 0x0B...
5987: call 0x5D0A        ; → flood 0x5A28  (recomputa la máscara de visibilidad)
```

Nota: la rama `loc<0x80` con `24e6==0` (relleno manual, 0x5992) tampoco revela: sólo
rellena celdas cuya máscara `[-0x54FE]==0` — **preserva** el negro. La ÚNICA rama que
revela la arena entera sin máscara es `loc≥0x80` (copia directa 0x59f8).

## 2. El combate compone la arena por `0x5910` (no por una rutina propia)

`combat_main_loop` (COMBAT:0x0B94) al arrancar hace (0ba6-0baf):

| COMBAT base-0 | +LB | kernel real | qué es |
|---|---|---|---|
| `call 0xB680` (0ba6) | +0xA290 | **`0x5910`** | **compositor con LOS** (dibuja la arena) |
| `call 0x8670` (0ba9) | +0xA290 | `0x2900` | `kernel_status_redraw` (línea de estado; mislabel histórico "panel") |
| `call 0x7886` (0bac) | +0xA290 | **`0x1B16`** | **flush del buffer de teclado BIOS** (0x40:[0x1A]/[0x1C]=0x1E), NO redibujo |
| `call 0xDBFA` (0baf) | +0xA290 | `0x7E8A` | stub kernel→overlay (recuento de vivos, en [0x7A16,0x81C6)) |

**Corrección a `combat-ui-spec.md §6`:** ese doc atribuye el "volcado de la arena" a
`0x7886`, pero `0x7886` resuelve a **`0x1B16` = flush de teclado** (leído 1b16-1b37:
`mov ds,0x40; mov word[0x1a],0x1e; mov word[0x1c],0x1e`). Sus 3 call-sites (0bac inicio
de bucle, 0d05 tras VICTORY!, 0d1f en la salida) descartan input en las fronteras del
bucle. **El redibujo real de la arena es `0xB680 → 0x5910`.** (El §6 confundió setup y
volcado; la conclusión de "sin animación de entrada" sigue valiendo — 0x5910 pinta de
golpe.)

Confirmación independiente de que el combate USA `0x5910`: el **flash de impacto**
`kernel_combat_hit_flash 0x3564` (combat-ui-spec §3) invierte el tile del objetivo y
**restaura llamando a `0x5910`** (`call 0x5910` en `0x35E1`). Es decir, cada golpe
repinta la arena por el mismo compositor con LOS.

## 3. El centro del flood = el COMBATIENTE ACTIVO (confirmación decisiva)

`combat_player_turn` (COMBAT:0x063E) copia, al empezar cada turno, la celda del
combatiente activo a `g_party_x`/`g_party_y` (0x0646-0x065C):

```
0646: mov al,[g_cmb_actor]          ; índice del activo
064d: shl si,3                      ; si = actor*8 (stride del registro DS:0xBA14)
0651: mov al,[si-0x45E6]  ; = [0xBA14 + actor*8 + 6] = combatant.x  (rec +6)
0655: mov [g_party_x], al
0658: mov al,[si-0x45E5]  ; = rec +7 = combatant.y
065c: mov [g_party_y], al
```

`g_party_x/y` es exactamente el CENTRO que `0x5910:0x596B-0x5982` empuja al flood. Así
que la visibilidad de combate se recomputa **centrada en quien tiene el turno**, radio =
`g_light_level`. (Prueba lógica adicional: si el combate usara la rama sin censura
`loc≥0x80`, fijar `g_party_x/y` al activo sería CÓDIGO MUERTO para el render — la copia
directa ignora la posición de la party. Que se fije confirma que corre la rama flood.)

## 4. El combate hereda `g_location` (<0x80) y `g_light_level` — sin override

- **`g_location`:** COMBAT.OVL/COMSUBS.OVL **no lo escriben** (0 stores; censo
  globals). En el kernel sólo hay 3 stores: `0x4841` (moongate), y `0x5FB4`/`0x6094`
  que son el **save/restore** de una rutina TEMPORAL (`0x5F86`: guarda loc→`g_unk_5894`,
  pone `loc=0xFF`, respalda sprites `0x5C5A→0xA9FC`, y **restaura loc en 0x6094** antes
  de volver; es un render de mapa completo puntual —aproximación/overview—, NO el bucle
  de combate). **Ninguna ruta deja `g_location≥0x80` de forma persistente para el
  combate.** Por tanto en combate `g_location` = valor de entrada: overworld = **0**,
  pueblos y salas de mazmorra < 0x80 ⇒ **rama LOS/flood**.
- **`g_light_level`:** sólo lo escribe el gestor `kernel 0x50A1` (leído 50a1-5145):
  `loc==0x19 ∨ g_floor>0x7F ∨ hour<5 ∨ hour>0x13 ⇒ 2` (noche/oscuro); `hour==5/0x13`
  ⇒ rampa amanecer/anochecer (tabla `[0x6A80+min/10]`); resto ⇒ **0x32=50** (día);
  Light spell ⇒ mín **0x12=18**; antorcha ⇒ mín **0x0A=10**. Al cambiar marca
  `g_unk_24e6=1` (dispara el recálculo del flood). El combate **no lo resetea** ⇒ usa la
  luz ambiental del momento de entrar.
- Buffers: mapa de combate en **DS:0xAD14** (`combat.md §1`), máscara/salida a
  **0xAB02 / `[-0x54FE]`** — los mismos que usa el compositor del mundo.
- Emisores de luz del propio `.CBT` (braseros/fogatas) añaden celdas iluminadas por el
  pase de emisor `0x5E4A` (wrappers `0x6350`/`0x6376`), igual que las luces del mundo.

## 5. Superficie vs mazmorra

**No divergen en el código de render.** Ambos combates mantienen `g_location < 0x80`
(overworld=0; DUNGEON/DNGLOOK fijan `g_location=0`) ⇒ misma rama LOS/flood, mismo
centro (activo), mismo `0x5A28`. Lo único distinto es la **fuente de luz**: hora del día
en superficie; antorcha / Light spell (y el centinela de mazmorra `g_light_level≥0x33`
que `0x50A1` no recalcula) bajo tierra. En la práctica:
- **Día** (radio 50): toda la arena 11×11 cae dentro del radio ⇒ sin censura visible
  (coincide con el port actual).
- **Noche sin luz** (radio 2): sólo ~2 celdas alrededor del activo ⇒ arena casi negra.
- **Antorcha** (radio 10) / **Light** (radio 18): arena visible otra vez.

## 6. Qué haría falta portar

El motor ya tiene el flood correcto: `game/src/core/world/visibility.ts::floodFOV`
(Moore, gate de flancos ya retirado en task #24). Para fidelidad de combate:

1. **Aplicar la MISMA visibilidad a la vista de combate** (`combatView.visibility` del
   snapshot, que E1-S12 ya reserva en `combat-ui-spec §8`): correr `floodFOV` sobre el
   buffer 11×11 de la arena, **centrado en la celda del combatiente ACTIVO**
   (`activeCombatant.cell`), radio = **nivel de luz ambiental** (mismo cálculo que el
   mundo: hora/antorcha/Light), MÁS los emisores de luz del mapa de combate.
2. La piel ya multiplica `tiles × visibility` (compositor del mundo reutilizado); basta
   con que el snapshot rellene `visibility` en combate en vez de dejarla toda visible.
3. Efecto neto: idéntico al actual de día/antorcha; sólo cambia el combate nocturno sin
   luz (que hoy el port muestra iluminado y el original deja a negro).

No abre divergencia deliberada nueva: es exactamente la LOS del mundo (regla dura #2)
aplicada al mismo buffer. El centro-en-activo y radio-ambiental son la única
particularidad, ya derivada arriba con cita.

## 7. Clase C (runtime-dependiente, no bloquea la decisión)

- Cadencia exacta de repintado por turno y si cada frame intermedio re-corre el flood
  (`0x5910` gate `g_unk_24e6`: flood si activo, relleno-preserva-máscara si no — **ambos
  preservan la censura**). No afecta al veredicto.
- Apariencia de píxel del borde de luz (idéntica al mundo). → píxel-diff task #26.
