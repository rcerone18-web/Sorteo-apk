"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertProbabilityAudit = insertProbabilityAudit;
const crypto_1 = require("crypto");
const dbCompat_1 = require("../sorteo/dbCompat");
async function insertProbabilityAudit(conn, input) {
    try {
        await conn.execute(`INSERT INTO probability_audit_log (
        id, participacion_id, campaign_id, usuario, factura_numero,
        valor_elegible, bono_valor_estimado, prob_base, prob_final,
        V_vendedor, B_vendedor, V_campana, B_campana,
        headroom_ratio, headroom_absoluto, random_u, gano, motivo_bloqueo, config_snapshot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            (0, crypto_1.randomUUID)(),
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
        ]);
    }
    catch (e) {
        if (!(0, dbCompat_1.isSchemaMismatchError)(e))
            throw e;
    }
}
