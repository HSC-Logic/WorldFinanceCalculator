import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Calculator, Check, ChevronDown, Copy, Download, Moon, Plus, Printer, Save, Share2, Sun, Trash2, WalletCards } from 'lucide-react'
import { calculateFinance, FinanceError } from './lib/finance/engine'
import { exportCsv, exportJson } from './lib/export/download'
import type { FinanceInputs, FinanceResult, SolveFor } from './types/finance'
import './index.css'

const schema = z.object({
  pv: z.coerce.number().finite(), fv: z.coerce.number().finite(), pmt: z.coerce.number().finite(), annualRate: z.coerce.number().finite(),
  periods: z.coerce.number().min(0).max(100000), paymentsPerYear: z.coerce.number().positive(), compoundsPerYear: z.coerce.number().positive(),
  timing: z.enum(['end', 'beginning']), currency: z.string(), precision: z.coerce.number().int().min(0).max(6),
})
type FormData = z.infer<typeof schema>
type Saved = { id: string; name: string; createdAt: string; inputs: FinanceInputs }

const defaults: FormData = { pv: -10000, fv: 0, pmt: 0, annualRate: 7, periods: 60, paymentsPerYear: 12, compoundsPerYear: 12, timing: 'end', currency: 'USD', precision: 2 }
const solveOptions: { value: SolveFor; label: string }[] = [{ value: 'fv', label: 'Future value' }, { value: 'pv', label: 'Present value' }, { value: 'pmt', label: 'Payment' }, { value: 'rate', label: 'Interest rate' }, { value: 'periods', label: 'Periods' }]
const frequencies = [{ n: 1, l: 'Annually' }, { n: 2, l: 'Semi-annually' }, { n: 4, l: 'Quarterly' }, { n: 12, l: 'Monthly' }, { n: 26, l: 'Biweekly' }, { n: 52, l: 'Weekly' }]
const currencies = ['LKR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'NZD', 'INR', 'JPY']

function money(value: number, currency: string, precision: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: precision, maximumFractionDigits: precision }).format(value)
}
function compact(value: number) { return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value) }

function Field({ label, hint, error, disabled, children }: { label: string; hint: string; error?: string; disabled?: boolean; children: React.ReactNode }) {
  return <label className={`field ${disabled ? 'field-disabled' : ''}`}><span>{label}<button className="info" type="button" title={hint} aria-label={`${label}: ${hint}`}>?</button></span>{children}{error && <small className="error">{error}</small>}</label>
}

