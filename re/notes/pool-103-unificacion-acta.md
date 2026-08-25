# ACTA #103 — el pool 0x5C5A unificado: la tabla que el binario comparte y el port partía en tres

Carril `fix-103` (rama `fix/103-pool-unificado`, sobre main `12b29aab`). Sujeto: el
BINARIO (ULTIMA.EXE / SJOG.OVL / CAST.OVL / CAST2.OVL) re-derivado sobre este árbol, y
el módulo único del port que sustituye a las tres particiones. Actas madre:
`reciclado-ranuras-y-boca-de-doom.md` (§1-§3, la cascada), `objects.md` (la tabla),
`an-sanct-286-derivacion.md` §4 y `hechizos-inertes-319-cableado.md` §4.1 (las dos
ramas declaradas-bloqueadas que motivaron la subida de prioridad).

## 0. La geometría de la ficha, adjudicada

La ficha decía «23 slots de 0x5c5a, 11 call-sites, 5 overlays». Medido: los tres
números son de la CASCADA DE DESALOJO, no de la tabla — que tiene **32** ranuras:

- **32 slots × 8 B** en DS:0x5C5A (slot 0 = vehículo del jugador). Controles en este
  árbol: el barrido de An Sanct corre las 32 desde la 0 (`CAST.OVL:0x03e3
  mov di,0x5c5a` · `0x42c cmp word [bp-8],0x20`), el de An Grav-combate también
  (`CAST2.OVL:0x0886 mov di,0x5c5a` · `0x8d6 cmp si,0x20`).
- **23 slots** es la región que barre el ESCÁNER de reciclado (ULTIMA.EXE:0x3868):
  `0x3870 mov cx,1` … `0x38cf cmp cx,0x18 / 0x38d2 jl 0x3881` — slots 1..23. Las
  ranuras 24..31 (y la 0) son INVISIBLES para el desalojo.
- **11 call-sites en 5 overlays** para `acquire_actor_slot` (ULTIMA.EXE:0x38E4),
  reproducidos con instrumento (`re/tools/dispatch_table.near_calls_to_kernel`,
  §2). El escáner 0x3868 tiene CERO llamadores externos: sólo la cascada.

## 1. Derivación en crudo (releída de los .asm de este árbol)

### 1.1 El escáner (ULTIMA.EXE:0x3868, `ret 6`, args (lo, hi, cerca))

```
3870  mov cx,1 · si=0x5c62 (+0 del slot 1) · di=0x5c64 (+2) · [bp-0xc]=0x5c65 (+3)
3885  cmp ax,[bp+8] / jb skip      ; tile < lo
388a  cmp ax,[bp+6] / ja skip      ; tile > hi
388f  cmp al,0xb5 / je skip        ; la Corona, excluida SIEMPRE (rige en las 10)
3893  cmp word [bp+4],0 / je acepta  ; cerca==0: sin condición de ventana
389b  al = x − g_party_x + 5       ; BYTE sin signo
38a7  dl = y − g_party_y + 5
38b0  cmp al,0xa / ja acepta       ; un eje fuera de la ventana 11×11 basta
38b4  cmp dl,0xa / jbe skip
38c4  si/di/[bp-0xc] += 8 · inc cx · cmp cx,0x18 / jl bucle
38da  sub ax,ax                    ; sin acierto: devuelve 0
```

La ventana es aritmética de BYTE: `x−px = −6` da `0xFF > 0x0a` = «fuera» (la
asimetría del sin-signo), y basta UN eje fuera. El 0 de fallo es también el índice
del slot 0 — el centinela ambiguo de la ficha #50.

### 1.2 La cascada (ULTIMA.EXE:0x38E4), las DIEZ llamadas con su call-site

