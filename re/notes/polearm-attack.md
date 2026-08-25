# Polearm «attack over obstacles» — derivación COMSUBS.OVL + veredicto

> Carril SCOUT (flota del team-lead), 2026-07-18. Deriva del ASM + veredicto + FIX.
> Responde el ítem B1 del censo de docs físicos (`docs/censo-docs-fisicos-port.md` §B1):
> la quickref (`quickref.md:74`) marca «**(p)** Denotes a Polearm: May be used to attack
> over obstacles». El port aplica `isRangedPathClear` a TODA arma de rango>1 sin eximir
> a las polearmas ⇒ sospecha de infidelidad.
>
> Doctrina `disasm-mata-resumen`: se cita `re/disasm/COMSUBS.OVL.asm` + offset.

---

## TL;DR (veredicto)

**(a) El port DIVERGE — FIX cableado.** El binario EXIME a Morning Star (0x19) y Halberd
(0x22) del raycast de línea-de-tiro: no «vuelan», pegan directo POR ENCIMA del obstáculo.
El port los somete a `isRangedPathClear` como a un arco ⇒ un obstáculo intermedio les da
«Blocked by wall!» erróneamente. Exención **TOTAL** (ignora todo tile intermedio; solo
respeta el alcance ≤ 2). Identificación del binario: **por ID de arma** (0x19/0x22), NO
por rango ni por flag de tabla. Magic Axe (0x26) **NO** es de este grupo: vuela y regresa
(rango 15), sí sujeto a LOS.

---

## 1. Cadena del ataque a distancia del jugador — COMSUBS.OVL

`sub_0A68(actor, weaponId, targetSlot)` = ataque a distancia (`re/notes/combat.md` §7):

```
0a6f-0a8b: interferencia SÓLO para armas con munición
           (bow 0x1a, crossbow 0x1c, magic bow 0x24, flaming oil 0x13, sling 0x11);
           morning star/halberd NI se comprueban aquí (0x0a9a directo).
0aa4: mov al,[bx+0x1664]     ; range = attackRangeValues[weaponId]   (DS 0x1664)
0aae: call 0x504             ; AIM: mueve cursor dentro de range + rejilla
```

### 1a. AIM — `sub_0504(range, …)` NO tiene LOS
El resolutor de apuntado (`re/disasm/COMSUBS.OVL.asm:558-628`) mueve el cursor con getkey
(0x448c) y sólo acota por **distancia** y **rejilla**, sin ningún chequeo de opacidad:
```
05f2: call 0x48a             ; dist combate (euclídea entera)
05f5: mov [bp-0x12], ax
05fb: cmp [bp-0x12], [bp+4]  ; dist vs range
05fe: jg 0x624               ; fuera de alcance → no mueve el cursor
0600-0616: cmp [bp-2]/[bp-4] contra 0 y 0xb  ; sólo límites de rejilla 0..10
0618: guarda aim_x/aim_y
```
⇒ El apuntado permite fijar el cursor sobre un enemigo **detrás de un muro** siempre que
esté en alcance. La línea-de-tiro NO se evalúa en la fase de apuntado.

## 2. Dónde vive el LOS: el VUELO del proyectil — `sub_0822`

Tras apuntar, el proyectil vuela y aterriza en `sub_0822`
(`re/disasm/COMSUBS.OVL.asm:830-899`). El corazón:

```
087e: cmp byte [g_cmb_weapon], 0x19   ; Morning Star
0883: je 0x88c
0885: cmp byte [g_cmb_weapon], 0x22   ; Halberd
088a: jne 0x8a6                        ; ── resto de armas → rama de VUELO
; ── rama POLEARM (0x88c): golpe directo, SIN raycast ─────────────
088c: cmp [bp+6], 0                    ; fase (0 = ida)
0890: je 0x8d6                         ; ida → aterriza YA en el objetivo apuntado
0892: mov [bp-4], [bp+0xa]             ; (fase de regreso; n/a para polearm de 1 fase)
0898: mov [bp-0xa], [bp+8]
089e: mov [bp-0xc], 1
08a3: jmp 0x8d6
; ── rama VUELO (0x8a6): TODO lo demás ────────────────────────────
08a6: push aim/origen…
08b5: call 0x12de                       ; ← RAYCAST Bresenham, se detiene en 1ª celda opaca
08b8: mov [bp-0xc], ax                  ; celda de impacto = donde chocó
```

