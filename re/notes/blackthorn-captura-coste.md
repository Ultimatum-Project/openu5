# El COSTE de la captura de Blackthorn — ¿siempre un compañero? NO: el sacrificio es condicional, y hay TRES vías sin coste

Carril `blackthorn-captura` · 2026-08-23 · sobre main `0720b744`. Pregunta de la ficha:
**¿la captura cuesta SIEMPRE un compañero (el sacrificio), o hay vías de captura sin
coste?** Y de propina, el flujo completo (arresto 'Y', tile 0x70, celda, sacrificio,
huida). Toda la rama de coste está RE-LEÍDA del crudo instrucción a instrucción
(`re/disasm/BLCKTHRN.OVL.asm`, `TOWN.OVL.asm`, `CMDS.OVL.asm`, `OUTSUBS.OVL.asm`) —
la transcripción histórica de `blackthorn.md` ya mordió una vez con una rama truncada
(root-cause del bug de las gárgolas, `gargolas-hostiles-palacio.md` §6), así que aquí
no se hereda ninguna cita de coste sin re-verificarla. Convención: `FICHERO.OVL:0x…`;
rebases verificados con control positivo (§0).

**Veredicto en una línea:** el sacrificio NO es incondicional — cuesta un compañero
**si y sólo si** `numLiving ≥ 2` **y** queda algún santuario con byte 0 (y entonces es
INEVITABLE: ceder el mantra o fallar 4 rondas acaban ambos en `sacrifice_member`); con
el Avatar solo NUNCA hay sacrificio, con los 8 santuarios gastados NO HAY NI
INTERROGATORIO, y el arresto de pueblo ('Y' → celda de Yew) no cuesta compañero jamás.
El port modela las tres vías sin coste y la inevitabilidad: **FIEL**, cero defectos.

## §0 — Rebases con control positivo (doctrina del call cross-overlay)

- TOWN.OVL `load_seg 0x81D` (loops.md §0) ⇒ `+0x81D0`. Controles: `12ca: e821e6
  call 0xf8ee` → 0xF8EE+0x81D0 = **0x7ABE** = stub de dispatch #8 → BLCKTHRN 0x060e
  (blackthorn.md §2, tabla de stubs; corroborado en runtime por el testigo DOSBox de
  oracle-blackthorn.md) · `12c0:` 0xB82C → **0x39FC** `party_conscious_state` ·
  `1328:` 0xCDAC → **0x4F7C** `advance_clock` · `12e6:` 0xA49C → **0x266C** getkey ·
  `12dc:` 0x9680 → **0x1850** print_ds.
- BLCKTHRN.OVL `load_seg 0x0A29` ⇒ `+0xA290`. Controles: `call 0x75c0` → **0x1850**
  print_ds · `0575:` 0x9CA6 → **0x3F36** `karma_sub5` · `05b4:` 0xACEC → **0x4F7C**
  `advance_clock`.

## §1 — El árbol de decisión del coste, del crudo

`interrogate(numLiving, subj)` BLCKTHRN.OVL:0x054a, transcrito entero (0x0552-0x060b).
`numLiving` = miembros con status ≠ 'D' de los `g_party_size` primeros (conteo en el
caller, 0x0620-0x0647: `0634: cmp byte [si],0x44 ; je 0x63a` / `0639: inc dx` — los
dormidos 'S' CUENTAN como vivos). `warned` = `[bp-4]`, arranca 0 (0x0552).

Bucle de 4 rondas (`si` = 0..3; `05fd: cmp si,4 ; jge` sale; `0602: jmp 0x563` repite):

