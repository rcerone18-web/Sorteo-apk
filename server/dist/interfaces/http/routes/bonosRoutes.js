"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bonosRoutes = void 0;
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const mysqlClient_1 = require("../../../infrastructure/database/mysqlClient");
const _helpers_1 = require("./_helpers");
exports.bonosRoutes = (0, express_1.Router)();
// GET /api/bonos?estado=&desde=&hasta=&cliente=&factura=  (admin)
exports.bonosRoutes.get('/', authMiddleware_1.authMiddleware, async (req, res, next) => {
    try {
        if (req.user?.rol !== 'administrador')
            return res.status(403).json({ error: 'Solo administrador' });
        const { estado, desde, hasta, cliente, factura } = (req.query ?? {});
        const desdeD = (0, _helpers_1.parseDate)(desde);
        const hastaD = (0, _helpers_1.parseDate)(hasta);
        const estadoQ = (estado && String(estado).trim().toLowerCase()) || '';
        const clienteQ = (cliente && String(cliente).trim()) || '';
        const facturaQ = (factura && String(factura).trim()) || '';
        let sql = `SELECT id, codigo, factura_origen as facturaOrigen, cedula, nombre_cliente as nombreCliente, valor,
               fecha_emision as fechaEmision, fecha_vencimiento as fechaVencimiento, estado, participacion_id as participacionId
               FROM bonos WHERE 1=1`;
        const params = [];
        if (estadoQ === 'disponible' || estadoQ === 'vigente') {
            sql += ` AND estado IN ('disponible','vigente','caucado') AND (fecha_vencimiento IS NULL OR fecha_vencimiento >= NOW())`;
        }
        else if (estadoQ === 'vencido') {
            sql += ` AND (estado = 'vencido' OR (estado IN ('disponible','vigente') AND fecha_vencimiento < NOW()))`;
        }
        else if (estadoQ) {
            params.push(estadoQ);
            sql += ` AND estado = ?`;
        }
        if (desdeD) {
            params.push(desdeD);
            sql += ` AND DATE(fecha_emision) >= DATE(?)`;
        }
        if (hastaD) {
            params.push(hastaD);
            sql += ` AND DATE(fecha_emision) <= DATE(?)`;
        }
        if (clienteQ) {
            params.push(`%${clienteQ}%`, `%${clienteQ}%`);
            sql += ` AND (nombre_cliente LIKE ? OR cedula LIKE ?)`;
        }
        if (facturaQ) {
            params.push(`%${facturaQ}%`);
            sql += ` AND factura_origen LIKE ?`;
        }
        sql += ' ORDER BY fecha_emision DESC LIMIT 500';
        const [rows] = await mysqlClient_1.pool.execute(sql, params);
        const now = new Date().toISOString();
        const out = rows.map((r) => ({
            ...r,
            estadoMostrar: (r.estado === 'disponible' || r.estado === 'vigente') && r.fechaVencimiento && r.fechaVencimiento < now
                ? 'vencido'
                : r.estado,
        }));
        return res.json(out);
    }
    catch (err) {
        return next(err);
    }
});
// PATCH /api/bonos/:id/redimir  (admin)
exports.bonosRoutes.patch('/:id/redimir', authMiddleware_1.authMiddleware, async (req, res, next) => {
    try {
        if (req.user?.rol !== 'administrador')
            return res.status(403).json({ error: 'Solo administrador' });
        const { id } = req.params;
        const [rows] = await mysqlClient_1.pool.execute('SELECT id, estado FROM bonos WHERE id = ?', [id]);
        const bono = rows?.[0];
        if (!bono)
            return res.status(404).json({ error: 'Bono no encontrado' });
        if (bono.estado === 'redimido')
            return res.status(409).json({ error: 'Código de un solo uso: ya fue redimido' });
        if (!['disponible', 'vigente', 'caucado'].includes(bono.estado)) {
            return res.status(400).json({ error: 'El bono no está disponible para redimir' });
        }
        await mysqlClient_1.pool.execute("UPDATE bonos SET estado = 'redimido', saldo_restante = 0 WHERE id = ?", [id]);
        return res.json({ ok: true, mensaje: 'Bono redimido correctamente' });
    }
    catch (err) {
        return next(err);
    }
});
