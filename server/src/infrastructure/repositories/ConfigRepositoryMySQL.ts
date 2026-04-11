import { pool } from '../database/mysqlClient';
import { IConfigRepository } from '../../application/repositories/IConfigRepository';

export class ConfigRepositoryMySQL implements IConfigRepository {
  async getCompraMinimaBono(): Promise<number> {
    const [rows] = await pool.execute('SELECT valor FROM config_sorteo WHERE clave = ?', ['compra_minima']);
    const v = (rows as any[])[0]?.valor;
    const n = Number(v);
    return Number.isFinite(n) ? n : 100000;
  }
}