```
0563: push si ; push di ; call 0x278          ; print_question(subj, ronda)
0568: push di ; call 0x2ea                    ; match = check_mantra(subj)
056c: or ax,ax ; je 0x59e                     ; sin match → 0x59e
── MATCH (ceder el mantra) ─────────────────────────────────────────────
0570: mov byte [di+0x58d8], 0xff              ; santuario CAE (g_shrine_destroyed)
0575: push 0x5888 ; push 5 ; call K 0x3f36    ; karma −5 con suelo 0  — SIEMPRE
0580: cmp word [bp+4], 1 ; jle 0x58e          ; ¿numLiving ≤ 1?
0586:   push 0 ; call 0x3ae                   ;   NO → sacrifice_member(0) «merciful»
058e:   mov ax,0xb4ba ; push ; call 0x75c0    ;   SÍ → «rewarded with thy life» y NADA
0595: call 0x510 ; 059b: jmp 0x606            ; SALE (el match siempre termina)
── SIN MATCH ───────────────────────────────────────────────────────────
059e: cmp word [bp+4], 2 ; jge 0x5aa          ; ¿numLiving ≥ 2?
05a4:   mov ax,0xb4fa ; jmp 0x591             ;   NO → «To the dungeon!» y SALE
                                              ;   (al PRIMER fallo: sin bucle, sin coste)
05aa: cmp word [bp-4], 0 ; je 0x5f4           ; ¿warned aún 0?
05f4:   [bp-4]=1 ; call 0x51c                 ;   1er fallo: amenaza y sigue (0x51c
                                              ;   nombra al slot 1 FIJO, 0x0531 print 0x55c8)
05b0:   push 2 ; call K 0x4f7c                ;   fallos 2º+ : advance_clock(2) y switch(si):
05ba-05cd: switch si → {0:0x5d2, 1:0x5da, 2:0x5e2, 3:0x5ea}
05d2/05da/05e2: [0xae39] = 0xea/0xeb/0xe8     ;   rondas 0-2: SOLO el reloj de arena (cosmético)
05ea:   push 1 ; call 0x3ae                   ;   ronda 3: sacrifice_member(1) «pendulum»
05fc: inc si ; …                              ;   y el bucle expira → SALE
```

Los ÚNICOS retornos son 0x0595→0x606 (match, o solo-fallo «dungeon» vía 0x591) y la
expiración `si==4` (0x598→0x606). No hay más salidas: careado contra el listado entero
de la función (nada entre 0x054a y 0x060b salta fuera de ese rango salvo los `call`).

★ Detalle que fija el crudo: el caso `si==0` del switch (0x05d2, arena 0xEA) es
**inalcanzable** — el switch sólo se entra con `warned≠0`, y warned lo arma el fallo de
la ronda 0 (el match no llega ahí: retorna). Ya declarado en el port
(`blackthorn-capture.ts:433`); aquí queda probado por enumeración de ramas.

## §2 — Respuesta: cuándo cuesta y cuándo no

**Con `numLiving ≥ 2` y un santuario en pie, el sacrificio es INEVITABLE.** Prueba por
enumeración de las salidas de §1: (a) match en cualquier ronda → `0586 sacrifice_member(0)`
(el gate 0x0580 lo cruza porque numLiving>1); (b) la única otra salida es expirar el
bucle, y llegar a procesar el fallo de la ronda 3 exige warned≠0 (el fallo de la ronda 0
lo armó) ⇒ pasa por `05ea sacrifice_member(1)`. No existe secuencia de respuestas que
salga del bucle con numLiving≥2 sin un `call 0x3ae`. Lo único que eliges es el MODO:
ceder = santuario caído + karma −5 + «merciful death»; resistir 4 rondas = péndulo, SIN
tocar karma ni santuario. Negarse no toca karma (cero escrituras en la vía del fallo).

**Vías de captura SIN coste de compañero (las tres, asm-probadas):**

1. **Avatar solo (`numLiving ≤ 1`) que cede**: `0580 jle 0x58e` → «rewarded with thy
   life» — sin sacrificio (paga santuario + karma −5, que corren ANTES del gate, 0x0570/0x0575).
2. **Avatar solo que falla**: `059e jge` no salta → «To the dungeon!» y sale AL PRIMER
   fallo — sin sacrificio, sin santuario, sin karma. (Ojo: «solo» es numLiving, no
   party_size — un party de 6 con 5 muertos 'D' entra por aquí.)
3. **Los 8 santuarios con byte ≠ 0**: `blackthorn_capture` 0x060e ni interroga — el
   scan `065b: cmp byte [si+0x58d8],0 ; jne 0x6c6` / `06c7: cmp si,8 ; jge 0x662` agota
   los 8 y `0665: cmp si,8 ; jl 0x66d` cae a `066a: jmp 0x8e7` = directo al depósito
   (venda 0x0652 impresa, sin trono, sin pregunta, sin coste). El único efecto es el
   depósito de §3.

