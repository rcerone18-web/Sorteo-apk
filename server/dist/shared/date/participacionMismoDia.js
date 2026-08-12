"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.todayYmdAmericaBogota = todayYmdAmericaBogota;
exports.facturaYmdFromStored = facturaYmdFromStored;
exports.isMismaFechaParticipacionBogota = isMismaFechaParticipacionBogota;
/** Zona operativa del negocio (Colombia) para “hoy” vs fecha de factura. */
const TZ_BOGOTA = 'America/Bogota';
const YMD_PREFIX = /^(\d{4}-\d{2}-\d{2})/;
/** Fecha civil YYYY-MM-DD en America/Bogota (ahora). */
function todayYmdAmericaBogota(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ_BOGOTA,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(now);
}
/**
 * Obtiene YYYY-MM-DD de un valor devuelto por MySQL (Date) o string (ISO / solo fecha).
 * Para columnas DATE, mysql2 suele mapear a medianoche UTC con el día correcto del calendario.
 */
function facturaYmdFromStored(raw) {
    if (raw == null || raw === '')
        return null;
    if (typeof raw === 'string') {
        const m = raw.trim().match(YMD_PREFIX);
        if (m)
            return m[1];
        const d = new Date(raw);
        if (Number.isNaN(d.getTime()))
            return null;
        return ymdFromUtcDate(d);
    }
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
        return ymdFromUtcDate(raw);
    }
    const m = String(raw).trim().match(YMD_PREFIX);
    return m ? m[1] : null;
}
function ymdFromUtcDate(d) {
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
}
/** Misma fecha civil que “hoy” en Bogotá (evita CURDATE() del servidor en otra TZ). */
function isMismaFechaParticipacionBogota(fechaFacturaStored) {
    const f = facturaYmdFromStored(fechaFacturaStored);
    if (!f)
        return false;
    return f === todayYmdAmericaBogota();
}
