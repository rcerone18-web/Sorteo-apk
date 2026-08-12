"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BonoRepositoryMySQL = void 0;
const mysqlClient_1 = require("../database/mysqlClient");
function pickConn(tx) {
    return tx && typeof tx === 'object' && 'execute' in tx ? tx : null;
}
class BonoRepositoryMySQL {
    async findByCodigoNormalized(codigo) {
        const codigoNorm = codigo.trim();
        try {
            const [rows] = await mysqlClient_1.pool.execute(`SELECT id, codigo, estado, fecha_vencimiento, cedula, nombre_cliente,
                COALESCE(saldo_restante, valor) as saldo_restante,
                COALESCE(valor_elegible_origen, valor) as valor_elegible_origen,
                valor
         FROM bonos WHERE UPPER(TRIM(codigo)) = UPPER(?)`, [codigoNorm]);
            const r = rows[0];
            if (!r)
                return null;
            return {
                id: String(r.id),
                codigo: String(r.codigo),
                estado: String(r.estado),
                fechaVencimiento: r.fecha_vencimiento ? new Date(r.fecha_vencimiento) : null,
                cedula: String(r.cedula),
                nombreCliente: String(r.nombre_cliente),
                saldoRestante: Number(r.saldo_restante),
                valorElegibleOrigen: Number(r.valor_elegible_origen),
                valorInicial: Number(r.valor),
            };
        }
        catch (err) {
            if (err?.code === 'ER_BAD_FIELD_ERROR') {
                const [rows] = await mysqlClient_1.pool.execute('SELECT id, codigo, estado, fecha_vencimiento, cedula, nombre_cliente, valor FROM bonos WHERE UPPER(TRIM(codigo)) = UPPER(?)', [codigoNorm]);
                const r = rows[0];
                if (!r)
                    return null;
                const v = Number(r.valor);
                return {
                    id: String(r.id),
                    codigo: String(r.codigo),
                    estado: String(r.estado),
                    fechaVencimiento: r.fecha_vencimiento ? new Date(r.fecha_vencimiento) : null,
                    cedula: String(r.cedula),
                    nombreCliente: String(r.nombre_cliente),
                    saldoRestante: v,
                    valorElegibleOrigen: v,
                    valorInicial: v,
                };
            }
            throw err;
        }
    }
    async markRedimido(id, tx) {
        const conn = pickConn(tx);
        const exec = conn ? conn.execute.bind(conn) : mysqlClient_1.pool.execute.bind(mysqlClient_1.pool);
        await exec("UPDATE bonos SET estado = 'redimido', saldo_restante = 0 WHERE id = ? AND estado IN ('vigente','caucado','disponible')", [id]);
    }
    async applyRedemption(id, montoUsado, facturaRedencion, tx) {
        const conn = pickConn(tx);
        const exec = conn ? conn.execute.bind(conn) : mysqlClient_1.pool.execute.bind(mysqlClient_1.pool);
        const m = Math.max(0, montoUsado);
        await exec(`UPDATE bonos SET
         saldo_restante = GREATEST(0, saldo_restante - ?),
         factura_redencion = ?,
         estado = IF(GREATEST(0, saldo_restante - ?) < 0.01, 'redimido', 'caucado')
       WHERE id = ? AND estado IN ('vigente','caucado','disponible')
         AND saldo_restante + 0.00001 >= ?`, [m, facturaRedencion, m, id, m]);
    }
}
exports.BonoRepositoryMySQL = BonoRepositoryMySQL;
