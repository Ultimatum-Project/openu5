# La ALFOMBRA y las gárgolas del Palacio: no es inmunidad, es el DOBLE de velocidad

Carril `gargolas-alfombra` · 2026-08-25 · sobre main `ccf4327a`. Origen: pregunta del
usuario jugando («con la alfombra voladora, ¿las gárgolas saltan de la pared?») + testigo
de vídeo aportado (**walkthrough de Lord Fenton, cap. 23, ~4:04-4:12**: la party cruza la
azotea del Palacio MONTADA en la alfombra y las dos gárgolas no se mueven de su hornacina).

Continúa [gargolas-hostiles-palacio.md](gargolas-hostiles-palacio.md) (la rama 'a' de
`npc_engine` y el ai=6), que dejó sin tocar la pregunta del transporte.

**Veredicto en una línea:** el transporte **no aparece en NINGÚN predicado** de la cadena de
persecución/ataque del NPC — montado en alfombra las gárgolas despiertan, persiguen y traban
combate exactamente igual; lo único que cambia es la **CADENCIA** (`TOWN 0x161F`: montado en
caballo **o alfombra**, la cola de NPC corre uno de cada dos turnos), y eso basta para
dejarlas atrás si no te paras. **El fotograma de Fenton no instancia la diferencia**: en él
la party está en una casilla donde las gárgolas están geométricamente clavadas **también a
pie**. El port es **FIEL** en las cinco piezas careadas (§5); sin cableo.

---

## §1 — El gate del ai=6 no lee el transporte (censo con control positivo)

`NPC.OVL:0x0d76-0x0d8f`, el handler compartido por los aiType 3 y 6, transcrito entero:

```
0d76: mov al,[g_party_x] ; sub ah,ah ; push ax
0d7c: mov al,[g_party_y] ; push ax
0d80: mov bx,[bp-2]                    ; bx = 0x5F5E + idx*16 = registro VIVO del NPC
0d83: push [bx+2] ; push [bx+4]        ; x,y VIVOS del NPC (no el puesto del horario)
0d89: call 0x6a0                       ; Manhattan
0d8c: cmp ax,4 ; jge 0xdac             ; >= 4 → epílogo (quieta)
0d91: push [bp+6] ; push [bp+4] ; call 0x6e4   ; < 4 → acercarse
```

Cuatro empujes: dos globales de posición del party y dos del registro vivo. **Ningún byte
de transporte.** Y no es sólo el handler:

| fichero / tramo | refs a `g_transport_tile` (símbolo) | por patrón de bytes `7c58` |
|---|---:|---:|
| **`NPC.OVL` ENTERO** | **0** | **0** |
| `npc_engine` TOWN 0x1352-0x1420 | **0** | **0** |
| `town_attack_engine_commit` TOWN 0x09BC (17 instr., sin rama) | **0** | **0** |
| `COMBAT.OVL` + `COMSUBS.OVL` enteros | **0** | **0** |
| `TOWN.OVL` entero (control positivo) | 23 | 23 |
| `ULTIMA.EXE` entero (control positivo) | 8 | — |

El censo-cero no es ciego por tres vías: (a) el mismo símbolo resuelve 23/23 en `TOWN.OVL`
y 8 en `ULTIMA.EXE`; (b) la búsqueda por **bytes crudos** (`7c58` = DS 0x587C little-endian)
da el MISMO cardinal en ambos ficheros, así que no depende del simbolizador; (c) dentro del
propio `NPC.OVL` el símbolo hermano `g_party_x` sí resuelve, y exactamente en los dos sitios
esperados (0x0d46 del ai 4 y 0x0d76 del ai 3/6).

⇒ **Hipótesis (a) del encargo REFUTADA**, y con ella (b) y (d): ni el NPC, ni el consumidor
del marcador, ni el commit de combate urbano miran el transporte. La única lectura de
`g_transport_tile` en toda la entrada a combate es `ULTIMA.EXE:0x623a`
(`and al,0xf8 / cmp al,0x20`) y es la **arena del BARCO** — la alfombra cae al `jne 0x6268`
y elige arena por el terreno bajo el actor, como a pie. Y `COMBAT.OVL` no lo lee en absoluto:
**el combate ni sabe que vas montado, y el tile de transporte sobrevive intacto a la pelea**
(vuelves a la alfombra al salir).

