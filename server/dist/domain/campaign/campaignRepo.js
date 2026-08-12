"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCampaigns = listCampaigns;
exports.getCampaignById = getCampaignById;
exports.createCampaign = createCampaign;
exports.updateCampaign = updateCampaign;
exports.setCampaignEstado = setCampaignEstado;
exports.deleteCampaign = deleteCampaign;
const crypto_1 = require("crypto");
function isMissingColumn(e) {
    return e?.code === 'ER_BAD_FIELD_ERROR';
}
function ymd(value) {
    if (!value)
        return '';
    if (value instanceof Date)
        return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
}
function toBool(v, def = true) {
    if (v == null)
        return def;
    return Number(v) === 1;
}
function mapRow(r) {
    return {
        id: r.id,
        nombre: r.nombre,
        fechaInicio: ymd(r.fechaInicio),
        fechaFin: ymd(r.fechaFin),
        minSubtotalElegible: Number(r.min_subtotal_elegible),
        pctBono: Number(r.pct_bono),
        pctTopeCosto: Number(r.pct_tope_costo),
        bonoVigenciaDias: Number(r.bono_vigencia_dias),
        probabilidadBase: Number(r.probabilidad_base),
        estado: r.estado,
        refsElegiblesJson: r.refs_elegibles_json || '[]',
        leyendaFacturaBono: r.leyenda_factura_bono || 'ESTA FACTURA CONTIENE UN BONO',
        bonoUnSoloUso: toBool(r.bono_un_solo_uso, true),
        bonoNoAcumulable: toBool(r.bono_no_acumulable, true),
        redencionSoloFacturaFutura: toBool(r.redencion_solo_factura_futura, true),
        redencionMinIgualOrigen: toBool(r.redencion_min_igual_origen, true),
        presupuestoTotal: r.presupuesto_total != null ? Number(r.presupuesto_total) : null,
        presupuestoModo: r.presupuesto_modo || 'ratio',
        probabilityConfigJson: r.probability_config_json ?? null,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
    };
}
const SELECT_BASE = `id, nombre,
    DATE_FORMAT(fecha_inicio, '%Y-%m-%d') as fechaInicio,
    DATE_FORMAT(fecha_fin, '%Y-%m-%d') as fechaFin,
    min_subtotal_elegible, pct_bono, pct_tope_costo,
    bono_vigencia_dias, probabilidad_base, estado,
    refs_elegibles_json, leyenda_factura_bono`;
const SELECT_EXT = `${SELECT_BASE},
    bono_un_solo_uso, bono_no_acumulable,
    redencion_solo_factura_futura, redencion_min_igual_origen,
    presupuesto_total, presupuesto_modo, probability_config_json,
    created_at, updated_at`;
