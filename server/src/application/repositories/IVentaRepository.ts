export interface CrearVentaRecord {
  id: string;
  clientId: string;
  numero: string;
  fecha: string; // YYYY-MM-DD
  cedula: string;
  nombreCliente: string;
  valorTotal: number;
  totalHuevos: number | null;
  presentacionesDetalleJson: string;
}

export interface IVentaRepository {
  findByClientId(clientId: string): Promise<{ numero: string } | null>;
  create(record: CrearVentaRecord, tx?: unknown): Promise<void>;
}

