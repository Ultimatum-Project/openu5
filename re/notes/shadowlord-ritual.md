# El ritual de los Shadowlords — derivación (F1.10-T5)

Clímax de la trama: destruir a los tres Shadowlords. Máquina de estados derivada
byte a byte de CMDS.OVL (convocatoria) y CAST.OVL (ritual). Strings/tablas de
DATA.OVL por la fórmula canónica `fileoff = DS_off + 0x10` (dataovl-strings.md).

🔴 **«SIN RNG» ERA FALSO Y SE RETIRA** (#249; medido por `shadowlord-av-243`, 13-08).
Este párrafo decía: «SIN RNG. Ni la convocatoria (CMDS 0x1030) ni el ritual
(CAST 0x15b4) tiran el rand del juego … Por eso NO hay escenario de paridad de RNG
para esta task». **La premisa es cierta y la conclusión no.**

- Lo que SIGUE EN PIE: ningún `call` **DIRECTO** de 0x1030 ni de 0x15b4 es el RNG.
  Los de 0x1030 son 0x7964 (buscar slot de objeto libre) y 0x7af4 (colocar objeto);
  los de 0x15b4 son efectos AV (0x6212 tono / 0x70f2 sacudida / 0x7b66 pausa /
  0x75a2 explosión / 0x842e / 0x83e8 fanfarria — rótulos corregidos en #201) +
  lectura de tile (0x770e) + los dos thunks 0xbb9e/0xbb92.
- 🔴 Lo que es FALSO: el ritual **sí mueve `g_rng_seed`, por el grafo de llamadas**.
  `screen_shake_fx` (el destino de 0x70f2 = kernel `ULTIMA.EXE:0x3072`) llama a
  `rand_range` (`kernel 0x2092`, que muta `g_rng_seed` en 0x5420) **1.856 veces por
  invocación** — 8 pasadas × 4 bucles × 58 iteraciones, aritmética sobre las cotas
  literales del cuerpo (`0x309b-0x315d`), no un recuento en ejecución. El ritual la
  invoca **tres** veces (0x169d/0x16a0/0x16a3) ⇒ **5.568 tiradas por ritual**.
- Y se consumen **con el sonido apagado**: la bandera `[0xa9ce]` se comprueba DENTRO
  de `set_tone` (0x22e2), después del `rand_range`. Clase de #94.
- `noise_burst` (0x223c) NO cuenta: usa un LFSR propio en `[0x545c]`, no `g_rng_seed`.
  Las siete explosiones no mueven el stream; **sólo el temblor**.

⇒ **SÍ hay ventana de RNG en esta task.** Quien porte el temblor con fidelidad tiene
que decidir qué hace con esas 5.568 tiradas, y esa decisión desalinea cualquier
medición de paridad que cruce la escena. Familia de #33 («en el binario dibujar no es
sólo-lectura») y de [[leer-en-orden-de-fichero-supone-la-caida]]: el error que escondió
esto fue leer la lista de `call` de la rutina y **no seguir el grafo**.
Derivación completa en `shadowlord-av-243.md` §3.1-3.2.

## Índice canónico y emparejamiento (POSICIONAL, sin tabla de indirección)

idx 0/1/2, fijado por los tres `switch(idx)` de CAST.OVL. `idx = z&3` al recoger
el shard (F1.10-T3); en el (U)se, `idx = itemId - 0x1d` (CAST 0x1a2f).

| idx | Shard (0x15c5)  | Llama (0x1682) | Shadowlord (0x1728) | Yell name (0x444a) | doom-bit (0x4892) |
|-----|-----------------|----------------|---------------------|--------------------|-------------------|
| 0   | Falsehood...    | Truth!         | Faulinei            | FAULINEI           | 0x02              |
| 1   | Hatred...       | Love!          | Astaroth            | ASTAROTH           | 0x04              |
| 2   | Cowardice...    | Courage!       | Nosfentor           | NOSFENTOR          | 0x08              |

⚠ CORRECCIÓN: el clon tenía Astaroth↔Nosfentor **intercambiados** (Hatred→Nosfentor,
Cowardice→Astaroth). El asm (0x1728) y la tabla de nombres (0x444a) confirman
Hatred→Astaroth, Cowardice→Nosfentor. Corregido en shadowlords.ts + ritual.ts.

## Salas de la Llama y posición del ritual (CAST 0x162f, DATA.OVL)

Tablas byte-exactas indexadas por idx (X DS 0x4882, Y DS 0x4886, loc DS 0x488a,
tabla floor DS 0x488e = {2,1,0xFF}). Las tres salas son KEEPS (mapas 32×32), no mazmorras:

| idx | location            | (x, y)  | floor byte | floor (clon) |
|-----|---------------------|---------|------------|--------------|
| 0   | 30 The Lycaeum      | (15, 9) | 0x02       | 2            |
| 1   | 31 Empath Abbey     | (15, 3) | 0x01       | 1            |
| 2   | 32 Serpent's Hold   | (15,16) | 0xFF       | -1 (sótano)  |

**floor 0xFF = -1 SIGNED = el sótano (z=-1) de Serpent's Hold** (smallmaps.json:
Serpent's Hold floors [-1,0,1]). El clon almacena `position.floor` con signo. NO
es inalcanzable; es grado A.

**Validación independiente (assets/maps/smallmaps.json):** la Llama (tile 0xDE)
está EXACTAMENTE una casilla al norte de la posición del ritual en las tres salas:
Lycaeum (15,8) / Empath (15,2) / Serpent's Hold (15,15). El ritual (party_y-1) mira
esa casilla; ahí se convoca el Shadowlord.

## Convocatoria — (Y)ell nombre (CMDS.OVL 0x1418 → 0x1030)

El handler de (Y)ell 0x1418: en FRAGATA (transport&0xf8==0x20, location<0x80) iza/
arría velas (0x142c, = yellSails ya portado); si no, imprime "what?" (DS 0x4529) y
lee una palabra (0x7b9c, máx 0x1e) → 0x1458. Para location 1..0x20 llama a 0x1030
(convocatoria); location 0 → 0x12c8 (yell del overworld, fuera de alcance T5).

**0x1030 (convocatoria):**
1. Gate de sala: `g_location` ∈ {0x1e,0x1f,0x20} (0x103d); fuera → 0x11f4 → imprime
   "\nNo effect!\n" (DS 0x443c).
2. Empareja la palabra con la tabla de nombres DS 0x444a (punteros a
   FAULINEI/ASTAROTH/NOSFENTOR) vía el helper 0xffffaf9e (substring-toupper, mismo
   patrón que el mantra de Blackthorn). Sin match → "No effect" (DS 0x440b).
3. `g_party_y >= 2` (0x106f; el SL se coloca en y-2). Falla → "No effect".
4. Ese Shadowlord vivo: `[0x58c8+idx] != 0xff` (0x1076). Muerto → "No effect".
5. No hay ya un tile 0xFC en la tabla de objetos 0x5c5a (0x109b). Ya presente →
   "No effect" (DS 0x4418).
6. Éxito (silencioso): `g_shadowlord_here (0x58cb) = idx` (0x10bd) + coloca objeto
   tile 0xFC en (party_x, party_y-2, floor) vía 0x7af4 (0x10c6-0x10e4).

## Ritual — (U)se Shard (CAST.OVL dispatcher 0x1a2c → 0x15b4)

`shardIdx = itemId - 0x1d` (0x1a2f). Los tres shards son items 0x1d/0x1e/0x1f.

**0x15b4:**
1. Imprime "Gem Shard\n\nThou dost hold above thee the evil Shard of " (DS 0x4794)
   + nombre-shard (DS 0x47cc/0x47d9/0x47e3). **Siempre**, antes de cualquier gate.
   [+ 0x6212 = `tone_sweep`, BUCLE de 460 llamadas (0x15dd-0x15fc) con el 4º argumento
   `start` de 2000 a 25000 de 50 en 50 — AUDIO, no animación; corregido #201.]
2. Check de posición (0x162f-0x1654): `party_x/y/location/floor` == las cuatro
   tablas [idx]. Si no → "\n\nNo effect!\n" (DS 0x47f0) [+ SFX 0x842e] y `ret`.
3. Imprime "\n\n...and cast it into the Flame of " (DS 0x47fe) + nombre-llama
   (DS 0x4822/0x482a/0x4831). [+ SACUDIDA de viewport 0x70f2 ×3 (cero args) entre DOS
   PAUSAS 0x7b66(7) y 0x7b66(3) — corregido #201: NO es «un SFX», son dos RESPIROS.]
4. Lee tile en (party_x, party_y-1) vía 0x770e (0x16ad-0x16be). Si != 0xFC (0x16c1)
   → `ret` SIN más texto (0x175c). Luego `[0x58cb] == shardIdx` (0x16c9-0x16ce); si
   no → `ret` sin más texto.
   [+ flash 0x75a2 ×7 sobre la casilla.]
5. DESTRUCCIÓN (0x1708):
   - `[0x58c8 + idx] = 0xff` (g_shadowlord_locs; 0x170b).
   - `[0x57b6 + idx] = 0` (g_shard_taken; **consume el shard**; 0x1710).
   - `[0x5bca] |= [0x4892+idx]` (bitmap de doom = 0x02/0x04/0x08; 0x171d).
   - Imprime "\nThe doom of the Shadowlord " (DS 0x483b) + nombre (DS 0x4858/61/6a)
     + " is wrought!\n" (DS 0x4874). [+ pausa 0x83e8.]

## Flujo completo (estado intermedio, "cómo se encadenan")

El SL se convoca en `party_y - 2` pero el ritual lo exige en `party_y - 1`. La
Llama está en (15, ritualY-1). Por tanto el jugador GRITA desde una casilla al sur
de la casilla del ritual (p.ej. (15,10) en el Lycaeum) → el SL manifiesta EN la
Llama (15,8); el jugador PISA la casilla del ritual (15,9) → el SL queda al norte;
(U)se el Shard → destruido. No requiere IA de movimiento del SL (el desfase 2↔1 lo
cubre el paso del jugador). Confirmado por la geometría del mapa.

## Strings byte-exactos (DATA.OVL, file = DS+0x10)

```
0x4794 "Gem Shard\n\nThou dost hold above thee the evil Shard of "
0x47cc "Falsehood..."   0x47d9 "Hatred..."   0x47e3 "Cowardice..."
0x47f0 "\n\nNo effect!\n"
0x47fe "\n\n...and cast it into the Flame of "
0x4822 "Truth!\n"       0x482a "Love!\n"     0x4831 "Courage!\n"
0x483b "\nThe doom of the Shadowlord "
0x4858 "Faulinei"       0x4861 "Astaroth"    0x486a "Nosfentor"
0x4874 " is wrought!\n"
0x4529 "what?\n:"  (prompt de Yell)   0x4531 "Nothing\n" (input vacío)
0x440b / 0x4418 / 0x443c "\nNo effect!\n"  (fallos de convocatoria)
0x43ef "FAULINEI"  0x43f8 "ASTAROTH"  0x4401 "NOSFENTOR"  (nombres a gritar)
```

## Clase C / AV (efectos no-lógicos, catálogo audiovisual, no fabricados)

- 🔴 CORREGIDO #201 (base 0xBF80 → ULTIMA.EXE; cuerpos leídos; nombres careados contra
  `routine-census.json`). Los rótulos de esta lista eran FALSOS en TRES de cinco:
  · 0x6212 → `tone_sweep` (0x2192): **AUDIO**, no animación. 🔴 Y tampoco es una sirena:
    el pitch de esa primitiva es `inc/65536·SR` = CONSTANTE (aquí inc=0xa50 fijo en las 920
    llamadas). Lo que barre 2000→25000→2000 es `start`, el umbral del PWM = el DUTY, o sea
    el TIMBRE. Modelo derivado y refutado por espectro de dos testigos en `speaker.ts:112-142`
    — quien lea «sube y baja» como frecuencia repite el modelo viejo.
  · 0x70f2 → `screen_shake_fx` (0x3072): **SACUDIDA DE VIEWPORT** ×3, cero args — no
    «pulsos de la Llama». El port ya la tiene como `CombatFx kind:"quake"`.
  · 0x7b66 → (0x3ae6): **PAUSA de n fotogramas** (redraw + espera calibrada), con n=7 y
    n=3 — no un SFX. El port ya la modela como `pauseUnits` (`game.ts:1354`).
  · 0x75a2 → `explosion_fx_at_cell` (0x3522): correcto — tile 0 (`Explosion`) +
    `noise_burst(2000,3000,10)` + `viewport_redraw`, ×7 sobre (party_x, party_y−1).
  · 0x83e8 → `sfx_victory_fanfare` (0x4368): **la fanfarria de la VICTORIA**, no una
    «pausa final» (cuerpo leído por cola-cast, acta §6; la comparte con COMBAT tras
    «VICTORY!»).
  Presentación pura: no tocan globales ni RNG.
- Sprite del SL convocado: el objeto lleva tile 0xFC (sentinela de "Shadowlord
  presente", ya reconocido por el clon en An Tym, cast.ts). Su render byte-exacto
  como el sprite ShadowLord (tileset 0x1FC) es capa de presentación (Clase C).

## Punteros para T6 (Shadowlords errantes por pueblos)

- `g_shadowlord_locs` (0x58c8) también lo lee TOWN 0x02cc/0x127f y OUTSUBS 0x05ae:
  la "presencia" de un SL en un pueblo (la merma de la Falsedad, F1.7-T4, ya
  cableada) y el spawn/announce/effect urbano (cuerpos town ~L3995/4121/4128 sin
  leer). El re-roll de errantes a medianoche (0x5004) ya está portado (F1.1-T3).
- `g_shadowlord_here` (0x58cb, este task) es DISTINTO de la merma de tienda, que
  usa `g_shadowlord_here_idx` (0x5958, shops.md §0.3) — no confundir.

## ALIASING del doom-bit 0x5bca ↔ g_npc_dead_bitmap (hallazgo del reviewer T5)

El OR del doom-bit (CAST 0x171d `or word ptr [0x5bca], ax`, ax = 0x02/0x04/0x08
por SL destruido) NO escribe en una palabra "doom" independiente: `0x5bca`
**aliasea estructuralmente** dentro de `g_npc_dead_bitmap` (base 0x5B5A = roster_off
+0x5B4, 32 locations × 32 NPCs, 4 B/loc, MSB-first; re/ledger/globals.json).
`0x5bca − 0x5B5A = 112 = 28×4` → es la palabra baja del campo de la **location 28
= Windemere** (smallmaps id 28). Los bits 0x02/0x04/0x08 caen en ese campo de
"NPC muerto".

- **Hoy no falta conducta**: ningún overlay del corpus LEE 0x5bca (grepeado); el
  gate de endgame del clon usa `questFlags` (shadowlord-dead), no este word. Por
  eso el clon lo modela como `state.shadowlordDoomBits` aparte (efecto derivado
  preservado, no leído).
<!-- [tarea #35 (2026-07-27): DESAMBIGUACIÓN, esta línea NO es la pregunta de
     «¿Shadowlord matable en combate normal?» de content-audit §ÁREAS ítem 6 (yo mismo las
     confundí al listarla como dudosa en censo-auto-infiel.md). Lo de aquí es el ALIASING
     del doom-bit dentro del bitmap de NPCs muertos de Windemere: sigue ABIERTO y va de
     efectos colaterales del formato de save. El ítem 6 quedó REFUTADO por censo de
     escritores de `g_shadowlord_locs` (DS 0x58C8): sólo el ritual CAST 0x170b escribe
     0xFF, el errante de medianoche ULTIMA.EXE 0x5044 está guardado por `cmp 0x80/jae` y
     sólo escribe 1..8, y COMBAT.OVL no toca esos bytes. Ver la anotación en
     content-audit.md ítem 6. -->
- **A COMPROBAR EN T6** (posible bug-for-bug del original): si los NPCs de Windemere
  cuyos bits toca el OR (según el orden MSB-first exacto — confirmar cuáles de los
  slots ~1-3 corresponden a 0x02/0x04/0x08) son personajes REALES con diálogo,
  entonces matar un Shadowlord los marcaría "muertos" en Windemere. Verificar con
  el .NPC de Windemere (loc 28): si esos slots tienen dialog/type reales, el alias
  es un artefacto observable del formato de save que hay que PORTAR (no arreglar);
  si están vacíos, el OR es inerte. BP DOSBox: matar un SL y leer el bitmap de
  Windemere + hablar con sus NPCs antes/después.
