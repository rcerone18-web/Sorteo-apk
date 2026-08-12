import type { PoolConnection } from 'mysql2/promise';
import { randomUUID } from 'crypto';
import { isSchemaMismatchError } from '../sorteo/dbCompat';
import type { ProbabilityEngineResult } from './probabilityEngine';

export interface AuditInput {
  participacionId: string;
  campaignId: string;
  usuario: string;
  facturaNumero: string;
  valorElegible: number;
  bonoValor: number;
  probBase: number;
  probResult: ProbabilityEngineResult;
  randomU: number;
  gano: boolean;
  configSnapshot: Record<string, unknown>;
}

export async function insertProbabilityAudit(
  conn: PoolConnection,
  input: AuditInput
): Promise<void> {
  try {
    await conn.execute(
      `INSERT INTO probability_audit_log (
        id, participacion_id, campaign_id, usuario, factura_numero,
        valor_elegible, bono_valor_estimado, prob_base, prob_final,
        V_vendedor, B_vendedor, V_campana, B_campana,
        headroom_ratio, headroom_absoluto, random_u, gano, motivo_bloqueo, config_snapshot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        input.participacionId,
        input.campaignId,
        input.usuario,
        input.facturaNumero,
        input.valorElegible,
        input.bonoValor,
        input.probBase,
        input.probResult.probFinal,
        input.configSnapshot.V_vendedor ?? 0,
        input.configSnapshot.B_vendedor ?? 0,
        input.configSnapshot.V_campana ?? null,
        input.configSnapshot.B_campana ?? null,
        input.probResult.headroomVendor,
        input.probResult.headroomAbsolute || null,
        input.randomU,
        input.gano ? 1 : 0,
        input.probResult.motivoBloqueo ?? null,
        JSON.stringify(input.configSnapshot),
      ] as (string | number | null)[]
    );
  } catch (e) {
    if (!isSchemaMismatchError(e)) throw e;
  }
}
