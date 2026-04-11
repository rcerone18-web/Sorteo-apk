import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { authMiddleware } from '../middlewares/authMiddleware';
import { pool } from '../../../infrastructure/database/mysqlClient';

export const configRoutes = Router();

// GET /api/config/sorteo
configRoutes.get('/sorteo', authMiddleware, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute<(RowDataPacket & { clave: string; valor: string })[]>(
      'SELECT clave, valor FROM config_sorteo'
    );
    const config: {
      probabilidadGanar?: number;
      compraMinimaBono?: number;
      presentacionesParticipan?: string[];
    } = {};

    for (const r of rows) {
      if (r.clave === 'presentaiones_para_participar') {
        try {
          const parsed = JSON.parse(r.valor || '[]');
          config.presentacionesParticipan = Array.isArray(parsed) ? parsed : [];
        } catch {
          config.presentacionesParticipan = [];
        }
      } else if (r.clave === 'probabilidad_ganar') {
        config.probabilidadGanar = parseFloat(r.valor);
      } else if (r.clave === 'compra_minima') {
        config.compraMinimaBono = parseFloat(r.valor);
      }
    }

    return res.json({
      probabilidadGanar: config.probabilidadGanar ?? 0.1,
      compraMinimaBono: config.compraMinimaBono ?? 100000,
      presentacionesParticipan: config.presentacionesParticipan ?? [],
    });
  } catch (err) {
    return next(err);
  }
});

