export interface BonoRow {
  id: string;
  codigo: string;
  estado: 'disponible' | 'redimido' | 'vencido';
  fechaVencimiento: Date | null;
  cedula: string;
  nombreCliente: string;
}

export interface IBonoRepository {
  findByCodigoNormalized(codigo: string): Promise<BonoRow | null>;
  markRedimido(id: string, tx?: unknown): Promise<void>;
}

