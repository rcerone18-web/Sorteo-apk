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
  id?: number;
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
  id?: number;
  numeroFactura: string;
  fechaFactura: string;
  cedulaCliente: string;
  nombreCliente: string;
  valorTotal: number;
  consentimientoDatos: boolean;
  resultado?: 'gano' | 'no_gano';
  codigoBono?: string;
  compraMinimaBono?: number;
  /** Misma clave en sync → servidor devuelve resultado idempotente (sin doble sorteo). */
  idempotencyKey?: string;
  probabilidadUtilizada?: number;
  leyendaFacturaBono?: string;
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
  probabilidadUtilizada?: number;
  leyendaFacturaBono?: string;
  valorElegible?: number;
  campaignId?: string;
}

// --- Admin módulo ---

export interface AdminUserItem {
  id: string;
  usuario: string;
  rol: Rol;
  nombre?: string;
}

export interface CampaignItem {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  minSubtotalElegible: number;
  pctBono: number;
  pctTopeCosto: number;
  bonoVigenciaDias: number;
  probabilidadBase: number;
  estado: 'activa' | 'inactiva';
  refsElegiblesJson: string;
  leyendaFacturaBono: string;
  presupuestoTotal?: number | null;
  presupuestoModo?: 'ratio' | 'absoluto' | 'mixto';
  /** Flags del brief promocional (opcional para BDs sin migrar 004). */
  bonoUnSoloUso?: boolean;
  bonoNoAcumulable?: boolean;
  redencionSoloFacturaFutura?: boolean;
  redencionMinIgualOrigen?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** Payload de creación/edición de campaña (admin). */
export interface CampaignWriteBody {
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  minSubtotalElegible: number;
  pctBono: number;
  pctTopeCosto: number;
  bonoVigenciaDias: number;
  probabilidadBase: number;
  estado: 'activa' | 'inactiva';
  refsElegibles: string[];
  leyendaFacturaBono: string;
  bonoUnSoloUso: boolean;
  bonoNoAcumulable: boolean;
  redencionSoloFacturaFutura: boolean;
  redencionMinIgualOrigen: boolean;
  presupuestoTotal?: number | null;
  presupuestoModo?: 'ratio' | 'absoluto' | 'mixto';
}

export interface ProbabilityAuditItem {
  id: string;
  participacionId?: string;
  facturaNumero: string;
  usuario: string;
  valorElegible: number;
  bonoValorEstimado: number;
  probBase: number;
  probFinal: number;
  randomU?: number;
  gano: number;
  motivoBloqueo?: string | null;
  createdAt: string;
}

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
  valorElegible?: number;
  probabilidadUtilizada?: number;
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
  estado: 'disponible' | 'vigente' | 'caucado' | 'redimido' | 'vencido' | 'anulado';
  estadoMostrar?: string;
  participacionId?: string;
}