| # | call | (lo, hi, cerca) | qué desaloja |
|---|---|---|---|
| 1 | `0x38ef` | (0, 0, 0) | ranura LIBRE (tile 0) |
| 2 | `0x3905` | (0x01, 0x0f, 1) | objetos sueltos, fuera de pantalla |
| 3 | `0x391d` | (0x80, 0xff, 1) | monstruos/artefactos, fuera |
| 4 | `0x3935` | (0x10, 0x11, 1) | caballos sin jinete, fuera |
| 5 | `0x394d` | (0x30, 0x7f, 1) | personas, fuera |
| 6 | `0x3964` | (0x01, 0x0f, 0) | objetos sueltos, también en pantalla |
| 7 | `0x397b` | (0x80, 0xff, 0) | monstruos/artefactos |
| 8 | `0x3992` | (0x10, 0x11, 0) | caballos |
| 9 | `0x39a9` | (0x30, 0x7f, 0) | personas |
| 10 | `0x39bf` | (0x00, 0xff, 0) | CUALQUIERA (salvo la Corona, que excluye el escáner) |

Cortocircuito en el primer no-cero (`or ax,ax / jne` tras cada una); `ret` en
`0x39cb`. Coincide 10/10 con `reciclado-ranuras-y-boca-de-doom.md §1` (control de
reproducción a ciegas).

### 1.3 Los consumidores que estaban bloqueados, releídos

