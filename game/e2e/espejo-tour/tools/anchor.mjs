/**
 * #85 — HUELLA DE CONTENIDO de un segmento de ruta. ÚNICA definición: la escriben los
 * generadores de overlay y la verifica `curate.mjs`. Vive suelta a propósito — si las dos
 * partes tuvieran copias y divergieran, TODAS las claves saldrían rancias a la vez y la
 * guarda pasaría de red de seguridad a generador de ruido.
 *
 * Por qué existe: el overlay se casaba SOLO por id de segmento, y los ids son POSICIONALES
 * (`gNN` por orden). Al re-segmentar, una clave sigue casando POR NOMBRE y apunta a OTRO
 * CONTENIDO; `overlay.segments?.[seg.id] ?? {}` la aplicaba en silencio. Medido en #85:
 * 49 de 54 decisiones desplazadas sin un solo aviso.
 *
 * Normalización = la `fuzz` del segmentador (l/I/1/]/[/|→i, 0/O→o): absorbe ruido de OCR
 * dentro de una misma pasada, pero NO un cambio de contenido.
 *
 * ⚠ ALCANCE HONESTO: esto detecta «la ruta se RE-SEGMENTÓ y las claves bailaron», que es
 * el fallo que nos mordió. NO sobrevive a un RE-OCR: si el texto mejora (part09-18 en #77),
 * la huella vieja no casa aunque el segmento sea el mismo — y entonces marcar todo rancio
 * es la respuesta CORRECTA, porque tras un re-OCR el overlay hay que regenerarlo entero.
 */
export function segAnchor(seg) {
  const src = [
    ...(seg.expect ?? []).slice(0, 3).map((e) => e.text ?? ""),
    ...(seg.script ?? []).filter((o) => o.todo).slice(0, 2).map((o) => o.todo),
  ].join(" ");
  return src
    .toLowerCase()
    .replace(/[1l|\]\[!]/g, "i")
    .replace(/[0o]/g, "o")
    .replace(/[^a-z]/g, "")
    .slice(0, 80);
}
