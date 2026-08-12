import * as SQLite from 'expo-sqlite';
import { SQL, DB_NAME } from './schema';
import type { Factura, Participacion, ItemFactura } from '../types';

let db: SQLite.SQLiteDatabase | null = null;

async function migrateSqlite(d: SQLite.SQLiteDatabase): Promise<void> {
  const alters = [
    'ALTER TABLE participaciones ADD COLUMN idempotency_key TEXT',
    'ALTER TABLE participaciones ADD COLUMN probabilidad_utilizada REAL',
    'ALTER TABLE participaciones ADD COLUMN leyenda_factura_bono TEXT',
  ];
  for (const sql of alters) {
    try {
      await d.execAsync(sql);
    } catch {
      /* columna ya existe */
    }
  }
}

export async function initDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(SQL.CREATE_VENTAS);
  await db.execAsync(SQL.CREATE_PARTICIPACIONES);
  await db.execAsync(SQL.CREATE_MAPEO_FACTURAS);
  await db.execAsync(SQL.CREATE_CONTADOR_LOCAL);
  await db.execAsync(SQL.CREATE_CONFIG_CACHE);
  await migrateSqlite(db);
  return db;
}

function getDb(): SQLite.SQLiteDatabase {
  if (!db) throw new Error('DB no inicializada. Llamar initDb() primero.');
  return db;
}

// --- Ventas ---
export async function siguienteNumeroLocal(): Promise<string> {
  const d = getDb();
  await d.runAsync('UPDATE contador_local SET value = value + 1 WHERE key = ?', ['venta']);
  const r = await d.getFirstAsync<{ value: number }>('SELECT value FROM contador_local WHERE key = ?', ['venta']);
  return `F-LOCAL-${String(r?.value ?? 1).padStart(3, '0')}`;
}

