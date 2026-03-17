import type { RespuestaSorteo } from '../types';

const PROB_DEFAULT = 0.1;
const COMPRA_MINIMA_DEFAULT = 100000;

export function ejecutarSorteoLocal(
  probabilidadGanar: number = PROB_DEFAULT,
  compraMinimaBono: number = COMPRA_MINIMA_DEFAULT
): RespuestaSorteo {
  const gano = Math.random() < probabilidadGanar;
  const codigoBono = gano ? `BONO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}` : undefined;
  return {
    gano,
    codigoBono,
    compraMinimaBono: gano ? compraMinimaBono : undefined,
    mensaje: gano
      ? `¡Felicidades! Ganaste un bono del 50% en tu próxima compra. Código: ${codigoBono}. Compra mínima para redimir: $${compraMinimaBono.toLocaleString()}`
      : 'Esta vez no ganaste. ¡Sigue participando!',
  };
}