Corolario del `g_char_anim_states+2/+3`: el fast-path de adyacencia de `0x06e4`
(`0x070c-0x0723`) mide contra ese par, no contra `g_party_x/y` — pero es un **snapshot de la
posición del party** escrito el mismo turno en `TOWN 0x160D-0x161C`, tres instrucciones
antes de la puerta del §2. No introduce dependencia del transporte.

## §2 — Lo que SÍ cambia: `TOWN 0x161F-0x1640`, el privilegio de ir montado

En el bucle principal de pueblo (`TOWN 0x141E`), justo antes de la cola de NPC:

```
160d-161c: [g_char_anim_states+2..4] = g_party_x / g_party_y / g_floor   ; snapshot
161f: cmp [g_transport_tile],0x12 ; jb  0x1642   \ MONTADO = [0x12,0x16):
1626: cmp [g_transport_tile],0x16 ; jae 0x1642   / caballo 0x12/0x13 + ALFOMBRA 0x14/0x15
162d: cmp [bp-6],0x20 ; je 0x1642                ; ★ la TECLA es ESPACIO (pasar) → excepción
1633: cmp [bp-4],1 ; sbb ax,ax ; neg ax          ; ax = NOT [bp-4]  (x∈{0,1})
163b: mov [bp-4],ax ; or ax,ax ; jne 0x1686      ; ★ uno de cada dos turnos: SALTA
1642: cmp [g_time_spell],0x54 ; je 0x1686        ; 'T' (Time-stop) congela SIEMPRE
1649: cmp [g_time_spell],0x51 ; …toggle [bp-0xe] ; 'Q' (Quickness) = mitad
165f: call 0xc78                                 ; guard/horse wander
1662-166e: (result<2) push g_hour ; call 0xfffff8e2   ; npc_tick_all  ← la IA de los NPC
1671-1683: gate marcador ; push … ; call 0x1352       ; npc_engine   ← el ataque adyacente
```

Lo que el salto a 0x1686 se lleva por delante son **las tres llamadas** del tramo
0x165F-0x1683: el wander de guardias/caballos, `npc_tick_all` (donde vive el `0x0d76` del §1)
y `npc_engine` (donde vive el «Attacked!»). Es decir: en el turno saltado las gárgolas **ni
se mueven ni pueden atacar**.

Tres detalles que cambian el resultado y no son obvios:

- El rango de «montado» es `[0x12,0x16)` — **más ancho** que el `and al,0xfe / cmp al,0x12`
  de caballo puro que usan el (K)limb (0x0b94) y el sonido de casco (0x0607/0x0823, §7).
  **La alfombra entra aquí.** Quien reutilice el predicado de caballo se deja fuera justo el
  caso de la pregunta.
- `[bp-4]` se inicializa a 0 UNA vez en el prólogo (0x1429), **antes** de la cabeza del bucle
  0x142C ⇒ persiste entre turnos y **el primer turno montado de la visita ya salta**.
- La excepción de la tecla 0x20 es la válvula anti-exploit: **pasando no puedes esquivarlos**.
  `[bp-6]` es la tecla del `getkey` (0x1492 `call 0xdc4` → 0x1495 `mov [bp-6],ax`).

⇒ Montado **la party va al doble de velocidad que los NPC de pueblo**, exactamente la misma
mecánica (y la misma forma en el asm) que el hechizo Quickness — y compuesta con él, porque
usan variables distintas.

## §3 — 🔴 La trampa del testigo: el fotograma de Fenton no instancia la diferencia

Fotogramas extraídos del fichero local `original/av-referencia/yt/lordfenton/23-…Castle
Blac.webm` (gitignored; los timestamps son la cita), 3 fps:

| t | pantalla | lectura |
|---|---|---|
| 4:04 | party sobre alfombra (sprite sentado sobre tapiz cian) en el centro; dos gárgolas blancas a (−2,−1) y (+2,−1) | party (15,19) z=3, gárgolas en su puesto (13,18)/(17,18): Manhattan **3** |
| 4:05 | party una fila arriba, **entre** las dos gárgolas, muro gris a izquierda y derecha, rastrillo dos filas arriba | party **(15,18)**: Manhattan **2** a cada una |
| 4:05-4:12 | la party se queda ahí rebuscando en el inventario; las gárgolas **no se mueven** | — |

El mapa de la azotea (`smallmaps.json` id 18, z=3) explica el fotograma **sin** la alfombra:

