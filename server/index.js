/**
 * API Sorteo Promocional – Base de datos MySQL (sorteo_db)
 * Tablas: users, ventas, facturas_mock, participaciones, sorteos, bonos, config_sorteo
 * Configuración: .env (MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, PORT, JWT_SECRET)
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const { randomUUID } = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sorteo-secret-cambiar-en-produccion';

app.use(cors());
app.use(express.json());

let pool = null;

async function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'sorteo_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

async function dbRun(sql, params = []) {
  const p = await getPool();
  await p.execute(sql, params);
}

async function dbGet(sql, params = []) {
  const p = await getPool();
  const [rows] = await p.execute(sql, params);
  return rows && rows[0] ? rows[0] : null;
}

async function dbAll(sql, params = []) {
  const p = await getPool();
  const [rows] = await p.execute(sql, params);
  return rows || [];
}

/** Normaliza a YYYY-MM-DD para columnas DATE de MySQL */
function toDateOnly(val) {
  if (val == null) return null;
  if (typeof val === 'string') {
    const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? match[0] : val.slice(0, 10);
  }
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

/** Lista permitida en mayúsculas; presentaciones = [{ presentacion, cantidad }, ...] o JSON string */
function ventaPuedeParticipar(presentaciones, listaPermitida) {
  if (!Array.isArray(listaPermitida) || listaPermitida.length === 0) return true;
  const allowSet = new Set(listaPermitida.map((s) => String(s).trim().toUpperCase()).filter(Boolean));
  let arr = presentaciones;
  if (typeof presentaciones === 'string') {
    try {
      arr = JSON.parse(presentaciones);
    } catch {
      return false;
    }
  }
  if (!Array.isArray(arr)) return false;
  return arr.some((p) => {
    const nom = (p && (p.presentacion ?? p.nombre ?? p.tipoPresentacion)) ? String(p.presentacion ?? p.nombre ?? p.tipoPresentacion).trim().toUpperCase() : '';
    return nom && allowSet.has(nom);
  });
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

/** Obtiene el siguiente número de factura desde la BD (evita duplicados al reiniciar el servidor) */
async function siguienteNumero() {
  const row = await dbGet(
    "SELECT COALESCE(MAX(CAST(SUBSTRING(numero, 8) AS UNSIGNED)), 0) + 1 AS n FROM ventas WHERE numero LIKE 'F-2024-%'"
  );
  const n = Number(row?.n) || 1;
  return `F-2024-${String(n).padStart(3, '0')}`;
}

// POST /api/auth/login (usuario, clave) → token
app.post('/api/auth/login', async (req, res) => {
  try {
    const { usuario, clave } = req.body || {};
    if (!usuario || !clave) {
      return res.status(400).json({ error: 'usuario y clave requeridos' });
    }
    const row = await dbGet('SELECT id, usuario, rol, nombre FROM users WHERE usuario = ? AND password_hash = ?', [usuario, clave]);
    if (!row) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    const token = jwt.sign({ id: row.id, usuario: row.usuario, rol: row.rol }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({
      token,
      usuario: { id: row.id, usuario: row.usuario, rol: row.rol, nombre: row.nombre },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});

// POST /api/ventas (cedula, nombreCliente, valorTotal, fechaFactura, totalHuevos?, presentaciones, codigoBono?) → numero
app.post('/api/ventas', authMiddleware, async (req, res) => {
  try {
    const { cedula, nombreCliente, valorTotal, fechaFactura, totalHuevos, presentaciones, codigoBono } = req.body || {};
    if (!cedula || !nombreCliente || valorTotal == null || valorTotal <= 0 || !fechaFactura || !Array.isArray(presentaciones)) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (cedula, nombreCliente, valorTotal, fechaFactura, presentaciones)' });
    }
    const cedulaNorm = String(cedula).trim();
    const nombreNorm = String(nombreCliente).trim();
    const nombreNormUpper = nombreNorm.toUpperCase();
    let bono = null;
    if (codigoBono) {
      const codigoNorm = String(codigoBono).trim();
      if (!codigoNorm) {
        return res.status(400).json({ error: 'Código de bono vacío' });
      }
      bono = await dbGet(
        'SELECT id, estado, fecha_vencimiento, cedula, nombre_cliente FROM bonos WHERE UPPER(TRIM(codigo)) = UPPER(?)',
        [codigoNorm]
      );
      if (!bono) {
        return res.status(404).json({ error: 'Código de bono no encontrado' });
      }
      const bonoCedula = String(bono.cedula || '').trim();
      const bonoNombreUpper = String(bono.nombre_cliente || '').trim().toUpperCase();
      if (!bonoCedula || !bonoNombreUpper) {
        return res.status(500).json({ error: 'Bono inválido: faltan datos del ganador' });
      }
      if (bonoCedula !== cedulaNorm || bonoNombreUpper !== nombreNormUpper) {
        return res.status(403).json({ error: 'Este bono no pertenece a este cliente (cédula/nombre no coinciden)' });
      }
      if (bono.estado === 'redimido') {
        return res.status(409).json({ error: 'Código de un solo uso: ya fue redimido' });
      }
      if (bono.estado === 'disponible' && bono.fecha_vencimiento && new Date(bono.fecha_vencimiento) < new Date()) {
        return res.status(410).json({ error: 'Bono vencido' });
      }
      const compraMinima = parseFloat((await dbGet('SELECT valor FROM config_sorteo WHERE clave = ?', ['compra_minima']))?.valor || '100000');
      if (valorTotal < compraMinima) {
        return res.status(422).json({
          error: 'Compra mínima no alcanzada para redimir el bono',
          compraMinimaRequerida: compraMinima,
        });
      }
    }

    const id = randomUUID();
    const numero = await siguienteNumero();
    const presentacionesDetalle = JSON.stringify(presentaciones);

    await dbRun(
      `INSERT INTO ventas (id, numero, fecha, cedula, nombre_cliente, valor, total_huevos, presentaciones_detalle) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, numero, fechaFactura, cedula, nombreCliente, valorTotal, totalHuevos ?? null, presentacionesDetalle]
    );

    if (!codigoBono) {
      let listPresentaciones = [];
      try {
        const cfg = await dbGet('SELECT valor FROM config_sorteo WHERE clave = ?', ['presentaiones_para_participar']);
        listPresentaciones = JSON.parse(cfg?.valor || '[]');
      } catch (_) {}
      if (ventaPuedeParticipar(presentaciones, listPresentaciones)) {
        await dbRun(`INSERT INTO facturas_mock (numero, fecha, valor) VALUES (?, ?, ?)`, [numero, fechaFactura, valorTotal]);
      }
    } else {
      if (bono && bono.id) {
        await dbRun("UPDATE bonos SET estado = 'redimido' WHERE id = ? AND estado = 'disponible'", [bono.id]);
      }
    }
    return res.json({ numero });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});

// GET /api/participaciones/validar-factura/:numero
app.get('/api/participaciones/validar-factura/:numero', authMiddleware, async (req, res) => {
  try {
    const { numero } = req.params;
    const enMock = await dbGet('SELECT numero, fecha, valor FROM facturas_mock WHERE numero = ?', [numero]);
    if (!enMock) return res.status(404).json({ error: 'Factura no encontrada o no participa (redimió bono)' });
    const yaParticipo = await dbGet('SELECT 1 as one FROM participaciones WHERE factura_numero = ?', [numero]);
    if (yaParticipo) return res.status(400).json({ error: 'Esta factura ya participó en el sorteo' });
    const venta = await dbGet('SELECT cedula, nombre_cliente, presentaciones_detalle FROM ventas WHERE numero = ?', [numero]);
    let listPresentaciones = [];
    try {
      const cfg = await dbGet('SELECT valor FROM config_sorteo WHERE clave = ?', ['presentaiones_para_participar']);
      listPresentaciones = JSON.parse(cfg?.valor || '[]');
    } catch (_) {}
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
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});

// GET /api/ventas/ultima-por-cedula/:cedula
app.get('/api/ventas/ultima-por-cedula/:cedula', authMiddleware, async (req, res) => {
  try {
    const cedula = (req.params.cedula || '').trim();
    if (!cedula) return res.status(400).json({ error: 'Cédula requerida' });
    const row = await dbGet(
      'SELECT numero, fecha, cedula, nombre_cliente, valor, total_huevos, presentaciones_detalle FROM ventas WHERE cedula = ? ORDER BY created_at DESC LIMIT 1',
      [cedula]
    );
    if (!row) return res.status(404).json({ error: 'No hay ventas registradas con esta cédula' });
    return res.json({
      numeroFactura: row.numero,
      fechaFactura: row.fecha,
      cedulaCliente: row.cedula,
      nombreCliente: row.nombre_cliente,
      valorTotal: row.valor,
      totalHuevos: row.total_huevos,
      presentaciones: row.presentaciones_detalle ? JSON.parse(row.presentaciones_detalle) : [],
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});

// GET /api/ventas/por-numero/:numero
app.get('/api/ventas/por-numero/:numero', authMiddleware, async (req, res) => {
  try {
    const row = await dbGet('SELECT numero, fecha, cedula, nombre_cliente, valor, total_huevos, presentaciones_detalle FROM ventas WHERE numero = ?', [req.params.numero]);
    if (!row) return res.status(404).json({ error: 'Factura no encontrada' });
    const enMock = await dbGet('SELECT 1 as one FROM facturas_mock WHERE numero = ?', [row.numero]);
    const yaParticipo = await dbGet('SELECT 1 as one FROM participaciones WHERE factura_numero = ?', [row.numero]);
    return res.json({
      numeroFactura: row.numero,
      fechaFactura: row.fecha,
      cedulaCliente: row.cedula,
      nombreCliente: row.nombre_cliente,
      valorTotal: row.valor,
      totalHuevos: row.total_huevos,
      presentaciones: row.presentaciones_detalle ? JSON.parse(row.presentaciones_detalle) : [],
      usadaEnSorteo: !!yaParticipo,
      tieneBonoRedimido: !enMock,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});

// POST /api/participaciones
app.post('/api/participaciones', authMiddleware, async (req, res) => {
  try {
    const { facturaNumero, fechaFactura, cedula, nombreCliente, valorTotal, consentimiento } = req.body || {};
    if (!facturaNumero || !consentimiento) {
      return res.status(400).json({ error: 'facturaNumero y consentimiento requeridos' });
    }
    const enMock = await dbGet('SELECT numero, fecha, valor FROM facturas_mock WHERE numero = ?', [facturaNumero]);
    if (!enMock) return res.status(404).json({ error: 'Factura no encontrada o no participa' });
    const yaParticipo = await dbGet('SELECT 1 as one FROM participaciones WHERE factura_numero = ?', [facturaNumero]);
    if (yaParticipo) return res.status(400).json({ error: 'Esta factura ya participó en el sorteo' });
    const venta = await dbGet('SELECT presentaciones_detalle FROM ventas WHERE numero = ?', [facturaNumero]);
    let listPresentaciones = [];
    try {
      const cfg = await dbGet('SELECT valor FROM config_sorteo WHERE clave = ?', ['presentaiones_para_participar']);
      listPresentaciones = JSON.parse(cfg?.valor || '[]');
    } catch (_) {}
    if (!ventaPuedeParticipar(venta?.presentaciones_detalle || '[]', listPresentaciones)) {
      return res.status(403).json({
        error: 'Esta factura no cumple con las presentaciones requeridas para participar en el sorteo',
        presentacionesRequeridas: Array.isArray(listPresentaciones) ? listPresentaciones : [],
      });
    }

    let prob = parseFloat((await dbGet('SELECT valor FROM config_sorteo WHERE clave = ?', ['probabilidad_ganar']))?.valor || '0.1');
    if (Number.isNaN(prob)) prob = 0.1;
    if (prob > 1) prob = prob / 100;
    prob = Math.max(0, Math.min(1, prob));
    const compraMinima = parseFloat((await dbGet('SELECT valor FROM config_sorteo WHERE clave = ?', ['compra_minima']))?.valor || '100000');
    const gana = Math.random() < prob ? 1 : 0;

    const participacionId = randomUUID();
    const sorteoId = randomUUID();
    const fechaFacturaNorm = toDateOnly(fechaFactura || enMock.fecha) || toDateOnly(new Date());
    let valorNum = Number(valorTotal ?? enMock.valor);
    if (!Number.isFinite(valorNum) || valorNum <= 0) valorNum = Number(enMock.valor) || 1;
    await dbRun(
      `INSERT INTO participaciones (id, factura_numero, fecha_factura, cedula, nombre_cliente, valor_total, consentimiento, usuario_registro) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [participacionId, facturaNumero, fechaFacturaNorm, cedula || '', nombreCliente || '', valorNum, consentimiento ? 1 : 0, req.user.usuario]
    );
    await dbRun(
      `INSERT INTO sorteos (id, participacion_id, ganador, usuario) VALUES (?, ?, ?, ?)`,
      [sorteoId, participacionId, gana, req.user.usuario]
    );

    let bonoCodigo = null;
    if (gana === 1) {
      const bonoId = randomUUID();
      bonoCodigo = `BONO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const vencimiento = new Date();
      vencimiento.setMonth(vencimiento.getMonth() + 1);
      const fechaVencStr = vencimiento.toISOString().slice(0, 19).replace('T', ' ');
      await dbRun(
        `INSERT INTO bonos (id, codigo, factura_origen, cedula, nombre_cliente, valor, fecha_vencimiento, estado, participacion_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'disponible', ?)`,
        [bonoId, bonoCodigo, facturaNumero, cedula || '', nombreCliente || '', valorNum, fechaVencStr, participacionId]
      );
    }

    return res.json({
      gana: gana === 1,
      codigoBono: gana === 1 ? bonoCodigo : undefined,
      compraMinimaBono: gana === 1 ? compraMinima : undefined,
      mensaje: gana === 1 ? `¡Felicidades! Bono 50%. Código: ${bonoCodigo}. Compra mínima: $${compraMinima}` : 'Esta vez no ganaste.',
    });
  } catch (e) {
    console.error('POST /api/participaciones error:', e.message || e);
    if (e.code) console.error('Código:', e.code);
    const msg = process.env.NODE_ENV !== 'production' && e.message
      ? `Error en el servidor: ${e.message}`
      : 'Error en el servidor';
    return res.status(500).json({ error: msg });
  }
});

// GET /api/ventas/config/compra-minima
app.get('/api/ventas/config/compra-minima', authMiddleware, async (req, res) => {
  try {
    const row = await dbGet('SELECT valor FROM config_sorteo WHERE clave = ?', ['compra_minima']);
    return res.json({ compraMinima: parseFloat(row?.valor || '100000') });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});

// GET /api/config/sorteo
app.get('/api/config/sorteo', authMiddleware, async (req, res) => {
  try {
    const rows = await dbAll('SELECT clave, valor FROM config_sorteo');
    const config = {};
    rows.forEach(r => {
      if (r.clave === 'presentaiones_para_participar') try { config.presentacionesParticipan = JSON.parse(r.valor); } catch { config.presentacionesParticipan = []; }
      else if (r.clave === 'probabilidad_ganar') config.probabilidadGanar = parseFloat(r.valor);
      else if (r.clave === 'compra_minima') config.compraMinimaBono = parseFloat(r.valor);
    });
    return res.json({
      probabilidadGanar: config.probabilidadGanar ?? 0.1,
      compraMinimaBono: config.compraMinimaBono ?? 100000,
      presentacionesParticipan: config.presentacionesParticipan ?? [],
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Admin: métricas
app.get('/api/admin/metricas', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'administrador') return res.status(403).json({ error: 'Solo administrador' });
  try {
    const totalParticipaciones = (await dbGet('SELECT COUNT(*) as c FROM participaciones')).c;
    const totalGanadores = (await dbGet('SELECT COUNT(*) as c FROM sorteos WHERE ganador = 1')).c;
    const tasaObservada = totalParticipaciones > 0 ? totalGanadores / totalParticipaciones : 0;
    const valorEmitido = (await dbGet('SELECT COALESCE(SUM(valor), 0) as s FROM bonos')).s ?? 0;
    const valorRedimido = (await dbGet("SELECT COALESCE(SUM(valor), 0) as s FROM bonos WHERE estado = 'redimido'")).s ?? 0;
    return res.json({
      totalParticipaciones,
      totalGanadores,
      tasaObservada: Math.round(tasaObservada * 10000) / 100,
      valorEmitido,
      valorRedimido,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.get('/api/admin/facturas', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'administrador') return res.status(403).json({ error: 'Solo administrador' });
  try {
    const rows = await dbAll('SELECT * FROM ventas ORDER BY created_at DESC LIMIT 500');
    return res.json(rows.map(r => ({ ...r, presentaciones: r.presentaciones_detalle ? JSON.parse(r.presentaciones_detalle) : [] })));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});

function parseDate(s) {
  if (!s || typeof s !== 'string') return null;
  const t = s.trim();
  return t.length >= 10 ? t.slice(0, 10) : null;
}

// GET /api/participaciones?desde=&hasta=&cliente=&factura=&estado=
app.get('/api/participaciones', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'administrador') return res.status(403).json({ error: 'Solo administrador' });
  try {
    const { desde, hasta, cliente, factura, estado } = req.query || {};
    const desdeD = parseDate(desde);
    const hastaD = parseDate(hasta);
    const clienteQ = (cliente && String(cliente).trim()) || '';
    const facturaQ = (factura && String(factura).trim()) || '';
    const estadoQ = (estado && String(estado).trim().toLowerCase()) || '';

    let sql = `
      SELECT p.id, p.factura_numero as facturaNumero, p.fecha_factura as fechaFactura, p.cedula, p.nombre_cliente as nombreCliente,
             p.valor_total as valorTotal, p.consentimiento, p.fecha_registro as fechaRegistro, p.usuario_registro as usuarioRegistro
      FROM participaciones p`;
    const params = [];
    if (estadoQ === 'disponible') {
      sql += ` INNER JOIN bonos b ON b.participacion_id = p.id AND b.estado = 'disponible' AND (b.fecha_vencimiento IS NULL OR b.fecha_vencimiento >= NOW())`;
    } else if (estadoQ === 'redimido') {
      sql += ` INNER JOIN bonos b ON b.participacion_id = p.id AND b.estado = 'redimido'`;
    } else if (estadoQ === 'vencido') {
      sql += ` INNER JOIN bonos b ON b.participacion_id = p.id AND (b.estado = 'vencido' OR (b.estado = 'disponible' AND b.fecha_vencimiento < NOW()))`;
    }
    sql += ' WHERE 1=1';
    if (desdeD) { params.push(desdeD); sql += ` AND DATE(p.fecha_registro) >= DATE(?)`; }
    if (hastaD) { params.push(hastaD); sql += ` AND DATE(p.fecha_registro) <= DATE(?)`; }
    if (clienteQ) { params.push(`%${clienteQ}%`, `%${clienteQ}%`); sql += ` AND (p.nombre_cliente LIKE ? OR p.cedula LIKE ?)`; }
    if (facturaQ) { params.push(`%${facturaQ}%`); sql += ` AND p.factura_numero LIKE ?`; }
    sql += ' ORDER BY p.fecha_registro DESC LIMIT 500';
    const rows = await dbAll(sql, params);
    return res.json(rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});

// GET /api/sorteos?desde=&hasta=
app.get('/api/sorteos', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'administrador') return res.status(403).json({ error: 'Solo administrador' });
  try {
    const { desde, hasta } = req.query || {};
    const desdeD = parseDate(desde);
    const hastaD = parseDate(hasta);
    let sql = `SELECT id, participacion_id as participacionId, ganador, fecha_sorteo as fechaSorteo, usuario FROM sorteos WHERE 1=1`;
    const params = [];
    if (desdeD) { params.push(desdeD); sql += ` AND DATE(fecha_sorteo) >= DATE(?)`; }
    if (hastaD) { params.push(hastaD); sql += ` AND DATE(fecha_sorteo) <= DATE(?)`; }
    sql += ' ORDER BY fecha_sorteo DESC LIMIT 500';
    return res.json(await dbAll(sql, params));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});

// GET /api/bonos?estado=&desde=&hasta=&cliente=&factura=
app.get('/api/bonos', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'administrador') return res.status(403).json({ error: 'Solo administrador' });
  try {
    const { estado, desde, hasta, cliente, factura } = req.query || {};
    const desdeD = parseDate(desde);
    const hastaD = parseDate(hasta);
    const estadoQ = (estado && String(estado).trim().toLowerCase()) || '';
    const clienteQ = (cliente && String(cliente).trim()) || '';
    const facturaQ = (factura && String(factura).trim()) || '';

    let sql = `SELECT id, codigo, factura_origen as facturaOrigen, cedula, nombre_cliente as nombreCliente, valor,
               fecha_emision as fechaEmision, fecha_vencimiento as fechaVencimiento, estado, participacion_id as participacionId
               FROM bonos WHERE 1=1`;
    const params = [];
    if (estadoQ === 'disponible') {
      sql += ` AND estado = 'disponible' AND (fecha_vencimiento IS NULL OR fecha_vencimiento >= NOW())`;
    } else if (estadoQ === 'vencido') {
      sql += ` AND (estado = 'vencido' OR (estado = 'disponible' AND fecha_vencimiento < NOW()))`;
    } else if (estadoQ) {
      params.push(estadoQ);
      sql += ` AND estado = ?`;
    }
    if (desdeD) { params.push(desdeD); sql += ` AND DATE(fecha_emision) >= DATE(?)`; }
    if (hastaD) { params.push(hastaD); sql += ` AND DATE(fecha_emision) <= DATE(?)`; }
    if (clienteQ) { params.push(`%${clienteQ}%`, `%${clienteQ}%`); sql += ` AND (nombre_cliente LIKE ? OR cedula LIKE ?)`; }
    if (facturaQ) { params.push(`%${facturaQ}%`); sql += ` AND factura_origen LIKE ?`; }
    sql += ' ORDER BY fecha_emision DESC LIMIT 500';
    const rows = await dbAll(sql, params);
    const now = new Date().toISOString();
    const out = rows.map(r => ({
      ...r,
      estadoMostrar: r.estado === 'disponible' && r.fechaVencimiento && r.fechaVencimiento < now ? 'vencido' : r.estado,
    }));
    return res.json(out);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});

// PATCH /api/bonos/:id/redimir
app.patch('/api/bonos/:id/redimir', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'administrador') return res.status(403).json({ error: 'Solo administrador' });
  try {
    const { id } = req.params;
    const bono = await dbGet('SELECT id, estado FROM bonos WHERE id = ?', [id]);
    if (!bono) return res.status(404).json({ error: 'Bono no encontrado' });
    if (bono.estado === 'redimido') return res.status(409).json({ error: 'Código de un solo uso: ya fue redimido' });
    if (bono.estado !== 'disponible') return res.status(400).json({ error: 'El bono no está disponible para redimir' });
    await dbRun("UPDATE bonos SET estado = 'redimido' WHERE id = ?", [id]);
    return res.json({ ok: true, mensaje: 'Bono redimido correctamente' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});

// GET /api/admin/config/probabilidad
app.get('/api/admin/config/probabilidad', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'administrador') return res.status(403).json({ error: 'Solo administrador' });
  try {
    const v = await dbGet('SELECT valor FROM config_sorteo WHERE clave = ?', ['probabilidad_ganar']);
    const probabilidad = parseFloat(v?.valor || '0.1');
    return res.json({ probabilidad, porcentaje: Math.round(probabilidad * 100) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});
// PUT /api/admin/config/probabilidad
app.put('/api/admin/config/probabilidad', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'administrador') return res.status(403).json({ error: 'Solo administrador' });
  try {
    let { porcentaje } = req.body || {};
    porcentaje = typeof porcentaje === 'number' ? porcentaje : parseFloat(porcentaje);
    if (isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100) {
      return res.status(400).json({ error: 'porcentaje debe estar entre 0 y 100' });
    }
    const probabilidad = porcentaje / 100;
    await dbRun("UPDATE config_sorteo SET valor = ? WHERE clave = 'probabilidad_ganar'", [String(probabilidad)]);
    return res.json({ probabilidad, porcentaje: Math.round(porcentaje) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});

// GET /api/admin/config/compra-minima
app.get('/api/admin/config/compra-minima', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'administrador') return res.status(403).json({ error: 'Solo administrador' });
  try {
    const v = await dbGet('SELECT valor FROM config_sorteo WHERE clave = ?', ['compra_minima']);
    const compraMinima = parseFloat(v?.valor || '100000');
    return res.json({ compraMinima });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});
// PUT /api/admin/config/compra-minima
app.put('/api/admin/config/compra-minima', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'administrador') return res.status(403).json({ error: 'Solo administrador' });
  try {
    let { compraMinima } = req.body || {};
    compraMinima = typeof compraMinima === 'number' ? compraMinima : parseFloat(compraMinima);
    if (isNaN(compraMinima) || compraMinima < 0) {
      return res.status(400).json({ error: 'compraMinima debe ser >= 0' });
    }
    await dbRun("UPDATE config_sorteo SET valor = ? WHERE clave = 'compra_minima'", [String(compraMinima)]);
    return res.json({ compraMinima });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});

// GET /api/admin/config/presentaciones-participar
app.get('/api/admin/config/presentaciones-participar', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'administrador') return res.status(403).json({ error: 'Solo administrador' });
  try {
    const v = await dbGet('SELECT valor FROM config_sorteo WHERE clave = ?', ['presentaiones_para_participar']);
    let presentaciones = [];
    try { presentaciones = JSON.parse(v?.valor || '[]'); } catch (_) {}
    if (!Array.isArray(presentaciones)) presentaciones = [];
    return res.json({ presentaciones });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});
// PUT /api/admin/config/presentaciones-participar
app.put('/api/admin/config/presentaciones-participar', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'administrador') return res.status(403).json({ error: 'Solo administrador' });
  try {
    const { presentaciones } = req.body || {};
    if (!Array.isArray(presentaciones)) {
      return res.status(400).json({ error: 'presentaciones debe ser un array de strings' });
    }
    const arr = presentaciones.map(s => String(s)).filter(Boolean);
    await dbRun("UPDATE config_sorteo SET valor = ? WHERE clave = 'presentaiones_para_participar'", [JSON.stringify(arr)]);
    return res.json({ presentaciones: arr });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.put('/api/admin/config/sorteo', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'administrador') return res.status(403).json({ error: 'Solo administrador' });
  try {
    const { probabilidadGanar, compraMinimaBono, presentacionesParticipan } = req.body || {};
    if (probabilidadGanar != null) await dbRun("UPDATE config_sorteo SET valor = ? WHERE clave = 'probabilidad_ganar'", [String(probabilidadGanar)]);
    if (compraMinimaBono != null) await dbRun("UPDATE config_sorteo SET valor = ? WHERE clave = 'compra_minima'", [String(compraMinimaBono)]);
    if (presentacionesParticipan != null) await dbRun("UPDATE config_sorteo SET valor = ? WHERE clave = 'presentaiones_para_participar'", [JSON.stringify(presentacionesParticipan)]);
    const rows = await dbAll('SELECT clave, valor FROM config_sorteo');
    const config = {};
    rows.forEach(r => {
      if (r.clave === 'presentaiones_para_participar') try { config.presentacionesParticipan = JSON.parse(r.valor); } catch { config.presentacionesParticipan = []; }
      else if (r.clave === 'probabilidad_ganar') config.probabilidadGanar = parseFloat(r.valor);
      else if (r.clave === 'compra_minima') config.compraMinimaBono = parseFloat(r.valor);
    });
    return res.json({ probabilidadGanar: config.probabilidadGanar ?? 0.1, compraMinimaBono: config.compraMinimaBono ?? 100000, presentacionesParticipan: config.presentacionesParticipan ?? [] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});

(async () => {
  try {
    await getPool();
    console.log('Conectado a MySQL (sorteo_db).');
  } catch (e) {
    console.error('No se pudo conectar a MySQL. Revisa .env (MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE).', e.message);
    process.exit(1);
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API Sorteo Promocional en http://0.0.0.0:${PORT}`);
    console.log('Usuarios: asesor/asesor123, admin/admin123');
  });
})();