Y la cuarta vía sin coste, que no es captura de palacio: el **arresto de pueblo**
(TOWN 0x12ae rama `loc ≠ 0x12`, §3) jamás toca el roster.

Semántica del byte de santuario (censo COMPLETO de `0x58d8` en los 28 .asm — 4 hits
reales): lo escribe SOLO la traición (`BLCKTHRN 0x0570` = 0xff) y la ceremonia de
restauración en el santuario (`CMDS.OVL:0x1293: and byte [bx+0x58d8], 0x7f` — limpia el
bit 7, NO pone a cero) ⇒ **un santuario traicionado y luego restaurado queda 0x7f ≠ 0 y
Blackthorn no vuelve a preguntar por él nunca** (su scan compara con 0). El lector
`OUTSUBS.OVL:0x006d: cmp byte [si+0x58d8],0x7f ; jbe → 0` distingue caído (≥0x80) de
intacto-o-restaurado (≤0x7f). Consecuencia jugable: tras 8 traiciones (p. ej. un Avatar
solo, a −5 de karma cada una) toda captura posterior es la vía 3 — depósito y ya.

## §3 — El flujo completo alrededor del coste

- **Trigger**: `npc_engine` TOWN.OVL:0x1352 con NPC activo `[0x65bf]` (solo se arma por
  adyacencia manhattan==1, NPC.OVL 0x06E4) — rama 'a' (marcador 0x61, hostiles 6/7) con
  tile **0x70** `13a4: cmp byte [bx],0x70 ; je 0x13d6` → `call 0x12ae`; rama 't'
  (guardias 4/5) → TALK 0x031E → guard_demand ret 1 → el mismo 0x12ae; tile ≠0x70 →
  «Attacked!» + combate (todo eso ya derivado en `gargolas-hostiles-palacio.md` §2 y
  `talk-031e-resolucion.md`; no re-derivado aquí).
- **`0x12ae` (re-leído entero, 0x12ae-0x1351)**: `12b9: cmp [g_location],0x12 ; jne
  0x12d8`. EN el Palacio: `12c0: call K 0x39fc` conscious; `<0 → 134b ret 0` (todo el
  grupo muerto: NO captura — eso es refuge, TOWN 0x1436); `≥0 → 12ca: call stub 0x7abe`
  = `blackthorn_capture` y `12cd: push 1 ; call 0x11f0` (recarga del pueblo: limpia
  objetos, re-coloca NPCs por `g_hour`, re-computa Shadowlord — 0x11f0 leído 0x11f0-0x12ab),
  ret 0. FUERA: prints 0x27e2/0x27fe («Thou art under arrest! Wilt thou come quietly?»),
  bucle getkey Y/N (12e6-12f2);
  - **'Y'** (12fa-133a): print 0x281b · `1301: push 0 ; call 0x88a0` = set_color(0), el
    APAGÓN (residente 0x0A70, cita ya adjudicada en `realimentaciones-visuales-328.md`) ·
    print 0x2845 · `130e-1318: g_location=4 (Yew), (x,y)=(0x19,4)` = la CELDA ·
    `131d: [0x24e6]=1` · bucle `1324: push 0x14 ; call K 0x4f7c` hasta `g_hour==8`
    (advance_clock(20) — despiertas a las 8) · `1332-1337: g_keys=0 ; g_floor=0` ·
    `133a: jmp 0x12cd` (recarga + ret 0). **Coste: llaves y tiempo. Roster intacto.**
  - **'N'** (133c-1346): print 0x285e («Then defend thyself, rogue!») + `call 0x958`
    alarma + **ret 1** → el tail de npc_engine ataca con ese guardia (los 8 GUARDS;
    derivado en gargolas §2).
- **La escena** (`blackthorn_capture` 0x060e): cuenta vivos (0x0616) → venda (0x0652,
  también en la vía sin interrogatorio) → si hay santuario: trono, cadenas, saludo con
  nombre/género, «Wait!» (0x06b0-0x08cd) → `08d0: call 0x54a` interrogate (§1).