```
fila 17, x=12..18:  27 27 50 44 50 27 27
fila 18, x=12..18:  52 57 54 44 55 57 53     ; 57 = las dos hornacinas; 44 = la party
fila 19, x=12..18:  50 44 44 44 44 44 50
```

El paso de la rama 0x0884 de `0x06e4` es **estrictamente mejorante**:
`0x0884 mov bx,[bp-0x20] / 0x0887 mov ax,[bp-4] / 0x088a cmp [bx],ax / 0x088c jge 0x854`
descarta empates y peores, y `0x08f1 cmp [bp-0x18],-1 / jle 0x92f` **sale sin mover** si
ninguna candidata mejoró. Desde (13,18) las cuatro vecinas, con su bit del bitmap canónico de
pasabilidad `DATA.OVL@0x54E4` leído en crudo (MSB-first; 1 = bloquea):

| vecina | tile | byte del bitmap | bit | |
|---|---|---|---|---|
| (12,18) | 0x52 CastleParapet3 | 0xff | 1 | bloquea |
| (14,18) | 0x54 CastleParapet5 | 0xff | 1 | bloquea |
| (13,17) | 0x27 Roof1 | 0x01 | 1 | bloquea |
| (13,19) | 0x44 BrickFloor | 0x72 | 0 | **libre** |

Con la party en (15,18) la única libre da distancia **3** contra la **2** actual ⇒ **no hay
paso**. Y eso vale **igual a pie**.

★★ Lección: el fotograma pasa con las dos hipótesis contrarias («la alfombra las inmuniza» y
«la geometría las clava»), así que no adjudica ninguna. La medida que separa es la MISMA
escena **a pie** — familia de
[[el-testigo-elegido-hace-pasar-al-aserto-con-el-codigo-roto]].

## §4 — La alfombra DENTRO del Palacio: sí vuela, y sobre qué

- **Se puede desplegar en pueblo**: el gate del (U)se Magic Carpet es `g_location < 0x21`
  (`CAST.OVL 0x1862`; en mazmorra «Not here!») + a pie. Loc 18 pasa.
- **Prefijo «Fly »**: `TOWN 0x05C4` (`and ax,0xfc / cmp ax,0x14` → DS 0x266C `"Fly "`), el
  mismo eco que se lee en todos los fotogramas de Fenton.
- **Pasabilidad**: el mover de pueblo llama `TOWN 0x077F call 0xffffaa7c(terreno,
  g_transport_tile)` = el MISMO kernel `ULTIMA.EXE:0x2C4C` del sobremundo; la alfombra es
  **clase 2** (class-table DATA.OVL 0x5504, idx 0x14>>2=5) → handler `0x2C80`:
  `terreno<4 ∨ (terreno&0xF0)==0x60 ∨ bitmap walkable`. ⇒ **cruza el foso**, pero **NO vuela
  sobre muros ni almenas**: la azotea se recorre por las mismas casillas que a pie (y por eso
  Fenton se come varios «Blocked!»). Derivación previa:
  [carpet-b2.md](carpet-b2.md) · [etiqueta-0x1c-acta.md](etiqueta-0x1c-acta.md) §2.
- **Dos privilegios de pueblo que la alfombra SÍ tiene** (censo completo de las 23 lecturas
  de `g_transport_tile` en `TOWN.OVL`): la trampilla 0x8C no la traga
  (`0x0F6B and al,0xfe / cmp al,0x14 → salta la caída`) y el pantano no la envenena
  (`0x1056` exige `g_transport_tile==0x1c` para el tick de veneno). Y uno que **no**: el
  (K)limb — pero el que lo prohíbe es el **caballo** (`0x0B94 and al,0xfe / cmp al,0x12` →
  «Klimb--On foot!»), no la alfombra, que por eso puede subir a la azotea.

## §5 — Careo del PORT: FIEL en los tres puntos

| pieza del binario | port | veredicto |
|---|---|---|
| gate ai=6 sin transporte (`0x0d76`) | `NpcManager.chaseStep` — sólo `location/floor/manhattan<4` | ✅ |
| paso estrictamente mejorante + «sin candidata no me muevo» (`0x088c jge`, `0x08f1 jle`) | `chaseMove`: `if (d < bestDist)` y `if (best)` | ✅ |
| cadencia montado `[0x12,0x16)` + excepción ESPACIO (`0x161F-0x1640`) | `townNpcTailRuns` (loops/turn.ts) — ya cableado, con el rango ancho y la excepción | ✅ |
| combate sin transporte (`COMBAT.OVL` 0 refs; sólo la arena de barco `0x623a`) | `arenaForActorAttack` por terreno; `state.transportTile` intacto al entrar y salir | ✅ |
| alfombra en pueblo: gate `<0x21`, «Fly », clase 2 | `useMagicCarpet` + `isPassable(...,"carpet")` | ✅ |

