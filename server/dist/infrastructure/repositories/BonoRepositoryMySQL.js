"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BonoRepositoryMySQL = void 0;
const mysqlClient_1 = require("../database/mysqlClient");
function pickConn(tx) {
    return (tx && typeof tx === 'object' && 'execute' in tx) ? tx : null;
}
class BonoRepositoryMySQL {
    async findByCodigoNormalized(codigo) {
        const codigoNorm = codigo.trim();
        const [rows] = await mysqlClient_1.pool.execute('SELECT id, codigo, estado, fecha_vencimiento, cedula, nombre_cliente FROM bonos WHERE UPPER(TRIM(codigo)) = UPPER(?)', [codigoNorm]);
        const r = rows[0];
        if (!r)
            return null;
        return {
            id: String(r.id),
            codigo: String(r.codigo),
            estado: r.estado,
            fechaVencimiento: r.fecha_vencimiento ? new Date(r.fecha_vencimiento) : null,
            cedula: String(r.cedula),
            nombreCliente: String(r.nombre_cliente),
        };
    }
    async markRedimido(id, tx) {
        const conn = pickConn(tx);
        const exec = conn ? conn.execute.bind(conn) : mysqlClient_1.pool.execute.bind(mysqlClient_1.pool);
        await exec("UPDATE bonos SET estado = 'redimido' WHERE id = ? AND estado = 'disponible'", [id]);
    }
}
exports.BonoRepositoryMySQL = BonoRepositoryMySQL;
