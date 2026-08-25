# Careo PORT-SIDE de las dos conductas medidas por #343 — giro-primero y gate 0x1260

Carril careo-fragata (cabo declarado por fix-343, fichado por el lead). La derivación
empírica vive en [testigo-remolino-343.md](testigo-remolino-343.md) §2 y en
[remolino-282-acta.md](remolino-282-acta.md) §9 — aquí NO se re-deriva: se carea el
PORT contra ella, con las citas del binario re-verificadas en crudo sobre
`re/disasm/MAINOUT.OVL.asm` (y `CMDS.OVL.asm` donde se indica).

## 1. Giro-primero de la fragata — el port era fiel EN EL GRUESO y divergía en el prólogo

Las DOS piezas del binario, verificadas instrucción a instrucción:

- **`transport_face` 0x016A** (clases 0x20 Y 0x24 — también arriada): si el facing del
  TILE cambia, imprime «Head <rumbo>» y devuelve 1; `outdoor_move` hace `or ax,ax` en
  sus cuatro call-sites (0x04F6/0x0549/0x0563/0x057D) y con ≠0 salta a 0x0592 SIN
  mover: **el giro consume el beat**. Esto el port YA lo modelaba
  (game.ts `navalMove`: rama izadas `virado` → `headMessage` + `runNavalTurn` sin paso;
  rama arriada vía `shipFacingStep` transport.ts + guarda `step.turned && !avanza`).
  Por eso #343 fabricó la corrida 4 con t=0x25 «ya encarada al Este»: para ejercitar
  el remo SIN giro-primero.

- **Prólogo de `outdoor_move` 0x0496-0x04B3** (SÓLO clase izadas: 0x0499
  `and al,0xfc / cmp al,0x20 / jne 0x4b8`): compara la TECLA con `g_sail_dir`
  (0x049F-0x04A4) y **sólo si difieren** escribe el rumbo (0x04AC) **y** resetea el
  drift ctr (0x04AF, `g_unk_5883`=0) — el `je 0x4b3` de 0x04A7 salta AMBOS juntos.
  **El gate es el RUMBO, no el facing del sprite.** El port escribía `sailDir`
  incondicional y ataba el reset del ctr a `virado` (el facing) ⇒ divergía en los dos
  bordes donde rumbo y facing se despegan:
  1. tecla≠rumbo con facing ya igual (estado post-dock/collision, que ponen
     `g_sail_dir=0` en 0x0306 dejando el sprite encarado): el binario re-arma el rumbo
     y pone ctr=0; el port dejaba el ctr rancio → la deriva siguiente disparaba un
     beat antes.
  2. tecla==rumbo con facing distinto: el prólogo se salta entero (ni escritura ni
     reset); el port reseteaba el ctr en la vira.

  Fix: game.ts `navalMove`, prólogo calcado con el predicado del binario
  (`SAIL_DIR[dir] !== sailDir` → escribe + ctr=0), reset quitado de `virado`.

## 2. Gate 0x1260 del turno del remolino — el port succionaba INCONDICIONAL

`monster_hits_special_tile` 0x1248, verificado en crudo: tras reconocer al remolino
(0x125A `and al,0xfc / cmp al,0xec`), **0x1260 `cmp byte [g_transport_tile],0x1c /
jne 0x126e`** — compare EXACTO al byte 0x1C:

- t==0x1C → `call damage_ship` (0x1267) y FUERA (0x126A `jmp 0x1313`): el actor NO se
  borra (0x1277/0x127B no corren), NO hay "WHIRLPOOL!" (0x127F), NO hay teleport
  (0x12B2-0x12C0). Y `damage_ship` gatea `(t&0xF8)==0x20` en 0x10A4 (sólo fragata),
  con el `rand(1,30)` de 0x10B8 DETRÁS del gate ⇒ con 0x1C la llamada es un no-op SIN
  tirada. Conducta neta medida por #343: **el contacto no hace nada y el remolino
  sigue vivo**.
- t≠0x1C (fragata, esquife, alfombra 0x14/0x15, e incluso 0x1D) → la vía completa.

El port (game.ts `outdoorWorldTurn`) succionaba incondicional en cuanto `isWhirlpool`
— y el contacto de `chase` (enemies.ts) se decide ANTES de `canEnter`, así que un
remolino clavado en una casilla de agua junto a la orilla arrastraba al Underworld a
una party A PIE (t=0x1C), imposible en 1988. Fix: el gate calcado
(`transportTile === 0x1C` exacto) delante del borrado/mensaje/teleport.

