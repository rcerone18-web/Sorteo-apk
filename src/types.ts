/** Roles según BASE_DE_DATOS_TABLAS.md: asesor (ventero), administrador */
export type Rol = 'asesor' | 'administrador';

export interface Usuario {
  id: string;
  usuario: string;
  rol: Rol;
  nombre?: string;
}

/** Presentación + cantidad para ventas (igual que doc: presentaciones_detalle) */
export interface PresentacionDetalle {
  presentacion: string;
  cantidad: number;
}

/** Item con precio (para UI de facturación); al enviar al API se usa presentaciones: { presentacion, cantidad }[] */
export interface ItemFactura {
  tipoPresentacion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface Factura {
  id?: string;
  numeroFactura: string;
  fechaFactura: string;
  cedulaCliente: string;
  nombreCliente: string;
  valorTotal: number;
  totalHuevos?: number;
  /** Para API: [{ presentacion, cantidad }]. En UI se puede usar items con precio. */
  presentaciones?: PresentacionDetalle[];
  items?: ItemFactura[];
  codigoBonoRedimido?: string;
  sincronizado?: boolean;
  createdAt?: string;
}

export interface Participacion {
  id?: string;
  numeroFactura: string;
  fechaFactura: string;
  cedulaCliente: string;
  nombreCliente: string;
  valorTotal: number;
  consentimientoDatos: boolean;
  resultado?: 'gano' | 'no_gano';
  codigoBono?: string;
  compraMinimaBono?: number;
  sincronizado?: boolean;
  createdAt?: string;
}

export interface ConfigSorteo {
  probabilidadGanar: number;
  compraMinimaBono: number;
  presentacionesParticipan: string[];
}

export interface RespuestaSorteo {
  /** Servidor devuelve "gana"; la app usa "gano" en pantallas */
  gana?: boolean;
  gano?: boolean;
  codigoBono?: string;
  compraMinimaBono?: number;
  mensaje: string;
}

// --- Admin módulo ---

export interface AdminMetricas {
  totalParticipaciones: number;
  totalGanadores: number;
  tasaObservada: number;
  valorEmitido: number;
  valorRedimido: number;
}

export interface ParticipacionItem {
  id: string;
  facturaNumero: string;
  fechaFactura: string;
  cedula: string;
  nombreCliente: string;
  valorTotal: number;
  consentimiento: number;
  fechaRegistro: string;
  usuarioRegistro: string;
}

export interface SorteoItem {
  id: string;
  participacionId: string;
  ganador: number;
  fechaSorteo: string;
  usuario: string;
}

export interface BonoItem {
  id: string;
  codigo: string;
  facturaOrigen: string;
  cedula: string;
  nombreCliente: string;
  valor: number;
  fechaEmision: string;
  fechaVencimiento: string;
  estado: 'disponible' | 'redimido' | 'vencido';
  estadoMostrar?: string;
  participacionId?: string;
}
