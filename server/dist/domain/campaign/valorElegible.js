"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subtotalLinea = subtotalLinea;
exports.calcularValorElegible = calcularValorElegible;
function subtotalLinea(p) {
    if (p.subtotal != null && Number.isFinite(p.subtotal) && p.subtotal >= 0)
        return p.subtotal;
    if (p.precioUnitario != null && Number.isFinite(p.precioUnitario))
        return p.cantidad * p.precioUnitario;
    return 0;
}
/**
 * Suma subtotales de referencias que están en refsElegibles (vacío = todas las líneas con precio).
 * Si no hay precios en ninguna línea, usa valorTotal como único elegible (comportamiento legacy).
 */
function calcularValorElegible(presentaciones, refsElegibles, valorTotal) {
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