## 2-bis. Hallazgo de la verificación JUGANDO — el damage_ship de la succión NO estaba

La verificación en vivo del control positivo (fragata succionada) salió con **hull 99
INTACTO** — y el testigo de #343 midió `damage_ship` en las TRES reubicaciones
(99→75, 86→61, 99→75). El §4 de [remolino-282-acta.md](remolino-282-acta.md) daba
la vía del turno del remolino por «ya portada», y era cierto para mensaje + teleport +
borrado del actor — pero `whirlpoolRelocate` sólo escribe la posición y NADIE llamaba
al daño. Portado en este carril, calcando el cuerpo 0x109E desde el call-site 0x12AF:

- gate 0x10A4 `(t&0xF8)==0x20`: sólo la FRAGATA tira `rand(1,30)` (0x10B8) — esquife
  y alfombra salen por 0x1160 SIN tirada (⇒ una tirada NUEVA del stream sólo en la
  succión de fragata; remolinos en tours del espejo: 0, censado arriba);
- daño < casco → `sub` (0x10CB); daño ≥ casco (0x10C6 `jae 0x10D6`) → hundimiento
  (`sinkPlayerShip`, casco intacto — transport.md §7E) y el teleport de 0x12B2 corre
  igual después.

Verificado jugando tras el fix: hull 99→78 con el stream vivo (`live-3`).

## 3. Cabo para el lead — la ETIQUETA de t=0x1C (no adjudicado aquí, a propósito)

El encargo y el §2 del testigo llaman a t=0x1C «la ALFOMBRA» (medido: con t=0x1C la
party CRUZA agua profunda). Pero en crudo, verificado aquí mismo:

- el board de la alfombra escribe **0x14** (`CMDS.OVL` 0x0890
  `mov byte [g_transport_tile],0x14` — la cita que le faltaba a `board()` en
  transport.ts:682, ahora verificada), y
- `transport_face` rama alfombra escribe **0x14/0x15** al virar E/O (MAINOUT
  0x013D/0x014A).

Es decir: el byte que el propio binario escribe al abordar/virar la alfombra NO es
0x1C — y el port llama a 0x1C `TILE_FOOT` con sus propias derivaciones (tabla de
verbos de transport_face «resto 0x1C sin verbo» 0x0129; gate a-pie del troll 0x1C01;
sincronizador 0x53B8). Las dos observaciones de #343 (cruza agua + gate del remolino)
son hechos medidos del ESTADO t=0x1C, cualquiera que sea su etiqueta; la
implementación de este carril calca el PREDICADO (`==0x1C`), que es correcto bajo
cualquiera de las dos lecturas. Queda para el lead adjudicar la etiqueta (¿qué estado
del juego produce t=0x1C cruzando agua — y la pasabilidad a pie del port sobre agua
diverge ahí?): eso exige re-medir en el binario vivo, fuera del alcance de este careo.

> **CABO CERRADO (carril etiqueta-0x1C, 20-08 — [etiqueta-0x1c-acta.md](etiqueta-0x1c-acta.md)):
> t=0x1C = A PIE.** Censo completo de escritores (los cuatro de 0x1C son X-it y
> Blackthorn), kernel 0x2C4C (clase 7 = bitmap que BLOQUEA el agua; el vuelo de la
> alfombra es privilegio de la CLASE de 0x14/0x15) y réplica en vivo de la corrida 2.
> El «cruza agua» del testigo era un artefacto de esa corrida; la pasabilidad a pie
> del port (`info.walkable`) NO diverge. El gate 0x1260 se lee «a pie no te traga».

## 4. Guardas

- `game/tests/giro-primero-0496.test.ts` — 5 asertos vivos (Game entero, esperados en
  crudo): careo izadas/arriada + los DOS bordes del prólogo (estrenados en ROJO sobre
  el port pre-fix, que es exactamente el mutante de cada uno).
- `game/tests/remolino-gate-1260.test.ts` — control positivo (fragata reubica a
  0xFF/(0x22,0x12) con "\nWHIRLPOOL!\n" y actor borrado, acota la ventana K),
  t==0x1C (estrenado en ROJO: nada de eso ocurre y el remolino sigue), y t==0x1D
  (compare exacto; mutante `&0xFE` ejecutado y muerto).
- Ventana de sellos censada ANTES de tocar: 0 tours del espejo con vela izada
  (`Hoist`/`Head <dir>`: 0 en routes/ y routes-ad/), 0 con WHIRLPOOL; el remo
  (Rowing: 11+13 tours) no se toca. Ningún reloj de tour se mueve.
