"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = void 0;
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const mysqlClient_1 = require("../../../infrastructure/database/mysqlClient");
exports.adminRoutes = (0, express_1.Router)();
exports.adminRoutes.use(authMiddleware_1.authMiddleware);
function requireAdmin(rol) {
    return rol === 'administrador';
}
// GET /api/admin/metricas
exports.adminRoutes.get('/metricas', async (req, res, next) => {
    try {
        if (!requireAdmin(req.user?.rol))
            return res.status(403).json({ error: 'Solo administrador' });
        const [[p]] = await mysqlClient_1.pool.query('SELECT COUNT(*) as c FROM participaciones');
        const [[g]] = await mysqlClient_1.pool.query('SELECT COUNT(*) as c FROM sorteos WHERE ganador = 1');
        const [[emit]] = await mysqlClient_1.pool.query('SELECT COALESCE(SUM(valor), 0) as s FROM bonos');
        const [[red]] = await mysqlClient_1.pool.query("SELECT COALESCE(SUM(valor), 0) as s FROM bonos WHERE estado = 'redimido'");
        const totalParticipaciones = Number(p?.c ?? 0);
        const totalGanadores = Number(g?.c ?? 0);
        const tasaObservada = totalParticipaciones > 0 ? totalGanadores / totalParticipaciones : 0;
        const valorEmitido = Number(emit?.s ?? 0);
        const valorRedimido = Number(red?.s ?? 0);
        return res.json({
            totalParticipaciones,
            totalGanadores,
            tasaObservada: Math.round(tasaObservada * 10000) / 100,
            valorEmitido,
            valorRedimido,
        });
    }
    catch (err) {
        return next(err);
    }
});
// GET /api/admin/config/probabilidad
exports.adminRoutes.get('/config/probabilidad', async (req, res, next) => {
    try {
        if (!requireAdmin(req.user?.rol))
            return res.status(403).json({ error: 'Solo administrador' });
        const [rows] = await mysqlClient_1.pool.execute('SELECT valor FROM config_sorteo WHERE clave = ?', ['probabilidad_ganar']);
        const probabilidad = parseFloat(rows?.[0]?.valor || '0.1');
        return res.json({ probabilidad, porcentaje: Math.round(probabilidad * 100) });
    }
    catch (err) {
        return next(err);
    }
});
// PUT /api/admin/config/probabilidad
exports.adminRoutes.put('/config/probabilidad', async (req, res, next) => {
    try {
        if (!requireAdmin(req.user?.rol))
            return res.status(403).json({ error: 'Solo administrador' });
        let { porcentaje } = (req.body ?? {});
        const n = typeof porcentaje === 'number' ? porcentaje : parseFloat(String(porcentaje));
        if (Number.isNaN(n) || n < 0 || n > 100)
            return res.status(400).json({ error: 'porcentaje debe estar entre 0 y 100' });
        const probabilidad = n / 100;
        await mysqlClient_1.pool.execute("UPDATE config_sorteo SET valor = ? WHERE clave = 'probabilidad_ganar'", [String(probabilidad)]);
        return res.json({ probabilidad, porcentaje: Math.round(n) });
    }
    catch (err) {
        return next(err);
    }
});
// GET /api/admin/config/compra-minima
exports.adminRoutes.get('/config/compra-minima', async (req, res, next) => {
    try {
        if (!requireAdmin(req.user?.rol))
            return res.status(403).json({ error: 'Solo administrador' });
        const [rows] = await mysqlClient_1.pool.execute('SELECT valor FROM config_sorteo WHERE clave = ?', ['compra_minima']);
        const compraMinima = parseFloat(rows?.[0]?.valor || '100000');
        return res.json({ compraMinima });
    }
    catch (err) {
        return next(err);
    }
});
// PUT /api/admin/config/compra-minima
exports.adminRoutes.put('/config/compra-minima', async (req, res, next) => {
    try {
        if (!requireAdmin(req.user?.rol))
            return res.status(403).json({ error: 'Solo administrador' });
        let { compraMinima } = (req.body ?? {});
        const n = typeof compraMinima === 'number' ? compraMinima : parseFloat(String(compraMinima));
        if (Number.isNaN(n) || n < 0)
            return res.status(400).json({ error: 'compraMinima debe ser >= 0' });
        await mysqlClient_1.pool.execute("UPDATE config_sorteo SET valor = ? WHERE clave = 'compra_minima'", [String(n)]);
        return res.json({ compraMinima: n });
    }
    catch (err) {
        return next(err);
    }
});
// GET /api/admin/config/presentaciones-participar
exports.adminRoutes.get('/config/presentaciones-participar', async (req, res, next) => {
    try {
        if (!requireAdmin(req.user?.rol))
            return res.status(403).json({ error: 'Solo administrador' });
        const [rows] = await mysqlClient_1.pool.execute('SELECT valor FROM config_sorteo WHERE clave = ?', ['presentaiones_para_participar']);
        let presentaciones = [];
        try {
            presentaciones = JSON.parse(rows?.[0]?.valor || '[]');
        }
        catch {
            presentaciones = [];
        }
        if (!Array.isArray(presentaciones))
            presentaciones = [];
        return res.json({ presentaciones });
    }
    catch (err) {
        return next(err);
    }
});
// PUT /api/admin/config/presentaciones-participar
exports.adminRoutes.put('/config/presentaciones-participar', async (req, res, next) => {
    try {
        if (!requireAdmin(req.user?.rol))
            return res.status(403).json({ error: 'Solo administrador' });
        const { presentaciones } = (req.body ?? {});
        if (!Array.isArray(presentaciones))
            return res.status(400).json({ error: 'presentaciones debe ser un array de strings' });
        const arr = presentaciones.map((s) => String(s)).filter(Boolean);
        await mysqlClient_1.pool.execute("UPDATE config_sorteo SET valor = ? WHERE clave = 'presentaiones_para_participar'", [JSON.stringify(arr)]);
        return res.json({ presentaciones: arr });
    }
    catch (err) {
        return next(err);
    }
});
// GET /api/admin/facturas
exports.adminRoutes.get('/facturas', async (req, res, next) => {
    try {
        if (!requireAdmin(req.user?.rol))
            return res.status(403).json({ error: 'Solo administrador' });
        const [rows] = await mysqlClient_1.pool.execute('SELECT * FROM ventas ORDER BY created_at DESC LIMIT 500');
        const out = rows.map((r) => ({
            ...r,
            presentaciones: r.presentaciones_detalle ? JSON.parse(r.presentaciones_detalle) : [],
        }));
        return res.json(out);
    }
    catch (err) {
        return next(err);
    }
});
// PUT /api/admin/config/sorteo
exports.adminRoutes.put('/config/sorteo', async (req, res, next) => {
    try {
        if (!requireAdmin(req.user?.rol))
            return res.status(403).json({ error: 'Solo administrador' });
        const { probabilidadGanar, compraMinimaBono, presentacionesParticipan } = (req.body ?? {});
        if (probabilidadGanar != null) {
            await mysqlClient_1.pool.execute("UPDATE config_sorteo SET valor = ? WHERE clave = 'probabilidad_ganar'", [String(probabilidadGanar)]);
        }
        if (compraMinimaBono != null) {
            await mysqlClient_1.pool.execute("UPDATE config_sorteo SET valor = ? WHERE clave = 'compra_minima'", [String(compraMinimaBono)]);
        }
        if (presentacionesParticipan != null) {
            await mysqlClient_1.pool.execute("UPDATE config_sorteo SET valor = ? WHERE clave = 'presentaiones_para_participar'", [
                JSON.stringify(presentacionesParticipan),
            ]);
        }
        const [rows] = await mysqlClient_1.pool.execute('SELECT clave, valor FROM config_sorteo');
        const cfg = {};
        for (const r of rows) {
            if (r.clave === 'presentaiones_para_participar') {
                try {
                    cfg.presentacionesParticipan = JSON.parse(r.valor);
                }
                catch {
                    cfg.presentacionesParticipan = [];
                }
            }
            else if (r.clave === 'probabilidad_ganar')
                cfg.probabilidadGanar = parseFloat(r.valor);
            else if (r.clave === 'compra_minima')
                cfg.compraMinimaBono = parseFloat(r.valor);
        }
        return res.json({
            probabilidadGanar: cfg.probabilidadGanar ?? 0.1,
            compraMinimaBono: cfg.compraMinimaBono ?? 100000,
            presentacionesParticipan: cfg.presentacionesParticipan ?? [],
        });
    }
    catch (err) {
        return next(err);
    }
});
