"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsecutivoRepositoryMySQL = void 0;
class ConsecutivoRepositoryMySQL {
    async nextFactura2024(conn) {
        try {
            const [rows] = await conn.execute('SELECT valor FROM consecutivos WHERE nombre = ? FOR UPDATE', ['FACTURA_2024']);
            const current = Number(rows[0]?.valor ?? 0);
            const next = current + 1;
            await conn.execute('UPDATE consecutivos SET valor = ? WHERE nombre = ?', [next, 'FACTURA_2024']);
            return `F-2024-${String(next).padStart(3, '0')}`;
        }
        catch (err) {
            // Backward compat: si no existe la tabla `consecutivos`, calculamos desde ventas.
            if (err?.code === 'ER_NO_SUCH_TABLE' && String(err?.message ?? '').includes('consecutivos')) {
                const [rows] = await conn.execute("SELECT COALESCE(MAX(CAST(SUBSTRING(numero, 8) AS UNSIGNED)), 0) + 1 AS n FROM ventas WHERE numero LIKE 'F-2024-%'");
                const next = Number(rows[0]?.n ?? 1);
                return `F-2024-${String(next).padStart(3, '0')}`;
            }
            throw err;
        }
    }
}
exports.ConsecutivoRepositoryMySQL = ConsecutivoRepositoryMySQL;
