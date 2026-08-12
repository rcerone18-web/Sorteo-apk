import type { PoolConnection } from 'mysql2/promise';
import { pool } from '../database/mysqlClient';
import type { IBonoRepository, BonoRow } from '../../application/repositories/IBonoRepository';

function pickConn(tx?: unknown): PoolConnection | null {
  return tx && typeof tx === 'object' && 'execute' in (tx as any) ? (tx as PoolConnection) : null;
}

export class BonoRepositoryMySQL implements IBonoRepository {
  async findByCodigoNormalized(codigo: string): Promise<BonoRow | null> {
    const codigoNorm = codigo.trim();
    try {
      const [rows] = await pool.execute(
        `SELECT id, codigo, estado, fecha_vencimiento, cedula, nombre_cliente,
                COALESCE(saldo_restante, valor) as saldo_restante,
                COALESCE(valor_elegible_origen, valor) as valor_elegible_origen,
                valor
         FROM bonos WHERE UPPER(TRIM(codigo)) = UPPER(?)`,
        [codigoNorm],
      );
      const r = (rows as any[])[0];
      if (!r) return null;
      return {
        id: String(r.id),
        codigo: String(r.codigo),
        estado: String(r.estado),
        fechaVencimiento: r.fecha_vencimiento ? new Date(r.fecha_vencimiento) : null,
        cedula: String(r.cedula),
        nombreCliente: String(r.nombre_cliente),
        saldoRestante: Number(r.saldo_restante),
        valorElegibleOrigen: Number(r.valor_elegible_origen),
        valorInicial: Number(r.valor),
      };
    } catch (err: any) {
      if (err?.code === 'ER_BAD_FIELD_ERROR') {
        const [rows] = await pool.execute(
          'SELECT id, codigo, estado, fecha_vencimiento, cedula, nombre_cliente, valor FROM bonos WHERE UPPER(TRIM(codigo)) = UPPER(?)',
          [codigoNorm],
        );
        const r = (rows as any[])[0];
        if (!r) return null;
        const v = Number(r.valor);
        return {
          id: String(r.id),
          codigo: String(r.codigo),
          estado: String(r.estado),
          fechaVencimiento: r.fecha_vencimiento ? new Date(r.fecha_vencimiento) : null,
          cedula: String(r.cedula),
          nombreCliente: String(r.nombre_cliente),
          saldoRestante: v,
          valorElegibleOrigen: v,
          valorInicial: v,
        };
      }
      throw err;
    }
  }

  async markRedimido(id: string, tx?: unknown): Promise<void> {
    const conn = pickConn(tx);
    const exec = conn ? conn.execute.bind(conn) : pool.execute.bind(pool);
    await exec(
      "UPDATE bonos SET estado = 'redimido', saldo_restante = 0 WHERE id = ? AND estado IN ('vigente','caucado','disponible')",
      [id],
    );
  }

  async applyRedemption(id: string, montoUsado: number, facturaRedencion: string, tx?: unknown): Promise<void> {
    const conn = pickConn(tx);
    const exec = conn ? conn.execute.bind(conn) : pool.execute.bind(pool);
    const m = Math.max(0, montoUsado);
    await exec(
      `UPDATE bonos SET
         saldo_restante = GREATEST(0, saldo_restante - ?),
         factura_redencion = ?,
         estado = IF(GREATEST(0, saldo_restante - ?) < 0.01, 'redimido', 'caucado')
       WHERE id = ? AND estado IN ('vigente','caucado','disponible')
         AND saldo_restante + 0.00001 >= ?`,
      [m, facturaRedencion, m, id, m],
    );
  }
}
