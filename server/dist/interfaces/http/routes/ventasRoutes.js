"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ventasRoutes = void 0;
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const validateBody_1 = require("../middlewares/validateBody");
const ventasSchemas_1 = require("../../../shared/validation/ventasSchemas");
const VentasController_1 = require("../controllers/VentasController");
const VentaRepositoryMySQL_1 = require("../../../infrastructure/repositories/VentaRepositoryMySQL");
const BonoRepositoryMySQL_1 = require("../../../infrastructure/repositories/BonoRepositoryMySQL");
const ConfigRepositoryMySQL_1 = require("../../../infrastructure/repositories/ConfigRepositoryMySQL");
const CrearVentaUseCase_1 = require("../../../domain/use-cases/ventas/CrearVentaUseCase");
const mysqlClient_1 = require("../../../infrastructure/database/mysqlClient");
const participacionMismoDia_1 = require("../../../shared/date/participacionMismoDia");
const ventaRepo = new VentaRepositoryMySQL_1.VentaRepositoryMySQL();
const bonoRepo = new BonoRepositoryMySQL_1.BonoRepositoryMySQL();
const configRepo = new ConfigRepositoryMySQL_1.ConfigRepositoryMySQL();
const crearVentaUC = new CrearVentaUseCase_1.CrearVentaUseCase(ventaRepo, bonoRepo, configRepo);
const controller = new VentasController_1.VentasController(crearVentaUC);
exports.ventasRoutes = (0, express_1.Router)();
exports.ventasRoutes.post('/', authMiddleware_1.authMiddleware, (0, validateBody_1.validateBody)(ventasSchemas_1.crearVentaSchema), controller.crearVenta);
/** Anula factura y bonos asociados (brief: anulación automática del bono). Solo administrador. */
exports.ventasRoutes.patch('/:numero/anular', authMiddleware_1.authMiddleware, async (req, res, next) => {
    try {
        if (req.user?.rol !== 'administrador')
            return res.status(403).json({ error: 'Solo administrador' });
        const numero = String(req.params.numero || '').trim();
        if (!numero)
            return res.status(400).json({ error: 'Número requerido' });
        try {
            await mysqlClient_1.pool.execute("UPDATE ventas SET estado = 'anulada' WHERE numero = ?", [numero]);
        }
        catch {
            /* columna estado opcional */
        }
        await mysqlClient_1.pool.execute("UPDATE bonos SET estado = 'anulado', saldo_restante = 0 WHERE factura_origen = ? AND estado IN ('vigente','caucado','disponible')", [numero]);
        try {
            await mysqlClient_1.pool.execute('DELETE FROM facturas_mock WHERE numero = ?', [numero]);
        }
        catch {
            /* */
        }
        return res.json({ ok: true, mensaje: 'Factura anulada y bonos revocados' });
    }
    catch (err) {
        return next(err);
    }
});
exports.ventasRoutes.get('/config/compra-minima', authMiddleware_1.authMiddleware, async (_req, res, next) => {
    try {
        const [rows] = await mysqlClient_1.pool.execute('SELECT valor FROM config_sorteo WHERE clave = ?', ['compra_minima']);
        const compraMinima = parseFloat(rows?.[0]?.valor || '100000');
        return res.json({ compraMinima });
    }
    catch (err) {
        return next(err);
    }
});
exports.ventasRoutes.get('/ultima-por-cedula/:cedula', authMiddleware_1.authMiddleware, async (req, res, next) => {
    try {
        const cedula = (req.params.cedula || '').trim();
        if (!cedula)
            return res.status(400).json({ error: 'Cédula requerida' });
        const [rows] = await mysqlClient_1.pool.execute(`SELECT numero,
              DATE_FORMAT(fecha, '%Y-%m-%d') as fecha,
              cedula, nombre_cliente, valor, total_huevos, presentaciones_detalle
       FROM ventas
       WHERE cedula = ?
       ORDER BY created_at DESC
       LIMIT 1`, [cedula]);
        const row = rows?.[0];
        if (!row)
            return res.status(404).json({ error: 'No hay ventas registradas con esta cédula' });
        const fechaFactura = (0, participacionMismoDia_1.facturaYmdFromStored)(row.fecha) ?? '';
        return res.json({
            numeroFactura: row.numero,
            fechaFactura,
            cedulaCliente: row.cedula,
            nombreCliente: row.nombre_cliente,
            valorTotal: row.valor,
            totalHuevos: row.total_huevos ?? undefined,
            presentaciones: row.presentaciones_detalle ? JSON.parse(row.presentaciones_detalle) : [],
        });
    }
    catch (err) {
        return next(err);
    }
});
exports.ventasRoutes.get('/por-numero/:numero', authMiddleware_1.authMiddleware, async (req, res, next) => {
    try {
        const numero = req.params.numero;
        const [rows] = await mysqlClient_1.pool.execute(`SELECT numero,
              DATE_FORMAT(fecha, '%Y-%m-%d') as fecha,
              cedula, nombre_cliente, valor, total_huevos, presentaciones_detalle
       FROM ventas
       WHERE numero = ?`, [numero]);
        const row = rows?.[0];
        if (!row)
            return res.status(404).json({ error: 'Factura no encontrada' });
        const fechaFactura = (0, participacionMismoDia_1.facturaYmdFromStored)(row.fecha) ?? '';
        const [mockRows] = await mysqlClient_1.pool.execute('SELECT 1 as one FROM facturas_mock WHERE numero = ?', [row.numero]);
        const [partRows] = await mysqlClient_1.pool.execute('SELECT 1 as one FROM participaciones WHERE factura_numero = ?', [row.numero]);
        return res.json({
            numeroFactura: row.numero,
            fechaFactura,
            cedulaCliente: row.cedula,
            nombreCliente: row.nombre_cliente,
            valorTotal: row.valor,
            totalHuevos: row.total_huevos ?? undefined,
            presentaciones: row.presentaciones_detalle ? JSON.parse(row.presentaciones_detalle) : [],
            usadaEnSorteo: (partRows?.length ?? 0) > 0,
            tieneBonoRedimido: (mockRows?.length ?? 0) === 0,
        });
    }
    catch (err) {
        return next(err);
    }
});
