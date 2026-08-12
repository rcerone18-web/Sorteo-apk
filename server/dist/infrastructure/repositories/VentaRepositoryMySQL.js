"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VentaRepositoryMySQL = void 0;
const mysqlClient_1 = require("../database/mysqlClient");
function pickConn(tx) {
    return (tx && typeof tx === 'object' && 'execute' in tx) ? tx : null;
}
class VentaRepositoryMySQL {
    async findByClientId(clientId) {
        try {
            const [rows] = await mysqlClient_1.pool.execute('SELECT numero FROM ventas WHERE client_id = ? LIMIT 1', [clientId]);
            const r = rows[0];
            return r ? { numero: String(r.numero) } : null;
        }
        catch (err) {
            // Si aún no existe la columna `client_id` (no aplicada la migración),
            // degradamos: no hay idempotencia por ese campo, retornamos null.
            if (err?.code === 'ER_BAD_FIELD_ERROR' && String(err?.message ?? '').includes('client_id')) {
                return null;
            }
            throw err;
        }
    }
    async create(record, tx) {
        const conn = pickConn(tx);
        const exec = conn ? conn.execute.bind(conn) : mysqlClient_1.pool.execute.bind(mysqlClient_1.pool);
        try {
            try {
                await exec(`INSERT INTO ventas (id, numero, fecha, cedula, nombre_cliente, valor, total_huevos, presentaciones_detalle, client_id, valor_elegible, campaign_id, estado)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'emitida')`, [
                    record.id,
                    record.numero,
                    record.fecha,
                    record.cedula,
                    record.nombreCliente,
                    record.valorTotal,
                    record.totalHuevos,
                    record.presentacionesDetalleJson,
                    record.clientId,
                    record.valorElegible ?? null,
                    record.campaignId ?? null,
                ]);
            }
            catch (err) {
                if (err?.code === 'ER_BAD_FIELD_ERROR') {
                    await exec(`INSERT INTO ventas (id, numero, fecha, cedula, nombre_cliente, valor, total_huevos, presentaciones_detalle, client_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                        record.id,
                        record.numero,
                        record.fecha,
                        record.cedula,
                        record.nombreCliente,
                        record.valorTotal,
                        record.totalHuevos,
                        record.presentacionesDetalleJson,
                        record.clientId,
                    ]);
                    return;
                }
                throw err;
            }
        }
        catch (err) {
            if (err?.code === 'ER_BAD_FIELD_ERROR' && String(err?.message ?? '').includes('client_id')) {
                // Backward compat: si no existe `client_id`, insertamos sin esa columna.
                await exec(`INSERT INTO ventas (id, numero, fecha, cedula, nombre_cliente, valor, total_huevos, presentaciones_detalle)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                    record.id,
                    record.numero,
                    record.fecha,
                    record.cedula,
                    record.nombreCliente,
                    record.valorTotal,
                    record.totalHuevos,
                    record.presentacionesDetalleJson,
                ]);
                return;
            }
            throw err;
        }
    }
}
exports.VentaRepositoryMySQL = VentaRepositoryMySQL;