`0x12de` (`re/disasm/COMSUBS.OVL.asm:1908…`, invocado sólo desde 0x08b5 y 0x0bed) es el
recorrido de línea que para en la primera celda opaca a LOS (kernel 0x5D8E) — **esto** es
lo que el port modeló como `isRangedPathClear`. Morning Star y Halberd **saltan** esa
llamada (rama 0x88c) ⇒ su golpe ignora los obstáculos intermedios: aterriza directo en la
celda apuntada. No hay chequeo parcial ni de tile adyacente: **exención total** dentro del
alcance (≤ 2; `attackRangeValues[0x19]=attackRangeValues[0x22]=2`, únicas armas de rango 2).

**Magic Axe (0x26):** NO cae en 0x087e; toma la rama de vuelo y además regresa (2ª llamada
a 0x12de en 0x0bed, `re/notes/combat.md:292`), rango 15. ⇒ sujeto a LOS. La «(p)» de la
quickref para Magic Axe (si la incluye) NO se traduce en exención de obstáculos en el
binario: es un arma arrojadiza que vuelve, no un asta.

**Enemigos:** su ataque a distancia (COMBAT:0x014E → 0x0822) usa `g_cmb_weapon = 0` (arma
0), nunca 0x19/0x22 ⇒ jamás exentos. La exención es exclusiva del jugador con asta.

## 3. Identificación del arma «(p)» en el binario

Por **ID literal** en 0x087e: `weapon == 0x19 (Morning Star) || weapon == 0x22 (Halberd)`.
No es un flag de la tabla de armas ni `range==2` (aunque de facto esas dos son las únicas de
rango 2). Se replica en el port por ID para ceñirse al mecanismo del binario.

## 4. Cotejo con el port (pre-fix)

`combat.ts` `canReach` (línea 808) llamaba `isRangedPathClear` para TODO `range>1`,
incluidas Morning Star/Halberd (rango 2). Un obstáculo entre atacante y objetivo a
distancia 2 producía «Blocked by wall!» (`combat.ts:1261`) — infiel: el binario pega.
`grep polearm combat.ts` = 0. **Divergencia real confirmada.**

Matiz (NO tocado, fuera de alcance): para armas que SÍ vuelan, el port pre-bloquea con
«Blocked by wall!»; el binario deja volar el proyectil hasta el muro y lo hace aterrizar
ahí (impacto en la celda opaca, daño a quien esté — normalmente nadie). El efecto neto para
proyectiles (no alcanzas al objetivo tras el muro) coincide; sólo difiere la presentación.
Se deja como observación; el fix se limita a las astas.

## 5. FIX cableado (esta rama)

- `formulas.ts`: `WEAPON_MORNING_STAR=0x19`, `WEAPON_HALBERD=0x22`, `POLEARM_WEAPONS`
  (Set) e `isPolearm(id)`.
- `combat.ts` `canReach(attacker, target, range, weaponId?)`: si `isPolearm(weaponId)` se
  omite `isRangedPathClear` (sólo se exige `dist ≤ range`). Sitios de jugador
  (`aimGeometry` línea 596, `playerAttack` línea 1257) pasan `weapon.id`. El sitio de
  hechizo (`playerCast` 1553) NO pasa arma (los hechizos conservan su LOS, CAST:0x1c28) y
  el ataque enemigo (2036) usa `isRangedPathClear` directo, sin cambio.
- Test unit: obstáculo entre atacante y objetivo a rango 2 → Halberd pega, arco no.

**Cierra B1 del censo docs-físicos como (a) DIVERGE→fixed.**
