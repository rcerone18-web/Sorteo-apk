import type { Pool } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import type { PresupuestoModo } from '../probability/probabilityEngine';

export interface CampaignRow {
  id: string;
  nombre: string;
  minSubtotalElegible: number;
  pctBono: number;
  pctTopeCosto: number;
  bonoVigenciaDias: number;
  probabilidadBase: number;
  refsElegiblesJson: string;
  leyendaFacturaBono: string;
  bonoUnSoloUso: boolean;
  bonoNoAcumulable: boolean;
  redencionSoloFacturaFutura: boolean;
  redencionMinIgualOrigen: boolean;
  presupuestoTotal: number | null;
  presupuestoModo: PresupuestoModo;
  probabilityConfigJson: string | null;
}

type CampaignDbRow = RowDataPacket & {
  id: string;
  nombre: string;
  min_subtotal_elegible: number;
  pct_bono: number;
  pct_tope_costo: number;
  bono_vigencia_dias: number;
  probabilidad_base: number;
  refs_elegibles_json: string;
  leyenda_factura_bono: string;
  bono_un_solo_uso?: number | null;
  bono_no_acumulable?: number | null;
  redencion_solo_factura_futura?: number | null;
  redencion_min_igual_origen?: number | null;
  presupuesto_total?: number | null;
  presupuesto_modo?: PresupuestoModo | null;
  probability_config_json?: string | null;
};

function mapCampaignRow(r: CampaignDbRow): CampaignRow {
  return {
    id: r.id,
    nombre: r.nombre,
    minSubtotalElegible: Number(r.min_subtotal_elegible),
    pctBono: Number(r.pct_bono),
    pctTopeCosto: Number(r.pct_tope_costo),
    bonoVigenciaDias: Number(r.bono_vigencia_dias),
    probabilidadBase: Number(r.probabilidad_base),
    refsElegiblesJson: r.refs_elegibles_json || '[]',
    leyendaFacturaBono: r.leyenda_factura_bono || 'ESTA FACTURA CONTIENE UN BONO',
    bonoUnSoloUso: r.bono_un_solo_uso == null ? true : Number(r.bono_un_solo_uso) === 1,
    bonoNoAcumulable: r.bono_no_acumulable == null ? true : Number(r.bono_no_acumulable) === 1,
    redencionSoloFacturaFutura:
      r.redencion_solo_factura_futura == null ? true : Number(r.redencion_solo_factura_futura) === 1,
    redencionMinIgualOrigen:
      r.redencion_min_igual_origen == null ? true : Number(r.redencion_min_igual_origen) === 1,
    presupuestoTotal: r.presupuesto_total != null ? Number(r.presupuesto_total) : null,
    presupuestoModo: (r.presupuesto_modo as PresupuestoModo) || 'ratio',
    probabilityConfigJson: r.probability_config_json ?? null,
  };
}

const CAMPAIGN_SELECT_BASE = `c.id, c.nombre, c.min_subtotal_elegible, c.pct_bono, c.pct_tope_costo,
        c.bono_vigencia_dias, c.probabilidad_base, c.refs_elegibles_json, c.leyenda_factura_bono`;

const CAMPAIGN_SELECT_V2 = `${CAMPAIGN_SELECT_BASE},
        c.bono_un_solo_uso, c.bono_no_acumulable,
        c.redencion_solo_factura_futura, c.redencion_min_igual_origen,
        c.presupuesto_total, c.presupuesto_modo, c.probability_config_json`;

export function isCampaignStrictMode(): boolean {
  return process.env.CAMPAIGN_STRICT_MODE !== 'false';
}

