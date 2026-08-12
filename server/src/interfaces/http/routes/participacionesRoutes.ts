import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { authMiddleware } from '../middlewares/authMiddleware';
import { pool } from '../../../infrastructure/database/mysqlClient';
import { parseDate, ventaPuedeParticipar } from './_helpers';
import { ejecutarParticipacion } from '../../../domain/sorteo/ejecutarParticipacion';
import { isSchemaMismatchError } from '../../../domain/sorteo/dbCompat';
import { ventaTieneRedencionBono, insertFacturaMockFromVenta } from '../../../domain/sorteo/facturasMock';
import {
  resolveCampaignForParticipation,
  loadLegacyConfigSorteo,
  hasAnyActiveCampaign,
  isCampaignStrictMode,
} from '../../../domain/campaign/resolveCampaign';
import { calcularValorElegible } from '../../../domain/campaign/valorElegible';
import {
  facturaYmdFromStored,
  todayYmdAmericaBogota,
} from '../../../shared/date/participacionMismoDia';

export const participacionesRoutes = Router();

async function loadFacturaMockValidar(numero: string) {
  try {
    const [rows] = await pool.execute<
      (RowDataPacket & { numero: string; fecha: string; valor: number; valor_elegible: number | null })[]
    >(
      `SELECT numero,
              DATE_FORMAT(fecha, '%Y-%m-%d') as fecha,
              valor, valor_elegible
       FROM facturas_mock WHERE numero = ?`,
      [numero]
    );
    return rows?.[0];
  } catch (e) {
    if (!isSchemaMismatchError(e)) throw e;
    const [rows] = await pool.execute<(RowDataPacket & { numero: string; fecha: string; valor: number })[]>(
      `SELECT numero,
              DATE_FORMAT(fecha, '%Y-%m-%d') as fecha,
              valor
       FROM facturas_mock WHERE numero = ?`,
      [numero]
    );
    const r = rows?.[0];
    return r ? { ...r, valor_elegible: null as number | null } : undefined;
  }
}

async function loadVentaValidar(numero: string) {
  try {
    const [rows] = await pool.execute<
      (RowDataPacket & {
        cedula: string;
        nombre_cliente: string;
        presentaciones_detalle: string | null;
        fecha: string;
        estado: string | null;
        valor: number;
        valor_elegible: number | null;
      })[]
    >(
      `SELECT cedula, nombre_cliente, presentaciones_detalle,
              DATE_FORMAT(fecha, '%Y-%m-%d') as fecha,
              estado, valor, valor_elegible
       FROM ventas WHERE numero = ?`,
      [numero]
    );
    return rows?.[0];
  } catch (e) {
    if (!isSchemaMismatchError(e)) throw e;
    const [rows] = await pool.execute<
      (RowDataPacket & {
        cedula: string;
        nombre_cliente: string;
        presentaciones_detalle: string | null;
        fecha: string;
        valor: number;
      })[]
    >(
      `SELECT cedula, nombre_cliente, presentaciones_detalle,
              DATE_FORMAT(fecha, '%Y-%m-%d') as fecha,
              valor
       FROM ventas WHERE numero = ?`,
      [numero]
    );
    const r = rows?.[0];
    return r ? { ...r, estado: 'emitida' as string | null, valor_elegible: null as number | null } : undefined;
  }
}

