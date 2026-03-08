

## Plan: Add NQ and GC Synthetic Symbols

### Concept
Add **NQ** (Nasdaq futures) and **GC** (Gold futures) as selectable symbols on the chart. Under the hood, fetch data from **QQQ** and **GLD** respectively, then apply a multiplier to approximate futures pricing.

### Conversion Formulas
- **NQ ≈ QQQ × 42** (E-mini Nasdaq 100 futures ≈ QQQ price × ~42)
- **GC ≈ GLD × 10.75** (Gold futures per troy ounce ≈ GLD price × ~10.75)

These are approximate but will produce realistic-looking price levels close to actual NQ/GC values.

### Changes

**1. `src/pages/Chart.tsx`**
- Add `"NQ"` and `"GC"` to the `popularSymbols` array

**2. `src/components/TradingViewChart.tsx`**
- Define a mapping for synthetic symbols: `{ NQ: { source: "QQQ", multiplier: 42 }, GC: { source: "GLD", multiplier: 10.75 } }`
- When fetching data, check if the symbol is synthetic — if so, fetch the source symbol instead
- After parsing OHLC data, multiply all price values (open, high, low, close) by the multiplier
- Display the synthetic symbol name (NQ/GC) in the OHLC header, not the underlying source