async function listCampaigns(pool) {
    try {
        const [rows] = await pool.execute(`SELECT ${SELECT_EXT} FROM campaigns ORDER BY fecha_inicio DESC`);
        return rows.map(mapRow);
    }
    catch (e) {
        if (!isMissingColumn(e))
            throw e;
        const [rows] = await pool.execute(`SELECT ${SELECT_BASE} FROM campaigns ORDER BY fecha_inicio DESC`);
        return rows.map(mapRow);
    }
}
async function getCampaignById(pool, id) {
    try {
        const [rows] = await pool.execute(`SELECT ${SELECT_EXT} FROM campaigns WHERE id = ? LIMIT 1`, [id]);
        return rows?.[0] ? mapRow(rows[0]) : null;
    }
    catch (e) {
        if (!isMissingColumn(e))
            throw e;
        const [rows] = await pool.execute(`SELECT ${SELECT_BASE} FROM campaigns WHERE id = ? LIMIT 1`, [id]);
        return rows?.[0] ? mapRow(rows[0]) : null;
    }
}
async function createCampaign(pool, input) {
    const id = (0, crypto_1.randomUUID)();
    const refsJson = JSON.stringify(Array.isArray(input.refsElegibles) ? input.refsElegibles : []);
    try {
        await pool.execute(`INSERT INTO campaigns
        (id, nombre, fecha_inicio, fecha_fin, min_subtotal_elegible, pct_bono, pct_tope_costo,
         bono_vigencia_dias, probabilidad_base, estado, refs_elegibles_json, leyenda_factura_bono,
         bono_un_solo_uso, bono_no_acumulable, redencion_solo_factura_futura, redencion_min_igual_origen,
         presupuesto_total, presupuesto_modo, probability_config_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            id,
            input.nombre,
            input.fechaInicio,
            input.fechaFin,
            input.minSubtotalElegible,
            input.pctBono,
            input.pctTopeCosto,
            input.bonoVigenciaDias,
            input.probabilidadBase,
            input.estado,
            refsJson,
            input.leyendaFacturaBono,
            input.bonoUnSoloUso ? 1 : 0,
            input.bonoNoAcumulable ? 1 : 0,
            input.redencionSoloFacturaFutura ? 1 : 0,
            input.redencionMinIgualOrigen ? 1 : 0,
            input.presupuestoTotal ?? null,
            input.presupuestoModo ?? 'ratio',
            input.probabilityConfigJson ?? null,
        ]);
        await pool.execute(`INSERT IGNORE INTO campaign_metrics_global (campaign_id) VALUES (?)`, [id]);
    }
    catch (e) {
        if (!isMissingColumn(e))
            throw e;
        await pool.execute(`INSERT INTO campaigns
        (id, nombre, fecha_inicio, fecha_fin, min_subtotal_elegible, pct_bono, pct_tope_costo,
         bono_vigencia_dias, probabilidad_base, estado, refs_elegibles_json, leyenda_factura_bono)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            id,
            input.nombre,
            input.fechaInicio,
            input.fechaFin,
            input.minSubtotalElegible,
            input.pctBono,
            input.pctTopeCosto,
            input.bonoVigenciaDias,
            input.probabilidadBase,
            input.estado,
            refsJson,
            input.leyendaFacturaBono,
        ]);
    }
    const created = await getCampaignById(pool, id);
    if (!created)
        throw new Error('No se pudo recuperar la campaña recién creada');
    return created;
}
async function updateCampaign(pool, id, patch) {
    const sets = [];
    const params = [];
    const map = {
        nombre: 'nombre',
        fechaInicio: 'fecha_inicio',
        fechaFin: 'fecha_fin',
        minSubtotalElegible: 'min_subtotal_elegible',
        pctBono: 'pct_bono',
        pctTopeCosto: 'pct_tope_costo',
        bonoVigenciaDias: 'bono_vigencia_dias',
        probabilidadBase: 'probabilidad_base',
        estado: 'estado',
        refsElegibles: 'refs_elegibles_json',
        leyendaFacturaBono: 'leyenda_factura_bono',
        bonoUnSoloUso: 'bono_un_solo_uso',
        bonoNoAcumulable: 'bono_no_acumulable',
        redencionSoloFacturaFutura: 'redencion_solo_factura_futura',
        redencionMinIgualOrigen: 'redencion_min_igual_origen',
        presupuestoTotal: 'presupuesto_total',
        presupuestoModo: 'presupuesto_modo',
        probabilityConfigJson: 'probability_config_json',
    };
    for (const [keyRaw, col] of Object.entries(map)) {
        const value = patch[keyRaw];
        if (value === undefined)
            continue;
        if (keyRaw === 'refsElegibles') {
            sets.push(`${col} = ?`);
            params.push(JSON.stringify(Array.isArray(value) ? value : []));
        }
        else if (keyRaw === 'bonoUnSoloUso' ||
            keyRaw === 'bonoNoAcumulable' ||
            keyRaw === 'redencionSoloFacturaFutura' ||
            keyRaw === 'redencionMinIgualOrigen') {
            sets.push(`${col} = ?`);
            params.push(value ? 1 : 0);
        }
        else if (keyRaw === 'presupuestoTotal') {
            sets.push(`${col} = ?`);
            params.push(value == null ? null : Number(value));
        }
        else if (keyRaw === 'probabilityConfigJson') {
            sets.push(`${col} = ?`);
            params.push(value == null ? null : String(value));
        }
        else {
            sets.push(`${col} = ?`);
            params.push(value);
        }
    }
    if (!sets.length) {
        return getCampaignById(pool, id);
    }
    params.push(id);
    const sql = `UPDATE campaigns SET ${sets.join(', ')} WHERE id = ?`;
    try {
        await pool.execute(sql, params);
    }
    catch (e) {
        if (!isMissingColumn(e))
            throw e;
        // Reintenta sin las columnas extendidas (omitiendo flags nuevos).
        const safeKeys = [
            'nombre',
            'fechaInicio',
            'fechaFin',
            'minSubtotalElegible',
            'pctBono',
            'pctTopeCosto',
            'bonoVigenciaDias',
            'probabilidadBase',
            'estado',
            'refsElegibles',
            'leyendaFacturaBono',
        ];
        const safeSets = [];
        const safeParams = [];
        for (const k of safeKeys) {
            const value = patch[k];
            if (value === undefined)
                continue;
            safeSets.push(`${map[k]} = ?`);
            if (k === 'refsElegibles')
                safeParams.push(JSON.stringify(Array.isArray(value) ? value : []));
            else
                safeParams.push(value);
        }
        if (!safeSets.length)
            return getCampaignById(pool, id);
        safeParams.push(id);
        await pool.execute(`UPDATE campaigns SET ${safeSets.join(', ')} WHERE id = ?`, safeParams);
    }
    return getCampaignById(pool, id);
}
async function setCampaignEstado(pool, id, estado) {
    await pool.execute(`UPDATE campaigns SET estado = ? WHERE id = ?`, [estado, id]);
    return getCampaignById(pool, id);
}
async function deleteCampaign(pool, id) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        // Las tablas dependientes (campaign_users, campaign_metrics) tienen ON DELETE CASCADE.
        // Validación blanda: no eliminar si hay participaciones/bonos asociados; preferimos desactivar.
        const [pRows] = await conn.execute(`SELECT COUNT(*) as c FROM participaciones WHERE campaign_id = ?`, [id]);
        const [bRows] = await conn.execute(`SELECT COUNT(*) as c FROM bonos WHERE campaign_id = ?`, [id]);
        const tieneParticipaciones = Number(pRows?.[0]?.c ?? 0) > 0;
        const tieneBonos = Number(bRows?.[0]?.c ?? 0) > 0;
        if (tieneParticipaciones || tieneBonos) {
            await conn.rollback();
            throw Object.assign(new Error('La campaña tiene historial (participaciones o bonos). Desactívala en lugar de eliminarla.'), { status: 409 });
        }
        const [r] = await conn.execute(`DELETE FROM campaigns WHERE id = ?`, [id]);
        await conn.commit();
        return (r.affectedRows ?? 0) > 0;
    }
    catch (e) {
        try {
            await conn.rollback();
        }
        catch {
            /* ignore */
        }
        throw e;
    }
    finally {
        conn.release();
    }
}
