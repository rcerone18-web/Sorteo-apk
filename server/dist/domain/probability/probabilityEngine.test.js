"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Tests del motor de probabilidad (node --test).
 * Ejecutar: npm run test (desde server/)
 */
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const probabilityEngine_js_1 = require("./probabilityEngine.js");
(0, node_test_1.describe)('computeDynamicProb', () => {
    (0, node_test_1.it)('escenario 2: headroom insuficiente → prob 0', () => {
        const p = (0, probabilityEngine_js_1.computeDynamicProb)(0.9, 0.05, 100_000, 0, 50_000);
        strict_1.default.equal(p, 0);
    });
    (0, node_test_1.it)('escenario 3: holgura amplia → prob = probBase', () => {
        const p = (0, probabilityEngine_js_1.computeDynamicProb)(0.9, 0.3, 100_000, 0, 5_000);
        strict_1.default.ok(Math.abs(p - 0.9) < 1e-9);
    });
    (0, node_test_1.it)('tope ratio alcanzado → prob 0', () => {
        const p = (0, probabilityEngine_js_1.computeDynamicProb)(0.5, 0.05, 100_000, 5_000, 1_000);
        strict_1.default.equal(p, 0);
    });
});
(0, node_test_1.describe)('computeAbsoluteProb', () => {
    (0, node_test_1.it)('presupuesto restante menor que bono → 0', () => {
        const p = (0, probabilityEngine_js_1.computeAbsoluteProb)(0.9, { presupuestoTotal: 1_000_000, bonosEmitidos: 990_000, bonosReserva: 0 }, 20_000);
        strict_1.default.equal(p, 0);
    });
    (0, node_test_1.it)('presupuesto amplio → cap por probBase', () => {
        const p = (0, probabilityEngine_js_1.computeAbsoluteProb)(0.15, { presupuestoTotal: 5_000_000, bonosEmitidos: 1_000_000, bonosReserva: 0 }, 20_000);
        strict_1.default.ok(Math.abs(p - 0.15) < 1e-9);
    });
});
(0, node_test_1.describe)('calculateFinalProbability', () => {
    (0, node_test_1.it)('modo mixto: toma el mínimo de vendedor, campaña y absoluto', () => {
        const r = (0, probabilityEngine_js_1.calculateFinalProbability)({
            probBase: 0.9,
            pctTope: 0.05,
            bonoValor: 50_000,
            vendor: { ventasElegibles: 100_000, bonosEmitidos: 0, pctTope: 0.05 },
            campaign: { ventasElegibles: 100_000, bonosEmitidos: 0, pctTope: 0.05 },
            presupuestoModo: 'mixto',
            absolute: {
                presupuestoTotal: 5_000_000,
                bonosEmitidos: 4_000_000,
                bonosReserva: 0,
            },
        });
        strict_1.default.equal(r.probFinal, 0);
        strict_1.default.equal(r.motivoBloqueo, 'tope_vendedor');
    });
});
(0, node_test_1.describe)('normalizeProbBase', () => {
    (0, node_test_1.it)('cap 95% → 10%', () => {
        strict_1.default.equal((0, probabilityEngine_js_1.normalizeProbBase)(0.99), 0.1);
    });
});
(0, node_test_1.describe)('evaluateDraw', () => {
    (0, node_test_1.it)('u < p → gana', () => {
        strict_1.default.equal((0, probabilityEngine_js_1.evaluateDraw)(0.5, 0.3).gana, true);
        strict_1.default.equal((0, probabilityEngine_js_1.evaluateDraw)(0.5, 0.7).gana, false);
    });
});
