import type { PoolConnection } from 'mysql2/promise';
import { randomUUID, createHash } from 'crypto';
import { pool } from '../../../infrastructure/database/mysqlClient';
import { AppError } from '../../../shared/errors/AppError';
import { ERROR_CODES } from '../../../shared/errors/errorCodes';
import type { IVentaRepository } from '../../../application/repositories/IVentaRepository';
import type { IBonoRepository } from '../../../application/repositories/IBonoRepository';
import type { IConfigRepository } from '../../../application/repositories/IConfigRepository';
import { ConsecutivoRepositoryMySQL } from '../../../infrastructure/repositories/ConsecutivoRepositoryMySQL';

export interface CrearVentaInput {
  clientId?: string;
  fechaFactura: string; // YYYY-MM-DD
  cedula: string;
  nombreCliente: string;
  valorTotal: number;
  totalHuevos?: number;
  presentaciones: { presentacion: string; cantidad: number }[];
  codigoBono?: string;
}

export class CrearVentaUseCase {
  private consecutivoRepo = new ConsecutivoRepositoryMySQL();

  constructor(
    private ventaRepo: IVentaRepository,
    private bonoRepo: IBonoRepository,
    private configRepo: IConfigRepository,
  ) {}

  async execute(input: CrearVentaInput): Promise<{ numero: string }> {
    // Idempotencia: si la app no envía `clientId`, lo derivamos de los campos.
    // Esto evita duplicar ventas al sincronizar.
    const clientId = input.clientId ?? deriveClientId(input);

    const existing = await this.ventaRepo.findByClientId(clientId);
    if (existing) {
      throw new AppError(ERROR_CODES.VENTA_DUPLICADA, 'Esta venta ya fue registrada (idempotencia)', 409, {
        numero: existing.numero,
      });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const numero = await this.consecutivoRepo.nextFactura2024(conn);

      // Validaciones críticas de bono (solo backend)
      let bonoId: string | null = null;
      if (input.codigoBono) {
        const bono = await this.bonoRepo.findByCodigoNormalized(input.codigoBono);
        if (!bono) throw new AppError(ERROR_CODES.BONO_INVALIDO, 'Código de bono no encontrado', 404);

        const cedulaNorm = input.cedula.trim();
        const nombreUpper = input.nombreCliente.trim().toUpperCase();
        if (bono.cedula.trim() !== cedulaNorm || bono.nombreCliente.trim().toUpperCase() !== nombreUpper) {
          throw new AppError(ERROR_CODES.BONO_NO_PERTENECE, 'Este bono no pertenece a este cliente', 403);
        }
        if (bono.estado === 'redimido') throw new AppError(ERROR_CODES.BONO_INVALIDO, 'Bono ya fue redimido', 409);
        if (bono.fechaVencimiento && bono.fechaVencimiento.getTime() < Date.now()) {
          throw new AppError(ERROR_CODES.BONO_INVALIDO, 'Bono vencido', 410);
        }
        const compraMin = await this.configRepo.getCompraMinimaBono();
        if (input.valorTotal < compraMin) {
          throw new AppError(
            ERROR_CODES.COMPRA_MINIMA_NO_CUMPLIDA,
            'Compra mínima no alcanzada para redimir el bono',
            422,
            { compraMinimaRequerida: compraMin },
          );
        }
        bonoId = bono.id;
      }

      await this.ventaRepo.create(
        {
          id: randomUUID(),
          clientId,
          numero,
          fecha: input.fechaFactura,
          cedula: input.cedula.trim(),
          nombreCliente: input.nombreCliente.trim(),
          valorTotal: input.valorTotal,
          totalHuevos: input.totalHuevos ?? null,
          presentacionesDetalleJson: JSON.stringify(input.presentaciones),
        },
        conn as unknown as PoolConnection,
      );

      if (!bonoId) {
        await conn.execute('INSERT INTO facturas_mock (numero, fecha, valor) VALUES (?, ?, ?)', [
          numero,
          input.fechaFactura,
          input.valorTotal,
        ]);
      } else {
        await this.bonoRepo.markRedimido(bonoId, conn as unknown as PoolConnection);
      }

      await conn.commit();
      return { numero };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
}

function deriveClientId(input: Omit<CrearVentaInput, 'clientId'>): string {
  const seed = JSON.stringify({
    fechaFactura: input.fechaFactura,
    cedula: input.cedula.trim(),
    nombreCliente: input.nombreCliente.trim().toUpperCase(),
    valorTotal: input.valorTotal,
    totalHuevos: input.totalHuevos ?? null,
    presentaciones: input.presentaciones,
    codigoBono: input.codigoBono ?? null,
  });

  // Creamos un UUID "con forma" a partir de un hash para cumplir el schema `.uuid()`.
  const hash = createHash('sha256').update(seed).digest(); // Buffer
  const bytes = hash.subarray(0, 16);

  // Ajustar versión (4) y variante (10xxxxxx) para RFC4122.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Buffer.from(bytes).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

