import type { Pool, PoolConnection } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import { randomUUID } from 'crypto';
import { ventaPuedeParticipar } from '../../interfaces/http/routes/_helpers';
import { calcularValorElegible } from '../campaign/valorElegible';
import type { CampaignRow, RolParticipacion } from '../campaign/resolveCampaign';
import {
  resolveCampaignForParticipation,
  loadLegacyConfigSorteo,
  hasAnyActiveCampaign,
  isCampaignStrictMode,
} from '../campaign/resolveCampaign';
import {
  calculateFinalProbability,
  evaluateDraw,
  normalizeProbBase,
} from '../probability/probabilityEngine';
import {
  lockVendorMetrics,
  lockGlobalMetrics,
  reserveBudgetIfNeeded,
  finalizeParticipacionMetrics,
} from '../probability/financialState';
import { insertProbabilityAudit } from '../probability/auditRecorder';
import { isSchemaMismatchError } from './dbCompat';
import { ventaTieneRedencionBono, insertFacturaMockFromVenta } from './facturasMock';
import { facturaYmdFromStored, todayYmdAmericaBogota } from '../../shared/date/participacionMismoDia';

export interface ParticipacionInput {
  usuario: string;
  rol?: RolParticipacion;
  facturaNumero: string;
  fechaFactura?: string;
  cedula: string;
  nombreCliente: string;
  valorTotal: number;
  consentimiento: boolean;
  idempotencyKey: string | null | undefined;
}

export interface ParticipacionResult {
  gana: boolean;
  codigoBono?: string;
  compraMinimaBono?: number;
  mensaje: string;
  probabilidadUtilizada: number;
  leyendaFacturaBono?: string;
  valorElegible?: number;
  campaignId?: string;
}

function parseRefs(json: string): string[] {
  try {
    const p = JSON.parse(json || '[]');
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return [];
  }
}

async function findIdempotentResult(pool: Pool, key: string): Promise<ParticipacionResult | null> {
  try {
    const [rows] = await pool.execute<
      (RowDataPacket & {
        ganador: number | null;
        codigo: string | null;
        prob: number | null;
        valor_elegible: number | null;
        campaign_id: string | null;
      })[]
    >(
      `SELECT s.ganador, b.codigo, s.probabilidad_utilizada as prob, p.valor_elegible, p.campaign_id
       FROM participaciones p
       INNER JOIN sorteos s ON s.participacion_id = p.id
       LEFT JOIN bonos b ON b.participacion_id = p.id
       WHERE p.idempotency_key = ?
       LIMIT 1`,
      [key]
    );
    const r = rows?.[0];
    if (!r) return null;
    const gana = r.ganador === 1;
    const legacy = await loadLegacyConfigSorteo(pool);
    return {
      gana,
      codigoBono: gana && r.codigo ? String(r.codigo) : undefined,
      compraMinimaBono: gana ? legacy.compraMinimaBono : undefined,
      mensaje: gana
        ? `¡Felicidades! Bono. Código: ${r.codigo}. (Resultado idempotente)`
        : 'Esta vez no ganaste. (Resultado idempotente)',
      probabilidadUtilizada: r.prob != null ? Number(r.prob) : 0,
      valorElegible: r.valor_elegible != null ? Number(r.valor_elegible) : undefined,
      campaignId: r.campaign_id ?? undefined,
    };
  } catch {
    return null;
  }
}

async function loadFacturaMock(
  conn: PoolConnection,
  numero: string
): Promise<{ numero: string; fecha: string; valor: number; valor_elegible: number | null } | undefined> {
  try {
    const [rows] = await conn.execute<
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
    const [rows] = await conn.execute<(RowDataPacket & { numero: string; fecha: string; valor: number })[]>(
      `SELECT numero,
              DATE_FORMAT(fecha, '%Y-%m-%d') as fecha,
              valor
       FROM facturas_mock WHERE numero = ?`,
      [numero]
    );
    const r = rows?.[0];
    return r ? { ...r, valor_elegible: null } : undefined;
  }
}

type VentaRow = {
  presentaciones_detalle: string | null;
  valor_elegible: number | null;
  campaign_id: string | null;
  fecha: string;
  estado: string | null;
  valor: number;
};

