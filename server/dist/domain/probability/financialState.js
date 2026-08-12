"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockVendorMetrics = lockVendorMetrics;
exports.lockGlobalMetrics = lockGlobalMetrics;
exports.reserveBudgetIfNeeded = reserveBudgetIfNeeded;
exports.finalizeParticipacionMetrics = finalizeParticipacionMetrics;
const dbCompat_1 = require("../sorteo/dbCompat");
async function lockVendorMetrics(conn, campaignId, usuario) {
    try {
        await conn.execute(`INSERT INTO campaign_metrics (campaign_id, usuario, ventas_elegibles_acum, bonos_emitidos_acum)
       VALUES (?, ?, 0, 0)
       ON DUPLICATE KEY UPDATE ventas_elegibles_acum = ventas_elegibles_acum`, [campaignId, usuario]);
        const [rows] = await conn.execute(`SELECT ventas_elegibles_acum AS v, bonos_emitidos_acum AS b
       FROM campaign_metrics WHERE campaign_id = ? AND usuario = ? FOR UPDATE`, [campaignId, usuario]);
        return {
            ventasElegibles: Number(rows?.[0]?.v ?? 0),
            bonosEmitidos: Number(rows?.[0]?.b ?? 0),
            useMetrics: true,
        };
    }
    catch (e) {
        if (!(0, dbCompat_1.isSchemaMismatchError)(e))
            throw e;
        return { ventasElegibles: 0, bonosEmitidos: 0, useMetrics: false };
    }
}
async function lockGlobalMetrics(conn, campaignId) {
    try {
        await conn.execute(`INSERT INTO campaign_metrics_global (campaign_id) VALUES (?)
       ON DUPLICATE KEY UPDATE campaign_id = campaign_id`, [campaignId]);
        const [rows] = await conn.execute(`SELECT ventas_elegibles_acum AS v, bonos_emitidos_acum AS b,
              bonos_comprometidos_reserva AS r, participaciones_count AS pc,
              ganadores_count AS gc
       FROM campaign_metrics_global WHERE campaign_id = ? FOR UPDATE`, [campaignId]);
        const r = rows?.[0];
        return {
            ventasElegibles: Number(r?.v ?? 0),
            bonosEmitidos: Number(r?.b ?? 0),
            bonosReserva: Number(r?.r ?? 0),
            participacionesCount: Number(r?.pc ?? 0),
            ganadoresCount: Number(r?.gc ?? 0),
            useGlobal: true,
        };
    }
    catch (e) {
        if (!(0, dbCompat_1.isSchemaMismatchError)(e))
            throw e;
        return {
            ventasElegibles: 0,
            bonosEmitidos: 0,
            bonosReserva: 0,
            participacionesCount: 0,
            ganadoresCount: 0,
            useGlobal: false,
        };
    }
}
/** Reserva optimista de presupuesto absoluto antes del sorteo. */
async function reserveBudgetIfNeeded(conn, campaignId, bonoValor, presupuestoTotal, modo) {
    if (!presupuestoTotal || presupuestoTotal <= 0 || (modo !== 'absoluto' && modo !== 'mixto')) {
        return { reserved: false, ok: true };
    }
    const g = await lockGlobalMetrics(conn, campaignId);
    if (!g.useGlobal)
        return { reserved: false, ok: true };
    const restante = presupuestoTotal - g.bonosEmitidos - g.bonosReserva;
    if (restante < bonoValor - 1e-6)
        return { reserved: false, ok: false };
    await conn.execute(`UPDATE campaign_metrics_global
     SET bonos_comprometidos_reserva = bonos_comprometidos_reserva + ?
     WHERE campaign_id = ?`, [bonoValor, campaignId]);
    return { reserved: true, ok: true };
}
async function finalizeParticipacionMetrics(conn, opts) {
    const { campaignId, usuario, valorElegible, bonoValor, gano, hadReserve, vendorUseMetrics } = opts;
    try {
        if (hadReserve) {
            await conn.execute(`UPDATE campaign_metrics_global SET
           ventas_elegibles_acum = ventas_elegibles_acum + ?,
           participaciones_count = participaciones_count + 1,
           bonos_comprometidos_reserva = GREATEST(0, bonos_comprometidos_reserva - ?)
           ${gano ? ', bonos_emitidos_acum = bonos_emitidos_acum + ?, ganadores_count = ganadores_count + 1' : ''}
         WHERE campaign_id = ?`, gano
                ? [valorElegible, bonoValor, bonoValor, campaignId]
                : [valorElegible, bonoValor, campaignId]);
        }
        else {
            await conn.execute(`UPDATE campaign_metrics_global SET
           ventas_elegibles_acum = ventas_elegibles_acum + ?,
           participaciones_count = participaciones_count + 1
           ${gano ? ', bonos_emitidos_acum = bonos_emitidos_acum + ?, ganadores_count = ganadores_count + 1' : ''}
         WHERE campaign_id = ?`, gano ? [valorElegible, bonoValor, campaignId] : [valorElegible, campaignId]);
        }
    }
    catch (e) {
        if (!(0, dbCompat_1.isSchemaMismatchError)(e))
            throw e;
    }
    if (gano && vendorUseMetrics) {
        try {
            await conn.execute(`UPDATE campaign_metrics SET bonos_emitidos_acum = bonos_emitidos_acum + ?
         WHERE campaign_id = ? AND usuario = ?`, [bonoValor, campaignId, usuario]);
        }
        catch (e) {
            if (!(0, dbCompat_1.isSchemaMismatchError)(e))
                throw e;
        }
    }
}
