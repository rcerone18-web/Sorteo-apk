import type { PoolConnection } from 'mysql2/promise';
import { pool } from '../database/mysqlClient';
import type { IVentaRepository, CrearVentaRecord } from '../../application/repositories/IVentaRepository';

function pickConn(tx?: unknown): PoolConnection | null {
  return (tx && typeof tx === 'object' && 'execute' in (tx as any)) ? (tx as PoolConnection) : null;
}

export class VentaRepositoryMySQL implements IVentaRepository {
  async findByClientId(clientId: string): Promise<{ numero: string } | null> {
    try {
      const [rows] = await pool.execute('SELECT numero FROM ventas WHERE client_id = ? LIMIT 1', [clientId]);
      const r = (rows as any[])[0];
      return r ? { numero: String(r.numero) } : null;
    } catch (err: any) {
      // Si aún no existe la columna `client_id` (no aplicada la migración),
      // degradamos: no hay idempotencia por ese campo, retornamos null.
      if (err?.code === 'ER_BAD_FIELD_ERROR' && String(err?.message ?? '').includes('client_id')) {
        return null;
      }
      throw err;
    }
  }

  async create(record: CrearVentaRecord, tx?: unknown): Promise<void> {
    const conn = pickConn(tx);
    const exec = conn ? conn.execute.bind(conn) : pool.execute.bind(pool);
    try {
      try {
        await exec(
          `INSERT INTO ventas (id, numero, fecha, cedula, nombre_cliente, valor, total_huevos, presentaciones_detalle, client_id, valor_elegible, campaign_id, estado)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'emitida')`,
          [
            record.id,
            record.numero,
            record.fecha,
            record.cedula,
            record.nombreCliente,
            record.valorTotal,
            record.totalHuevos,
            record.presentacionesDetalleJson,
            record.clientId,
            record.valorElegible ?? null,
            record.campaignId ?? null,
          ],
        );
      } catch (err: any) {
        if (err?.code === 'ER_BAD_FIELD_ERROR') {
          await exec(
            `INSERT INTO ventas (id, numero, fecha, cedula, nombre_cliente, valor, total_huevos, presentaciones_detalle, client_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              record.id,
              record.numero,
              record.fecha,
              record.cedula,
              record.nombreCliente,
              record.valorTotal,
              record.totalHuevos,
              record.presentacionesDetalleJson,
              record.clientId,
            ],
          );
          return;
        }
        throw err;
      }
    } catch (err: any) {
      if (err?.code === 'ER_BAD_FIELD_ERROR' && String(err?.message ?? '').includes('client_id')) {
        // Backward compat: si no existe `client_id`, insertamos sin esa columna.
        await exec(
          `INSERT INTO ventas (id, numero, fecha, cedula, nombre_cliente, valor, total_huevos, presentaciones_detalle)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            record.id,
            record.numero,
            record.fecha,
            record.cedula,
            record.nombreCliente,
            record.valorTotal,
            record.totalHuevos,
            record.presentacionesDetalleJson,
          ],
        );
        return;
      }
      throw err;
    }
  }
}