async function loadVenta(conn: PoolConnection, numero: string): Promise<VentaRow | undefined> {
  try {
    const [rows] = await conn.execute<(RowDataPacket & VentaRow)[]>(
      `SELECT presentaciones_detalle, valor_elegible, campaign_id,
              DATE_FORMAT(fecha, '%Y-%m-%d') as fecha,
              estado, valor
       FROM ventas WHERE numero = ?`,
      [numero]
    );
    return rows?.[0];
  } catch (e) {
    if (!isSchemaMismatchError(e)) throw e;
    const [rows] = await conn.execute<
      (RowDataPacket & { presentaciones_detalle: string | null; fecha: string; valor: number })[]
    >(
      `SELECT presentaciones_detalle,
              DATE_FORMAT(fecha, '%Y-%m-%d') as fecha,
              valor
       FROM ventas WHERE numero = ?`,
      [numero]
    );
    const r = rows?.[0];
    if (!r) return undefined;
    return {
      presentaciones_detalle: r.presentaciones_detalle,
      valor_elegible: null,
      campaign_id: null,
      fecha: r.fecha,
      estado: 'emitida',
      valor: Number(r.valor),
    };
  }
}

async function insertParticipacion(
  conn: PoolConnection,
  params: {
    participacionId: string;
    facturaNumero: string;
    fechaFacturaNorm: string;
    cedula: string;
    nombreCliente: string;
    valorTotal: number;
    consentimiento: boolean;
    usuario: string;
    idem: string | null;
    campaignId: string;
    valorElegible: number;
    probabilidadUtilizada: number;
  }
): Promise<void> {
  const {
    participacionId,
    facturaNumero,
    fechaFacturaNorm,
    cedula,
    nombreCliente,
    valorTotal,
    consentimiento,
    usuario,
    idem,
    campaignId,
    valorElegible,
    probabilidadUtilizada,
  } = params;
  try {
    await conn.execute(
      `INSERT INTO participaciones (id, factura_numero, fecha_factura, cedula, nombre_cliente, valor_total, consentimiento, usuario_registro, idempotency_key, campaign_id, valor_elegible, probabilidad_utilizada)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        participacionId,
        facturaNumero,
        fechaFacturaNorm,
        cedula,
        nombreCliente,
        valorTotal,
        consentimiento ? 1 : 0,
        usuario,
        idem,
        campaignId,
        valorElegible,
        probabilidadUtilizada,
      ]
    );
  } catch (e) {
    if (!isSchemaMismatchError(e)) throw e;
    await conn.execute(
      `INSERT INTO participaciones (id, factura_numero, fecha_factura, cedula, nombre_cliente, valor_total, consentimiento, usuario_registro)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        participacionId,
        facturaNumero,
        fechaFacturaNorm,
        cedula,
        nombreCliente,
        valorTotal,
        consentimiento ? 1 : 0,
        usuario,
      ]
    );
  }
}

async function insertSorteo(
  conn: PoolConnection,
  sorteoId: string,
  participacionId: string,
  gana: number,
  usuario: string,
  probabilidadUtilizada: number
): Promise<void> {
  try {
    await conn.execute(
      `INSERT INTO sorteos (id, participacion_id, ganador, usuario, probabilidad_utilizada) VALUES (?, ?, ?, ?, ?)`,
      [sorteoId, participacionId, gana, usuario, probabilidadUtilizada]
    );
  } catch (e) {
    if (!isSchemaMismatchError(e)) throw e;
    await conn.execute(`INSERT INTO sorteos (id, participacion_id, ganador, usuario) VALUES (?, ?, ?, ?)`, [
      sorteoId,
      participacionId,
      gana,
      usuario,
    ]);
  }
}

