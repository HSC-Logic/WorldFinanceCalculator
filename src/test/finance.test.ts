import { describe, expect, it } from 'vitest'
import { calculateFinance, FinanceError, periodicRate } from '../lib/finance/engine'
import type { FinanceInputs, SolveFor } from '../types/finance'

const base: FinanceInputs = { solveFor: 'fv', pv: -1000, fv: 0, pmt: 0, annualRate: 12, periods: 12, paymentsPerYear: 12, compoundsPerYear: 12, timing: 'end', currency: 'USD', precision: 2 }
const calc = (solveFor: SolveFor, values: Partial<FinanceInputs> = {}) => calculateFinance({ ...base, ...values, solveFor })

describe('time value of money engine', () => {
  it('calculates future value without payments', () => expect(calc('fv').value).toBeCloseTo(1126.82503, 5))
  it('calculates future value with monthly contributions', () => expect(calc('fv', { pv: -5000, pmt: -200, annualRate: 6, periods: 120 }).value).toBeCloseTo(41872.85303, 5))
  it('calculates present value', () => expect(calc('pv', { pv: 0, fv: 2000, pmt: 0, annualRate: 12, periods: 12 }).value).toBeCloseTo(-1774.89845, 5))
  it('calculates a loan payment', () => expect(calc('pmt', { pv: 200000, fv: 0, annualRate: 6, periods: 360 }).value).toBeCloseTo(-1199.10105, 4))
  it('calculates an investment contribution', () => expect(calc('pmt', { pv: 0, fv: 100000, annualRate: 8, periods: 120 }).value).toBeCloseTo(-546.609, 2))
  it('handles zero-interest payments', () => expect(calc('pmt', { pv: 12000, fv: 0, annualRate: 0, periods: 12 }).value).toBe(-1000))
  it('distinguishes beginning and end payments', () => {
    const end = calc('fv', { pv: 0, pmt: -100, periods: 12 }).value
    const due = calc('fv', { pv: 0, pmt: -100, periods: 12, timing: 'beginning' }).value
    expect(due).toBeCloseTo(end * 1.01, 8)
  })
  it('solves annual interest rate', () => expect(calc('rate', { pv: -1000, fv: 1126.82503, periods: 12 }).value).toBeCloseTo(12, 5))
  it('solves number of periods', () => expect(calc('periods', { pv: -1000, fv: 1126.82503 }).value).toBeCloseTo(12, 5))
  it('supports different payment and compounding frequencies', () => expect(periodicRate(12, 12, 4)).toBeCloseTo(Math.pow(1.03, 1 / 3) - 1, 12))
  it('uses cash-flow signs consistently', () => { expect(calc('fv', { pv: -1000 }).value).toBeGreaterThan(0); expect(calc('fv', { pv: 1000 }).value).toBeLessThan(0) })
  it('rejects invalid frequencies and periods', () => { expect(() => calc('fv', { paymentsPerYear: 0 })).toThrow(FinanceError); expect(() => calc('fv', { periods: -1 })).toThrow(FinanceError) })
  it('reports impossible rate solutions', () => expect(() => calc('rate', { pv: 0, fv: 100, pmt: 0 })).toThrow(/No interest-rate solution/))
  it('remains finite for small and large values', () => { expect(Number.isFinite(calc('fv', { pv: -1e-8, annualRate: .0001, periods: 1 }).value)).toBe(true); expect(Number.isFinite(calc('fv', { pv: -1e12, annualRate: 3, periods: 1200 }).value)).toBe(true) })
})
