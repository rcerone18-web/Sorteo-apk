import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { authMiddleware } from '../middlewares/authMiddleware';
import { pool } from '../../../infrastructure/database/mysqlClient';
import { parseDate } from './_helpers';

export const sorteosRoutes = Router();

// GET /api/sorteos?desde=&hasta=  (admin)
sorteosRoutes.get('/', authMiddleware, async (req, res, next) => {
  try {
    if (req.user?.rol !== 'administrador') return res.status(403).json({ error: 'Solo administrador' });

    const { desde, hasta } = (req.query ?? {}) as Record<string, unknown>;
    const desdeD = parseDate(desde);
    const hastaD = parseDate(hasta);

    let sql = `SELECT id, participacion_id as participacionId, ganador, fecha_sorteo as fechaSorteo, usuario FROM sorteos WHERE 1=1`;
    const params: any[] = [];
    if (desdeD) {
      params.push(desdeD);
      sql += ` AND DATE(fecha_sorteo) >= DATE(?)`;
    }
    if (hastaD) {
      params.push(hastaD);
      sql += ` AND DATE(fecha_sorteo) <= DATE(?)`;
    }
    sql += ' ORDER BY fecha_sorteo DESC LIMIT 500';

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params as any);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