- **El depósito** (0x08e7-0x0905, común a TODAS las vías): ~~`g_floor=0xff` (centinela
  de redibujo; NO se re-fija — la planta de aterrizaje sigue siendo la Clase C declarada
  en blackthorn.md §3.1)~~ **Clase C CERRADA (24-08, carril blackthorn-deposito):
  `g_floor=0xff` ES la planta de aterrizaje — el SÓTANO (z=−1), la celda del calabozo**
  (0xff = el valor que deja el `dec [g_floor]` de KLIMB TOWN 0x0566 al bajar de la
  planta 0; el arresto de Yew, en contraste, escribe su planta explícita `1332/1337:
  g_floor=0`; control por tiles: (10,7) sólo es pisable en z=−1 — derivación completa
  en blackthorn.md §3.1, actualizada) → fade → `08f6: g_party_x=10 ; g_party_y=7 ;
  g_keys=0 ; g_location=0x12`, a pie (0x064a `g_transport_tile=0x1c`). Y responde la
  pregunta de la vía con fallo: **mismo destino para TODAS las vías** — cede, falla
  en solitario («dungeon», que es literal: te llevan AL calabozo), péndulo o depósito
  directo: (10,7) del sótano de loc 0x12. Confiscación EXACTA: solo
  las llaves — entre 0x08e7 y el ret no hay más escrituras de estado (oro/equipo/gemas
  intactos).
- **La huida**: NO hay lógica de fuga en BLCKTHRN — la escena TERMINA en el depósito y
  devuelve el control al motor normal (la recarga 0x11f0 del caller). Tampoco hay pase
  ni cooldown (T-B retirada: TALK 0x01e2 solo escribe `g_gold`; `tc-result-producer.md`
  §3): cada turno con un guardia armado adyacente RE-dispara. Con party>1 cada
  re-captura cuesta OTRO compañero, hasta quedarte solo (vías 1-2) o gastar los 8
  santuarios (vía 3); huir es alejarse de los guardias y salir andando con las llaves a 0.
- **Borde del crudo en `sacrifice_member` 0x03ae** (guardado por los callers): el scan
  del 2º vivo (0x0446-0x046a) tiene la salida `0466: cmp ax,di ; jae 0x457` que, si el
  roster se agotara sin 2º vivo, adjudicaría el slot `party_size` (fuera del grupo). Con
  los gates de §1 (`numLiving≥2` en ambos call-sites) es inalcanzable en fábrica; el
  port devuelve `null` en ese caso (`sacrificeFirstCompanion`, blackthorn.ts:288) —
  divergencia solo en lo inalcanzable, no se ficha. La víctima real es el **2º miembro
  VIVO** (el Avatar slot 0 nunca, si vive); el record ejecutado se aparca en el slot 15
  (0x04c2-0x04d4, byte final 0x7f) — ~~paridad byte-a-byte de ese aparcamiento sigue en
  Task F (declarada en blackthorn.ts:269 y saveNative.ts:820)~~ **CERRADA (24-08, carril
  save-residuos)**: `sacrificeFirstCompanion` ya aparca el record entero en
  `characters[15]` con `partyStatus=0x7f` (splice = la compactación 0x04ab-0x04c0 de los
  16 records; asignación a [15] = la copia 0x04c2-0x04cd a DS:0x5788; 0x7f = el byte
  0x04cf en [0x57A7]) y `exportNativeSave` lo serializa como a cualquier record.
  Testigos: `save-native-post-sacrificio.test.ts` (slot 15 = víctima + 0x7f, PJ15
  corrido al 14, roster desplazado) y `capture-live.test.ts` (vía live).

## §4 — Careo con el port: FIEL, las tres vías y la inevitabilidad

