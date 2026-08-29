export type SolveFor = 'fv' | 'pv' | 'pmt' | 'rate' | 'periods'
export type Timing = 'end' | 'beginning'

export interface FinanceInputs {
  solveFor: SolveFor
  pv: number
  fv: number
  pmt: number
  annualRate: number
  periods: number
  paymentsPerYear: number
  compoundsPerYear: number
  timing: Timing
  currency: string
  precision: number
}

export interface ScheduleRow {
  period: number
  startingBalance: number
  payment: number
  interest: number
  principal: number
  endingBalance: number
  cumulativePayments: number
  cumulativeInterest: number
}

export interface FinanceResult {
  value: number
  inputs: FinanceInputs
  periodicRate: number
  effectiveAnnualRate: number
  totalPayments: number
  totalInterest: number
  durationYears: number
  schedule: ScheduleRow[]
  formula: string
  substituted: string
}

