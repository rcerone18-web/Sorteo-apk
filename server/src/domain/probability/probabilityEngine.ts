/**
 * Motor de probabilidad dinámica (brief promocional).
 * Fórmula núcleo: p = min(probBase, headroom / bonoValor) con headroom = pctTope * V - B
 */

export const PROB_EPS = 1e-6;

export type PresupuestoModo = 'ratio' | 'absoluto' | 'mixto';

export interface RatioState {
  ventasElegibles: number;
  bonosEmitidos: number;
  pctTope: number;
}

export interface AbsoluteBudgetState {
  presupuestoTotal: number;
  bonosEmitidos: number;
  bonosReserva: number;
}

export interface ProbabilityEngineInput {
  probBase: number;
  pctTope: number;
  bonoValor: number;
  /** Control por vendedor */
  vendor: RatioState;
  /** Control agregado campaña (ratio) */
  campaign?: RatioState;
  /** Presupuesto en $ (opcional) */
  absolute?: AbsoluteBudgetState;
  presupuestoModo?: PresupuestoModo;
}

export interface ProbabilityEngineResult {
  probFinal: number;
  probVendor: number;
  probCampaign: number;
  probAbsolute: number;
  headroomVendor: number;
  headroomCampaign: number;
  headroomAbsolute: number;
  motivoBloqueo: string | null;
}

/** Cap por ratio B/V vs ventas elegibles V. */
export function computeDynamicProb(
  probBase: number,
  pctTope: number,
  V: number,
  B: number,
  bonoValor: number
): number {
  let p = clampProb(probBase);
  if (bonoValor <= PROB_EPS) return 0;
  const v = Math.max(V, PROB_EPS);
  const ratio = B / v;
  if (ratio >= pctTope - 1e-12) return 0;
  const headroom = pctTope * v - B;
  if (headroom < bonoValor - 1e-6) return 0;
  const cap = headroom / bonoValor;
  p = Math.min(p, cap);
  return clampProb(p);
}

/** Presupuesto absoluto: headroom = total - emitidos - reserva; mismo patrón cap/bono. */
export function computeAbsoluteProb(
  probBase: number,
  budget: AbsoluteBudgetState,
  bonoValor: number
): number {
  if (bonoValor <= PROB_EPS) return 0;
  const headroom =
    Number(budget.presupuestoTotal) -
    Number(budget.bonosEmitidos) -
    Number(budget.bonosReserva);
  if (headroom < bonoValor - 1e-6) return 0;
  const cap = headroom / bonoValor;
  return clampProb(Math.min(clampProb(probBase), cap));
}

export function headroomRatio(state: RatioState): number {
  const v = Math.max(state.ventasElegibles, 0);
  return state.pctTope * v - state.bonosEmitidos;
}

export function headroomAbsolute(budget: AbsoluteBudgetState): number {
  return (
    Number(budget.presupuestoTotal) -
    Number(budget.bonosEmitidos) -
    Number(budget.bonosReserva)
  );
}

/**
 * Probabilidad final = mínimo de caps (vendedor, campaña, absoluto) según modo.
 */
export function calculateFinalProbability(input: ProbabilityEngineInput): ProbabilityEngineResult {
  const { probBase, pctTope, bonoValor, vendor, campaign, absolute, presupuestoModo = 'ratio' } =
    input;

  const probVendor = computeDynamicProb(
    probBase,
    pctTope,
    vendor.ventasElegibles,
    vendor.bonosEmitidos,
    bonoValor
  );

  let probCampaign = probBase;
  let headroomCampaign = 0;
  if (campaign) {
    probCampaign = computeDynamicProb(
      probBase,
      pctTope,
      campaign.ventasElegibles,
      campaign.bonosEmitidos,
      bonoValor
    );
    headroomCampaign = headroomRatio(campaign);
  }

  let probAbsolute = probBase;
  let headroomAbs = 0;
  const useAbs =
    absolute &&
    absolute.presupuestoTotal > 0 &&
    (presupuestoModo === 'absoluto' || presupuestoModo === 'mixto');
  if (useAbs && absolute) {
    probAbsolute = computeAbsoluteProb(probBase, absolute, bonoValor);
    headroomAbs = headroomAbsolute(absolute);
  }

  let probFinal = probVendor;
  let motivo: string | null = null;

  if (presupuestoModo === 'ratio' || !useAbs) {
    probFinal = campaign ? Math.min(probVendor, probCampaign) : probVendor;
  } else if (presupuestoModo === 'absoluto') {
    probFinal = probAbsolute;
  } else {
    probFinal = Math.min(probVendor, campaign ? probCampaign : probVendor, probAbsolute);
  }

  probFinal = clampProb(probFinal);

  if (probFinal <= PROB_EPS) {
    if (probVendor <= PROB_EPS) motivo = 'tope_vendedor';
    else if (campaign && probCampaign <= PROB_EPS) motivo = 'tope_campana';
    else if (useAbs && probAbsolute <= PROB_EPS) motivo = 'presupuesto_agotado';
    else motivo = 'probabilidad_cero';
  }

  return {
    probFinal,
    probVendor,
    probCampaign,
    probAbsolute,
    headroomVendor: headroomRatio(vendor),
    headroomCampaign,
    headroomAbsolute: headroomAbs,
    motivoBloqueo: motivo,
  };
}

export function normalizeProbBase(raw: number): number {
  let p = raw > 1 ? raw / 100 : raw;
  p = clampProb(p);
  if (p >= 0.95) p = 0.1;
  return p;
}

export function clampProb(p: number): number {
  if (!Number.isFinite(p)) return 0;
  return Math.max(0, Math.min(1, p));
}

/** Sorteo: u ∈ [0,1) vs probFinal */
export function evaluateDraw(probFinal: number, randomU?: number): { gana: boolean; randomU: number } {
  const u = randomU ?? Math.random();
  return { gana: u < probFinal, randomU: u };
}