async function insertBono(
  conn: PoolConnection,
  params: {
    bonoId: string;
    bonoCodigo: string;
    facturaNumero: string;
    cedula: string;
    nombreCliente: string;
    bonoValor: number;
    valorElegible: number;
    fechaVencStr: string;
    participacionId: string;
    campaignId: string;
  }
): Promise<void> {
  const {
    bonoId,
    bonoCodigo,
    facturaNumero,
    cedula,
    nombreCliente,
    bonoValor,
    valorElegible,
    fechaVencStr,
    participacionId,
    campaignId,
  } = params;
  try {
    await conn.execute(
      `INSERT INTO bonos (id, codigo, factura_origen, cedula, nombre_cliente, valor, saldo_restante, valor_elegible_origen, fecha_vencimiento, estado, participacion_id, campaign_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'vigente', ?, ?)`,
      [
        bonoId,
        bonoCodigo,
        facturaNumero,
        cedula,
        nombreCliente,
        bonoValor,
        bonoValor,
        valorElegible,
        fechaVencStr,
        participacionId,
        campaignId,
      ]
    );
  } catch (e) {
    if (!isSchemaMismatchError(e)) throw e;
    await conn.execute(
      `INSERT INTO bonos (id, codigo, factura_origen, cedula, nombre_cliente, valor, fecha_vencimiento, estado, participacion_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'disponible', ?)`,
      [bonoId, bonoCodigo, facturaNumero, cedula, nombreCliente, bonoValor, fechaVencStr, participacionId]
    );
  }
}

