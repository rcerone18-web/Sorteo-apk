import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { isOnline, totalPendientes, sincronizar, type SyncResult } from '../sync/syncService';

interface SyncState {
  online: boolean;
  pendientesVentas: number;
  pendientesParticipaciones: number;
  sincronizando: boolean;
  ultimoResultado: SyncResult | null;
}

interface SyncContextType extends SyncState {
  refrescarPendientes: () => Promise<void>;
  ejecutarSincronizacion: () => Promise<SyncResult>;
}

const SyncContext = createContext<SyncContextType | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SyncState>({
    online: false,
    pendientesVentas: 0,
    pendientesParticipaciones: 0,
    sincronizando: false,
    ultimoResultado: null,
  });

  const refrescarPendientes = useCallback(async () => {
    const [online, totales] = await Promise.all([isOnline(), totalPendientes()]);
    setState((s) => ({
      ...s,
      online,
      pendientesVentas: totales.ventas,
      pendientesParticipaciones: totales.participaciones,
    }));
  }, []);

  const ejecutarSincronizacion = useCallback(async (): Promise<SyncResult> => {
    setState((s) => ({ ...s, sincronizando: true, ultimoResultado: null }));
    try {
      const res = await sincronizar();
      setState((s) => ({ ...s, ultimoResultado: res }));
      await refrescarPendientes();
      return res;
    } finally {
      setState((s) => ({ ...s, sincronizando: false }));
    }
  }, [refrescarPendientes]);

  useEffect(() => {
    const t = setInterval(refrescarPendientes, 10000);
    refrescarPendientes();
    return () => clearInterval(t);
  }, [refrescarPendientes]);

  return (
    <SyncContext.Provider
      value={{
        ...state,
        refrescarPendientes,
        ejecutarSincronizacion,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync debe usarse dentro de SyncProvider');
  return ctx;
}
