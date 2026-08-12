/**
 * Tests del motor de probabilidad (node --test).
 * Ejecutar: npm run test (desde server/)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFinalProbability,
  computeDynamicProb,
  computeAbsoluteProb,
  evaluateDraw,
  normalizeProbBase,
} from './probabilityEngine.js';

describe('computeDynamicProb', () => {
  it('escenario 2: headroom insuficiente → prob 0', () => {
    const p = computeDynamicProb(0.9, 0.05, 100_000, 0, 50_000);
    assert.equal(p, 0);
  });

  it('escenario 3: holgura amplia → prob = probBase', () => {
    const p = computeDynamicProb(0.9, 0.3, 100_000, 0, 5_000);
    assert.ok(Math.abs(p - 0.9) < 1e-9);
  });

  it('tope ratio alcanzado → prob 0', () => {
    const p = computeDynamicProb(0.5, 0.05, 100_000, 5_000, 1_000);
    assert.equal(p, 0);
  });
});

describe('computeAbsoluteProb', () => {
  it('presupuesto restante menor que bono → 0', () => {
    const p = computeAbsoluteProb(
      0.9,
      { presupuestoTotal: 1_000_000, bonosEmitidos: 990_000, bonosReserva: 0 },
      20_000
    );
    assert.equal(p, 0);
  });

  it('presupuesto amplio → cap por probBase', () => {
    const p = computeAbsoluteProb(
      0.15,
      { presupuestoTotal: 5_000_000, bonosEmitidos: 1_000_000, bonosReserva: 0 },
      20_000
    );
    assert.ok(Math.abs(p - 0.15) < 1e-9);
  });
});

describe('calculateFinalProbability', () => {
  it('modo mixto: toma el mínimo de vendedor, campaña y absoluto', () => {
    const r = calculateFinalProbability({
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
    assert.equal(r.probFinal, 0);
    assert.equal(r.motivoBloqueo, 'tope_vendedor');
  });
});

describe('normalizeProbBase', () => {
  it('cap 95% → 10%', () => {
    assert.equal(normalizeProbBase(0.99), 0.1);
  });
});

describe('evaluateDraw', () => {
  it('u < p → gana', () => {
    assert.equal(evaluateDraw(0.5, 0.3).gana, true);
    assert.equal(evaluateDraw(0.5, 0.7).gana, false);
  });
});