export async function ejecutarParticipacion(pool: Pool, input: ParticipacionInput): Promise<ParticipacionResult> {
  const idem = input.idempotencyKey?.trim();
  if (idem) {
    const replay = await findIdempotentResult(pool, idem);
    if (replay) return replay;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const facturaNumero = String(input.facturaNumero);
    const venta = await loadVenta(conn, facturaNumero);
    if (!venta) {
      await conn.rollback();
      conn.release();
      throw Object.assign(
        new Error('No existe una venta registrada con este número en el servidor. Verifica el número o sincroniza si la factura fue creada sin conexión.'),
        { status: 404 }
      );
    }

    const [yaPart] = await conn.execute<(RowDataPacket & { one: number })[]>(
      'SELECT 1 as one FROM participaciones WHERE factura_numero = ?',
      [facturaNumero]
    );
    if ((yaPart?.length ?? 0) > 0) {
      await conn.rollback();
      conn.release();
      throw Object.assign(new Error('Esta factura ya participó en el sorteo'), { status: 400 });
    }

    if (venta.estado && venta.estado !== 'emitida') {
      await conn.rollback();
      conn.release();
      throw Object.assign(new Error('La factura no está disponible para sorteo'), { status: 400 });
    }

    let enMock = await loadFacturaMock(conn, facturaNumero);
    if (!enMock) {
      if (await ventaTieneRedencionBono(conn, facturaNumero)) {
        await conn.rollback();
        conn.release();
        throw Object.assign(
          new Error('Esta factura no participa en el sorteo porque incluyó canje o descuento con bono.'),
          { status: 404 }
        );
      }
      const valorNum = Number(venta.valor);
      const ve = venta.valor_elegible != null ? Number(venta.valor_elegible) : valorNum;
      const fechaYmdBackfill = facturaYmdFromStored(venta.fecha);
      if (!fechaYmdBackfill) {
        await conn.rollback();
        conn.release();
        throw Object.assign(new Error('Fecha de factura inválida en el registro de venta'), { status: 400 });
      }
      await insertFacturaMockFromVenta(conn, {
        numero: facturaNumero,
        fecha: fechaYmdBackfill,
        valor: valorNum,
        valorElegible: ve,
      });
      enMock = await loadFacturaMock(conn, facturaNumero);
    }
    if (!enMock) {
      await conn.rollback();
      conn.release();
      throw Object.assign(new Error('No se pudo habilitar la factura para el sorteo.'), { status: 404 });
    }

    let campaign: CampaignRow | null = null;
    try {
      campaign = await resolveCampaignForParticipation(pool, input.usuario, input.rol);
    } catch {
      campaign = null;
    }

    if (!campaign && isCampaignStrictMode() && (await hasAnyActiveCampaign(pool))) {
      await conn.rollback();
      conn.release();
      throw Object.assign(
        new Error(
          'No tienes una campaña promocional asignada. El administrador debe autorizarte en Campañas → Usuarios autorizados.'
        ),
        { status: 403, code: 'CAMPAIGN_NOT_ASSIGNED' }
      );
    }

    const legacy = await loadLegacyConfigSorteo(pool);
    let refsCfg: string[] = parseRefs(campaign?.refsElegiblesJson ?? '[]');
    if (!campaign) {
      refsCfg = legacy.presentacionesParticipan || [];
    }

    if (!ventaPuedeParticipar(venta?.presentaciones_detalle || '[]', refsCfg.length ? refsCfg : [])) {
      await conn.rollback();
      conn.release();
      throw Object.assign(
        new Error('Esta factura no cumple con las referencias requeridas para participar en el sorteo'),
        { status: 403, presentacionesRequeridas: refsCfg }
      );
    }

    const fechaFacturaNorm = facturaYmdFromStored(venta?.fecha ?? enMock.fecha);
    if (!fechaFacturaNorm) {
      await conn.rollback();
      conn.release();
      throw Object.assign(new Error('No se pudo leer la fecha de emisión de la factura'), { status: 400 });
    }
    if (fechaFacturaNorm !== todayYmdAmericaBogota()) {
      await conn.rollback();
      conn.release();
      throw Object.assign(new Error('La participación solo es válida el mismo día de emisión de la factura'), {
        status: 400,
      });
    }

    let valorElegible =
      venta?.valor_elegible != null ? Number(venta.valor_elegible) : Number(enMock.valor_elegible ?? enMock.valor);
    try {
      const pres = JSON.parse(venta?.presentaciones_detalle || '[]');
      if (Array.isArray(pres)) {
        const ve = calcularValorElegible(pres, refsCfg, Number(enMock.valor));
        if (ve > 0) valorElegible = ve;
      }
    } catch {
      /* usar columna */
    }

    const probBase = normalizeProbBase(campaign?.probabilidadBase ?? legacy.probabilidadGanar);

    const pctTope = campaign?.pctTopeCosto ?? 0.15;
    const minSub = campaign?.minSubtotalElegible ?? 0;
    const pctBono = campaign?.pctBono ?? 0.5;
    const bonoDias = campaign?.bonoVigenciaDias ?? 30;
    const compraMinima = legacy.compraMinimaBono;
    const minRefsLegacy = legacy.minSubtotalRefsParticipar ?? 0;
    const campaignId = campaign?.id ?? venta?.campaign_id ?? 'c0000001-0000-0000-0000-000000000001';
    const leyenda = campaign?.leyendaFacturaBono ?? 'ESTA FACTURA CONTIENE UN BONO';

    if (valorElegible < minSub) {
      await conn.rollback();
      conn.release();
      throw Object.assign(new Error('El valor elegible de la factura no alcanza el mínimo de la campaña'), {
        status: 400,
      });
    }

    // Regla adicional (legacy, editable): mínimo de subtotal por referencias seleccionadas para poder participar.
    // Solo aplica si hay refs configuradas y NO hay campaña (si hay campaña, usa min_subtotal_elegible).
    if (!campaign && refsCfg.length > 0 && minRefsLegacy > 0 && valorElegible < minRefsLegacy) {
      await conn.rollback();
      conn.release();
      throw Object.assign(new Error('El subtotal de referencias seleccionadas no alcanza el mínimo para participar'), {
        status: 400,
        minimoReferencias: minRefsLegacy,
      });
    }

    const bonoValor = valorElegible * pctBono;

    const vendorMetrics = await lockVendorMetrics(conn, campaignId, input.usuario);
    const globalMetrics = await lockGlobalMetrics(conn, campaignId);

    const presupuestoTotal = campaign?.presupuestoTotal ?? null;
    const presupuestoModo = campaign?.presupuestoModo ?? 'ratio';

    const reserve = await reserveBudgetIfNeeded(
      conn,
      campaignId,
      bonoValor,
      presupuestoTotal,
      presupuestoModo
    );
    if (!reserve.ok) {
      await conn.rollback();
      conn.release();
      throw Object.assign(
        new Error('La campaña no tiene presupuesto promocional suficiente para emitir más bonos.'),
        { status: 409, code: 'PRESUPUESTO_AGOTADO' }
      );
    }

    const V_c_proj = globalMetrics.ventasElegibles + valorElegible;
    const probResult = calculateFinalProbability({
      probBase,
      pctTope,
      bonoValor,
      vendor: {
        ventasElegibles: vendorMetrics.ventasElegibles,
        bonosEmitidos: vendorMetrics.bonosEmitidos,
        pctTope,
      },
      campaign: globalMetrics.useGlobal
        ? {
            ventasElegibles: V_c_proj,
            bonosEmitidos: globalMetrics.bonosEmitidos,
            pctTope,
          }
        : undefined,
      presupuestoModo,
      absolute:
        presupuestoTotal && presupuestoTotal > 0
          ? {
              presupuestoTotal,
              bonosEmitidos: globalMetrics.bonosEmitidos,
              bonosReserva: globalMetrics.bonosReserva + (reserve.reserved ? bonoValor : 0),
            }
          : undefined,
    });

    const probabilidadUtilizada = vendorMetrics.useMetrics ? probResult.probFinal : probBase;
    const { gana: ganaBool, randomU } = evaluateDraw(probabilidadUtilizada);
    const gana = ganaBool ? 1 : 0;

    const participacionId = randomUUID();
    const sorteoId = randomUUID();
    await insertParticipacion(conn, {
      participacionId,
      facturaNumero: String(input.facturaNumero),
      fechaFacturaNorm,
      cedula: String(input.cedula || ''),
      nombreCliente: String(input.nombreCliente || ''),
      valorTotal: Number(input.valorTotal ?? enMock.valor),
      consentimiento: input.consentimiento,
      usuario: input.usuario,
      idem: idem || null,
      campaignId,
      valorElegible,
      probabilidadUtilizada,
    });

    await insertSorteo(conn, sorteoId, participacionId, gana, input.usuario, probabilidadUtilizada);

    let bonoCodigo: string | null = null;
    if (gana === 1) {
      const bonoId = randomUUID();
      bonoCodigo = `BONO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const venc = new Date();
      venc.setDate(venc.getDate() + bonoDias);
      const fechaVencStr = venc.toISOString().slice(0, 19).replace('T', ' ');
      await insertBono(conn, {
        bonoId,
        bonoCodigo,
        facturaNumero: String(input.facturaNumero),
        cedula: String(input.cedula || ''),
        nombreCliente: String(input.nombreCliente || ''),
        bonoValor,
        valorElegible,
        fechaVencStr,
        participacionId,
        campaignId,
      });
    }

    await insertProbabilityAudit(conn, {
      participacionId,
      campaignId,
      usuario: input.usuario,
      facturaNumero: String(input.facturaNumero),
      valorElegible,
      bonoValor,
      probBase,
      probResult,
      randomU,
      gano: gana === 1,
      configSnapshot: {
        pctTope,
        pctBono,
        presupuestoModo,
        presupuestoTotal,
        V_vendedor: vendorMetrics.ventasElegibles,
        B_vendedor: vendorMetrics.bonosEmitidos,
        V_campana: V_c_proj,
        B_campana: globalMetrics.bonosEmitidos,
        campaignNombre: campaign?.nombre ?? 'legacy',
      },
    });

    await finalizeParticipacionMetrics(conn, {
      campaignId,
      usuario: input.usuario,
      valorElegible,
      bonoValor,
      gano: gana === 1,
      hadReserve: reserve.reserved,
      vendorUseMetrics: vendorMetrics.useMetrics,
    });

    await conn.commit();
    conn.release();

    return {
      gana: gana === 1,
      codigoBono: gana === 1 ? bonoCodigo! : undefined,
      compraMinimaBono: gana === 1 ? compraMinima : undefined,
      mensaje:
        gana === 1
          ? `¡Felicidades! Bono ${Math.round(pctBono * 100)}%. Código: ${bonoCodigo}. Compra mínima redención: $${compraMinima}. ${leyenda}`
          : 'Esta vez no ganaste.',
      probabilidadUtilizada,
      leyendaFacturaBono: leyenda,
      valorElegible,
      campaignId,
    };
  } catch (e) {
    await conn.rollback();
    conn.release();
    throw e;
  }
}