function App() {
  const [solveFor, setSolveFor] = useState<SolveFor>('fv')
  const [result, setResult] = useState<FinanceResult | null>(null)
  const [error, setError] = useState('')
  const [dark, setDark] = useState(() => localStorage.getItem('sfc-theme') === 'dark')
  const [toast, setToast] = useState('')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortAsc, setSortAsc] = useState(true)
  const [saved, setSaved] = useState<Saved[]>(() => JSON.parse(localStorage.getItem('sfc-saved') || '[]'))
  const [scenarios, setScenarios] = useState<FinanceResult[]>([])
  const [view, setView] = useState<'calculator' | 'compare' | 'saved'>('calculator')
  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.input<typeof schema>, undefined, FormData>({ resolver: zodResolver(schema), defaultValues: defaults })

  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('sfc-theme', dark ? 'dark' : 'light') }, [dark])
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 2400); return () => clearTimeout(t) } }, [toast])

  const calculate = (data: FormData) => {
    try {
      const next = calculateFinance({ ...data, solveFor })
      setResult(next); setError(''); setPage(1)
      localStorage.setItem('sfc-latest', JSON.stringify(next.inputs))
      const params = new URLSearchParams(Object.entries(next.inputs).map(([k, v]) => [k, String(v)]))
      history.replaceState(null, '', `${location.pathname}?${params}`)
    } catch (e) { setResult(null); setError(e instanceof FinanceError ? e.message : 'The calculation could not be completed.') }
  }
  useEffect(() => {
    const q = new URLSearchParams(location.search)
    if (q.size) {
      const parsed = { ...defaults }
      for (const key of Object.keys(defaults) as (keyof FormData)[]) if (q.has(key)) (parsed as Record<string, string | number>)[key] = ['timing', 'currency'].includes(key) ? q.get(key)! : Number(q.get(key))
      const sf = q.get('solveFor') as SolveFor | null
      if (sf) setSolveFor(sf)
      reset(parsed)
      try { setResult(calculateFinance({ ...parsed, solveFor: sf || 'fv' })) } catch { setError('The shared calculation could not be loaded.') }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = () => {
    if (!result) return
    const name = prompt('Name this calculation', `${solveFor.toUpperCase()} · ${new Date().toLocaleDateString()}`)
    if (!name) return
    const next = [{ id: crypto.randomUUID(), name, createdAt: new Date().toISOString(), inputs: result.inputs }, ...saved]
    setSaved(next); localStorage.setItem('sfc-saved', JSON.stringify(next)); setToast('Calculation saved')
  }
  const load = (inputs: FinanceInputs) => { setSolveFor(inputs.solveFor); reset(inputs); calculate(inputs); setView('calculator') }
  const remove = (id: string) => { const next = saved.filter((s) => s.id !== id); setSaved(next); localStorage.setItem('sfc-saved', JSON.stringify(next)) }
  const share = async () => { await navigator.clipboard.writeText(location.href); setToast('Share link copied') }
  const copy = async () => { if (!result) return; await navigator.clipboard.writeText(`${result.inputs.solveFor.toUpperCase()}: ${result.value}\n${result.substituted}`); setToast('Summary copied') }

  const chartRows = useMemo(() => result?.schedule.filter((_, i) => i % Math.max(1, Math.ceil(result.schedule.length / 180)) === 0) ?? [], [result])
  const filtered = useMemo(() => {
    if (!result) return []
    const rows = search ? result.schedule.filter((r) => String(r.period).includes(search)) : result.schedule
    return [...rows].sort((a, b) => sortAsc ? a.period - b.period : b.period - a.period)
  }, [result, search, sortAsc])
  const pageRows = filtered.slice((page - 1) * 25, page * 25)

  return <div className="app-shell">
    <header><a className="brand" href="./"><span><WalletCards size={22}/></span><b>Smart Finance</b></a><nav aria-label="Main navigation"><button className={view === 'calculator' ? 'active' : ''} onClick={() => setView('calculator')}>Calculator</button><button className={view === 'compare' ? 'active' : ''} onClick={() => setView('compare')}>Compare <em>{scenarios.length || ''}</em></button><button className={view === 'saved' ? 'active' : ''} onClick={() => setView('saved')}>Saved</button></nav><button className="icon-btn" aria-label="Toggle color theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button></header>
    <main>
      {view === 'calculator' && <>
        <section className="intro"><div><p className="eyebrow">Time value of money, made clear</p><h1>Model your money with confidence.</h1><p>Calculate, inspect, and compare every cash flow—without sending your data anywhere.</p></div><div className="trust"><Check size={18}/><span><b>Private by design</b><small>Everything stays in your browser</small></span></div></section>
        <div className="workspace">
          <form className="panel form-panel" onSubmit={handleSubmit(calculate)}>
            <div className="panel-heading"><div><span className="step">01</span><h2>What do you want to find?</h2></div><p>Choose the unknown variable.</p></div>
            <div className="segments" role="tablist" aria-label="Variable to calculate">{solveOptions.map((o) => <button key={o.value} type="button" role="tab" aria-selected={solveFor === o.value} className={solveFor === o.value ? 'selected' : ''} onClick={() => setSolveFor(o.value)}><b>{o.value === 'rate' ? 'I/Y' : o.value === 'periods' ? 'N' : o.value.toUpperCase()}</b><small>{o.label}</small></button>)}</div>
            <div className="section-label"><span className="step">02</span><div><h2>Enter your values</h2><p>Use negative numbers for money paid or invested.</p></div></div>
            <div className="form-grid">
              <Field label="Present value (PV)" hint="The amount at the start. Money invested or paid is negative." error={errors.pv?.message} disabled={solveFor === 'pv'}><input step="any" disabled={solveFor === 'pv'} {...register('pv')} /></Field>
              <Field label="Future value (FV)" hint="The target or ending amount." error={errors.fv?.message} disabled={solveFor === 'fv'}><input step="any" disabled={solveFor === 'fv'} {...register('fv')} /></Field>
              <Field label="Periodic payment (PMT)" hint="An equal cash flow each payment period." error={errors.pmt?.message} disabled={solveFor === 'pmt'}><input step="any" disabled={solveFor === 'pmt'} {...register('pmt')} /></Field>
              <Field label="Annual interest (I/Y)" hint="Nominal annual percentage rate." error={errors.annualRate?.message} disabled={solveFor === 'rate'}><div className="suffix"><input step="any" disabled={solveFor === 'rate'} {...register('annualRate')} /><span>%</span></div></Field>
              <Field label="Number of periods (N)" hint="Total number of payment periods." error={errors.periods?.message} disabled={solveFor === 'periods'}><input step="any" disabled={solveFor === 'periods'} {...register('periods')} /></Field>
              <Field label="Payment timing" hint="Whether payments occur at the start or end of each period."><select {...register('timing')}><option value="end">End of period</option><option value="beginning">Beginning of period</option></select></Field>
              <Field label="Payments per year (P/Y)" hint="How many payments occur each year."><select {...register('paymentsPerYear')}>{frequencies.map((f) => <option key={f.n} value={f.n}>{f.l} ({f.n})</option>)}</select></Field>
              <Field label="Compounds per year (C/Y)" hint="How often interest is added each year."><select {...register('compoundsPerYear')}>{frequencies.map((f) => <option key={f.n} value={f.n}>{f.l} ({f.n})</option>)}</select></Field>
              <Field label="Currency" hint="Used only for display; no exchange rates are applied."><select {...register('currency')}>{currencies.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Decimal precision" hint="Digits shown after the decimal; calculations retain full precision."><select {...register('precision')}>{[0,1,2,3,4,5,6].map((n) => <option key={n}>{n}</option>)}</select></Field>
            </div>
            {error && <div className="alert" role="alert">{error}</div>}
            <div className="form-actions"><button className="primary" type="submit"><Calculator size={18}/>Calculate {solveFor === 'rate' ? 'I/Y' : solveFor === 'periods' ? 'N' : solveFor.toUpperCase()}</button><button type="button" className="secondary" onClick={() => { if (!result || confirm('Reset your current calculation?')) { reset(defaults); setResult(null); setError('') } }}>Reset</button></div>
            <details className="examples"><summary>Load an example <ChevronDown size={16}/></summary><button type="button" onClick={() => { const v = { ...defaults, pv: 250000, fv: 0, annualRate: 6.5, periods: 360 }; reset(v); setSolveFor('pmt') }}>30-year home loan</button><button type="button" onClick={() => { const v = { ...defaults, pv: -5000, pmt: -250, fv: 0, annualRate: 8, periods: 120 }; reset(v); setSolveFor('fv') }}>Monthly investing</button></details>
          </form>
          <aside className="panel result-panel" aria-live="polite">
            <div className="result-head"><span>Live result</span>{result && <span className="ready"><i/>Calculated</span>}</div>
            {!result ? <div className="empty"><div><Calculator size={30}/></div><h2>Your result will appear here</h2><p>Enter your values and calculate to unlock the full dashboard.</p><ul><li><Check/>Clear cash-flow breakdown</li><li><Check/>Interactive balance chart</li><li><Check/>Exportable payment schedule</li></ul></div> : <ResultSummary result={result} onSave={save} onShare={share} onCopy={copy} onCompare={() => { if (scenarios.length < 4) { setScenarios([...scenarios, result]); setToast('Added to comparison') } else setToast('Comparison is limited to four scenarios') }}/>} 
          </aside>
        </div>
        {result && <section className="details-wrap">
          <div className="chart-panel panel"><div className="section-title"><div><p className="eyebrow">Growth trajectory</p><h2>Balance over time</h2></div><span>{result.schedule.length} periods</span></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartRows}><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#16a385" stopOpacity=".35"/><stop offset="1" stopColor="#16a385" stopOpacity="0"/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="period"/><YAxis tickFormatter={compact}/><Tooltip formatter={(v) => money(Number(v), result.inputs.currency, result.inputs.precision)}/><Area type="monotone" dataKey="endingBalance" name="Balance" stroke="#16a385" fill="url(#fill)" strokeWidth={3}/></AreaChart></ResponsiveContainer></div></div>
          <div className="chart-panel panel"><div className="section-title"><div><p className="eyebrow">Cash-flow composition</p><h2>Payments and interest</h2></div></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartRows}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="period"/><YAxis tickFormatter={compact}/><Tooltip formatter={(v) => money(Number(v), result.inputs.currency, result.inputs.precision)}/><Legend/><Bar dataKey="payment" name="Payment" fill="#2563eb"/><Bar dataKey="interest" name="Interest" fill="#16a385"/></BarChart></ResponsiveContainer></div></div>
          <Schedule result={result} rows={pageRows} search={search} setSearch={setSearch} sortAsc={sortAsc} setSortAsc={setSortAsc} page={page} setPage={setPage} total={filtered.length}/>
        </section>}
      </>}
      {view === 'compare' && <Comparison scenarios={scenarios} setScenarios={setScenarios} load={load}/>} 
      {view === 'saved' && <SavedView saved={saved} load={load} remove={remove} clear={() => { if (confirm('Delete all saved calculations?')) { setSaved([]); localStorage.removeItem('sfc-saved') } }}/>} 
    </main>
    <footer><span>Smart Finance Calculator</span><p>Results are estimates, not financial advice. Confirm important decisions with a qualified professional.</p></footer>
    {toast && <div className="toast" role="status"><Check size={17}/>{toast}</div>}
  </div>
}

function ResultSummary({ result, onSave, onShare, onCopy, onCompare }: { result: FinanceResult; onSave: () => void; onShare: () => void; onCopy: () => void; onCompare: () => void }) {
  const { inputs } = result
  const label = inputs.solveFor === 'rate' ? 'Annual interest rate' : inputs.solveFor === 'periods' ? 'Number of periods' : solveOptions.find((o) => o.value === inputs.solveFor)?.label
  const shown = inputs.solveFor === 'rate' ? `${result.value.toFixed(inputs.precision)}%` : inputs.solveFor === 'periods' ? result.value.toFixed(inputs.precision) : money(result.value, inputs.currency, inputs.precision)
  return <div className="result-content"><p className="eyebrow">{label}</p><h2 className={result.value < 0 ? 'negative' : ''}>{shown}</h2><p className="summary">At {inputs.annualRate.toFixed(2)}% annually over {result.durationYears.toFixed(1)} years, the modeled cash flows resolve to <b>{shown}</b>.</p><div className="metrics"><div><small>Total payments</small><b>{money(result.totalPayments, inputs.currency, inputs.precision)}</b></div><div><small>Total interest</small><b>{money(result.totalInterest, inputs.currency, inputs.precision)}</b></div><div><small>Effective annual rate</small><b>{(result.effectiveAnnualRate * 100).toFixed(2)}%</b></div><div><small>Duration</small><b>{result.durationYears.toFixed(2)} years</b></div></div><div className="result-actions"><button onClick={onSave}><Save/>Save</button><button onClick={onShare}><Share2/>Share</button><button onClick={onCopy}><Copy/>Copy</button><button onClick={onCompare}><Plus/>Compare</button></div><details className="calculation"><summary>How this was calculated <ChevronDown size={16}/></summary><h3>Formula</h3><code>{result.formula}</code><h3>Values used</h3><p>{result.substituted}</p><h3>Convention & assumptions</h3><p>Money received is positive; money paid or invested is negative. Rates are converted to an equivalent rate per payment period. Full precision is retained until display.</p></details></div>
}

function Schedule({ result, rows, search, setSearch, sortAsc, setSortAsc, page, setPage, total }: { result: FinanceResult; rows: FinanceResult['schedule']; search: string; setSearch: (v: string) => void; sortAsc: boolean; setSortAsc: (v: boolean) => void; page: number; setPage: (v: number) => void; total: number }) {
  const fmt = (n: number) => money(n, result.inputs.currency, result.inputs.precision)
  return <section className="panel schedule"><div className="section-title"><div><p className="eyebrow">Audit the numbers</p><h2>Period-by-period schedule</h2></div><div className="tools"><input aria-label="Search by period" placeholder="Search period" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}/><button onClick={() => exportCsv(result)}><Download/>CSV</button><button onClick={() => exportJson(result)}><Download/>JSON</button><button onClick={() => window.print()}><Printer/>Print / PDF</button></div></div><div className="table-scroll"><table><thead><tr><th><button onClick={() => setSortAsc(!sortAsc)}>Period {sortAsc ? '↑' : '↓'}</button></th><th>Starting balance</th><th>Payment</th><th>Interest</th><th>Principal</th><th>Ending balance</th><th>Cumulative payments</th><th>Cumulative interest</th></tr></thead><tbody>{rows.map((r) => <tr key={r.period}><td data-label="Period">{r.period}</td><td data-label="Starting balance">{fmt(r.startingBalance)}</td><td data-label="Payment">{fmt(r.payment)}</td><td data-label="Interest">{fmt(r.interest)}</td><td data-label="Principal">{fmt(r.principal)}</td><td data-label="Ending balance"><b>{fmt(r.endingBalance)}</b></td><td data-label="Cumulative payments">{fmt(r.cumulativePayments)}</td><td data-label="Cumulative interest">{fmt(r.cumulativeInterest)}</td></tr>)}</tbody></table></div><div className="pagination"><span>Showing {total ? (page - 1) * 25 + 1 : 0}–{Math.min(page * 25, total)} of {total}</span><div><button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><button disabled={page * 25 >= total} onClick={() => setPage(page + 1)}>Next</button></div></div></section>
}

