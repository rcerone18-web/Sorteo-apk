import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { authMiddleware } from '../middlewares/authMiddleware';
import { pool } from '../../../infrastructure/database/mysqlClient';
import { parseDate } from './_helpers';

export const bonosRoutes = Router();

// GET /api/bonos?estado=&desde=&hasta=&cliente=&factura=  (admin)
bonosRoutes.get('/', authMiddleware, async (req, res, next) => {
  try {
    if (req.user?.rol !== 'administrador') return res.status(403).json({ error: 'Solo administrador' });

    const { estado, desde, hasta, cliente, factura } = (req.query ?? {}) as Record<string, unknown>;
    const desdeD = parseDate(desde);
    const hastaD = parseDate(hasta);
    const estadoQ = (estado && String(estado).trim().toLowerCase()) || '';
    const clienteQ = (cliente && String(cliente).trim()) || '';
    const facturaQ = (factura && String(factura).trim()) || '';

    let sql = `SELECT id, codigo, factura_origen as facturaOrigen, cedula, nombre_cliente as nombreCliente, valor,
               fecha_emision as fechaEmision, fecha_vencimiento as fechaVencimiento, estado, participacion_id as participacionId
               FROM bonos WHERE 1=1`;
    const params: any[] = [];

    if (estadoQ === 'disponible') {
      sql += ` AND estado = 'disponible' AND (fecha_vencimiento IS NULL OR fecha_vencimiento >= NOW())`;
    } else if (estadoQ === 'vencido') {
      sql += ` AND (estado = 'vencido' OR (estado = 'disponible' AND fecha_vencimiento < NOW()))`;
    } else if (estadoQ) {
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

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params as any);
    const now = new Date().toISOString();
    const out = (rows as any[]).map((r) => ({
      ...r,
      estadoMostrar: r.estado === 'disponible' && r.fechaVencimiento && r.fechaVencimiento < now ? 'vencido' : r.estado,
    }));
    return res.json(out);
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/bonos/:id/redimir  (admin)
bonosRoutes.patch('/:id/redimir', authMiddleware, async (req, res, next) => {
  try {
    if (req.user?.rol !== 'administrador') return res.status(403).json({ error: 'Solo administrador' });

    const { id } = req.params;
    const [rows] = await pool.execute<(RowDataPacket & { id: string; estado: string })[]>(
      'SELECT id, estado FROM bonos WHERE id = ?',
      [id]
    );
    const bono = rows?.[0];
    if (!bono) return res.status(404).json({ error: 'Bono no encontrado' });
    if (bono.estado === 'redimido') return res.status(409).json({ error: 'Código de un solo uso: ya fue redimido' });
    if (bono.estado !== 'disponible') return res.status(400).json({ error: 'El bono no está disponible para redimir' });

    await pool.execute("UPDATE bonos SET estado = 'redimido' WHERE id = ?", [id]);
    return res.json({ ok: true, mensaje: 'Bono redimido correctamente' });
  } catch (err) {
    return next(err);
  }
});