**Sin divergencia y sin defecto: no hay cableo en este carril.** Lo que faltaba era el
TESTIGO de la composición (la cadencia estaba probada suelta en `town-npc-cadence.test.ts`,
y la persecución suelta en `npc-aitype4-persigue.test.ts`, pero nadie ejercía las dos juntas
sobre la escena real del Palacio).

## §6 — Medición en vivo (dos instrumentos independientes, mismo resultado)

**(a) Navegador** — `re/tools/gargolas_alfombra_probe.mjs` (playwright + vite en 52xx,
deep-link `?loc=18&floor=3&x=..&y=..`, `state.transportTile` escrito por `__u5test`).
Capturas en el carril; posiciones leídas del estado vivo:

| caso | t1 | t2 | t3 | t4 |
|---|---|---|---|---|
| **E — a pie**, (15,21)→N×4 | (13,18)/(17,18) | (13,19)/(17,19) | **(14,19)/(16,19)** | (15,19)/(16,19) |
| **F — alfombra**, ídem | (13,18)/(17,18) | (13,19)/(17,19) | **(13,19)/(17,19)** | (13,19)/(17,19) |
| **C — a pie**, quieto en (15,18) | sin mover | sin mover | sin mover | sin mover |
| **D — alfombra**, quieto en (15,18) | sin mover | sin mover | sin mover | sin mover |
| **A — a pie**, ESPACIO en (15,19) | (13,19)/(17,19) | **combate + ranura fuera** | — | — |
| **B — alfombra**, ESPACIO en (15,19) | (13,19)/(17,19) | **combate + ranura fuera** | — | — |

C/D reproducen el fotograma de Fenton **con los dos transportes** (la trampa del §3). E/F son
la diferencia real: a pie cierran a la diagonal en t3, en alfombra se quedan un paso atrás y
en t4 la party ya está a distancia 4 y se apagan. A/B: **pasando, la alfombra no te salva** —
combate en el mismo turno que a pie, y `transportTile` sigue en 0x14 durante y después.

**(b) Vitest** — `game/tests/gargolas-alfombra.test.ts` (5 casos): la premisa (fila 18/19 del
mapa real + las dos ranuras de `npcs.json` en crudo), la subida a pie, la subida en alfombra,
el **control de la trampa** (misma escena con los dos transportes) y la excepción del ESPACIO.
Corre `townTurn` de verdad con el `NpcManager` real; los esperados son los de la tabla de
arriba, escritos antes de correr.

Mutantes (predicción escrita antes de aplicarlos): **M1** borrar la rama de montado de
`townNpcTailRuns` · **M2** estrecharla al `&0xfe==0x12` de caballo (la trampa que el propio
docstring avisa) · **M3** `chaseMove` sin la comparación contra la distancia actual (moverse
al vecino menos malo) · **M4** ignorar `passCommand`. Resultado medido (con su control de
«mutante aplicado», un `grep -c` por mutante): **los cuatro MUEREN** — M1, M2 y M4 tumban 1
caso cada uno (la subida en alfombra los dos primeros, el del ESPACIO el último) y **M3
tumba 2** (el control de la trampa y la subida en alfombra).

## §7 — Lo que esta acta NO hace

- No adjudica el `call 0xffffc16e` que el caballo dispara al moverse por pueblo (TOWN 0x0607
  y 0x0823): resuelve a `ULTIMA.EXE:0x433E` = dos `noise_burst` (0x3E8 y 0x5DC, dur 0x19) con
  un `0x20C8(0x14,1)` en medio — el **casco**; el port no lo emite y queda Clase C de
  presentación, sin efecto sobre esta pregunta.
- No mide el privilegio de cadencia **fuera** de pueblo: `TOWN 0x161F` es del bucle de pueblo;
  si el sobremundo tiene un equivalente para montado, no se buscó.
- No toca la pregunta hermana de la ranura 1 (`0xb5` ai 0 en (15,13) z=3), que es decorado
  quieto y no entra en esta cadena.