function Comparison({ scenarios, setScenarios, load }: { scenarios: FinanceResult[]; setScenarios: (s: FinanceResult[]) => void; load: (i: FinanceInputs) => void }) {
  return <section className="subpage"><p className="eyebrow">Decision workspace</p><h1>Compare scenarios</h1><p>Place up to four calculations side by side. Add scenarios from the calculator result.</p>{!scenarios.length ? <div className="panel empty-state"><WalletCards/><h2>No scenarios yet</h2><p>Calculate a result, then select “Compare”.</p></div> : <><div className="scenario-grid">{scenarios.map((s, i) => <article className="panel scenario" key={i}><div><span>Scenario {i + 1}</span><button aria-label="Remove scenario" onClick={() => setScenarios(scenarios.filter((_, x) => x !== i))}><Trash2/></button></div><h2>{money(s.inputs.fv, s.inputs.currency, s.inputs.precision)}</h2><dl><dt>Annual rate</dt><dd>{s.inputs.annualRate.toFixed(2)}%</dd><dt>Payment</dt><dd>{money(s.inputs.pmt, s.inputs.currency, s.inputs.precision)}</dd><dt>Duration</dt><dd>{s.durationYears.toFixed(1)} years</dd><dt>Total interest</dt><dd>{money(s.totalInterest, s.inputs.currency, s.inputs.precision)}</dd><dt>Effective rate</dt><dd>{(s.effectiveAnnualRate * 100).toFixed(2)}%</dd></dl><button className="secondary" onClick={() => load(s.inputs)}>Duplicate & edit</button></article>)}</div><div className="panel compare-chart"><ResponsiveContainer width="100%" height="100%"><LineChart><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="period" type="number" allowDuplicatedCategory={false}/><YAxis tickFormatter={compact}/><Tooltip/>{scenarios.map((s, i) => <Line key={i} data={s.schedule.filter((_, x) => x % Math.max(1, Math.ceil(s.schedule.length / 100)) === 0)} dataKey="endingBalance" name={`Scenario ${i + 1}`} stroke={['#16a385','#2563eb','#8b5cf6','#f59e0b'][i]} dot={false}/>)}</LineChart></ResponsiveContainer></div></>}</section>
}

function SavedView({ saved, load, remove, clear }: { saved: Saved[]; load: (i: FinanceInputs) => void; remove: (id: string) => void; clear: () => void }) {
  return <section className="subpage"><div className="section-title"><div><p className="eyebrow">Stored on this device</p><h1>Saved calculations</h1></div>{saved.length > 0 && <button className="danger" onClick={clear}><Trash2/>Clear all</button>}</div>{!saved.length ? <div className="panel empty-state"><Save/><h2>Nothing saved yet</h2><p>Your named calculations will appear here.</p></div> : <div className="saved-list">{saved.map((s) => <article className="panel saved-item" key={s.id}><div><h2>{s.name}</h2><p>{new Date(s.createdAt).toLocaleString()} · Calculate {s.inputs.solveFor.toUpperCase()}</p></div><div><button className="secondary" onClick={() => load(s.inputs)}>Open</button><button className="icon-btn" aria-label={`Delete ${s.name}`} onClick={() => remove(s.id)}><Trash2/></button></div></article>)}</div>}</section>
}

export default App
