# Munición agotada: el desequipado es del PARTY ENTERO — ficha #36

**Sujeto:** el binario (`consume_ammo`, COMSUBS.OVL, y su cadena de llamadas).
**Fecha:** 2026-08-06 · **Carril:** bugs-original / combate-ligero.
**Método:** PORT PRIMERO — el clon se leyó antes que el disasm, y el disasm se leyó
entero por mí (no se copió ningún nombre del ledger: los near-call se resolvieron en vivo
con `verify_cites._landing`, por la tarjeta #10).

---

## 1. La cadena, resuelta y leída de punta a punta

`consume_ammo` vive en COMSUBS.OVL a partir de `0x097c`. La rama de munición son catorce
bytes de código:

```
099c: fe0edb57   dec byte ptr [g_equip_qty+27]     ; Arrows 0x1b (0x09b2 hace lo propio con
09a0: 7555       jne 0x9f7                         ;   Quarrels 0x1d, +29, y salta aquí)
09a2: ff7606     push word ptr [bp + 6]            ; el id de arma
09a5: e88294     call 0xffff9e2a                   ; → stub CS 0x800a → SJOG.OVL:0x1b34
09a8: 8b5e06     mov bx, word ptr [bp + 6]
09ab: 0087c057   add byte ptr [bx + 0x57c0], al    ; g_equip_qty[arma] += AL
09af: eb46       jmp 0x9f7
```

El callee, **SJOG.OVL 0x1b34** — cuerpo entero, 29 instrucciones:

```
1b3c: sub di,di / 1b3e: sub si,si          ; di = conteo, si = índice de miembro
1b42: push si / push [bp+4] / call 0xffffaee0   ; unequip_item(arma, si)
1b49: or ax,ax / je 0x1b4e / 1b4d: inc di       ; cuenta sólo los que devolvieron ≠0
1b4e: inc si
1b4f: mov ax,si / mov cl,[g_party_size] / cmp ax,cx / jb 0x1b42
1b61: mov ax,di                            ; DEVUELVE EL CONTEO
```

Y el callee de dentro, `0xffffaee0` desde SJOG y `0xffff8c80` desde COMSUBS, **resuelven al
mismo sitio**: **ULTIMA.EXE 0x6e60**, `unequip_item(itemId=[bp+4], partyIdx=[bp+6])`.

## 2. Subida de grado: `unequip_item` ya no es inferencia

El acta previa (`asm100-censo-acta`) dejó anotado, con honestidad, que *«que 0x6e60
desequipe es INFERENCIA (fuerte, por la aritmética) — su cuerpo vive en ULTIMA.EXE, carril
kernel, y NO lo he leído; su nombre en el ledger tampoco está verificado»*.

**Leído** (`0x6e60`-`0x6f1b`): calcula `si = partyIdx*32 + 0x55c1` y compara `[bp+4]` contra
las **seis** ranuras del registro (`+0x55c1` … `+0x55c6`); a la PRIMERA que casa le escribe
`0xff` y devuelve **1**; si ninguna casa devuelve **0** (`0x6f09`). Sale siempre llamando a
`member_armor_rating(partyIdx)` (**0x6da8**, hoja: cero `call` en su cuerpo).

⇒ **INFERIDO → MEDIDO**, y el nombre del ledger queda verificado contra el cuerpo.
Cabo aparte, para quien trabaje la exención de invisibilidad: `member_armor_rating` abre con
`cmp byte ptr [g_unk_5894], 0x28` — la localización exenta del filtro de invisibilidad
(COMBAT.OVL `0x0db7`) reaparece aquí decidiendo la armadura. Segundo consumidor de la copia
sombra; no adjudicado en esta ficha.

## 3. Lo que hacía el clon, y las TRES mitades del defecto

`game/src/core/combat/combat.ts` `consumeAmmo` llamaba a
`unequipWeaponById(state, cur.charIdx, weapon.id, true)`, y esa rama del helper hacía
`if (q < 99) qty[weaponId] = q + 1`.

| | binario | clon (antes de #36) |
|---|---|---|
| ALCANCE | party entero (`si < g_party_size`) | sólo el tirador |
| CANTIDAD | `+N`, el conteo devuelto | `+1` |
| TOPE | `add byte` pelado (envuelve mod 256) | `if (q < 99)` |

**El tope 99 no era una invención: era fidelidad importada de otra rutina.** El toggle-off del
(R)eady sí lo tiene —ZSTATS.OVL `0x0ccd`: `cmp byte ptr [bx+0x57c0], 0x63` / `jae` / `inc`— y el
clon lo calca bien en su sitio (`equip.ts`, rama de desequipar por toggle). Lo que ocurrió es
que **un helper compartido entre dos rutinas del binario con reglas distintas** llevó el tope
del sitio donde es cierto al sitio donde no lo es. Es la forma exacta de
`dos-convenciones-del-port-pueden-calcar-dos-del-binario`: la unidad de fidelidad es LA RUTINA.
Por eso el fix no se limita a corregir el número: **mata la rama** del helper, para que el
vehículo no siga ahí.

## 4. Que el alcance sea deliberado lo prueba la otra rama de la MISMA rutina

`0x09b8` (arrojadizas, sólo a distancia > 1) llama **al mismo callee del kernel** con UN solo
sujeto: toma la ranura del actor de su registro de combate (`0x09d8`, `[bx-0x45e9]`) y llama a
`unequip_item` con ella. Mismo `0x6e60`, un sujeto; y sin `add` de vuelta — el arma se pierde.
Dos alcances distintos, dos aritméticas distintas, la misma rutina. No es un efecto del callee.

## 5. 🔴 El fix corrige un argumento que ya estaba publicado

`re/deliberate-divergences.md` justificaba la alcanzabilidad del bug #18 (underflow de flechas
a 255) así: *«si el PJ A vacía el pool y el PJ B dispara SU PROPIO ARCO después»*. Ese camino
**no existe**: si el arco de B es el mismo id, el barrido de A se lo quitó.

La vía que sí queda es más estrecha, y es de **ids distintos sobre un pool común**: `ammoItemFor`
mapea **Bow 0x1a y Magic Bow 0x24** a las MISMAS Arrows `0x1b`, pero son ítems distintos, así
que el barrido del `0x1a` no toca al `0x24`. Ése es el camino por el que #18 sigue vivo, y el
test «el barrido es por ID DE ARMA…» lo fija. El Crossbow no entra: su pool es Quarrels `0x1d`.

Enmendado en el mismo commit: `re/deliberate-divergences.md` y su espejo EN, `docs/FIDELITY.md`,
`re/notes/combat.md` y su espejo EN. En `docs/FIDELITY.md` apareció además una rancidez
ANTERIOR a esta ficha: decía «el clon CLAMPA a 0 (`Math.max`) y además desequipa el arco de B»,
que describe el clon de antes del fix de #18 (aquel arreglo tácito ya se había revertido).

## 6. Grados y alcance de lo afirmado

- **MEDIDO**: los tres cuerpos (`0x097c`, `0x1b34`, `0x6e60`), la cota `g_party_size`, el `add`
  sin tope, el tope 0x63 del (R)eady, y que la cadena **no consume RNG** — tiene exactamente
  tres `call`, los tres resueltos aquí, y `0x6da8` es hoja con cero `call`. Ninguno es
  `rand_range`.
- **MEDIDO**: que ninguna de las dos ramas imprime (ni `push` de cadena ni `call` de print).
- **NO MEDIDO**: si algún recorrido del arnés llega de verdad al cruce que activa el fix (pool
  compartido a 0 en combate **y** un segundo miembro con el mismo id equipado). La ventana de
  sellos se pidió con expectativa pre-registrada de **delta 0** justamente porque eso está sin
  medir; si algún sello se mueve, el delta es el dato, no ruido.
- **NO TOCADO**: `re/notes/routine-census.json` congela, como cita de evidencia, la frase de
  `ring-expiry-derivation` que esta ficha deja caducada. Es la tarjeta #10 otra vez (foto a
  mano que no sigue al árbol); no se edita a mano un JSON que alimenta el ledger.
