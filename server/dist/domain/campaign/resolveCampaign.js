"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCampaignStrictMode = isCampaignStrictMode;
exports.hasAnyActiveCampaign = hasAnyActiveCampaign;
exports.resolveDefaultActiveCampaign = resolveDefaultActiveCampaign;
exports.resolveCampaignForParticipation = resolveCampaignForParticipation;
exports.resolveCampaignForUser = resolveCampaignForUser;
exports.loadLegacyConfigSorteo = loadLegacyConfigSorteo;
function mapCampaignRow(r) {
    return {
        id: r.id,
        nombre: r.nombre,
        minSubtotalElegible: Number(r.min_subtotal_elegible),
        pctBono: Number(r.pct_bono),
        pctTopeCosto: Number(r.pct_tope_costo),
        bonoVigenciaDias: Number(r.bono_vigencia_dias),
        probabilidadBase: Number(r.probabilidad_base),
        refsElegiblesJson: r.refs_elegibles_json || '[]',
        leyendaFacturaBono: r.leyenda_factura_bono || 'ESTA FACTURA CONTIENE UN BONO',
        bonoUnSoloUso: r.bono_un_solo_uso == null ? true : Number(r.bono_un_solo_uso) === 1,
        bonoNoAcumulable: r.bono_no_acumulable == null ? true : Number(r.bono_no_acumulable) === 1,
        redencionSoloFacturaFutura: r.redencion_solo_factura_futura == null ? true : Number(r.redencion_solo_factura_futura) === 1,
        redencionMinIgualOrigen: r.redencion_min_igual_origen == null ? true : Number(r.redencion_min_igual_origen) === 1,
        presupuestoTotal: r.presupuesto_total != null ? Number(r.presupuesto_total) : null,
        presupuestoModo: r.presupuesto_modo || 'ratio',
        probabilityConfigJson: r.probability_config_json ?? null,
    };
}
const CAMPAIGN_SELECT_BASE = `c.id, c.nombre, c.min_subtotal_elegible, c.pct_bono, c.pct_tope_costo,
        c.bono_vigencia_dias, c.probabilidad_base, c.refs_elegibles_json, c.leyenda_factura_bono`;
const CAMPAIGN_SELECT_V2 = `${CAMPAIGN_SELECT_BASE},
        c.bono_un_solo_uso, c.bono_no_acumulable,
        c.redencion_solo_factura_futura, c.redencion_min_igual_origen,
        c.presupuesto_total, c.presupuesto_modo, c.probability_config_json`;
function isCampaignStrictMode() {
    return process.env.CAMPAIGN_STRICT_MODE !== 'false';
}
/** Hay al menos una campaña activa en vigencia (para modo estricto sin fallback). */
async function hasAnyActiveCampaign(pool) {
    try {
        const [rows] = await pool.execute(`SELECT 1 AS one FROM campaigns
       WHERE estado = 'activa' AND CURDATE() BETWEEN fecha_inicio AND fecha_fin
       LIMIT 1`);
        return (rows?.length ?? 0) > 0;
    }
    catch {
        return false;
    }
}
/** Campaña activa vigente (sin exigir fila en campaign_users). */
async function resolveDefaultActiveCampaign(pool) {
    const fromWhere = `FROM campaigns c
     WHERE c.estado = 'activa' AND CURDATE() BETWEEN c.fecha_inicio AND c.fecha_fin
     ORDER BY c.fecha_inicio DESC
     LIMIT 1`;
    try {
        const [rows] = await pool.execute(`SELECT ${CAMPAIGN_SELECT_V2} ${fromWhere}`);
        return rows?.[0] ? mapCampaignRow(rows[0]) : null;
    }
    catch (e) {
        const code = e.code;
        if (code !== 'ER_BAD_FIELD_ERROR')
            throw e;
        try {
            const [rows] = await pool.execute(`SELECT ${CAMPAIGN_SELECT_BASE},
                c.bono_un_solo_uso, c.bono_no_acumulable,
                c.redencion_solo_factura_futura, c.redencion_min_igual_origen
         ${fromWhere}`);
            return rows?.[0] ? mapCampaignRow(rows[0]) : null;
        }
        catch {
            const [rows] = await pool.execute(`SELECT ${CAMPAIGN_SELECT_BASE} ${fromWhere}`);
            return rows?.[0] ? mapCampaignRow(rows[0]) : null;
        }
    }
}
/**
 * Resuelve campaña para venta/participación: asignación explícita en campaign_users,
 * o campaña activa por defecto si el usuario es administrador (demo/pruebas sin auto-asignarse).
 */
