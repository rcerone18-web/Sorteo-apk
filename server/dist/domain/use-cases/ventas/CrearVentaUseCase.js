"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrearVentaUseCase = void 0;
const crypto_1 = require("crypto");
const mysqlClient_1 = require("../../../infrastructure/database/mysqlClient");
const AppError_1 = require("../../../shared/errors/AppError");
const errorCodes_1 = require("../../../shared/errors/errorCodes");
const ConsecutivoRepositoryMySQL_1 = require("../../../infrastructure/repositories/ConsecutivoRepositoryMySQL");
const valorElegible_1 = require("../../campaign/valorElegible");
const resolveCampaign_1 = require("../../campaign/resolveCampaign");
class CrearVentaUseCase {
    ventaRepo;
    bonoRepo;
    configRepo;
    consecutivoRepo = new ConsecutivoRepositoryMySQL_1.ConsecutivoRepositoryMySQL();
    constructor(ventaRepo, bonoRepo, configRepo) {
        this.ventaRepo = ventaRepo;
        this.bonoRepo = bonoRepo;
        this.configRepo = configRepo;
    }
    async execute(input) {
        const clientId = input.clientId ?? deriveClientId(input);
        const existing = await this.ventaRepo.findByClientId(clientId);
        if (existing) {
            throw new AppError_1.AppError(errorCodes_1.ERROR_CODES.VENTA_DUPLICADA, 'Esta venta ya fue registrada (idempotencia)', 409, {
                numero: existing.numero,
            });
        }
        let campaign = null;
        try {
            campaign = await (0, resolveCampaign_1.resolveCampaignForParticipation)(mysqlClient_1.pool, input.usuarioVendedor, input.rolVendedor);
        }
        catch {
            campaign = null;
        }
        let refsEleg = [];
        let minSub = 0;
        let campaignId = campaign?.id ?? null;
        if (campaign) {
            try {
                refsEleg = JSON.parse(campaign.refsElegiblesJson || '[]');
                if (!Array.isArray(refsEleg))
                    refsEleg = [];
            }
            catch {
                refsEleg = [];
            }
            minSub = campaign.minSubtotalElegible;
        }
        else {
            const legacy = await (0, resolveCampaign_1.loadLegacyConfigSorteo)(mysqlClient_1.pool);
            refsEleg = legacy.presentacionesParticipan || [];
            minSub = 0;
        }
        const valorElegible = (0, valorElegible_1.calcularValorElegible)(input.presentaciones, refsEleg, input.valorTotal);
        const conn = await mysqlClient_1.pool.getConnection();
        try {
            await conn.beginTransaction();
            const numero = await this.consecutivoRepo.nextFactura2024(conn);
            let bonoId = null;
            if (input.codigoBono) {
                const bono = await this.bonoRepo.findByCodigoNormalized(input.codigoBono);
                if (!bono)
                    throw new AppError_1.AppError(errorCodes_1.ERROR_CODES.BONO_INVALIDO, 'Código de bono no encontrado', 404);
                const cedulaNorm = input.cedula.trim();
                const nombreUpper = input.nombreCliente.trim().toUpperCase();
                if (bono.cedula.trim() !== cedulaNorm || bono.nombreCliente.trim().toUpperCase() !== nombreUpper) {
                    throw new AppError_1.AppError(errorCodes_1.ERROR_CODES.BONO_NO_PERTENECE, 'Este bono no pertenece a este cliente', 403);
                }
                const st = bono.estado;
                if (st === 'anulado' || st === 'vencido' || st === 'redimido') {
                    throw new AppError_1.AppError(errorCodes_1.ERROR_CODES.BONO_INVALIDO, 'Bono no disponible para redimir', 409);
                }
                if (bono.fechaVencimiento && bono.fechaVencimiento.getTime() < Date.now()) {
                    throw new AppError_1.AppError(errorCodes_1.ERROR_CODES.BONO_INVALIDO, 'Bono vencido', 410);
                }
                if (bono.saldoRestante <= 0) {
                    throw new AppError_1.AppError(errorCodes_1.ERROR_CODES.BONO_INVALIDO, 'Bono sin saldo', 409);
                }
                if (valorElegible < bono.valorElegibleOrigen) {
                    throw new AppError_1.AppError(errorCodes_1.ERROR_CODES.COMPRA_MINIMA_NO_CUMPLIDA, 'El valor elegible de esta compra debe ser al menos el de la factura que originó el bono', 422, { valorElegibleMinimo: bono.valorElegibleOrigen });
                }
                const montoRedimir = Math.min(bono.saldoRestante, valorElegible);
                bonoId = bono.id;
                await this.bonoRepo.applyRedemption(bonoId, montoRedimir, numero, conn);
            }
            await this.ventaRepo.create({
                id: (0, crypto_1.randomUUID)(),
                clientId,
                numero,
                fecha: input.fechaFactura,
                cedula: input.cedula.trim(),
                nombreCliente: input.nombreCliente.trim(),
                valorTotal: input.valorTotal,
                totalHuevos: input.totalHuevos ?? null,
                presentacionesDetalleJson: JSON.stringify(input.presentaciones),
                valorElegible,
                campaignId,
            }, conn);
            // Todas las ventas sin redención de bono entran al pool del sorteo (facturas_mock).
            // La elegibilidad estricta (mínimo elegible, referencias, mismo día) se valida al participar.
            if (!bonoId) {
                try {
                    await conn.execute('INSERT INTO facturas_mock (numero, fecha, valor, valor_elegible) VALUES (?, ?, ?, ?)', [numero, input.fechaFactura, input.valorTotal, valorElegible]);
                }
                catch {
                    await conn.execute('INSERT INTO facturas_mock (numero, fecha, valor) VALUES (?, ?, ?)', [
                        numero,
                        input.fechaFactura,
                        input.valorTotal,
                    ]);
                }
                if (valorElegible >= minSub) {
                    try {
                        const cidMetric = campaignId ?? 'c0000001-0000-0000-0000-000000000001';
                        await conn.execute(`INSERT INTO campaign_metrics (campaign_id, usuario, ventas_elegibles_acum, bonos_emitidos_acum)
               VALUES (?, ?, ?, 0)
               ON DUPLICATE KEY UPDATE ventas_elegibles_acum = ventas_elegibles_acum + ?`, [cidMetric, input.usuarioVendedor, valorElegible, valorElegible]);
                    }
                    catch {
                        /* tabla no migrada */
                    }
                }
            }
            await conn.commit();
            return { numero };
        }
        catch (e) {
            await conn.rollback();
            throw e;
        }
        finally {
            conn.release();
        }
    }
}
exports.CrearVentaUseCase = CrearVentaUseCase;
function deriveClientId(input) {
    const seed = JSON.stringify({
        fechaFactura: input.fechaFactura,
        cedula: input.cedula.trim(),
        nombreCliente: input.nombreCliente.trim().toUpperCase(),
        valorTotal: input.valorTotal,
        totalHuevos: input.totalHuevos ?? null,
        presentaciones: input.presentaciones,
        codigoBono: input.codigoBono ?? null,
    });
    const hash = (0, crypto_1.createHash)('sha256').update(seed).digest();
    const bytes = hash.subarray(0, 16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Buffer.from(bytes).toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
