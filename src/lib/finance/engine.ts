import type { FinanceInputs, FinanceResult, ScheduleRow } from '../../types/finance'

const EPS = 1e-12
const MAX_ITERATIONS = 250
const RATE_TOLERANCE = 1e-11

export class FinanceError extends Error {}

export function periodicRate(annualRate: number, paymentsPerYear: number, compoundsPerYear: number) {
  if (!Number.isFinite(annualRate) || paymentsPerYear <= 0 || compoundsPerYear <= 0) throw new FinanceError('Payment and compounding frequencies must be positive.')
  const base = 1 + annualRate / 100 / compoundsPerYear
  if (base <= 0) throw new FinanceError('The interest rate is outside the supported range for this compounding frequency.')
  return Math.pow(base, compoundsPerYear / paymentsPerYear) - 1
}

function annuityFactor(rate: number, periods: number) {
  return Math.abs(rate) < EPS ? periods : Math.expm1(periods * Math.log1p(rate)) / rate
}

function futureValue(pv: number, pmt: number, rate: number, periods: number, due: boolean) {
  const growth = Math.exp(periods * Math.log1p(rate))
  return -(pv * growth + pmt * annuityFactor(rate, periods) * (due ? 1 + rate : 1))
}

function solveRate(inputs: FinanceInputs) {
  const objective = (annual: number) => {
    const r = periodicRate(annual, inputs.paymentsPerYear, inputs.compoundsPerYear)
    return futureValue(inputs.pv, inputs.pmt, r, inputs.periods, inputs.timing === 'beginning') - inputs.fv
  }
  // Scan a wide safe domain first, then bisect a sign-changing bracket. This cannot loop indefinitely.
  const minimum = -99.999 * inputs.compoundsPerYear
  const maximum = 1_000_000
  let left = minimum
  let leftValue = objective(left)
  let bracket: [number, number] | undefined
  for (let i = 1; i <= 500; i++) {
    const t = i / 500
    const right = minimum + (maximum - minimum) * t * t
    const rightValue = objective(right)
    if (Number.isFinite(leftValue) && Number.isFinite(rightValue) && Math.sign(leftValue) !== Math.sign(rightValue)) {
      bracket = [left, right]
      break
    }
    left = right
    leftValue = rightValue
  }
  if (!bracket) throw new FinanceError('No interest-rate solution was found for these cash flows. Check the signs and values.')
  let [lo, hi] = bracket
  let flo = objective(lo)
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const mid = (lo + hi) / 2
    const fm = objective(mid)
    if (Math.abs(fm) < RATE_TOLERANCE || Math.abs(hi - lo) < RATE_TOLERANCE) return mid
    if (Math.sign(flo) === Math.sign(fm)) { lo = mid; flo = fm } else hi = mid
  }
  throw new FinanceError('The interest-rate solver did not converge. Try values closer to the expected result.')
}

function solvePeriods(inputs: FinanceInputs, rate: number) {
  if (Math.abs(rate) < EPS) {
    if (Math.abs(inputs.pmt) < EPS) throw new FinanceError('Periods cannot be determined when both interest and payment are zero.')
    const n = -(inputs.fv + inputs.pv) / inputs.pmt
    if (!(n >= 0) || !Number.isFinite(n)) throw new FinanceError('These cash flows do not produce a positive duration.')
    return n
  }
  const adjustedPayment = inputs.pmt * (inputs.timing === 'beginning' ? 1 + rate : 1)
  const a = adjustedPayment / rate
  const ratio = (a - inputs.fv) / (inputs.pv + a)
  if (ratio <= 0 || !Number.isFinite(ratio)) throw new FinanceError('These values do not produce a valid logarithmic solution for periods.')
  const n = Math.log(ratio) / Math.log1p(rate)
  if (!(n >= 0) || !Number.isFinite(n)) throw new FinanceError('These cash flows do not produce a positive duration.')
  return n
}

