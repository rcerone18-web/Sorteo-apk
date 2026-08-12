import type { RowDataPacket } from 'mysql2';
import { isSchemaMismatchError } from './dbCompat';

/** Pool / PoolConnection de mysql2 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqlExec = { execute: (sql: string, params?: any) => Promise<unknown> };

/** Indica si esta factura fue usada como redención de un bono (no participa). */
export async function ventaTieneRedencionBono(dispatch: SqlExec, numeroFactura: string): Promise<boolean> {
  try {
    const [rows] = (await dispatch.execute(
      'SELECT 1 as one FROM bonos WHERE factura_redencion = ? LIMIT 1',
      [numeroFactura]
    )) as [RowDataPacket[], unknown];
    return (rows?.length ?? 0) > 0;
  } catch (e) {
    if (!isSchemaMismatchError(e)) throw e;
    return false;
  }
}

export async function insertFacturaMockFromVenta(
  dispatch: SqlExec,
  params: { numero: string; fecha: string; valor: number; valorElegible: number }
): Promise<void> {
  const { numero, fecha, valor, valorElegible } = params;
  try {
    await dispatch.execute(
      'INSERT INTO facturas_mock (numero, fecha, valor, valor_elegible) VALUES (?, ?, ?, ?)',
      [numero, fecha, valor, valorElegible]
    );
  } catch (e) {
    if (!isSchemaMismatchError(e)) throw e;
    await dispatch.execute('INSERT INTO facturas_mock (numero, fecha, valor) VALUES (?, ?, ?)', [
      numero,
      fecha,
      valor
    ]);
  }
}