// GET /api/participaciones/validar-factura/:numero
participacionesRoutes.get('/validar-factura/:numero', authMiddleware, async (req, res, next) => {
  try {
    const { numero } = req.params;
    const venta = await loadVentaValidar(numero);
    if (!venta) {
      return res.status(404).json({
        error:
          'No existe una venta con este número en el servidor. Revisa el número o sincroniza si la factura quedó solo en el dispositivo.',
      });
    }

    const [yaPart] = await pool.execute<(RowDataPacket & { one: number })[]>(
      'SELECT 1 as one FROM participaciones WHERE factura_numero = ?',
      [numero]
    );
    if ((yaPart?.length ?? 0) > 0) return res.status(400).json({ error: 'Esta factura ya participó en el sorteo' });

    if (venta.estado && venta.estado !== 'emitida') {
      return res.status(400).json({ error: 'La factura no está disponible para sorteo' });
    }

    let enMock = await loadFacturaMockValidar(numero);
    if (!enMock) {
      if (await ventaTieneRedencionBono(pool, numero)) {
        return res.status(404).json({
          error: 'Esta factura no participa en el sorteo porque incluyó canje o descuento con bono.',
        });
      }
      const valorNum = Number(venta.valor);
      const ve = venta.valor_elegible != null ? Number(venta.valor_elegible) : valorNum;
      const fechaYmd = facturaYmdFromStored(venta.fecha);
      if (!fechaYmd) {
        return res.status(400).json({ error: 'Fecha de factura inválida en el registro de venta' });
      }
      await insertFacturaMockFromVenta(pool, {
        numero,
        fecha: fechaYmd,
        valor: valorNum,
        valorElegible: ve,
      });
      enMock = await loadFacturaMockValidar(numero);
    }
    if (!enMock) {
      return res.status(404).json({ error: 'No se pudo habilitar la factura para el sorteo.' });
    }

    const fechaYmd = facturaYmdFromStored(venta?.fecha ?? enMock.fecha);
    if (!fechaYmd) {
      return res.status(400).json({ error: 'No se pudo leer la fecha de emisión de la factura' });
    }
    if (fechaYmd !== todayYmdAmericaBogota()) {
      return res.status(400).json({ error: 'La participación solo es válida el mismo día de emisión de la factura' });
    }

    let listPresentaciones: unknown = [];
    let campaign: Awaited<ReturnType<typeof resolveCampaignForParticipation>> = null;
    try {
      campaign = await resolveCampaignForParticipation(
        pool,
        req.user?.usuario ?? '',
        req.user?.rol
      );
    } catch {
      campaign = null;
    }

    if (!campaign && isCampaignStrictMode() && (await hasAnyActiveCampaign(pool))) {
      return res.status(403).json({
        error:
          'No tienes una campaña promocional asignada. El administrador debe autorizarte en Campañas → Usuarios autorizados.',
        code: 'CAMPAIGN_NOT_ASSIGNED',
      });
    }
    if (campaign) {
      try {
        listPresentaciones = JSON.parse(campaign.refsElegiblesJson || '[]');
      } catch {
        listPresentaciones = [];
      }
    } else {
      const legacy = await loadLegacyConfigSorteo(pool);
      listPresentaciones = legacy.presentacionesParticipan || [];
    }

    if (!ventaPuedeParticipar(venta?.presentaciones_detalle || '[]', Array.isArray(listPresentaciones) ? listPresentaciones : [])) {
      return res.status(403).json({
        error: 'Esta factura no cumple con las referencias requeridas para participar en el sorteo',
        presentacionesRequeridas: Array.isArray(listPresentaciones) ? listPresentaciones : [],
      });
    }

    // Mínimo por subtotal de referencias seleccionadas (legacy, editable): solo aplica si hay refs configuradas y no hay campaña.
    if (!campaign) {
      const legacy = await loadLegacyConfigSorteo(pool);
      const minRefs = legacy.minSubtotalRefsParticipar ?? 0;
      const refs = Array.isArray(listPresentaciones) ? listPresentaciones.map(String) : [];
      if (refs.length > 0 && minRefs > 0) {
        try {
          const pres = JSON.parse(venta?.presentaciones_detalle || '[]');
          const ve = Array.isArray(pres) ? calcularValorElegible(pres, refs, Number(enMock.valor)) : 0;
          if (ve < minRefs) {
            return res.status(400).json({
              error: 'El subtotal de referencias seleccionadas no alcanza el mínimo para participar',
              minimoReferencias: minRefs,
              subtotalReferencias: ve,
            });
          }
        } catch {
          return res.status(400).json({ error: 'No se pudo validar el subtotal por referencias' });
        }
      }
    }

    return res.json({
      numero: enMock.numero,
      fecha: fechaYmd,
      valor: enMock.valor,
      valorElegible: enMock.valor_elegible != null ? Number(enMock.valor_elegible) : Number(enMock.valor),
      cedula: venta?.cedula || '',
      nombreCliente: venta?.nombre_cliente || '',
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/participaciones?desde=&hasta=&cliente=&factura=&estado=  (admin)
participacionesRoutes.get('/', authMiddleware, async (req, res, next) => {
  try {
    if (req.user?.rol !== 'administrador') return res.status(403).json({ error: 'Solo administrador' });

    const { desde, hasta, cliente, factura, estado } = (req.query ?? {}) as Record<string, unknown>;
    const desdeD = parseDate(desde);
    const hastaD = parseDate(hasta);
    const clienteQ = (cliente && String(cliente).trim()) || '';
    const facturaQ = (factura && String(factura).trim()) || '';
    const estadoQ = (estado && String(estado).trim().toLowerCase()) || '';

    // Algunas BDs legacy no tienen: p.valor_elegible, p.probabilidad_utilizada (migración 002 no aplicada).
    let selectCols = `
      SELECT p.id, p.factura_numero as facturaNumero, p.fecha_factura as fechaFactura, p.cedula, p.nombre_cliente as nombreCliente,
             p.valor_total as valorTotal, p.consentimiento, p.fecha_registro as fechaRegistro, p.usuario_registro as usuarioRegistro,
             p.valor_elegible as valorElegible, p.probabilidad_utilizada as probabilidadUtilizada
      FROM participaciones p`;
    const params: unknown[] = [];
    let sql = selectCols;

    if (estadoQ === 'disponible' || estadoQ === 'vigente') {
      sql += ` INNER JOIN bonos b ON b.participacion_id = p.id AND b.estado IN ('vigente','disponible','caucado') AND (b.fecha_vencimiento IS NULL OR b.fecha_vencimiento >= NOW())`;
    } else if (estadoQ === 'redimido') {
      sql += ` INNER JOIN bonos b ON b.participacion_id = p.id AND b.estado = 'redimido'`;
    } else if (estadoQ === 'vencido') {
      sql += ` INNER JOIN bonos b ON b.participacion_id = p.id AND (b.estado = 'vencido' OR (b.estado IN ('vigente','disponible') AND b.fecha_vencimiento < NOW()))`;
    }

    sql += ' WHERE 1=1';
    if (desdeD) {
      params.push(desdeD);
      sql += ` AND DATE(p.fecha_registro) >= DATE(?)`;
    }
    if (hastaD) {
      params.push(hastaD);
      sql += ` AND DATE(p.fecha_registro) <= DATE(?)`;
    }
    if (clienteQ) {
      params.push(`%${clienteQ}%`, `%${clienteQ}%`);
      sql += ` AND (p.nombre_cliente LIKE ? OR p.cedula LIKE ?)`;
    }
    if (facturaQ) {
      params.push(`%${facturaQ}%`);
      sql += ` AND p.factura_numero LIKE ?`;
    }
    sql += ' ORDER BY p.fecha_registro DESC LIMIT 500';

    try {
      const [rows] = await pool.execute<RowDataPacket[]>(sql, params as any);
      return res.json(rows);
    } catch (e) {
      if (!isSchemaMismatchError(e)) throw e;
      // Fallback: sin columnas nuevas.
      sql = `
        SELECT p.id, p.factura_numero as facturaNumero, p.fecha_factura as fechaFactura, p.cedula, p.nombre_cliente as nombreCliente,
               p.valor_total as valorTotal, p.consentimiento, p.fecha_registro as fechaRegistro, p.usuario_registro as usuarioRegistro
        FROM participaciones p`;
      if (estadoQ === 'disponible' || estadoQ === 'vigente') {
        sql += ` INNER JOIN bonos b ON b.participacion_id = p.id AND b.estado IN ('vigente','disponible','caucado') AND (b.fecha_vencimiento IS NULL OR b.fecha_vencimiento >= NOW())`;
      } else if (estadoQ === 'redimido') {
        sql += ` INNER JOIN bonos b ON b.participacion_id = p.id AND b.estado = 'redimido'`;
      } else if (estadoQ === 'vencido') {
        sql += ` INNER JOIN bonos b ON b.participacion_id = p.id AND (b.estado = 'vencido' OR (b.estado IN ('vigente','disponible') AND b.fecha_vencimiento < NOW()))`;
      }
      sql += ' WHERE 1=1';
      if (desdeD) sql += ` AND DATE(p.fecha_registro) >= DATE(?)`;
      if (hastaD) sql += ` AND DATE(p.fecha_registro) <= DATE(?)`;
      if (clienteQ) sql += ` AND (p.nombre_cliente LIKE ? OR p.cedula LIKE ?)`;
      if (facturaQ) sql += ` AND p.factura_numero LIKE ?`;
      sql += ' ORDER BY p.fecha_registro DESC LIMIT 500';
      const [rows2] = await pool.execute<RowDataPacket[]>(sql, params as any);
      // Homologar shape para el frontend.
      const out = (rows2 as any[]).map((r) => ({
        ...r,
        valorElegible: null,
        probabilidadUtilizada: null,
      }));
      return res.json(out);
    }
  } catch (err) {
    return next(err);
  }
});

// POST /api/participaciones
participacionesRoutes.post('/', authMiddleware, async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { facturaNumero, fechaFactura, cedula, nombreCliente, valorTotal, consentimiento, idempotencyKey } = body;
    if (!facturaNumero || !consentimiento) {
      return res.status(400).json({ error: 'facturaNumero y consentimiento requeridos' });
    }

    const result = await ejecutarParticipacion(pool, {
      usuario: req.user?.usuario ?? '',
      rol: req.user?.rol,
      facturaNumero: String(facturaNumero),
      fechaFactura: fechaFactura != null ? String(fechaFactura) : undefined,
      cedula: cedula != null ? String(cedula) : '',
      nombreCliente: nombreCliente != null ? String(nombreCliente) : '',
      valorTotal: Number(valorTotal),
      consentimiento: Boolean(consentimiento),
      idempotencyKey: idempotencyKey != null ? String(idempotencyKey) : null,
    });

    return res.json({
      gana: result.gana,
      gano: result.gana,
      codigoBono: result.codigoBono,
      compraMinimaBono: result.compraMinimaBono,
      mensaje: result.mensaje,
      probabilidadUtilizada: result.probabilidadUtilizada,
      leyendaFacturaBono: result.leyendaFacturaBono,
      valorElegible: result.valorElegible,
      campaignId: result.campaignId,
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; presentacionesRequeridas?: string[] };
    const status = typeof e.status === 'number' ? e.status : 500;
    if (e.presentacionesRequeridas) {
      return res.status(status).json({
        error: e.message || 'Error',
        presentacionesRequeridas: e.presentacionesRequeridas,
      });
    }
    if (status !== 500) {
      return res.status(status).json({ error: e.message || 'Error' });
    }
    return next(err);
  }
});