- **An Sanct, tabla de objetos** (`CAST.OVL:0x03de-0x0432`): barrido de las 32 desde
  la 0; `0x3e8 cmp byte [si],1` (kind cofre) · `0x3f2/0x3fb` vs
  `g_cmb_scratch_x/y` · `0x401 cmp [g_location],0x7f / ja 0x410` (en combate el
  check de planta `0x40b cmp [si+4],al` SE SALTA) · acierto `0x410 and byte
  [si+5],0x7f` (desarma, INCONDICIONAL — haya bit 0x80 o no) + `0x414 push 2` →
  jingle (`0x418 call 0xffffc186` → stub CAST2:0x0000, la resolución de #286 §0) +
  res 1; agotamiento → res 0. CERO RNG.
- **An Grav, combate** (`CAST2.OVL:0x0866-0x08e6`): `0x866 call 0x306` (cursor de
  apuntado; 0 = ESC → ret −1 mudo) · jingle 4 condicional (`0x872-0x87c`) · barrido
  de las 32 desde la 0 buscando `0x895 and al,0xfc / 0x897 cmp al,0xe8` (los campos
  0xE8-0xEB) en la celda apuntada (`0x8a2/0x8ad`) · acierto: **seis ceros +
  `push si` → `0x8c1 call 0x5894`** = `(0x5894 + 0xe1e0) mod 2^16 = 0x3a74` =
  `write_object_slot` ⇒ **BORRA la ranura entera** (+0..+5 a cero; a diferencia de
  An Sanct, que sólo toca el bit 7 del +5). Control positivo de la base 0xe1e0: los
  nueve pares de #319 §0 sobre este mismo overlay. ⇒ en el binario los CAMPOS de
  combate SON ranuras del pool.

### 1.4 write_object_slot y find_free_actor_slot

- `write_object_slot` ULTIMA.EXE:0x3A74: escribe +0..+5, deja +6/+7 (ya acreditada,
  `worldObjects.ts`). El borrado de An Grav-combate y el del (G)et (reciclado §3)
  son esta misma rutina con seis ceros.
- `find_free_actor_slot` SJOG.OVL:0x0000: 31→1, primer tile==0, jamás el 0.

## 2. El censo 11/5, reproducido con instrumento

`dispatch_table.near_calls_to_kernel(<overlay>, 0x38e4)` sobre los 24 overlays:

```
CMDS.OVL    0x0ff4, 0x10c0      MAINOUT.OVL 0x07fd, 0x0d33, 0x1021, 0x1bbd
LOOKOBJ.OVL 0x012c              SJOG.OVL    0x0422, 0x05bd
TOWN.OVL    0x0314, 0x1785      = 11 en 5 overlays
```

Idéntico al censo de `reciclado-ranuras-y-boca-de-doom.md §2` (que además los
nombra). Para 0x3868: cero externos.

## 3. Las TRES particiones del port, nombradas

1. `state.overworldEnemies` (`world/enemies.ts`) — errantes, slots 1..23, allocator
   propio (`firstFreeSlot` ascendente) que sólo veía su lista.
2. `state.worldObjects` (`world/worldObjects.ts` + state.ts) — estacionarios
   (naves/caballos/cofres/botín/trama), allocator propio 31→1, y en
   `Game.placeChestLoot` una TERCERA vista sintética (lista empaquetada, no ranuras).
3. NPCs de pueblo (`npc/manager.ts`, `NpcRuntime`) — su `slot` es el índice del
   fichero .NPC, NO la ranura del pool (la asigna `npc_place` TOWN.OVL:0x1785 vía la
   cascada al entrar).

Síntomas medidos de la partición (antes de este carril): `trySpawn` construía
`occupied` sólo con `this.enemies` (reciclado §5) ⇒ el spawn podía PISAR la ranura
de la fragata del slot 1; no existía camino de desalojo (los 5 valores de reciclado
§5 divergían); y las dos ramas de hechizo declaradas quedaban sin consumidor.

## 4. Qué se unificó (port)

**Módulo nuevo `game/src/core/world/actorPool.ts`** — único dueño de la semántica:
constantes en crudo (32/1..23/0xB5/ventana 5/0x0a), `findFreeActorSlot` (31→1),
`firstFreeRecycleSlot` (ascendente = llamada 1), `scanRecyclableSlot` (0x3868),
`ACQUIRE_CASCADE` + `acquireActorSlot` (0x38E4, tabla de 10 con call-site citado por
fila), `composeWorldPool` (la vista 32×8 del entorno vivo compuesta desde las
particiones, que asigna y PERSISTE ranura a quien no la traiga) y
`anSanctObjectSweep` (0x03de-0x0432).

Recableados a ese módulo (cada duplicado eliminado):

- `enemies.ts`: backfill y spawn sobre la vista compuesta — el spawn ya no pisa
  ranuras de objetos, y con el pool lleno DESALOJA por la cascada (víctima enemigo →
  fuera de la lista; víctima objeto → fuera de `worldObjects`). CERO RNG añadido.
- `worldObjects.ts::findFreeObjectSlot` → adaptador sobre `findFreeActorSlot`.
- `saveNative.ts`: los dos bucles inline (31→1 de `writeNativeWorldObjects`,
  ascendente de `writeEnemyTable`) → funciones del módulo. Codificación intacta.
- `Game.placeChestLoot`: la vista sintética empaquetada → `composeWorldPool` (el cap
  de 31 cuenta ahora RANURAS reales, los errantes dejan de ser invisibles a la
  colocación, y el botín nace con su `slot`).
- `Game.applyUnlockSpell`: **la rama de TABLA DE OBJETOS de An Sanct (#286 §4)
  PORTADA fuera de combate** — fall-through de la puerta al barrido, desarme
  `contents &= 0x7f` + `trapped=false`, "Success!"/"Failed!" por res.

## 5. Las dos ramas declaradas: qué queda EXACTAMENTE

- **An Sanct pueblo/exterior: DESBLOQUEADA y portada** (arriba). Su mitad de
  COMBATE no: el camino 0x398 con `g_location >= 0x80` barre el pool con el check
  de planta saltado, pero la ARENA del clon no comparte la tabla — sus actores
  viven en `Combatant[]` y no hay cofres-objeto en el modelo de arena. Falta: o
  bien absorber los actores de arena al pool (refactor de combate entero), o bien
  un adaptador de vista de arena; y cofres-objeto EN arena que hoy no existen.
- **An Grav combate (#319 §6): SIGUE SIN PODER PORTARSE, y ya no por el pool.** El
  barrido 0x0886 busca campos 0xE8-0xEB como RANURAS; en el clon `fieldWall` es
  no-op en combate (los campos no existen en la arena, cabecera de combat.ts) ⇒ no
  hay nada que disipar. Falta, POR ORDEN: (1) los campos 0xE8-0xEB en la arena
  (siembra por `cast_field_wall` rama de combate y persistencia como ranura u
  equivalente), (2) su pasabilidad/daño de terreno, y (3) entonces el barrido de
  0x0886 con el borrado por `write_object_slot` (seis ceros) es trivial sobre
  `actorPool`. El pool queda LISTO (el barrido y el borrado ya tienen primitiva).

## 6. Residuos declarados (con dueño propuesto)

1. **Partición 3 (NPCs)**: la vista compuesta NO los incluye — la ranura de pool de
   un NPC la decide el ORDEN de colocación de `npc_place` (TOWN.OVL:0x1785, cascada)
   al entrar al pueblo, y ese orden no está derivado (el `slot` de `NpcRuntime` es
   índice del .NPC). Consecuencia acotada: la vista en PUEBLO sólo lleva objetos —
   suficiente para An Sanct (los NPC no son kind 1) y para el save (los NPC no se
   escriben, objects.md O6); insuficiente para calcar `npc_place`/
   `town_place_shadowlord` (TOWN 0x0314), que siguen fuera.
2. **Desalojo de artefactos en pueblo** (Cetro/Shard/Amuleto/Shadowlord de reciclado
   §5): mecanismo ya disponible en el módulo, pero sus productores de pueblo
   (`npc_place`) no consumen la cascada mientras (1) siga abierto. La Corona ya
   queda protegida POR EXCLUSIÓN en el escáner (antes lo estaba por ausencia de
   desalojo — fidelidad vacua; ahora el mecanismo existe y la excluye).
3. **Los otros lectores/escritores del pool en el binario** (moongate CAST2:0x0eb6
   salva/vacía; ENDGAME/demo lo usan como tabla de actores de escena; COMBAT.OVL lo
   reusa entero en arena): fuera del alcance de este carril, sin cambio de estado.

## 7. Tests y estreno en rojo

- `pool-ocupacion-desalojo-103.test.ts` (4): ocupación compuesta (spawn y backfill
  saltan la ranura de la fragata) y desalojo con pool lleno (respeta ventana y
  bandas; la fragata banda-10 sobrevive; control de no-regresión del cap
  maxEnemies). **3 rojos conductuales pre-fix medidos** (slot 1 pisado ×2; sin
  desalojo: 23≠22).
- `an-sanct-pool-103.test.ts` (6): trampeado→Success+bit limpio · sin-trampa→Success
  (0x410 incondicional) · otra celda / otra planta / no-cofre / vacío → Failed.
  **2 rojos conductuales pre-fix** (los positivos; los cuatro negativos son
  controles que ya pasaban — los redimen los positivos del mismo fichero, patrón D5).
- `actor-pool-103.test.ts` (15): límite 23 (la 24 no se devuelve, la 23 sí) ·
  Corona nunca (banda propia y llamada 10) · ventana en byte sin signo (+5 dentro,
  +6 fuera, −6 fuera por wrap, un-eje-basta) · cascada (libre gana; banda antes que
  índice; fuera-de-pantalla antes que en-pantalla; fragata sólo llamada 10; todo
  Coronas ⇒ 0) · 31→1 y ascendente en crudo · vista compuesta (asigna/persiste,
  acota entorno) · barrido An Sanct (planta on/off = combate). Esperados EN CRUDO.
  Mutantes en §8.

## 8. Mutantes (corridos tras commitear la base `actorPool.ts`, cada uno revertido y
el revert verificado con `git status` limpio; población = los 3 ficheros -103, 25 tests)

| mutante | medido |
|---|---|
| `RECYCLE_SLOT_HI` 23→31 | **3 rojos**: límite-del-escáner · primer-hueco-1..23 · desalojo conductual |
| quitar la exclusión de la Corona (0x388f) | **3 rojos**: Corona-siempre · fragata-sólo-llamada-10 · todo-Coronas⇒0 |
| invertir la ventana (aceptar DENTRO) | **3 rojos**: ventana-en-byte · fuera-antes-que-dentro · desalojo conductual (respeta al de pantalla) |
| intercambiar llamadas 1↔2 de la cascada | **1 rojo**: «con ranura LIBRE la llamada 1 gana» |

Cada mutante enrojece asertos PROPIOS y ninguno deja la población verde (22-24/25).

## 9. Stream

CERO tiradas añadidas o quitadas: ni el escáner, ni la cascada, ni los dos barridos
de hechizo consumen `rand_range` (§1; para An Sanct ya lo había medido #286 a
profundidad 1). El desalojo cambia QUÉ ranura ocupa un spawn sólo cuando antes no
había hueco (antes: no-spawn; ahora: desalojo) — el sorteo de coordenadas previo es
idéntico en cardinal y orden.
