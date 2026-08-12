"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configRoutes = void 0;
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const mysqlClient_1 = require("../../../infrastructure/database/mysqlClient");
exports.configRoutes = (0, express_1.Router)();
// GET /api/config/sorteo
exports.configRoutes.get('/sorteo', authMiddleware_1.authMiddleware, async (_req, res, next) => {
    try {
        const [rows] = await mysqlClient_1.pool.execute('SELECT clave, valor FROM config_sorteo');
        const config = {};
        for (const r of rows) {
            // Compat: legado tenía un typo ('presentaiones_...'). Aceptar ambas claves.
            if (r.clave === 'presentaciones_para_participar' || r.clave === 'presentaiones_para_participar') {
                try {
                    const parsed = JSON.parse(r.valor || '[]');
                    config.presentacionesParticipan = Array.isArray(parsed) ? parsed : [];
                }
                catch {
                    config.presentacionesParticipan = [];
                }
            }
            else if (r.clave === 'probabilidad_ganar') {
                config.probabilidadGanar = parseFloat(r.valor);
            }
            else if (r.clave === 'compra_minima') {
                config.compraMinimaBono = parseFloat(r.valor);
            }
        }
        return res.json({
            probabilidadGanar: config.probabilidadGanar ?? 0.1,
            compraMinimaBono: config.compraMinimaBono ?? 100000,
            presentacionesParticipan: config.presentacionesParticipan ?? [],
        });
    }
    catch (err) {
        return next(err);
    }
});