function validate(inputs: FinanceInputs) {
  const numeric = [inputs.pv, inputs.fv, inputs.pmt, inputs.annualRate, inputs.periods, inputs.paymentsPerYear, inputs.compoundsPerYear]
  if (numeric.some((n) => !Number.isFinite(n))) throw new FinanceError('All financial inputs must be finite numbers.')
  if (inputs.paymentsPerYear <= 0 || inputs.compoundsPerYear <= 0) throw new FinanceError('Frequencies must be greater than zero.')
  if (inputs.solveFor !== 'periods' && (inputs.periods < 0 || inputs.periods > 100_000)) throw new FinanceError('Periods must be between 0 and 100,000.')
}

export function generateSchedule(inputs: FinanceInputs, rate: number): ScheduleRow[] {
  const count = Math.min(100_000, Math.max(0, Math.ceil(inputs.periods)))
  let balance = -inputs.pv
  let cumulativePayments = 0
  let cumulativeInterest = 0
  const rows: ScheduleRow[] = []
  for (let period = 1; period <= count; period++) {
    const startingBalance = balance
    const payment = -inputs.pmt
    if (inputs.timing === 'beginning') balance += payment
    const interest = balance * rate
    balance += interest
    if (inputs.timing === 'end') balance += payment
    cumulativePayments += payment
    cumulativeInterest += interest
    rows.push({ period, startingBalance, payment, interest, principal: payment, endingBalance: balance, cumulativePayments, cumulativeInterest })
  }
  return rows
}

export function calculateFinance(original: FinanceInputs): FinanceResult {
  validate(original)
  const inputs = { ...original }
  let rate = inputs.solveFor === 'rate' ? 0 : periodicRate(inputs.annualRate, inputs.paymentsPerYear, inputs.compoundsPerYear)
  const due = inputs.timing === 'beginning'
  let value: number
  let formula = ''
  if (inputs.solveFor === 'fv') {
    value = futureValue(inputs.pv, inputs.pmt, rate, inputs.periods, due)
    inputs.fv = value
    formula = 'FV = −[PV(1+r)ⁿ + PMT × ((1+r)ⁿ−1)/r × timing factor]'
  } else if (inputs.solveFor === 'pv') {
    const growth = Math.pow(1 + rate, inputs.periods)
    value = -(inputs.fv + inputs.pmt * annuityFactor(rate, inputs.periods) * (due ? 1 + rate : 1)) / growth
    inputs.pv = value
    formula = 'PV = −[FV + PMT × annuity factor × timing factor] / (1+r)ⁿ'
  } else if (inputs.solveFor === 'pmt') {
    const denominator = annuityFactor(rate, inputs.periods) * (due ? 1 + rate : 1)
    if (Math.abs(denominator) < EPS) throw new FinanceError('A payment cannot be calculated with zero periods.')
    value = -(inputs.fv + inputs.pv * Math.pow(1 + rate, inputs.periods)) / denominator
    inputs.pmt = value
    formula = 'PMT = −[FV + PV(1+r)ⁿ] / [annuity factor × timing factor]'
  } else if (inputs.solveFor === 'rate') {
    value = solveRate(inputs)
    inputs.annualRate = value
    rate = periodicRate(value, inputs.paymentsPerYear, inputs.compoundsPerYear)
    formula = 'I/Y is found by bracketed bisection of the TVM cash-flow equation.'
  } else {
    value = solvePeriods(inputs, rate)
    inputs.periods = value
    formula = Math.abs(rate) < EPS ? 'N = −(FV + PV) / PMT' : 'N = ln[(PMT/r − FV)/(PV + PMT/r)] / ln(1+r), adjusted for timing'
  }
  if (!Number.isFinite(value)) throw new FinanceError('The calculation produced a non-finite result.')
  const schedule = generateSchedule(inputs, rate)
  const totalPayments = inputs.pmt * inputs.periods
  const totalInterest = -(inputs.pv + inputs.fv + totalPayments)
  return {
    value, inputs, periodicRate: rate,
    effectiveAnnualRate: Math.pow(1 + inputs.annualRate / 100 / inputs.compoundsPerYear, inputs.compoundsPerYear) - 1,
    totalPayments, totalInterest,
    durationYears: inputs.periods / inputs.paymentsPerYear,
    schedule, formula,
    substituted: `PV ${inputs.pv}; FV ${inputs.fv}; PMT ${inputs.pmt}; r ${(rate * 100).toPrecision(7)}%; N ${inputs.periods}`,
  }
}

