/** Subtotal de línea; si no hay precios, reparte valorTotal proporcional por cantidad. */
export type LineaPresentacion = {
  presentacion: string;
  cantidad: number;
  precioUnitario?: number;
  subtotal?: number;
};

export function subtotalLinea(p: LineaPresentacion): number {
  if (p.subtotal != null && Number.isFinite(p.subtotal) && p.subtotal >= 0) return p.subtotal;
  if (p.precioUnitario != null && Number.isFinite(p.precioUnitario)) return p.cantidad * p.precioUnitario;
  return 0;
}

/**
 * Suma subtotales de referencias que están en refsElegibles (vacío = todas las líneas con precio).
 * Si no hay precios en ninguna línea, usa valorTotal como único elegible (comportamiento legacy).
 */
export function calcularValorElegible(
  presentaciones: LineaPresentacion[],
  refsElegibles: string[],
  valorTotal: number
): number {
  const lines = presentaciones.map((p) => ({
    nom: String(p.presentacion || '').trim().toUpperCase(),
    sub: subtotalLinea(p),
  }));
  const tienePrecios = lines.some((l) => l.sub > 0);
  if (!tienePrecios) {
    return valorTotal > 0 ? valorTotal : 0;
  }
  if (!refsElegibles || refsElegibles.length === 0) {
    return lines.reduce((s, l) => s + l.sub, 0);
  }
  const allow = new Set(refsElegibles.map((r) => String(r).trim().toUpperCase()).filter(Boolean));
  return lines.filter((l) => l.nom && allow.has(l.nom)).reduce((s, l) => s + l.sub, 0);
}