export async function guardarVentaLocal(venta: Omit<Factura, 'id'>): Promise<number> {
  const d = getDb();
  const res = await d.runAsync(
    `INSERT INTO ventas (numero_factura, fecha_factura, cedula_cliente, nombre_cliente, valor_total, total_huevos, items_json, codigo_bono_redimido, sincronizado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      venta.numeroFactura,
      venta.fechaFactura,
      venta.cedulaCliente,
      venta.nombreCliente,
      venta.valorTotal,
      venta.totalHuevos ?? null,
      JSON.stringify(venta.items),
      venta.codigoBonoRedimido ?? null,
    ]
  );
  return res.lastInsertRowId;
}

export async function ventasPendientes(): Promise<Factura[]> {
  const d = getDb();
  const rows = await d.getAllAsync<{
    id: number;
    numero_factura: string;
    fecha_factura: string;
    cedula_cliente: string;
    nombre_cliente: string;
    valor_total: number;
    total_huevos: number | null;
    items_json: string;
    codigo_bono_redimido: string | null;
    sincronizado: number;
    created_at: string;
  }>('SELECT * FROM ventas WHERE sincronizado = 0 ORDER BY id');
  return rows.map((r) => ({
    id: r.id,
    numeroFactura: r.numero_factura,
    fechaFactura: r.fecha_factura,
    cedulaCliente: r.cedula_cliente,
    nombreCliente: r.nombre_cliente,
    valorTotal: r.valor_total,
    totalHuevos: r.total_huevos ?? undefined,
    items: JSON.parse(r.items_json) as ItemFactura[],
    codigoBonoRedimido: r.codigo_bono_redimido ?? undefined,
    sincronizado: r.sincronizado === 1,
    createdAt: r.created_at,
  }));
}

export async function ventaPorNumero(numero: string): Promise<Factura | null> {
  const d = getDb();
  const r = await d.getFirstAsync<{
    id: number;
    numero_factura: string;
    fecha_factura: string;
    cedula_cliente: string;
    nombre_cliente: string;
    valor_total: number;
    total_huevos: number | null;
    items_json: string;
    codigo_bono_redimido: string | null;
    sincronizado: number;
    created_at: string;
  }>('SELECT * FROM ventas WHERE numero_factura = ?', [numero]);
  if (!r) return null;
  return rowToFactura(r);
}

/** Última venta por cédula (autocompletar formulario). */
export async function ultimaVentaPorCedula(cedula: string): Promise<Factura | null> {
  const d = getDb();
  const r = await d.getFirstAsync<{
    id: number;
    numero_factura: string;
    fecha_factura: string;
    cedula_cliente: string;
    nombre_cliente: string;
    valor_total: number;
    total_huevos: number | null;
    items_json: string;
    codigo_bono_redimido: string | null;
    sincronizado: number;
    created_at: string;
  }>('SELECT * FROM ventas WHERE cedula_cliente = ? ORDER BY id DESC LIMIT 1', [cedula.trim()]);
  if (!r) return null;
  return rowToFactura(r);
}

function rowToFactura(r: {
  id: number;
  numero_factura: string;
  fecha_factura: string;
  cedula_cliente: string;
  nombre_cliente: string;
  valor_total: number;
  total_huevos: number | null;
  items_json: string;
  codigo_bono_redimido: string | null;
  sincronizado: number;
  created_at: string;
}): Factura {
  return {
    id: r.id,
    numeroFactura: r.numero_factura,
    fechaFactura: r.fecha_factura,
    cedulaCliente: r.cedula_cliente,
    nombreCliente: r.nombre_cliente,
    valorTotal: r.valor_total,
    totalHuevos: r.total_huevos ?? undefined,
    items: JSON.parse(r.items_json) as ItemFactura[],
    codigoBonoRedimido: r.codigo_bono_redimido ?? undefined,
    sincronizado: r.sincronizado === 1,
    createdAt: r.created_at,
  };
}

export async function marcarVentaSincronizada(numeroLocal: string, numeroReal: string): Promise<void> {
  const d = getDb();
  await d.runAsync('UPDATE ventas SET sincronizado = 1 WHERE numero_factura = ?', [numeroLocal]);
  await d.runAsync('INSERT OR REPLACE INTO mapeo_facturas (numero_local, numero_real) VALUES (?, ?)', [
    numeroLocal,
    numeroReal,
  ]);
}

export async function numeroRealDesdeLocal(numeroLocal: string): Promise<string | null> {
  const d = getDb();
  const r = await d.getFirstAsync<{ numero_real: string }>(
    'SELECT numero_real FROM mapeo_facturas WHERE numero_local = ?',
    [numeroLocal]
  );
  return r?.numero_real ?? null;
}

export async function participacionesPendientes(): Promise<Participacion[]> {
  const d = getDb();
  const rows = await d.getAllAsync<{
    id: number;
    numero_factura: string;
    fecha_factura: string;
    cedula_cliente: string;
    nombre_cliente: string;
    valor_total: number;
    consentimiento_datos: number;
    resultado: string | null;
    codigo_bono: string | null;
    compra_minima_bono: number | null;
    idempotency_key: string | null;
    probabilidad_utilizada: number | null;
    leyenda_factura_bono: string | null;
    sincronizado: number;
    created_at: string;
  }>('SELECT * FROM participaciones WHERE sincronizado = 0 ORDER BY id');
  return rows.map((r) => ({
    id: r.id,
    numeroFactura: r.numero_factura,
    fechaFactura: r.fecha_factura,
    cedulaCliente: r.cedula_cliente,
    nombreCliente: r.nombre_cliente,
    valorTotal: r.valor_total,
    consentimientoDatos: r.consentimiento_datos === 1,
    resultado: (r.resultado as 'gano' | 'no_gano') ?? undefined,
    codigoBono: r.codigo_bono ?? undefined,
    compraMinimaBono: r.compra_minima_bono ?? undefined,
    idempotencyKey: r.idempotency_key ?? undefined,
    probabilidadUtilizada: r.probabilidad_utilizada ?? undefined,
    leyendaFacturaBono: r.leyenda_factura_bono ?? undefined,
    sincronizado: r.sincronizado === 1,
    createdAt: r.created_at,
  }));
}

export async function guardarParticipacionLocal(p: Omit<Participacion, 'id'>): Promise<number> {
  const d = getDb();
  const res = await d.runAsync(
    `INSERT INTO participaciones (numero_factura, fecha_factura, cedula_cliente, nombre_cliente, valor_total, consentimiento_datos, resultado, codigo_bono, compra_minima_bono, idempotency_key, probabilidad_utilizada, leyenda_factura_bono, sincronizado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      p.numeroFactura,
      p.fechaFactura,
      p.cedulaCliente,
      p.nombreCliente,
      p.valorTotal,
      p.consentimientoDatos ? 1 : 0,
      p.resultado ?? null,
      p.codigoBono ?? null,
      p.compraMinimaBono ?? null,
      p.idempotencyKey ?? null,
      p.probabilidadUtilizada ?? null,
      p.leyendaFacturaBono ?? null,
    ]
  );
  return res.lastInsertRowId;
}

export async function marcarParticipacionSincronizada(id: number): Promise<void> {
  const d = getDb();
  await d.runAsync('UPDATE participaciones SET sincronizado = 1 WHERE id = ?', [id]);
}

export async function guardarConfigCache(config: { probabilidadGanar: number; compraMinimaBono: number; presentacionesParticipan: string[] }): Promise<void> {
  const d = getDb();
  await d.runAsync(
    'INSERT OR REPLACE INTO config_sorteo (key, value_json, updated_at) VALUES (?, ?, datetime("now"))',
    ['sorteo', JSON.stringify(config)]
  );
}

export async function obtenerConfigCache(): Promise<{
  probabilidadGanar: number;
  compraMinimaBono: number;
  presentacionesParticipan: string[];
} | null> {
  const d = getDb();
  const r = await d.getFirstAsync<{ value_json: string }>('SELECT value_json FROM config_sorteo WHERE key = ?', [
    'sorteo',
  ]);
  if (!r) return null;
  return JSON.parse(r.value_json);
}