/** Hay al menos una campaña activa en vigencia (para modo estricto sin fallback). */
export async function hasAnyActiveCampaign(pool: Pool): Promise<boolean> {
  try {
    const [rows] = await pool.execute<(RowDataPacket & { one: number })[]>(
      `SELECT 1 AS one FROM campaigns
       WHERE estado = 'activa' AND CURDATE() BETWEEN fecha_inicio AND fecha_fin
       LIMIT 1`
    );
    return (rows?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

export type RolParticipacion = 'asesor' | 'administrador';

/** Campaña activa vigente (sin exigir fila en campaign_users). */
export async function resolveDefaultActiveCampaign(pool: Pool): Promise<CampaignRow | null> {
  const fromWhere = `FROM campaigns c
     WHERE c.estado = 'activa' AND CURDATE() BETWEEN c.fecha_inicio AND c.fecha_fin
     ORDER BY c.fecha_inicio DESC
     LIMIT 1`;
  try {
    const [rows] = await pool.execute<CampaignDbRow[]>(`SELECT ${CAMPAIGN_SELECT_V2} ${fromWhere}`);
    return rows?.[0] ? mapCampaignRow(rows[0]) : null;
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code !== 'ER_BAD_FIELD_ERROR') throw e;
    try {
      const [rows] = await pool.execute<CampaignDbRow[]>(
        `SELECT ${CAMPAIGN_SELECT_BASE},
                c.bono_un_solo_uso, c.bono_no_acumulable,
                c.redencion_solo_factura_futura, c.redencion_min_igual_origen
         ${fromWhere}`
      );
      return rows?.[0] ? mapCampaignRow(rows[0]) : null;
    } catch {
      const [rows] = await pool.execute<CampaignDbRow[]>(
        `SELECT ${CAMPAIGN_SELECT_BASE} ${fromWhere}`
      );
      return rows?.[0] ? mapCampaignRow(rows[0]) : null;
    }
  }
}

/**
 * Resuelve campaña para venta/participación: asignación explícita en campaign_users,
 * o campaña activa por defecto si el usuario es administrador (demo/pruebas sin auto-asignarse).
 */
export async function resolveCampaignForParticipation(
  pool: Pool,
  usuario: string,
  rol?: RolParticipacion
): Promise<CampaignRow | null> {
  const assigned = await resolveCampaignForUser(pool, usuario);
  if (assigned) return assigned;
  if (rol === 'administrador') {
    return resolveDefaultActiveCampaign(pool);
  }
  return null;
}

export async function resolveCampaignForUser(pool: Pool, usuario: string): Promise<CampaignRow | null> {
  const sqlExt = `SELECT ${CAMPAIGN_SELECT_V2}
     FROM campaigns c
     INNER JOIN campaign_users cu ON cu.campaign_id = c.id AND cu.usuario = ?
     WHERE c.estado = 'activa' AND CURDATE() BETWEEN c.fecha_inicio AND c.fecha_fin
     ORDER BY c.fecha_inicio DESC
     LIMIT 1`;
  try {
    const [rows] = await pool.execute<CampaignDbRow[]>(sqlExt, [usuario]);
    return rows?.[0] ? mapCampaignRow(rows[0]) : null;
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code !== 'ER_BAD_FIELD_ERROR') throw e;
    try {
      const [rows] = await pool.execute<CampaignDbRow[]>(
        `SELECT ${CAMPAIGN_SELECT_BASE},
                c.bono_un_solo_uso, c.bono_no_acumulable,
                c.redencion_solo_factura_futura, c.redencion_min_igual_origen
         FROM campaigns c
         INNER JOIN campaign_users cu ON cu.campaign_id = c.id AND cu.usuario = ?
         WHERE c.estado = 'activa' AND CURDATE() BETWEEN c.fecha_inicio AND c.fecha_fin
         ORDER BY c.fecha_inicio DESC
         LIMIT 1`,
        [usuario]
      );
      return rows?.[0] ? mapCampaignRow(rows[0]) : null;
    } catch {
      const [rows] = await pool.execute<CampaignDbRow[]>(
        `SELECT ${CAMPAIGN_SELECT_BASE}
         FROM campaigns c
         INNER JOIN campaign_users cu ON cu.campaign_id = c.id AND cu.usuario = ?
         WHERE c.estado = 'activa' AND CURDATE() BETWEEN c.fecha_inicio AND c.fecha_fin
         ORDER BY c.fecha_inicio DESC
         LIMIT 1`,
        [usuario]
      );
      return rows?.[0] ? mapCampaignRow(rows[0]) : null;
    }
  }
}

/** Fallback si no hay fila en campaigns (BD sin migrar): lee config_sorteo legacy. */
export async function loadLegacyConfigSorteo(pool: Pool): Promise<{
  probabilidadGanar: number;
  compraMinimaBono: number;
  minSubtotalRefsParticipar: number;
  presentacionesParticipan: string[];
}> {
  const [rows] = await pool.execute<(RowDataPacket & { clave: string; valor: string })[]>(
    'SELECT clave, valor FROM config_sorteo'
  );
  const cfg: {
    probabilidadGanar?: number;
    compraMinimaBono?: number;
    minSubtotalRefsParticipar?: number;
    presentacionesParticipan?: string[];
  } = {};
  for (const r of rows ?? []) {
    if (r.clave === 'presentaciones_para_participar' || r.clave === 'presentaiones_para_participar') {
      try {
        const parsed = JSON.parse(r.valor || '[]');
        cfg.presentacionesParticipan = Array.isArray(parsed) ? parsed : [];
      } catch {
        cfg.presentacionesParticipan = [];
      }
    } else if (r.clave === 'probabilidad_ganar') cfg.probabilidadGanar = parseFloat(r.valor);
    else if (r.clave === 'compra_minima') cfg.compraMinimaBono = parseFloat(r.valor);
    else if (r.clave === 'min_subtotal_refs_participar')
      cfg.minSubtotalRefsParticipar = parseFloat(r.valor);
  }
  return {
    probabilidadGanar: cfg.probabilidadGanar ?? 0.1,
    compraMinimaBono: cfg.compraMinimaBono ?? 100000,
    minSubtotalRefsParticipar: Number.isFinite(cfg.minSubtotalRefsParticipar as number)
      ? (cfg.minSubtotalRefsParticipar as number)
      : 0,
    presentacionesParticipan: cfg.presentacionesParticipan ?? [],
  };
}
