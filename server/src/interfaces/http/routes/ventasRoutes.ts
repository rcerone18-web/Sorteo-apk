import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { validateBody } from '../middlewares/validateBody';
import { crearVentaSchema } from '../../../shared/validation/ventasSchemas';
import { VentasController } from '../controllers/VentasController';
import { VentaRepositoryMySQL } from '../../../infrastructure/repositories/VentaRepositoryMySQL';
import { BonoRepositoryMySQL } from '../../../infrastructure/repositories/BonoRepositoryMySQL';
import { ConfigRepositoryMySQL } from '../../../infrastructure/repositories/ConfigRepositoryMySQL';
import { CrearVentaUseCase } from '../../../domain/use-cases/ventas/CrearVentaUseCase';
import { pool } from '../../../infrastructure/database/mysqlClient';
import type { RowDataPacket } from 'mysql2';

const ventaRepo = new VentaRepositoryMySQL();
const bonoRepo = new BonoRepositoryMySQL();
const configRepo = new ConfigRepositoryMySQL();
const crearVentaUC = new CrearVentaUseCase(ventaRepo, bonoRepo, configRepo);
const controller = new VentasController(crearVentaUC);

export const ventasRoutes = Router();

ventasRoutes.post('/', authMiddleware, validateBody(crearVentaSchema), controller.crearVenta);

ventasRoutes.get('/config/compra-minima', authMiddleware, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute<(RowDataPacket & { valor: string })[]>(
      'SELECT valor FROM config_sorteo WHERE clave = ?',
      ['compra_minima']
    );
    const compraMinima = parseFloat(rows?.[0]?.valor || '100000');
    return res.json({ compraMinima });
  } catch (err) {
    return next(err);
  }
});

ventasRoutes.get('/ultima-por-cedula/:cedula', authMiddleware, async (req, res, next) => {
  try {
    const cedula = (req.params.cedula || '').trim();
    if (!cedula) return res.status(400).json({ error: 'Cédula requerida' });
    const [rows] = await pool.execute<
      (RowDataPacket & {
        numero: string;
        fecha: string;
        cedula: string;
        nombre_cliente: string;
        valor: number;
        total_huevos: number | null;
        presentaciones_detalle: string | null;
      })[]
    >(
      'SELECT numero, fecha, cedula, nombre_cliente, valor, total_huevos, presentaciones_detalle FROM ventas WHERE cedula = ? ORDER BY created_at DESC LIMIT 1',
      [cedula]
    );
    const row = rows?.[0];
    if (!row) return res.status(404).json({ error: 'No hay ventas registradas con esta cédula' });
    return res.json({
      numeroFactura: row.numero,
      fechaFactura: row.fecha,
      cedulaCliente: row.cedula,
      nombreCliente: row.nombre_cliente,
      valorTotal: row.valor,
      totalHuevos: row.total_huevos ?? undefined,
      presentaciones: row.presentaciones_detalle ? JSON.parse(row.presentaciones_detalle) : [],
    });
  } catch (err) {
    return next(err);
  }
});

ventasRoutes.get('/por-numero/:numero', authMiddleware, async (req, res, next) => {
  try {
    const numero = req.params.numero;
    const [rows] = await pool.execute<
      (RowDataPacket & {
        numero: string;
        fecha: string;
        cedula: string;
        nombre_cliente: string;
        valor: number;
        total_huevos: number | null;
        presentaciones_detalle: string | null;
      })[]
    >(
      'SELECT numero, fecha, cedula, nombre_cliente, valor, total_huevos, presentaciones_detalle FROM ventas WHERE numero = ?',
      [numero]
    );
    const row = rows?.[0];
    if (!row) return res.status(404).json({ error: 'Factura no encontrada' });

    const [mockRows] = await pool.execute<(RowDataPacket & { one: number })[]>(
      'SELECT 1 as one FROM facturas_mock WHERE numero = ?',
      [row.numero]
    );
    const [partRows] = await pool.execute<(RowDataPacket & { one: number })[]>(
      'SELECT 1 as one FROM participaciones WHERE factura_numero = ?',
      [row.numero]
    );

    return res.json({
      numeroFactura: row.numero,
      fechaFactura: row.fecha,
      cedulaCliente: row.cedula,
      nombreCliente: row.nombre_cliente,
      valorTotal: row.valor,
      totalHuevos: row.total_huevos ?? undefined,
      presentaciones: row.presentaciones_detalle ? JSON.parse(row.presentaciones_detalle) : [],
      usadaEnSorteo: (partRows?.length ?? 0) > 0,
      tieneBonoRedimido: (mockRows?.length ?? 0) === 0,
    });
  } catch (err) {
    return next(err);
  }
});

