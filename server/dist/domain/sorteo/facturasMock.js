"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ventaTieneRedencionBono = ventaTieneRedencionBono;
exports.insertFacturaMockFromVenta = insertFacturaMockFromVenta;
const dbCompat_1 = require("./dbCompat");
/** Indica si esta factura fue usada como redención de un bono (no participa). */
async function ventaTieneRedencionBono(dispatch, numeroFactura) {
    try {
        const [rows] = (await dispatch.execute('SELECT 1 as one FROM bonos WHERE factura_redencion = ? LIMIT 1', [numeroFactura]));
        return (rows?.length ?? 0) > 0;
    }
    catch (e) {
        if (!(0, dbCompat_1.isSchemaMismatchError)(e))
            throw e;
        return false;
    }
}
async function insertFacturaMockFromVenta(dispatch, params) {
    const { numero, fecha, valor, valorElegible } = params;
    try {
        await dispatch.execute('INSERT INTO facturas_mock (numero, fecha, valor, valor_elegible) VALUES (?, ?, ?, ?)', [numero, fecha, valor, valorElegible]);
    }
    catch (e) {
        if (!(0, dbCompat_1.isSchemaMismatchError)(e))
            throw e;
        await dispatch.execute('INSERT INTO facturas_mock (numero, fecha, valor) VALUES (?, ?, ?)', [
            numero,
            fecha,
            valor
        ]);
    }
}
