export const DB_NAME = 'sorteo.db';

export const SQL = {
  CREATE_VENTAS: `
    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_factura TEXT NOT NULL UNIQUE,
      fecha_factura TEXT NOT NULL,
      cedula_cliente TEXT NOT NULL,
      nombre_cliente TEXT NOT NULL,
      valor_total REAL NOT NULL,
      total_huevos INTEGER,
      items_json TEXT NOT NULL,
      codigo_bono_redimido TEXT,
      sincronizado INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `,
  CREATE_PARTICIPACIONES: `
    CREATE TABLE IF NOT EXISTS participaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_factura TEXT NOT NULL,
      fecha_factura TEXT NOT NULL,
      cedula_cliente TEXT NOT NULL,
      nombre_cliente TEXT NOT NULL,
      valor_total REAL NOT NULL,
      consentimiento_datos INTEGER NOT NULL,
      resultado TEXT,
      codigo_bono TEXT,
      compra_minima_bono REAL,
      idempotency_key TEXT,
      probabilidad_utilizada REAL,
      leyenda_factura_bono TEXT,
      sincronizado INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `,
  CREATE_MAPEO_FACTURAS: `
    CREATE TABLE IF NOT EXISTS mapeo_facturas (
      numero_local TEXT PRIMARY KEY,
      numero_real TEXT NOT NULL
    );
  `,
  CREATE_CONTADOR_LOCAL: `
    CREATE TABLE IF NOT EXISTS contador_local (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    );
    INSERT OR IGNORE INTO contador_local (key, value) VALUES ('venta', 0);
  `,
  CREATE_CONFIG_CACHE: `
    CREATE TABLE IF NOT EXISTS config_sorteo (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT
    );
  `,
};
