

## Plan: Show Real Analysis Parameters in Custom Settings

### Problem
The "Custom Settings" section in the analysis results shows hardcoded values ("any size", "all days") instead of the actual parameters used during the analysis run.

### Analysis
Looking at `src/pages/Index.tsx`, the settingsGrid is currently hardcoded:
```tsx
settingsGrid={[
  { label: "IB timeframe", value: `${result.ibWindowMinutes} min` },  // ✓ Real
  { label: "candle timeframe", value: "5min" },  // ✓ Fixed (correct)
  { label: "IB size", value: "any size" },  // ✗ Hardcoded
  { label: "IB ending zone", value: "all days" },  // ✗ Hardcoded
  { label: "IB breakout measure", value: "by rejection (M5 close)" },  // ✓ Fixed (correct)
  { label: "weekdays to use", value: "all days" },  // ✗ Hardcoded
]}
```

Some settings like "IB size" and "weekdays filter" don't exist as parameters yet. However, we can and should show the **date range (maxDays)** which IS a real parameter but isn't displayed.

### Solution

1. **Track actual parameters used** - Store `maxDays` in state alongside results
2. **Update settingsGrid** to display real values:
   - Keep showing IB timeframe (already real)
   - Add "date range" showing actual maxDays used (e.g., "last 15 days" or "all days")
   - Keep fixed values (candle timeframe, breakout measure) as they don't change

### Changes

**File: `src/pages/Index.tsx`**

1. Add state to store `maxDays` used in analysis:
```tsx
const [analysisMaxDays, setAnalysisMaxDays] = useState<number>(0);
```

2. Save `maxDays` when running analysis:
```tsx
// In handleRun, after analysis completes
setAnalysisMaxDays(effectiveMaxDays);
```

3. Update settingsGrid for IB charts:
```tsx
settingsGrid={[
  { label: "IB timeframe", value: `${result.ibWindowMinutes} min` },
  { label: "candle timeframe", value: "5min" },
  { label: "IB size", value: "any size" },
  { label: "IB ending zone", value: analysisMaxDays === 0 ? "all days" : `last ${analysisMaxDays} days` },
  { label: "IB breakout measure", value: "by rejection (M5 close)" },
  { label: "weekdays to use", value: "all days" },
]}
```

4. Apply similar updates to momentum, OCC, and other report charts.

### Technical Notes
- The filters for "IB size" and "weekdays" don't exist in the parameter panel yet, so they remain hardcoded as "any size" / "all days"
- Future: Can add these filters to ParameterPanel and pass them to the analysis functions

