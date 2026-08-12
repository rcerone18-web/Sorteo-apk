"use strict";
/**
 * Motor de probabilidad dinámica (brief promocional).
 * Fórmula núcleo: p = min(probBase, headroom / bonoValor) con headroom = pctTope * V - B
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROB_EPS = void 0;
exports.computeDynamicProb = computeDynamicProb;
exports.computeAbsoluteProb = computeAbsoluteProb;
exports.headroomRatio = headroomRatio;
exports.headroomAbsolute = headroomAbsolute;
exports.calculateFinalProbability = calculateFinalProbability;
exports.normalizeProbBase = normalizeProbBase;
exports.clampProb = clampProb;
exports.evaluateDraw = evaluateDraw;
exports.PROB_EPS = 1e-6;
/** Cap por ratio B/V vs ventas elegibles V. */
function computeDynamicProb(probBase, pctTope, V, B, bonoValor) {
    let p = clampProb(probBase);
    if (bonoValor <= exports.PROB_EPS)
        return 0;
    const v = Math.max(V, exports.PROB_EPS);
    const ratio = B / v;
    if (ratio >= pctTope - 1e-12)
        return 0;
    const headroom = pctTope * v - B;
    if (headroom < bonoValor - 1e-6)
        return 0;
    const cap = headroom / bonoValor;
    p = Math.min(p, cap);
    return clampProb(p);
}
/** Presupuesto absoluto: headroom = total - emitidos - reserva; mismo patrón cap/bono. */
function computeAbsoluteProb(probBase, budget, bonoValor) {
    if (bonoValor <= exports.PROB_EPS)
        return 0;
    const headroom = Number(budget.presupuestoTotal) -
        Number(budget.bonosEmitidos) -
        Number(budget.bonosReserva);
    if (headroom < bonoValor - 1e-6)
        return 0;
    const cap = headroom / bonoValor;
    return clampProb(Math.min(clampProb(probBase), cap));
}
function headroomRatio(state) {
    const v = Math.max(state.ventasElegibles, 0);
    return state.pctTope * v - state.bonosEmitidos;
}
function headroomAbsolute(budget) {
    return (Number(budget.presupuestoTotal) -
        Number(budget.bonosEmitidos) -
        Number(budget.bonosReserva));
}
/**
 * Probabilidad final = mínimo de caps (vendedor, campaña, absoluto) según modo.
 */
function calculateFinalProbability(input) {
    const { probBase, pctTope, bonoValor, vendor, campaign, absolute, presupuestoModo = 'ratio' } = input;
    const probVendor = computeDynamicProb(probBase, pctTope, vendor.ventasElegibles, vendor.bonosEmitidos, bonoValor);
    let probCampaign = probBase;
    let headroomCampaign = 0;
    if (campaign) {
        probCampaign = computeDynamicProb(probBase, pctTope, campaign.ventasElegibles, campaign.bonosEmitidos, bonoValor);
        headroomCampaign = headroomRatio(campaign);
    }
    let probAbsolute = probBase;
    let headroomAbs = 0;
    const useAbs = absolute &&
        absolute.presupuestoTotal > 0 &&
        (presupuestoModo === 'absoluto' || presupuestoModo === 'mixto');
    if (useAbs && absolute) {
        probAbsolute = computeAbsoluteProb(probBase, absolute, bonoValor);
        headroomAbs = headroomAbsolute(absolute);
    }
    let probFinal = probVendor;
    let motivo = null;
    if (presupuestoModo === 'ratio' || !useAbs) {
        probFinal = campaign ? Math.min(probVendor, probCampaign) : probVendor;
    }
    else if (presupuestoModo === 'absoluto') {
        probFinal = probAbsolute;
    }
    else {
        probFinal = Math.min(probVendor, campaign ? probCampaign : probVendor, probAbsolute);
    }
    probFinal = clampProb(probFinal);
    if (probFinal <= exports.PROB_EPS) {
        if (probVendor <= exports.PROB_EPS)
            motivo = 'tope_vendedor';
        else if (campaign && probCampaign <= exports.PROB_EPS)
            motivo = 'tope_campana';
        else if (useAbs && probAbsolute <= exports.PROB_EPS)
            motivo = 'presupuesto_agotado';
        else
            motivo = 'probabilidad_cero';
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
function normalizeProbBase(raw) {
    let p = raw > 1 ? raw / 100 : raw;
    p = clampProb(p);
    if (p >= 0.95)
        p = 0.1;
    return p;
}
function clampProb(p) {
    if (!Number.isFinite(p))
        return 0;
    return Math.max(0, Math.min(1, p));
}
/** Sorteo: u ∈ [0,1) vs probFinal */
function evaluateDraw(probFinal, randomU) {
    const u = randomU ?? Math.random();
    return { gana: u < probFinal, randomU: u };
}
