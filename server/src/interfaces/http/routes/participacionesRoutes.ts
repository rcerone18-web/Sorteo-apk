import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { randomUUID } from 'crypto';
import { authMiddleware } from '../middlewares/authMiddleware';
import { pool } from '../../../infrastructure/database/mysqlClient';
import { parseDate, toDateOnly, ventaPuedeParticipar } from './_helpers';

export const participacionesRoutes = Router();

// GET /api/participaciones/validar-factura/:numero
participacionesRoutes.get('/validar-factura/:numero', authMiddleware, async (req, res, next) => {
  try {
    const { numero } = req.params;
    const [mockRows] = await pool.execute<(RowDataPacket & { numero: string; fecha: string; valor: number })[]>(
      'SELECT numero, fecha, valor FROM facturas_mock WHERE numero = ?',
      [numero]
    );
    const enMock = mockRows?.[0];
    if (!enMock) return res.status(404).json({ error: 'Factura no encontrada o no participa (redimió bono)' });

    const [yaPart] = await pool.execute<(RowDataPacket & { one: number })[]>(
      'SELECT 1 as one FROM participaciones WHERE factura_numero = ?',
      [numero]
    );
    if ((yaPart?.length ?? 0) > 0) return res.status(400).json({ error: 'Esta factura ya participó en el sorteo' });

    const [ventaRows] = await pool.execute<(RowDataPacket & { cedula: string; nombre_cliente: string; presentaciones_detalle: string | null })[]>(
      'SELECT cedula, nombre_cliente, presentaciones_detalle FROM ventas WHERE numero = ?',
      [numero]
    );
    const venta = ventaRows?.[0];

    let listPresentaciones: unknown = [];
    try {
      const [cfgRows] = await pool.execute<(RowDataPacket & { valor: string })[]>(
        'SELECT valor FROM config_sorteo WHERE clave = ?',
        ['presentaiones_para_participar']
      );
      listPresentaciones = JSON.parse(cfgRows?.[0]?.valor || '[]');
    } catch {
      listPresentaciones = [];
    }

    if (!ventaPuedeParticipar(venta?.presentaciones_detalle || '[]', listPresentaciones)) {
      return res.status(403).json({
        error: 'Esta factura no cumple con las presentaciones requeridas para participar en el sorteo',
        presentacionesRequeridas: Array.isArray(listPresentaciones) ? listPresentaciones : [],
      });
    }

    return res.json({
      numero: enMock.numero,
      fecha: enMock.fecha,
      valor: enMock.valor,
      cedula: venta?.cedula || '',
      nombreCliente: venta?.nombre_cliente || '',
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/participaciones?desde=&hasta=&cliente=&factura=&estado=  (admin)
participacionesRoutes.get('/', authMiddleware, async (req, res, next) => {
  try {
    if (req.user?.rol !== 'administrador') return res.status(403).json({ error: 'Solo administrador' });

    const { desde, hasta, cliente, factura, estado } = (req.query ?? {}) as Record<string, unknown>;
    const desdeD = parseDate(desde);
    const hastaD = parseDate(hasta);
    const clienteQ = (cliente && String(cliente).trim()) || '';
    const facturaQ = (factura && String(factura).trim()) || '';
    const estadoQ = (estado && String(estado).trim().toLowerCase()) || '';

    let sql = `
      SELECT p.id, p.factura_numero as facturaNumero, p.fecha_factura as fechaFactura, p.cedula, p.nombre_cliente as nombreCliente,
             p.valor_total as valorTotal, p.consentimiento, p.fecha_registro as fechaRegistro, p.usuario_registro as usuarioRegistro
      FROM participaciones p`;
    const params: any[] = [];

    if (estadoQ === 'disponible') {
      sql += ` INNER JOIN bonos b ON b.participacion_id = p.id AND b.estado = 'disponible' AND (b.fecha_vencimiento IS NULL OR b.fecha_vencimiento >= NOW())`;
    } else if (estadoQ === 'redimido') {
      sql += ` INNER JOIN bonos b ON b.participacion_id = p.id AND b.estado = 'redimido'`;
    } else if (estadoQ === 'vencido') {
      sql += ` INNER JOIN bonos b ON b.participacion_id = p.id AND (b.estado = 'vencido' OR (b.estado = 'disponible' AND b.fecha_vencimiento < NOW()))`;
    }

    sql += ' WHERE 1=1';
    if (desdeD) {
      params.push(desdeD);
      sql += ` AND DATE(p.fecha_registro) >= DATE(?)`;
    }
    if (hastaD) {
      params.push(hastaD);
      sql += ` AND DATE(p.fecha_registro) <= DATE(?)`;
    }
    if (clienteQ) {
      params.push(`%${clienteQ}%`, `%${clienteQ}%`);
      sql += ` AND (p.nombre_cliente LIKE ? OR p.cedula LIKE ?)`;
    }
    if (facturaQ) {
      params.push(`%${facturaQ}%`);
      sql += ` AND p.factura_numero LIKE ?`;
    }
    sql += ' ORDER BY p.fecha_registro DESC LIMIT 500';

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params as any);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

// POST /api/participaciones
participacionesRoutes.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { facturaNumero, fechaFactura, cedula, nombreCliente, valorTotal, consentimiento } = (req.body ?? {}) as Record<string, unknown>;
    if (!facturaNumero || !consentimiento) {
      return res.status(400).json({ error: 'facturaNumero y consentimiento requeridos' });
    }

    const [mockRows] = await pool.execute<(RowDataPacket & { numero: string; fecha: string; valor: number })[]>(
      'SELECT numero, fecha, valor FROM facturas_mock WHERE numero = ?',
      [String(facturaNumero)]
    );
    const enMock = mockRows?.[0];
    if (!enMock) return res.status(404).json({ error: 'Factura no encontrada o no participa' });

    const [yaPart] = await pool.execute<(RowDataPacket & { one: number })[]>(
      'SELECT 1 as one FROM participaciones WHERE factura_numero = ?',
      [String(facturaNumero)]
    );
    if ((yaPart?.length ?? 0) > 0) return res.status(400).json({ error: 'Esta factura ya participó en el sorteo' });

    const [ventaRows] = await pool.execute<(RowDataPacket & { presentaciones_detalle: string | null })[]>(
      'SELECT presentaciones_detalle FROM ventas WHERE numero = ?',
      [String(facturaNumero)]
    );
    const venta = ventaRows?.[0];

    let listPresentaciones: unknown = [];
    try {
      const [cfgRows] = await pool.execute<(RowDataPacket & { valor: string })[]>(
        'SELECT valor FROM config_sorteo WHERE clave = ?',
        ['presentaiones_para_participar']
      );
      listPresentaciones = JSON.parse(cfgRows?.[0]?.valor || '[]');
    } catch {
      listPresentaciones = [];
    }

    if (!ventaPuedeParticipar(venta?.presentaciones_detalle || '[]', listPresentaciones)) {
      return res.status(403).json({
        error: 'Esta factura no cumple con las presentaciones requeridas para participar en el sorteo',
        presentacionesRequeridas: Array.isArray(listPresentaciones) ? listPresentaciones : [],
      });
    }

    const [probRows] = await pool.execute<(RowDataPacket & { valor: string })[]>(
      'SELECT valor FROM config_sorteo WHERE clave = ?',
      ['probabilidad_ganar']
    );
    let prob = parseFloat(probRows?.[0]?.valor || '0.1');
    if (Number.isNaN(prob)) prob = 0.1;
    if (prob > 1) prob = prob / 100;
    prob = Math.max(0, Math.min(1, prob));

    const [minRows] = await pool.execute<(RowDataPacket & { valor: string })[]>(
      'SELECT valor FROM config_sorteo WHERE clave = ?',
      ['compra_minima']
    );
    const compraMinima = parseFloat(minRows?.[0]?.valor || '100000');

    const gana = Math.random() < prob ? 1 : 0;

    const participacionId = randomUUID();
    const sorteoId = randomUUID();
    const fechaFacturaNorm = toDateOnly(fechaFactura || enMock.fecha) || toDateOnly(new Date());
    let valorNum = Number(valorTotal ?? enMock.valor);
    if (!Number.isFinite(valorNum) || valorNum <= 0) valorNum = Number(enMock.valor) || 1;

    await pool.execute(
      `INSERT INTO participaciones (id, factura_numero, fecha_factura, cedula, nombre_cliente, valor_total, consentimiento, usuario_registro) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        participacionId,
        String(facturaNumero),
        fechaFacturaNorm,
        String(cedula || ''),
        String(nombreCliente || ''),
        valorNum,
        consentimiento ? 1 : 0,
        req.user?.usuario ?? '',
      ]
    );
    await pool.execute(
      `INSERT INTO sorteos (id, participacion_id, ganador, usuario) VALUES (?, ?, ?, ?)`,
      [sorteoId, participacionId, gana, req.user?.usuario ?? '']
    );

    let bonoCodigo: string | null = null;
    if (gana === 1) {
      const bonoId = randomUUID();
      bonoCodigo = `BONO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const vencimiento = new Date();
      vencimiento.setMonth(vencimiento.getMonth() + 1);
      const fechaVencStr = vencimiento.toISOString().slice(0, 19).replace('T', ' ');
      await pool.execute(
        `INSERT INTO bonos (id, codigo, factura_origen, cedula, nombre_cliente, valor, fecha_vencimiento, estado, participacion_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'disponible', ?)`,
        [bonoId, bonoCodigo, String(facturaNumero), String(cedula || ''), String(nombreCliente || ''), valorNum, fechaVencStr, participacionId]
      );
    }

    return res.json({
      gana: gana === 1,
      codigoBono: gana === 1 ? bonoCodigo : undefined,
      compraMinimaBono: gana === 1 ? compraMinima : undefined,
      mensaje: gana === 1
        ? `¡Felicidades! Bono 50%. Código: ${bonoCodigo}. Compra mínima: $${compraMinima}`
        : 'Esta vez no ganaste.',
    });
  } catch (err) {
    return next(err);
  }
});

