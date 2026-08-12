import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { authMiddleware } from '../middlewares/authMiddleware';
import { pool } from '../../../infrastructure/database/mysqlClient';
import {
  createCampaign,
  deleteCampaign,
  getCampaignById,
  listCampaigns,
  setCampaignEstado,
  updateCampaign,
  type CampaignWriteInput,
} from '../../../domain/campaign/campaignRepo';

export const adminRoutes = Router();

adminRoutes.use(authMiddleware);

function requireAdmin(rol?: string) {
  return rol === 'administrador';
}

// GET /api/admin/metricas
adminRoutes.get('/metricas', async (req, res, next) => {
  try {
    if (!requireAdmin(req.user?.rol)) return res.status(403).json({ error: 'Solo administrador' });

    const [[p]] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as c FROM participaciones');
    const [[g]] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as c FROM sorteos WHERE ganador = 1');
    const [[emit]] = await pool.query<RowDataPacket[]>('SELECT COALESCE(SUM(valor), 0) as s FROM bonos');
    const [[red]] = await pool.query<RowDataPacket[]>("SELECT COALESCE(SUM(valor), 0) as s FROM bonos WHERE estado = 'redimido'");

    const totalParticipaciones = Number((p as any)?.c ?? 0);
    const totalGanadores = Number((g as any)?.c ?? 0);
    const tasaObservada = totalParticipaciones > 0 ? totalGanadores / totalParticipaciones : 0;
    const valorEmitido = Number((emit as any)?.s ?? 0);
    const valorRedimido = Number((red as any)?.s ?? 0);

    return res.json({
      totalParticipaciones,
      totalGanadores,
      tasaObservada: Math.round(tasaObservada * 10000) / 100,
      valorEmitido,
      valorRedimido,
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/config/probabilidad
adminRoutes.get('/config/probabilidad', async (req, res, next) => {
  try {
    if (!requireAdmin(req.user?.rol)) return res.status(403).json({ error: 'Solo administrador' });
    const [rows] = await pool.execute<(RowDataPacket & { valor: string })[]>(
      'SELECT valor FROM config_sorteo WHERE clave = ?',
      ['probabilidad_ganar']
    );
    const probabilidad = parseFloat(rows?.[0]?.valor || '0.1');
    return res.json({ probabilidad, porcentaje: Math.round(probabilidad * 100) });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/admin/config/probabilidad
adminRoutes.put('/config/probabilidad', async (req, res, next) => {
  try {
    if (!requireAdmin(req.user?.rol)) return res.status(403).json({ error: 'Solo administrador' });
    let { porcentaje } = (req.body ?? {}) as { porcentaje?: unknown };
    const n = typeof porcentaje === 'number' ? porcentaje : parseFloat(String(porcentaje));
    if (Number.isNaN(n) || n < 0 || n > 100) return res.status(400).json({ error: 'porcentaje debe estar entre 0 y 100' });
    const probabilidad = n / 100;
    await pool.execute("UPDATE config_sorteo SET valor = ? WHERE clave = 'probabilidad_ganar'", [String(probabilidad)]);
    return res.json({ probabilidad, porcentaje: Math.round(n) });
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/config/compra-minima
adminRoutes.get('/config/compra-minima', async (req, res, next) => {
  try {
    if (!requireAdmin(req.user?.rol)) return res.status(403).json({ error: 'Solo administrador' });
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

// PUT /api/admin/config/compra-minima
adminRoutes.put('/config/compra-minima', async (req, res, next) => {
  try {
    if (!requireAdmin(req.user?.rol)) return res.status(403).json({ error: 'Solo administrador' });
    let { compraMinima } = (req.body ?? {}) as { compraMinima?: unknown };
    const n = typeof compraMinima === 'number' ? compraMinima : parseFloat(String(compraMinima));
    if (Number.isNaN(n) || n < 0) return res.status(400).json({ error: 'compraMinima debe ser >= 0' });
    await pool.execute("UPDATE config_sorteo SET valor = ? WHERE clave = 'compra_minima'", [String(n)]);
    return res.json({ compraMinima: n });
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/config/min-subtotal-refs-participar
adminRoutes.get('/config/min-subtotal-refs-participar', async (req, res, next) => {
  try {
    if (!requireAdmin(req.user?.rol)) return res.status(403).json({ error: 'Solo administrador' });
    const [rows] = await pool.execute<(RowDataPacket & { valor: string })[]>(
      'SELECT valor FROM config_sorteo WHERE clave = ?',
      ['min_subtotal_refs_participar']
    );
    const minSubtotal = parseFloat(rows?.[0]?.valor || '0');
    return res.json({ minSubtotal });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/admin/config/min-subtotal-refs-participar
adminRoutes.put('/config/min-subtotal-refs-participar', async (req, res, next) => {
  try {
    if (!requireAdmin(req.user?.rol)) return res.status(403).json({ error: 'Solo administrador' });
    let { minSubtotal } = (req.body ?? {}) as { minSubtotal?: unknown };
    const n = typeof minSubtotal === 'number' ? minSubtotal : parseFloat(String(minSubtotal));
    if (Number.isNaN(n) || n < 0) return res.status(400).json({ error: 'minSubtotal debe ser >= 0' });
    await pool.execute("UPDATE config_sorteo SET valor = ? WHERE clave = 'min_subtotal_refs_participar'", [String(n)]);
    return res.json({ minSubtotal: n });
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/config/presentaciones-participar
adminRoutes.get('/config/presentaciones-participar', async (req, res, next) => {
  try {
    if (!requireAdmin(req.user?.rol)) return res.status(403).json({ error: 'Solo administrador' });
    const [rows] = await pool.execute<(RowDataPacket & { valor: string })[]>(
      `SELECT clave, valor
       FROM config_sorteo
       WHERE clave IN ('presentaciones_para_participar','presentaiones_para_participar')`
    );
    let presentaciones: unknown = [];
    try {
      const prefer = (rows as any[]).find((r) => r?.clave === 'presentaciones_para_participar') ?? (rows as any[])[0];
      presentaciones = JSON.parse(prefer?.valor || '[]');
    } catch {
      presentaciones = [];
    }
    if (!Array.isArray(presentaciones)) presentaciones = [];
    return res.json({ presentaciones });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/admin/config/presentaciones-participar
adminRoutes.put('/config/presentaciones-participar', async (req, res, next) => {
  try {
    if (!requireAdmin(req.user?.rol)) return res.status(403).json({ error: 'Solo administrador' });
    const { presentaciones } = (req.body ?? {}) as { presentaciones?: unknown };
    if (!Array.isArray(presentaciones)) return res.status(400).json({ error: 'presentaciones debe ser un array de strings' });
    const arr = presentaciones.map((s) => String(s)).filter(Boolean);
    const payload = JSON.stringify(arr);
    // Compat: escribir en ambas claves para no depender del typo/BD legacy.
    await pool.execute(
      `INSERT INTO config_sorteo (clave, valor)
       VALUES ('presentaciones_para_participar', ?)
       ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
      [payload]
    );
    await pool.execute(
      `INSERT INTO config_sorteo (clave, valor)
       VALUES ('presentaiones_para_participar', ?)
       ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
      [payload]
    );
    return res.json({ presentaciones: arr });
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/facturas
adminRoutes.get('/facturas', async (req, res, next) => {
  try {
    if (!requireAdmin(req.user?.rol)) return res.status(403).json({ error: 'Solo administrador' });
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM ventas ORDER BY created_at DESC LIMIT 500');
    const out = (rows as any[]).map((r) => ({
      ...r,
      presentaciones: r.presentaciones_detalle ? JSON.parse(r.presentaciones_detalle) : [],
    }));
    return res.json(out);
  } catch (err) {
    return next(err);
  }
});

// PUT /api/admin/config/sorteo
adminRoutes.put('/config/sorteo', async (req, res, next) => {
  try {
    if (!requireAdmin(req.user?.rol)) return res.status(403).json({ error: 'Solo administrador' });
    const { probabilidadGanar, compraMinimaBono, presentacionesParticipan } = (req.body ?? {}) as Record<string, unknown>;

    if (probabilidadGanar != null) {
      await pool.execute("UPDATE config_sorteo SET valor = ? WHERE clave = 'probabilidad_ganar'", [String(probabilidadGanar)]);
    }
    if (compraMinimaBono != null) {
      await pool.execute("UPDATE config_sorteo SET valor = ? WHERE clave = 'compra_minima'", [String(compraMinimaBono)]);
    }
    if (presentacionesParticipan != null) {
      const payload = JSON.stringify(presentacionesParticipan);
      await pool.execute(
        `INSERT INTO config_sorteo (clave, valor)
         VALUES ('presentaciones_para_participar', ?)
         ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
        [payload]
      );
      await pool.execute(
        `INSERT INTO config_sorteo (clave, valor)
         VALUES ('presentaiones_para_participar', ?)
         ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
        [payload]
      );
    }

    const [rows] = await pool.execute<(RowDataPacket & { clave: string; valor: string })[]>(
      'SELECT clave, valor FROM config_sorteo'
    );
    const cfg: any = {};
    for (const r of rows) {
      if (r.clave === 'presentaciones_para_participar' || r.clave === 'presentaiones_para_participar') {
        try {
          cfg.presentacionesParticipan = JSON.parse(r.valor);
        } catch {
          cfg.presentacionesParticipan = [];
        }
      } else if (r.clave === 'probabilidad_ganar') cfg.probabilidadGanar = parseFloat(r.valor);
      else if (r.clave === 'compra_minima') cfg.compraMinimaBono = parseFloat(r.valor);
    }
    return res.json({
      probabilidadGanar: cfg.probabilidadGanar ?? 0.1,
      compraMinimaBono: cfg.compraMinimaBono ?? 100000,
      presentacionesParticipan: cfg.presentacionesParticipan ?? [],
    });
  } catch (err) {
    return next(err);
  }
});

// ===========================================================================
// Campañas — CRUD completo (admin)
// Reglas alineadas con el brief promocional:
//   - pctBono, pctTopeCosto, probabilidadBase: decimales 0..1
//   - bonoUnSoloUso, bonoNoAcumulable, redencionSoloFacturaFutura,
//     redencionMinIgualOrigen: flags por defecto true según brief
//   - DELETE solo si no hay historial (participaciones/bonos); si hay, devolver 409
// ===========================================================================

function pickNumberInRange(v: unknown, min: number, max: number): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

function parseRefsElegibles(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p.map((s: unknown) => String(s).trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function isYmd(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function parseCampaignBody(body: unknown, partial = false): CampaignWriteInput | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const out: Partial<CampaignWriteInput> = {};

  if (b.nombre !== undefined) {
    const n = String(b.nombre).trim();
    if (!n) return { error: 'nombre requerido' };
    out.nombre = n;
  }
  if (b.fechaInicio !== undefined) {
    if (!isYmd(b.fechaInicio)) return { error: 'fechaInicio debe ser YYYY-MM-DD' };
    out.fechaInicio = b.fechaInicio;
  }
  if (b.fechaFin !== undefined) {
    if (!isYmd(b.fechaFin)) return { error: 'fechaFin debe ser YYYY-MM-DD' };
    out.fechaFin = b.fechaFin;
  }
  if (out.fechaInicio && out.fechaFin && out.fechaInicio > out.fechaFin) {
    return { error: 'fechaInicio no puede ser mayor a fechaFin' };
  }
  if (b.minSubtotalElegible !== undefined) {
    const n = pickNumberInRange(b.minSubtotalElegible, 0, 1e15);
    if (n == null) return { error: 'minSubtotalElegible debe ser >= 0' };
    out.minSubtotalElegible = n;
  }
  if (b.pctBono !== undefined) {
    const n = pickNumberInRange(b.pctBono, 0, 1);
    if (n == null) return { error: 'pctBono debe estar entre 0 y 1 (decimal)' };
    out.pctBono = n;
  }
  if (b.pctTopeCosto !== undefined) {
    const n = pickNumberInRange(b.pctTopeCosto, 0, 1);
    if (n == null) return { error: 'pctTopeCosto debe estar entre 0 y 1 (decimal)' };
    out.pctTopeCosto = n;
  }
  if (b.bonoVigenciaDias !== undefined) {
    const n = pickNumberInRange(b.bonoVigenciaDias, 1, 3650);
    if (n == null) return { error: 'bonoVigenciaDias debe estar entre 1 y 3650 días' };
    out.bonoVigenciaDias = Math.round(n);
  }
  if (b.probabilidadBase !== undefined) {
    const n = pickNumberInRange(b.probabilidadBase, 0, 1);
    if (n == null) return { error: 'probabilidadBase debe estar entre 0 y 1 (decimal)' };
    out.probabilidadBase = n;
  }
  if (b.estado !== undefined) {
    if (b.estado !== 'activa' && b.estado !== 'inactiva') {
      return { error: "estado debe ser 'activa' o 'inactiva'" };
    }
    out.estado = b.estado;
  }
  if (b.refsElegibles !== undefined) {
    out.refsElegibles = parseRefsElegibles(b.refsElegibles);
  }
  if (b.leyendaFacturaBono !== undefined) {
    out.leyendaFacturaBono = String(b.leyendaFacturaBono).slice(0, 500);
  }
  if (b.bonoUnSoloUso !== undefined) out.bonoUnSoloUso = !!b.bonoUnSoloUso;
  if (b.bonoNoAcumulable !== undefined) out.bonoNoAcumulable = !!b.bonoNoAcumulable;
  if (b.redencionSoloFacturaFutura !== undefined) out.redencionSoloFacturaFutura = !!b.redencionSoloFacturaFutura;
  if (b.redencionMinIgualOrigen !== undefined) out.redencionMinIgualOrigen = !!b.redencionMinIgualOrigen;
  if (b.presupuestoTotal !== undefined) {
    if (b.presupuestoTotal === null || b.presupuestoTotal === '') {
      out.presupuestoTotal = null;
    } else {
      const n = pickNumberInRange(b.presupuestoTotal, 0, 1e18);
      if (n == null) return { error: 'presupuestoTotal debe ser >= 0' };
      out.presupuestoTotal = n;
    }
  }
  if (b.presupuestoModo !== undefined) {
    const m = String(b.presupuestoModo);
    if (!['ratio', 'absoluto', 'mixto'].includes(m)) {
      return { error: "presupuestoModo debe ser 'ratio', 'absoluto' o 'mixto'" };
    }
    out.presupuestoModo = m as CampaignWriteInput['presupuestoModo'];
  }

  if (partial) return out as CampaignWriteInput;

  // Validar que estén los obligatorios para creación.
  const required: (keyof CampaignWriteInput)[] = [
    'nombre',
    'fechaInicio',
    'fechaFin',
    'pctBono',
    'pctTopeCosto',
    'bonoVigenciaDias',
    'probabilidadBase',
  ];
  for (const k of required) {
    if (out[k] === undefined) return { error: `Campo requerido: ${String(k)}` };
  }

  return {
    nombre: out.nombre!,
    fechaInicio: out.fechaInicio!,
    fechaFin: out.fechaFin!,
    minSubtotalElegible: out.minSubtotalElegible ?? 0,
    pctBono: out.pctBono!,
    pctTopeCosto: out.pctTopeCosto!,
    bonoVigenciaDias: out.bonoVigenciaDias!,
    probabilidadBase: out.probabilidadBase!,
    estado: out.estado ?? 'activa',
    refsElegibles: out.refsElegibles ?? [],
    leyendaFacturaBono: out.leyendaFacturaBono ?? 'ESTA FACTURA CONTIENE UN BONO',
    bonoUnSoloUso: out.bonoUnSoloUso ?? true,
    bonoNoAcumulable: out.bonoNoAcumulable ?? true,
    redencionSoloFacturaFutura: out.redencionSoloFacturaFutura ?? true,
    redencionMinIgualOrigen: out.redencionMinIgualOrigen ?? true,
    presupuestoTotal: out.presupuestoTotal ?? null,
    presupuestoModo: out.presupuestoModo ?? 'ratio',
    probabilityConfigJson: null,
  };
}

// GET /api/admin/campaigns — listado completo
adminRoutes.get('/campaigns', async (req, res, next) => {
  try {
    if (!requireAdmin(req.user?.rol)) return res.status(403).json({ error: 'Solo administrador' });
    const list = await listCampaigns(pool);
    return res.json(list);
  } catch (err) {
    return next(err);
  }
});

// POST /api/admin/campaigns — crear campaña con todos los parámetros del brief
adminRoutes.post('/campaigns', async (req, res, next) => {
  try {
    if (!requireAdmin(req.user?.rol)) return res.status(403).json({ error: 'Solo administrador' });
    const parsed = parseCampaignBody(req.body, false);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });
    const created = await createCampaign(pool, parsed);
    return res.status(201).json(created);
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/campaigns/:id — detalle de campaña
adminRoutes.get('/campaigns/:id', async (req, res, next) => {
  try {
    if (!requireAdmin(req.user?.rol)) return res.status(403).json({ error: 'Solo administrador' });
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'campaignId requerido' });
    const c = await getCampaignById(pool, id);
    if (!c) return res.status(404).json({ error: 'Campaña no encontrada' });
    return res.json(c);
  } catch (err) {
    return next(err);
  }
});

// PUT /api/admin/campaigns/:id — modificar parámetros (parcial o total)
adminRoutes.put('/campaigns/:id', async (req, res, next) => {
  try {
    if (!requireAdmin(req.user?.rol)) return res.status(403).json({ error: 'Solo administrador' });
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'campaignId requerido' });
    const existing = await getCampaignById(pool, id);
    if (!existing) return res.status(404).json({ error: 'Campaña no encontrada' });

    const parsed = parseCampaignBody(req.body, true);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });

    const updated = await updateCampaign(pool, id, parsed as Partial<CampaignWriteInput>);
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/admin/campaigns/:id/estado — activar/desactivar rápido
adminRoutes.patch('/campaigns/:id/estado', async (req, res, next) => {
  try {
    if (!requireAdmin(req.user?.rol)) return res.status(403).json({ error: 'Solo administrador' });
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'campaignId requerido' });
    const { estado } = (req.body ?? {}) as { estado?: unknown };
    if (estado !== 'activa' && estado !== 'inactiva') {
      return res.status(400).json({ error: "estado debe ser 'activa' o 'inactiva'" });
    }
    const existing = await getCampaignById(pool, id);
    if (!existing) return res.status(404).json({ error: 'Campaña no encontrada' });
    const updated = await setCampaignEstado(pool, id, estado);
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/admin/campaigns/:id — borrar (solo si no tiene historial)
adminRoutes.delete('/campaigns/:id', async (req, res, next) => {
  try {
    if (!requireAdmin(req.user?.rol)) return res.status(403).json({ error: 'Solo administrador' });
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'campaignId requerido' });
    const existing = await getCampaignById(pool, id);
    if (!existing) return res.status(404).json({ error: 'Campaña no encontrada' });
    const ok = await deleteCampaign(pool, id);
    return res.json({ ok });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 409) {
      return res.status(409).json({ error: (err as Error).message });
    }
    return next(err);
  }
});

// GET /api/admin/users — listar usuarios (para asignación a campañas)
adminRoutes.get('/users', async (req, res, next) => {
  try {
    if (!requireAdmin(req.user?.rol)) return res.status(403).json({ error: 'Solo administrador' });
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, usuario, rol, nombre FROM users ORDER BY rol DESC, usuario ASC`
    );
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/campaigns/:id/users — usuarios asignados
adminRoutes.get('/campaigns/:id/users', async (req, res, next) => {
  try {
    if (!requireAdmin(req.user?.rol)) return res.status(403).json({ error: 'Solo administrador' });
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'campaignId requerido' });
    const [rows] = await pool.execute<(RowDataPacket & { usuario: string })[]>(
      `SELECT usuario FROM campaign_users WHERE campaign_id = ? ORDER BY usuario ASC`,
      [id]
    );
    return res.json({ usuarios: rows.map((r) => String(r.usuario)) });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/admin/campaigns/:id/users — reemplaza asignación (control de quién puede sortear)
adminRoutes.put('/campaigns/:id/users', async (req, res, next) => {
  try {
    if (!requireAdmin(req.user?.rol)) return res.status(403).json({ error: 'Solo administrador' });
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'campaignId requerido' });
    const { usuarios } = (req.body ?? {}) as { usuarios?: unknown };
    if (!Array.isArray(usuarios)) return res.status(400).json({ error: 'usuarios debe ser un array de strings' });
    const list = usuarios.map((u) => String(u).trim()).filter(Boolean);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(`DELETE FROM campaign_users WHERE campaign_id = ?`, [id]);
      for (const u of list) {
        await conn.execute(`INSERT IGNORE INTO campaign_users (campaign_id, usuario) VALUES (?, ?)`, [id, u]);
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    return res.json({ ok: true, usuarios: list });
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/campaigns/:id/presupuesto — métricas por vendedor + globales
adminRoutes.get('/campaigns/:id/presupuesto', async (req, res, next) => {
  try {
    if (!requireAdmin(req.user?.rol)) return res.status(403).json({ error: 'Solo administrador' });
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'campaignId requerido' });
    const [cRows] = await pool.execute<
      (RowDataPacket & {
        pct_tope_costo: number;
        presupuesto_total: number | null;
        presupuesto_modo: string;
      })[]
    >(
      `SELECT pct_tope_costo, presupuesto_total, presupuesto_modo FROM campaigns WHERE id = ? LIMIT 1`,
      [id]
    );
    const camp = cRows?.[0];
    const pctTope = Number(camp?.pct_tope_costo ?? 0);
    const presupuestoTotal = camp?.presupuesto_total != null ? Number(camp.presupuesto_total) : null;
    const presupuestoModo = camp?.presupuesto_modo ?? 'ratio';

    const [mRows] = await pool.execute<(RowDataPacket & { usuario: string; v: number; b: number })[]>(
      `SELECT usuario, ventas_elegibles_acum as v, bonos_emitidos_acum as b
       FROM campaign_metrics WHERE campaign_id = ? ORDER BY usuario ASC`,
      [id]
    );
    const items = (mRows as any[]).map((r) => {
      const V = Number(r.v ?? 0);
      const B = Number(r.b ?? 0);
      const headroom = pctTope * V - B;
      return { usuario: String(r.usuario), V, B, headroom };
    });

    let global: {
      V: number;
      B: number;
      reserva: number;
      participaciones: number;
      ganadores: number;
      headroomRatio: number;
      headroomAbsoluto: number | null;
    } | null = null;
    try {
      const [gRows] = await pool.execute<
        (RowDataPacket & { v: number; b: number; r: number; pc: number; gc: number })[]
      >(
        `SELECT ventas_elegibles_acum AS v, bonos_emitidos_acum AS b,
                bonos_comprometidos_reserva AS r, participaciones_count AS pc, ganadores_count AS gc
         FROM campaign_metrics_global WHERE campaign_id = ?`,
        [id]
      );
      const g = gRows?.[0];
      if (g) {
        const V = Number(g.v ?? 0);
        const B = Number(g.b ?? 0);
        const reserva = Number(g.r ?? 0);
        global = {
          V,
          B,
          reserva,
          participaciones: Number(g.pc ?? 0),
          ganadores: Number(g.gc ?? 0),
          headroomRatio: pctTope * V - B,
          headroomAbsoluto:
            presupuestoTotal != null ? presupuestoTotal - B - reserva : null,
        };
      }
    } catch {
      global = null;
    }

    return res.json({ pctTope, presupuestoTotal, presupuestoModo, global, items });
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/campaigns/:id/audit-log — trazabilidad del motor de probabilidades
adminRoutes.get('/campaigns/:id/audit-log', async (req, res, next) => {
  try {
    if (!requireAdmin(req.user?.rol)) return res.status(403).json({ error: 'Solo administrador' });
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'campaignId requerido' });
    const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, participacion_id AS participacionId, factura_numero AS facturaNumero,
              usuario, valor_elegible AS valorElegible, bono_valor_estimado AS bonoValorEstimado,
              prob_base AS probBase, prob_final AS probFinal,
              V_vendedor AS VVendedor, B_vendedor AS BVendedor,
              headroom_ratio AS headroomRatio, headroom_absoluto AS headroomAbsoluto,
              random_u AS randomU, gano, motivo_bloqueo AS motivoBloqueo, created_at AS createdAt
       FROM probability_audit_log
       WHERE campaign_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [id, limit]
    );
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

