export interface BonoRow {
  id: string;
  codigo: string;
  estado: string;
  fechaVencimiento: Date | null;
  cedula: string;
  nombreCliente: string;
  saldoRestante: number;
  valorElegibleOrigen: number;
  valorInicial: number;
}

export interface IBonoRepository {
  findByCodigoNormalized(codigo: string): Promise<BonoRow | null>;
  /** Marca bono totalmente redimido (compatibilidad legacy) */
  markRedimido(id: string, tx?: unknown): Promise<void>;
  /** Redención parcial o total: descuenta saldo y actualiza estado (vigente/caucado/redimido). */
  applyRedemption(id: string, montoUsado: number, facturaRedencion: string, tx?: unknown): Promise<void>;
}