async function resolveCampaignForParticipation(pool, usuario, rol) {
    const assigned = await resolveCampaignForUser(pool, usuario);
    if (assigned)
        return assigned;
    if (rol === 'administrador') {
        return resolveDefaultActiveCampaign(pool);
    }
    return null;
}
async function resolveCampaignForUser(pool, usuario) {
    const sqlExt = `SELECT ${CAMPAIGN_SELECT_V2}
     FROM campaigns c
     INNER JOIN campaign_users cu ON cu.campaign_id = c.id AND cu.usuario = ?
     WHERE c.estado = 'activa' AND CURDATE() BETWEEN c.fecha_inicio AND c.fecha_fin
     ORDER BY c.fecha_inicio DESC
     LIMIT 1`;
    try {
        const [rows] = await pool.execute(sqlExt, [usuario]);
        return rows?.[0] ? mapCampaignRow(rows[0]) : null;
    }
    catch (e) {
        const code = e.code;
        if (code !== 'ER_BAD_FIELD_ERROR')
            throw e;
        try {
            const [rows] = await pool.execute(`SELECT ${CAMPAIGN_SELECT_BASE},
                c.bono_un_solo_uso, c.bono_no_acumulable,
                c.redencion_solo_factura_futura, c.redencion_min_igual_origen
         FROM campaigns c
         INNER JOIN campaign_users cu ON cu.campaign_id = c.id AND cu.usuario = ?
         WHERE c.estado = 'activa' AND CURDATE() BETWEEN c.fecha_inicio AND c.fecha_fin
         ORDER BY c.fecha_inicio DESC
         LIMIT 1`, [usuario]);
            return rows?.[0] ? mapCampaignRow(rows[0]) : null;
        }
        catch {
            const [rows] = await pool.execute(`SELECT ${CAMPAIGN_SELECT_BASE}
         FROM campaigns c
         INNER JOIN campaign_users cu ON cu.campaign_id = c.id AND cu.usuario = ?
         WHERE c.estado = 'activa' AND CURDATE() BETWEEN c.fecha_inicio AND c.fecha_fin
         ORDER BY c.fecha_inicio DESC
         LIMIT 1`, [usuario]);
            return rows?.[0] ? mapCampaignRow(rows[0]) : null;
        }
    }
}
/** Fallback si no hay fila en campaigns (BD sin migrar): lee config_sorteo legacy. */
async function loadLegacyConfigSorteo(pool) {
    const [rows] = await pool.execute('SELECT clave, valor FROM config_sorteo');
    const cfg = {};
    for (const r of rows ?? []) {
        if (r.clave === 'presentaciones_para_participar' || r.clave === 'presentaiones_para_participar') {
            try {
                const parsed = JSON.parse(r.valor || '[]');
                cfg.presentacionesParticipan = Array.isArray(parsed) ? parsed : [];
            }
            catch {
                cfg.presentacionesParticipan = [];
            }
        }
        else if (r.clave === 'probabilidad_ganar')
            cfg.probabilidadGanar = parseFloat(r.valor);
        else if (r.clave === 'compra_minima')
            cfg.compraMinimaBono = parseFloat(r.valor);
        else if (r.clave === 'min_subtotal_refs_participar')
            cfg.minSubtotalRefsParticipar = parseFloat(r.valor);
    }
    return {
        probabilidadGanar: cfg.probabilidadGanar ?? 0.1,
        compraMinimaBono: cfg.compraMinimaBono ?? 100000,
        minSubtotalRefsParticipar: Number.isFinite(cfg.minSubtotalRefsParticipar)
            ? cfg.minSubtotalRefsParticipar
            : 0,
        presentacionesParticipan: cfg.presentacionesParticipan ?? [],
    };
}