| regla del binario | port | veredicto |
|---|---|---|
| sacrificio ssi numLiving>1 en el match (0x0580 `jle`) | `blackthorn.ts:341` `if (numLiving > 1)` | fiel |
| solo+match → «rewarded», sin sacrificio (0x058e) | `blackthorn.ts:352-359` `rewardedWithLife: true` | fiel |
| solo+fallo → «dungeon» al PRIMER fallo (0x05a4) | `blackthorn.ts:362-371` (dentro del bucle, corta la ronda) | fiel |
| party≥2: 1er fallo solo avisa (0x05f4), 2º-3º arena+reloj (0x05b0/0x5da/0x5e2), 4º péndulo (0x05ea) | `blackthorn.ts:372-387`; reloj vivo en `blackthorn-capture.ts:404-406` (round≥1 ≡ warned, invariante probado en §1) | fiel |
| advance_clock(2) TAMBIÉN en la ronda del péndulo (0x05b0 precede al switch) | `blackthorn.ts:373` suma antes del `if round===3`; wiring ídem | fiel |
| 8 santuarios ≠0 → sin interrogatorio, solo venda+depósito (0x066a→0x8e7) | `blackthorn.ts:237-243` `pickInterrogationShrine` ===0 → null; `blackthorn-capture.ts:292-298` | fiel |
| restaurar santuario = `and 0x7f`, NO 0 → no re-interrogable (CMDS 0x1293) | `shrines.ts:305` `arr[v] & 0x7f`; predicado caído = bit 0x80 (`shrines.ts:120` ≡ OUTSUBS 0x006d) | fiel |
| amenaza nombra al slot 1 FIJO (0x0531 print 0x55c8), péndulo al 2º vivo (0x04e8 print 0x5788) | `blackthorn-capture.ts:423-427` `characters[1]`; víctima `secondLivingName` | fiel |
| arresto 'Y' → Yew (25,4), keys=0, floor=0, hora 8 — roster intacto (0x12fa-0x133a) | `blackthorn.ts:708-723` `guardArrestJail` (sin tocar characters) | fiel |
| depósito confisca SOLO llaves (0x08f6-0x0905) | `blackthornCaptureDeposit` blackthorn.ts:413-420 | fiel |
| sin pase/cooldown: re-captura por adyacencia cada turno | `blackthorn-capture.ts:267-282` (T-B retirada) | fiel |
| conscious==−1 en palacio → ret 0 sin captura (12c5 jge / 12c7 jmp) | test «exclusión mutua» capture-live.test.ts:267 (refuge) | fiel |

Testigos ejecutables ya en main: `capture-live.test.ts` cubre las CUATRO celdas de la
matriz de coste (party>1 ceder=1 sacrificio · solo ceder=0 · solo fallar=0 · party>1
4 fallos=1) más «8 santuarios caídos → depósito directo» (línea 292) y la confiscación
exacta (línea 172); `blackthorn.test.ts` los mismos sobre el motor puro;
`save-native-post-sacrificio.test.ts` el roster de 15 en el .GAM exportado. La matriz
del binario y la del port coinciden celda a celda: **cero divergencias nuevas, cero
defectos** — ~~las dos Clases C preexistentes (planta del depósito; slot-15 en el save)
siguen declaradas donde estaban, sin cambio de estado~~ **actualización 24-08**: la
Clase C «planta del depósito» quedó CERRADA por el carril blackthorn-deposito (0xff =
sótano z=−1; ver §3 y blackthorn.md §3.1 — el port depositaba en planta 0 y encastraba
al party en el muro del almacén de barriles, vídeo del usuario en móvil); ~~la de slot-15
en el save (Task F) sigue declarada donde estaba, sin cambio de estado~~ **24-08 (carril
save-residuos): también CERRADA** — el aparcamiento slot-15 con 0x7f ya es conducta del
port (ver §3, cierre con testigos).

## §5 — Lo que esta acta NO hace

- No re-deriva la suficiencia del trigger ni la rama 't'/TALK (cerradas en
  `talk-031e-resolucion.md` y gargolas §2; aquí solo se consumen).
- ~~No cierra la planta del depósito (g_floor=0xff, Clase C de blackthorn.md §3.1) ni el
  aparcamiento slot-15 en el save (Task F): sin evidencia nueva en el crudo leído.~~
  **24-08**: la planta del depósito quedó cerrada después (carril blackthorn-deposito,
  ver §3); ~~el aparcamiento slot-15 (Task F) sigue abierto~~ y el aparcamiento slot-15
  quedó cerrado el mismo día por el carril save-residuos (ver §3).
- No adjudica los helpers cosméticos de la escena más allá de identificarlos
  (0x88a0 set_color ya adjudicado; sirena 0x7f02; anim_vm 0xbe).
