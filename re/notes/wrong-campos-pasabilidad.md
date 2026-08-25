# Wrong: pasabilidad FIEL de campos/bombas — refutación del sello-candidato ch32

Acta del carril f2b-wrong (2026-07-22). Pieza encargada: «cita estática final» del
sello-candidato 8×SIN-ENTRADA de Wrong r7-r14 (ch32, lote-1). La cita **REFUTA** el
candidato en vez de confirmarlo. Ruling del lead el mismo día: no estampar SIN-ENTRADA;
jugar con la semántica fiel (extensión opt-in del pather) y estampar solo veredictos
jugados.

## 1. Careo binario (la estructura que el veredicto asume)

`game/assets/maps/dungeons.json` (Wrong, loc 36) contra el crudo
`DUNGEON.DAT[0x600:0x800]` (índice 3 = Wrong; orden Deceit..Doom = loc 33..40; layout
`(floor<<6)+(y<<3)+x`, hi-nibble tipo / lo-nibble sub — re/notes/dungeon.md §0.1, mismo
buffer vivo DS:0x595A): **512/512 bytes idénticos**. La fuente del runtime ES el binario.

## 2. La semántica de paso del binario (ya derivada y PORTADA, pero no en el pather)

- **Clasificador de movimiento** DUNGEON:0x05FF (re/notes/dungeon.md §2; port
  `DungeonState.isPassable`, dungeon.ts): SOLO bloquean muros hi∈{0xB,0xC,0xD}.
- **Campos** (type 0x8): sueño 0x80/0x88, veneno 0x81/0x89, fuego 0x82/0x8A **SE PISAN**
  (efecto por miembro, on_enter 0x0C76 §5; sueño incluso LIMPIA el tile a suelo). SOLO el
  0x83 EXACTO (Electric) rebota (0x0470, gate 0x05d7 — ni siquiera el lit 0x8B).
- **Bombas** 0x62/0x6A: se pisan ("Bomb Trap!" + rand(1,8) c/u) y **limpian** (`&=8`).
- **Cetro vs 0x83**: (U)se en mazmorra disuelve el campo ENCARADO (CAST 0x1966 rama
  residente 0x1a04; port useSceptre/dissolveFacingField). "Wrong (0x24) y Covetous (0x25)
  SÍ tienen campos → aquí actúa" (use-tools.ts).

**El mirror estático (`re/tools/dungeon_pocket_reach.py`) y el pather del arnés
(`planDungeonDescent`, nav.ts) trataban TODO type-8 como muro y las bombas como
intransitables** — modelo conservador que NO es el binario.

## 3. Floods (mirror con la semántica fiel; entradas reales del port)

Entradas: cima = primera escalera 1/3 de floor0 = **f0(1,1)** (game.ts enterDungeon);
fondo = **f7(7,7)** oeste (rama fromUnderworld).

| modelo | cima alcanza | fondo alcanza |
|---|---|---|
| conservador (campo=muro, bomba=muro) — el de ch23/ch32 | 43 celdas, floors {0,1}, 0/11 salas | **1 celda** (bolsillo aislado), 0/11 |
| **FIEL sin cetro** (0x83 muro; resto pisable) | 200 celdas, floors 0-7, **salas r7-r14 (8/8)** | 1 celda, 0/11 |
| FIEL + cetro (0x83 disoluble) | 238 celdas, **11/11 salas** | 35 celdas, r14+r15 |

Ruta testigo cima→r11 (sin cetro): f0(1,1)→(1,5) → Des Por f1 → oeste con wrap →
**pisa veneno f1(5,5)** → foso f1(4,5) ENCADENA a f2 → (3,5)→(3,4) → Des Por f3 →
(3,3)→(3,1) → klimb-up f2 → (2,1) → r11(1,1). El «cima solo alcanza floors 0-1
(confirmado estático)» del censo era **ARTEFACTO DEL PATHER**, no del binario.

Muradas: r5 approach único = **el propio campo 0x83 f3(1,1)** (r6 ídem (5,1); r15 =
bombas f7(7,2..5) tras el 0x83 f7(7,6) del bolsillo del fondo) ⇒ la hipótesis
«cetro-como-llave-de-navegación» (Fase 2b, fichada para Covetous) queda INSTANCIADA en
Wrong: sin cetro, las 3 muradas no tienen approach; con cetro, lo tienen.

## 4. Consecuencias

1. **ch32 «8×SIN-ENTRADA» NO es sellable**: el fondo (7,7) sí está aislado (verdad), pero
   la vía de CIMA existe y ch32 nunca la probó (su pather no pisaba campos).
2. Extensión OPT-IN del arnés (`fields`/`sceptreKey` en planDungeonDescent/
   dungeonDescendTo/conquerRoomAt, nav.ts; default OFF = cero impacto en digests
   sellados): campos sub≠3 pisables (peso 2), bombas pisables (peso 2), 0x83 =
   transición "sceptre" (encara + (U)se Cetro + pisa; peso 6). El capítulo
   **ch37-wrong-campos** juega las 11 salas de la cola de Wrong con ella.
3. La MISMA revisión aplica a cualquier lectura estática previa hecha con el mirror
   conservador en mazmorras CON campos: **Wrong y Covetous** (el resto no tiene campos
   en DUNGEON.DAT — use-tools.ts — y no cambia).

Guion de la derivación: scratchpad del carril (wrong_static_seal.py, variantes fiel/
peor-caso inline); reproducible con `dungeon_pocket_reach.py` + los overrides de
semántica descritos arriba.
