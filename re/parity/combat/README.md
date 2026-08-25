# Paridad de combate (Task 3.2)

A diferencia de los escenarios declarativos de `re/parity/kernel/*.json`
(acciones + campos), el combate se verifica por **traza de rands**:
`re/tools/combat_parity.py` entra en un combate real (inyecta una Giant
Rat adyacente en la tabla de objetos DS:0x5C62 de la choza de Iolo — la
tabla arranca vacía — y la Ataca), registra cada
llamada a `rand_range` del kernel (sitio clasificado por la cadena de
retornos + rango + semilla + instantánea de HP/registros) y
`game/src/core/__parity__/combat-run.ts` reproduce el combate exigiendo
la misma secuencia de tiradas y la misma trayectoria de estado.

- `last-trace.json` — captura del último run en vivo (se regenera con
  `python3 re/tools/combat_parity.py`; también lo guarda el test live de
  `re/tools/test_combat_parity.py`).

Ver re/notes/combat.md (fórmulas y offsets) y re/verified/combat.md
(qué quedó verificado en runtime vs asm-derivado).
