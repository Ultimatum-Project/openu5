/**
 * #268 — LA PREGUNTA DEL SANTUARIO SE TECLEA EN LA CONSOLA, NO EN UN MODAL.
 *
 * Reporte del usuario (14-08, iPhone portrait, Shrine of Honesty): «UPON WHAT VIRTUE DOST
 * THOU MEDITATE?» salía como diálogo HTML moderno —caja blanca, `<input>`, botones
 * Speak/Cancel— encima del juego. En 1988 no hay ventana: `shrine_visit` (CAST2.OVL
 * 0x0966) imprime el literal con `print_string` y lee la respuesta con el `input_string`
 * del kernel (ULTIMA.EXE 0x3b1c), ecoándola EN LÍNEA sobre la consola del marco EGA.
 *
 * QUÉ FIJA ESTE SPEC, y por qué cada aserto es el que es:
 *   1. la pregunta aparece en la CONSOLA (`consoleLines`, el ring que la piel pinta con
 *      la fuente de píxeles) — no en el DOM;
 *   2. NO existe el modal: cero `.save-name` visibles mientras el prompt está vivo. Es el
 *      aserto que habría cazado el defecto del reporte, y por eso va con el prompt ABIERTO
 *      (comprobarlo con el prompt cerrado pasaría trivialmente, mida lo que mida);
 *   3. el prompt VIVO es un getstring de consola (`inputSinks().prompt === "text"`), que
 *      es lo que hace que el deck alce la hoja A-Z y iOS despliegue el teclado;
 *   4. lo TECLEADO se ecoa en la consola (fila de eco viva, `echoSetLast`);
 *   5. el flujo completo virtud→mantra×3 sigue resolviendo la ceremonia.
 *
 * ★ El aserto 4 se mide con un mutante natural: se teclea `Ahm` y se exige ver `Ahm` en la
 * fila del eco ANTES del Enter. Un eco que no existiera dejaría la fila en el prefijo
 * ("Mantra:") y el aserto caería — no es un `toBeVisible` que pasa con la pantalla vacía.
 *
 * Corre en `iphone` (Chromium) y `iphone-webkit` (WebKit): la entrada de texto es
 * justamente donde los dos motores divergieron antes (#192 autocapitalize, #219 IDL que
 * no refleja), así que el segundo motor no es adorno.
 */
import { test, expect } from "@playwright/test";
import { gotoMobile } from "./deck";

/** Tipo del prompt VIVO (`__u5test.inputSinks().prompt`), o null si no hay ninguno. */
async function promptType(page: import("@playwright/test").Page): Promise<string | null> {
  return page.evaluate(() => {
    const t = (window as unknown as {
      __u5test?: { inputSinks?: () => Record<string, unknown> };
    }).__u5test;
    return (t?.inputSinks?.().prompt as string | null) ?? null;
  });
}

/** Consola lógica viva (ring de 12 líneas) como un solo texto. */
async function consola(page: import("@playwright/test").Page): Promise<string> {
  return page.evaluate(() => {
    const t = (window as unknown as {
      __u5test?: { consoleLines?: () => string[] };
    }).__u5test;
    return (t?.consoleLines?.() ?? []).join("\n");
  });
}

// (233,66) = Shrine of Honesty en el sobremundo; se entra desde (232,66) con un paso al
// este + (E)nter, que es el disparador real de la ceremonia (cmd_enter 0x936, F2-T6).
test("#268 · la pregunta del santuario vive en la CONSOLA y el modal NO existe", async ({ page }) => {
  await gotoMobile(page, "clasico", { x: 232, y: 66, seed: 1 });
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("e");

  // (1) la pregunta se imprimió en la consola…
  await expect.poll(() => consola(page)).toMatch(/Upon what virtue dost thou meditate\?/i);
  // (3) …y lo que espera el motor es un getstring de CONSOLA (el que alza la hoja A-Z).
  await expect.poll(() => promptType(page)).toBe("text");
  // (2) EL ASERTO DEL REPORTE: con el prompt abierto, ningún input del modal retirado.
  await expect(page.locator(".save-name:visible")).toHaveCount(0);
  await expect(page.locator(".save-panel:visible")).toHaveCount(0);

  // (4) el eco: se teclea la virtud y se LEE en la consola antes de confirmar.
  await page.keyboard.type("Honesty");
  await expect.poll(() => consola(page)).toMatch(/Honesty/);
  await page.keyboard.press("Enter");

  // (5) el resto de la ceremonia: tres mantras por el mismo camino, y el desenlace.
  for (let i = 0; i < 3; i++) {
    await expect.poll(() => promptType(page)).toBe("text");
    await expect(page.locator(".save-name:visible")).toHaveCount(0);
    await page.keyboard.type("Ahm");
    await expect.poll(() => consola(page)).toMatch(/Ahm/);
    await page.keyboard.press("Enter");
  }
  await expect.poll(() => consola(page)).toMatch(/a Quest is ordained!/i);
  await expect.poll(() => promptType(page)).toBeNull(); // la cadena cerró
});

test("#268 · Escape cierra el getstring del santuario sin dejar prompt colgando", async ({ page }) => {
  await gotoMobile(page, "clasico", { x: 232, y: 66, seed: 1 });
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("e");
  await expect.poll(() => promptType(page)).toBe("text");

  // Entrada VACÍA = salir del rito, como el binario (CAST2 0x09cc `cmp byte [0xbd08],0`).
  // Antes de #268 la salida era el botón Cancel del modal, que además NO llamaba al submit
  // y dejaba el `pending` del santuario sin limpiar.
  //
  // ⚠ Y la salida es EN SILENCIO (#275, ef6a6565): el binario salta a 0x0d1d, DESPUÉS
  // del flash de 0x0d1a — no imprime nada. «Thine thoughts are unfocused.» (0xb5de) vive
  // en la rama 0x0a62 del mantra EQUIVOCADO, inalcanzable con el búfer vacío. Este test
  // exigía ese mensaje aquí y era el port INFIEL el que lo imprimía; el control positivo
  // del mensaje con búfer NO vacío vive en tests/shrine-scene.test.ts (guarda de #275) y
  // en el spec de escritorio del rito.
  await page.keyboard.press("Escape");
  await expect.poll(() => promptType(page)).toBeNull();

  // Y el juego vuelve a aceptar comandos: el prompt no se quedó tragándose las teclas.
  // ⚠ SE MIDE POR EL ECO DEL COMANDO, NO POR LA POSICIÓN. La primera versión de este
  // aserto exigía volver a x=232 y fallaba en los dos motores — pero el CONTROL (misma
  // ida y vuelta SIN ceremonia) da «Blocked!» igual: desde el ankh (233,66) el paso al
  // oeste NO es transitable, así que la posición no distingue «tecla tragada» de «tecla
  // recibida y rechazada por el mapa», que es justo lo que hay que distinguir aquí.
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => consola(page)).toMatch(/West/);

  // SILENCIO afirmado DESPUÉS del eco de West (así el aserto de ausencia no gana por
  // mirar antes de tiempo): la salida vacía no imprimió el «unfocused» de la rama de
  // fallo — ni nada del rito.
  expect(await consola(page)).not.toMatch(/Thine thoughts are unfocused/i);
});
