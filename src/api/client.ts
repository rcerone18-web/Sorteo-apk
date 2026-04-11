import axios, { AxiosInstance } from 'axios';
import { getApiBaseUrl } from '../config';
import type {
  Factura,
  Participacion,
  ConfigSorteo,
  RespuestaSorteo,
  PresentacionDetalle,
  AdminMetricas,
  ParticipacionItem,
  SorteoItem,
  BonoItem,
} from '../types';

let token: string | null = null;
let onAuthError: (() => void) | null = null;

export function setAuthToken(t: string | null) {
  token = t;
}

export function setOnAuthError(fn: (() => void) | null) {
  onAuthError = fn;
}

function client(): AxiosInstance {
  const c = axios.create({
    baseURL: `${getApiBaseUrl()}/api`,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  });
  c.interceptors.request.use((config) => {
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  c.interceptors.response.use(
    (r) => r,
    (err) => {
      // Solo cerrar sesión si el problema es autenticación (token inválido/expirado).
      // El 403 aquí puede venir de reglas de negocio (p.ej. "presentaciones requeridas"),
      // y no debe forzar logout.
      if (err.response?.status === 401) {
        onAuthError?.();
      }
      return Promise.reject(err);
    }
  );
  return c;
}

export interface LoginBody {
  usuario: string;
  clave: string;
}
export interface LoginResponse {
  token: string;
  usuario: { id: string; usuario: string; rol: 'asesor' | 'administrador'; nombre?: string };
}

export async function login(body: LoginBody): Promise<LoginResponse> {
  const { data } = await client().post<LoginResponse>('/auth/login', body);
  return data;
}

/** Prueba si el servidor está alcanzable (para diagnóstico). */
export async function testConnection(): Promise<{ ok: boolean; mensaje: string }> {
  try {
    const base = getApiBaseUrl();
    await axios.get(base, { timeout: 5000 });
    return { ok: true, mensaje: 'Servidor alcanzable' };
  } catch (e) {
    const msg = axios.isAxiosError(e) ? (e.message || 'Error de red') : 'Error desconocido';
    return { ok: false, mensaje: msg };
  }
}

/** Body según doc: cedula, nombreCliente, valorTotal, fechaFactura, totalHuevos?, presentaciones, codigoBono? */
export interface CrearVentaBody {
  fechaFactura: string;
  cedulaCliente: string;
  nombreCliente: string;
  valorTotal: number;
  totalHuevos?: number;
  presentaciones: PresentacionDetalle[];
  codigoBono?: string;
}
export interface CrearVentaResponse {
  numero: string;
}

export async function crearVenta(body: CrearVentaBody): Promise<CrearVentaResponse> {
  const payload = {
    cedula: body.cedulaCliente,
    nombreCliente: body.nombreCliente,
    valorTotal: body.valorTotal,
    fechaFactura: body.fechaFactura,
    totalHuevos: body.totalHuevos,
    presentaciones: body.presentaciones,
    codigoBono: body.codigoBono,
  };
  // El backend responde con `{ data: { numero } }`.
  const { data } = await client().post<{ data: CrearVentaResponse }>('/ventas', payload);
  return (data as any).data ?? data;
}

export interface VentaPorNumero {
  numeroFactura: string;
  fechaFactura: string;
  cedulaCliente: string;
  nombreCliente: string;
  valorTotal: number;
  totalHuevos?: number;
  presentaciones?: PresentacionDetalle[];
  usadaEnSorteo?: boolean;
  tieneBonoRedimido?: boolean;
}

export async function getVentaPorNumero(numero: string): Promise<VentaPorNumero | null> {
  try {
    const { data } = await client().get<VentaPorNumero>(`/ventas/por-numero/${encodeURIComponent(numero)}`);
    return data;
  } catch (e: unknown) {
    if (axios.isAxiosError(e) && e.response?.status === 404) return null;
    throw e;
  }
}

/** Última venta por cédula (autocompletar formulario ventas) */
export async function getVentaPorCedula(cedula: string): Promise<VentaPorNumero | null> {
  try {
    const { data } = await client().get<VentaPorNumero>(`/ventas/ultima-por-cedula/${encodeURIComponent(cedula)}`);
    return data;
  } catch (e: unknown) {
    if (axios.isAxiosError(e) && e.response?.status === 404) return null;
    throw e;
  }
}

/** Validar factura para participación (facturas_mock) */
export async function validarFactura(numero: string): Promise<VentaPorNumero | null> {
  try {
    const { data } = await client().get<{ numero: string; fecha: string; valor: number; cedula: string; nombreCliente: string }>(
      `/participaciones/validar-factura/${encodeURIComponent(numero)}`
    );
    return {
      numeroFactura: data.numero,
      fechaFactura: data.fecha,
      cedulaCliente: data.cedula,
      nombreCliente: data.nombreCliente,
      valorTotal: data.valor,
    };
  } catch (e: unknown) {
    if (axios.isAxiosError(e) && (e.response?.status === 404 || e.response?.status === 400)) return null;
    throw e;
  }
}

export interface CrearParticipacionBody {
  numeroFactura: string;
  fechaFactura: string;
  cedulaCliente: string;
  nombreCliente: string;
  valorTotal: number;
  consentimientoDatos: boolean;
}

export async function crearParticipacion(body: CrearParticipacionBody): Promise<RespuestaSorteo> {
  const payload = {
    facturaNumero: body.numeroFactura,
    fechaFactura: body.fechaFactura,
    cedula: body.cedulaCliente,
    nombreCliente: body.nombreCliente,
    valorTotal: body.valorTotal,
    consentimiento: body.consentimientoDatos,
  };
  const { data } = await client().post<RespuestaSorteo>('/participaciones', payload);
  return data;
}

export async function getConfigSorteo(): Promise<ConfigSorteo> {
  const { data } = await client().get<ConfigSorteo>('/config/sorteo');
  return data;
}

export async function getCompraMinima(): Promise<number> {
  const { data } = await client().get<{ compraMinima: number }>('/ventas/config/compra-minima');
  return data.compraMinima;
}

// Admin (rol administrador)

export async function getMetricas(): Promise<AdminMetricas> {
  const { data } = await client().get<AdminMetricas>('/admin/metricas');
  return data;
}

export interface ParticipacionesQuery {
  desde?: string;
  hasta?: string;
  cliente?: string;
  factura?: string;
  estado?: 'disponible' | 'redimido' | 'vencido';
}

export async function getParticipacionesList(params: ParticipacionesQuery = {}): Promise<ParticipacionItem[]> {
  const q = new URLSearchParams();
  if (params.desde) q.set('desde', params.desde);
  if (params.hasta) q.set('hasta', params.hasta);
  if (params.cliente) q.set('cliente', params.cliente);
  if (params.factura) q.set('factura', params.factura);
  if (params.estado) q.set('estado', params.estado);
  const { data } = await client().get<ParticipacionItem[]>(`/participaciones?${q.toString()}`);
  return data;
}

export interface SorteosQuery {
  desde?: string;
  hasta?: string;
}

export async function getSorteos(params: SorteosQuery = {}): Promise<SorteoItem[]> {
  const q = new URLSearchParams();
  if (params.desde) q.set('desde', params.desde);
  if (params.hasta) q.set('hasta', params.hasta);
  const { data } = await client().get<SorteoItem[]>(`/sorteos?${q.toString()}`);
  return data;
}

export interface BonosQuery {
  estado?: string;
  desde?: string;
  hasta?: string;
  cliente?: string;
  factura?: string;
}

export async function getBonos(params: BonosQuery = {}): Promise<BonoItem[]> {
  const q = new URLSearchParams();
  if (params.estado) q.set('estado', params.estado);
  if (params.desde) q.set('desde', params.desde);
  if (params.hasta) q.set('hasta', params.hasta);
  if (params.cliente) q.set('cliente', params.cliente);
  if (params.factura) q.set('factura', params.factura);
  const { data } = await client().get<BonoItem[]>(`/bonos?${q.toString()}`);
  return data;
}

export async function redimirBono(id: string): Promise<{ ok: boolean; mensaje: string }> {
  const { data } = await client().patch<{ ok: boolean; mensaje: string }>(`/bonos/${encodeURIComponent(id)}/redimir`);
  return data;
}

export async function getConfigProbabilidad(): Promise<{ probabilidad: number; porcentaje: number }> {
  const { data } = await client().get('/admin/config/probabilidad');
  return data;
}

export async function putConfigProbabilidad(porcentaje: number): Promise<{ probabilidad: number; porcentaje: number }> {
  const { data } = await client().put('/admin/config/probabilidad', { porcentaje });
  return data;
}

export async function getConfigCompraMinima(): Promise<{ compraMinima: number }> {
  const { data } = await client().get('/admin/config/compra-minima');
  return data;
}

export async function putConfigCompraMinima(compraMinima: number): Promise<{ compraMinima: number }> {
  const { data } = await client().put('/admin/config/compra-minima', { compraMinima });
  return data;
}

export async function getConfigPresentacionesParticipar(): Promise<{ presentaciones: string[] }> {
  const { data } = await client().get('/admin/config/presentaciones-participar');
  return data;
}

export async function putConfigPresentacionesParticipar(presentaciones: string[]): Promise<{ presentaciones: string[] }> {
  const { data } = await client().put('/admin/config/presentaciones-participar', { presentaciones });
  return data;
}

export async function getFacturas(): Promise<Factura[]> {
  const { data } = await client().get<Factura[]>('/admin/facturas');
  return data;
}

export async function actualizarConfigSorteo(config: Partial<ConfigSorteo>): Promise<ConfigSorteo> {
  const { data } = await client().put<ConfigSorteo>('/admin/config/sorteo', config);
  return data;
}
