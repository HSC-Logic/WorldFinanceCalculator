# Smart Finance Calculator

A private, browser-only time-value-of-money workspace. Solve for future value, present value, periodic payment, annual interest rate, or number of periods; then inspect charts and a period-by-period cash-flow schedule.

## Features

- Five TVM solvers with ordinary-annuity and annuity-due timing
- Distinct payment and compounding frequencies
- Zero-interest and lump-sum support, strict validation, and bracketed rate solving
- Results dashboard, responsive Recharts visualizations, paginated/searchable/sortable schedule
- Up to four scenario comparisons
- Local saved calculations, latest-result persistence, and URL sharing
- CSV schedule, JSON summary, clipboard, print, and browser PDF exports
- Nine display currencies, configurable precision, dark mode, mobile layout, and accessible controls
- No backend, account, API key, tracking, or transmitted personal data

## Stack

React 19, TypeScript, Vite, Tailwind CSS, Recharts, Lucide React, React Hook Form, Zod, Vitest, and LocalStorage.

## Local setup

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Commands

- `npm run dev` — development server
- `npm run lint` — static lint checks
- `npm run test` — finance-engine unit tests
- `npm run build` — type-check and production build
- `npm run preview` — preview the production bundle

## Financial conventions

Money received is positive. Money paid or invested is negative. Annual interest is entered as a nominal percentage and converted to an equivalent payment-period rate from P/Y and C/Y. Beginning-of-period payments receive one additional period of growth. Calculations keep full floating-point precision and round only for display.

The interest-rate solver scans a bounded domain for a sign-changing interval and uses bisection with a fixed maximum iteration count and convergence tolerance. Some cash-flow series can have multiple internal rates of return; this calculator returns the first bracketed solution in its scan. Period calculations validate the logarithm domain and handle zero interest separately.

## Tests

Run `npm run test`. Coverage includes lump sums, monthly cash flows, PV, loan and investment payments, zero interest, payment timing, rate and period solving, mixed frequencies, cash-flow signs, invalid and non-converging cases, and very small/large values.

## GitHub Pages

1. Push the project to the `main` branch of a GitHub repository named `WorldFinanceCalculator`.
2. In **Settings → Pages**, select **GitHub Actions** as the source.
3. The workflow in `.github/workflows/deploy.yml` tests, builds, and deploys on every push to `main`.

Vite automatically uses `/WorldFinanceCalculator/` as its production base inside GitHub Actions. The app is a single page with no server-side routing, so refreshes do not depend on rewrite rules. If the repository is renamed, update `base` in `vite.config.ts`.

## Project structure

```text
src/
  lib/finance/       Pure calculation and schedule engine
  lib/export/        CSV and JSON downloads
  test/              Finance unit tests
  types/             Shared financial types
  App.tsx            Calculator, results, comparison, and saved views
  index.css          Responsive theme and print styles
```

## Known limitations

- Currency choices format values only; no exchange-rate conversion is performed.
- Schedules are capped at 100,000 periods and chart samples are reduced for responsiveness.
- Browser floating-point arithmetic is appropriate for estimates but not regulated accounting ledgers.
- Shared URLs expose only the financial inputs placed in the query string; do not add sensitive information.

## Screenshots

Add desktop and mobile screenshots here after deployment.

## Disclaimer

Results are estimates and not financial advice. Confirm material decisions with a qualified professional.

## License

MIT — see [LICENSE](LICENSE).
