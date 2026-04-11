"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sorteosRoutes = void 0;
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const mysqlClient_1 = require("../../../infrastructure/database/mysqlClient");
const _helpers_1 = require("./_helpers");
exports.sorteosRoutes = (0, express_1.Router)();
// GET /api/sorteos?desde=&hasta=  (admin)
exports.sorteosRoutes.get('/', authMiddleware_1.authMiddleware, async (req, res, next) => {
    try {
        if (req.user?.rol !== 'administrador')
            return res.status(403).json({ error: 'Solo administrador' });
        const { desde, hasta } = (req.query ?? {});
        const desdeD = (0, _helpers_1.parseDate)(desde);
        const hastaD = (0, _helpers_1.parseDate)(hasta);
        let sql = `SELECT id, participacion_id as participacionId, ganador, fecha_sorteo as fechaSorteo, usuario FROM sorteos WHERE 1=1`;
        const params = [];
        if (desdeD) {
            params.push(desdeD);
            sql += ` AND DATE(fecha_sorteo) >= DATE(?)`;
        }
        if (hastaD) {
            params.push(hastaD);
            sql += ` AND DATE(fecha_sorteo) <= DATE(?)`;
        }
        sql += ' ORDER BY fecha_sorteo DESC LIMIT 500';
        const [rows] = await mysqlClient_1.pool.execute(sql, params);
        return res.json(rows);
    }
    catch (err) {
        return next(err);
    }
});
