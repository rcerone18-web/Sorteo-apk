import type { PoolConnection } from 'mysql2/promise';
import { pool } from '../database/mysqlClient';
import type { IBonoRepository, BonoRow } from '../../application/repositories/IBonoRepository';

function pickConn(tx?: unknown): PoolConnection | null {
  return (tx && typeof tx === 'object' && 'execute' in (tx as any)) ? (tx as PoolConnection) : null;
}

export class BonoRepositoryMySQL implements IBonoRepository {
  async findByCodigoNormalized(codigo: string): Promise<BonoRow | null> {
    const codigoNorm = codigo.trim();
    const [rows] = await pool.execute(
      'SELECT id, codigo, estado, fecha_vencimiento, cedula, nombre_cliente FROM bonos WHERE UPPER(TRIM(codigo)) = UPPER(?)',
      [codigoNorm],
    );
    const r = (rows as any[])[0];
    if (!r) return null;
    return {
      id: String(r.id),
      codigo: String(r.codigo),
      estado: r.estado,
      fechaVencimiento: r.fecha_vencimiento ? new Date(r.fecha_vencimiento) : null,
      cedula: String(r.cedula),
      nombreCliente: String(r.nombre_cliente),
    };
  }

  async markRedimido(id: string, tx?: unknown): Promise<void> {
    const conn = pickConn(tx);
    const exec = conn ? conn.execute.bind(conn) : pool.execute.bind(pool);
    await exec("UPDATE bonos SET estado = 'redimido' WHERE id = ? AND estado = 'disponible'", [id]);
  }
}

