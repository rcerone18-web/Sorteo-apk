import * as Network from 'expo-network';
import axios from 'axios';
import {
  ventasPendientes,
  participacionesPendientes,
  marcarVentaSincronizada,
  marcarParticipacionSincronizada,
  numeroRealDesdeLocal,
} from '../db';
import * as api from '../api/client';
import type { Factura, ItemFactura } from '../types';

function mensajeErrorParticipacion(e: unknown, numeroFacturaMostrar: string): string {
  if (axios.isAxiosError(e) && e.response) {
    const status = e.response.status;
    const data = e.response.data as { error?: string; presentacionesRequeridas?: string[] } | undefined;
    if (status === 404) {
      return `Participación factura ${numeroFacturaMostrar}: la factura no puede participar en el servidor (no cumple presentaciones requeridas, redimió bono o ya participó).`;
    }
    if (status === 403 && Array.isArray(data?.presentacionesRequeridas) && data.presentacionesRequeridas.length > 0) {
      return `Participación factura ${numeroFacturaMostrar}: no cumple presentaciones. Debe incluir al menos una de: ${data.presentacionesRequeridas.join(', ')}.`;
    }
    if (data?.error) return `Participación factura ${numeroFacturaMostrar}: ${data.error}`;
  }
  return `Participación factura ${numeroFacturaMostrar}: ${e instanceof Error ? e.message : String(e)}`;
}

export async function isOnline(): Promise<boolean> {
  const st = await Network.getNetworkStateAsync();
  return st.isConnected === true && st.isInternetReachable === true;
}

export interface SyncResult {
  ventasEnviadas: number;
  participacionesEnviadas: number;
  errores: string[];
}

export async function sincronizar(): Promise<SyncResult> {
  const resultado: SyncResult = { ventasEnviadas: 0, participacionesEnviadas: 0, errores: [] };
  const ventas = await ventasPendientes();

  for (const v of ventas) {
    try {
      const presentaciones = (v.items || []).map((i: ItemFactura) => ({ presentacion: i.tipoPresentacion, cantidad: i.cantidad }));
      const body = {
        fechaFactura: v.fechaFactura,
        cedulaCliente: v.cedulaCliente,
        nombreCliente: v.nombreCliente,
        valorTotal: v.valorTotal,
        totalHuevos: v.totalHuevos,
        presentaciones,
        codigoBono: v.codigoBonoRedimido,
      };
      const res = await api.crearVenta(body);
      await marcarVentaSincronizada(v.numeroFactura, res.numero);
      resultado.ventasEnviadas++;
    } catch (e) {
      resultado.errores.push(`Venta ${v.numeroFactura}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const participaciones = await participacionesPendientes();
  for (const p of participaciones) {
    const numeroParaMostrar = p.numeroFactura;
    try {
      let numeroFactura = p.numeroFactura;
      if (numeroFactura.startsWith('F-LOCAL-')) {
        const real = await numeroRealDesdeLocal(numeroFactura);
        if (!real) {
          resultado.errores.push(
            `Participación factura ${numeroParaMostrar}: sincroniza primero la venta correspondiente y vuelve a sincronizar.`
          );
          continue;
        }
        numeroFactura = real;
      }
      await api.crearParticipacion({
        numeroFactura,
        fechaFactura: p.fechaFactura,
        cedulaCliente: p.cedulaCliente,
        nombreCliente: p.nombreCliente,
        valorTotal: p.valorTotal,
        consentimientoDatos: p.consentimientoDatos,
      });
      if (p.id != null) await marcarParticipacionSincronizada(p.id);
      resultado.participacionesEnviadas++;
    } catch (e) {
      resultado.errores.push(mensajeErrorParticipacion(e, numeroParaMostrar));
    }
  }

  return resultado;
}

export async function totalPendientes(): Promise<{ ventas: number; participaciones: number }> {
  const [v, p] = await Promise.all([ventasPendientes(), participacionesPendientes()]);
  return { ventas: v.length, participaciones: p.length };
}
