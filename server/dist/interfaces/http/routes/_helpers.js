"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toDateOnly = toDateOnly;
exports.parseDate = parseDate;
exports.ventaPuedeParticipar = ventaPuedeParticipar;
function toDateOnly(val) {
    if (val == null)
        return null;
    if (typeof val === 'string') {
        const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
        return match ? match[0] : val.slice(0, 10);
    }
    if (val instanceof Date)
        return val.toISOString().slice(0, 10);
    return String(val).slice(0, 10);
}
function parseDate(s) {
    if (!s || typeof s !== 'string')
        return null;
    const t = s.trim();
    return t.length >= 10 ? t.slice(0, 10) : null;
}
/** presentaciones = [{ presentacion, cantidad }, ...] o JSON string */
function ventaPuedeParticipar(presentaciones, listaPermitida) {
    if (!Array.isArray(listaPermitida) || listaPermitida.length === 0)
        return true;
    const allowSet = new Set(listaPermitida.map((s) => String(s).trim().toUpperCase()).filter(Boolean));
    let arr = presentaciones;
    if (typeof presentaciones === 'string') {
        try {
            arr = JSON.parse(presentaciones);
        }
        catch {
            return false;
        }
    }
    if (!Array.isArray(arr))
        return false;
    return arr.some((p) => {
        const obj = p;
        const raw = obj?.presentacion ?? obj?.nombre ?? obj?.tipoPresentacion;
        const nom = raw ? String(raw).trim().toUpperCase() : '';
        return nom && allowSet.has(nom);
    });
}
