"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigRepositoryMySQL = void 0;
const mysqlClient_1 = require("../database/mysqlClient");
class ConfigRepositoryMySQL {
    async getCompraMinimaBono() {
        const [rows] = await mysqlClient_1.pool.execute('SELECT valor FROM config_sorteo WHERE clave = ?', ['compra_minima']);
        const v = rows[0]?.valor;
        const n = Number(v);
        return Number.isFinite(n) ? n : 100000;
    }
}
exports.ConfigRepositoryMySQL = ConfigRepositoryMySQL;
