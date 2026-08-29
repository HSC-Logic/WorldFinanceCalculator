import type { FinanceResult } from '../../types/finance'

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = name; anchor.click()
  URL.revokeObjectURL(url)
}

export function exportCsv(result: FinanceResult) {
  const header = 'Period,Starting balance,Payment,Interest,Principal,Ending balance,Cumulative payments,Cumulative interest'
  const rows = result.schedule.map((r) => [r.period, r.startingBalance, r.payment, r.interest, r.principal, r.endingBalance, r.cumulativePayments, r.cumulativeInterest].join(','))
  download('smart-finance-schedule.csv', [header, ...rows].join('\n'), 'text/csv')
}

export function exportJson(result: FinanceResult) {
  download('smart-finance-summary.json', JSON.stringify(result, null, 2), 'application/json')
}

