

## IB London Analysis

### Konsep
Mode baru "IB London" yang menganalisis Initial Balance sesi London (03:00 AM - 11:30 AM ET), lalu melacak breakout setelah IB window. Data diambil dari Massive API (seperti Globex IB) karena sesi London terjadi di luar jam RTH.

### Waktu Sesi London (dalam ET)
- **London Open**: 03:00 AM ET
- **London Close**: 11:30 AM ET  
- **IB Window**: 15/30/60/90 menit pertama dari 03:00 AM
- **Post-IB tracking**: Setelah IB window sampai London close (11:30 AM)

### File yang Dibuat/Diubah

1. **`src/lib/london-ib-analysis.ts`** (baru)
   - Clone dari `ib-analysis.ts` dengan konstanta waktu London:
     - `IB_START = 3 * 60` (03:00 AM ET)
     - `SESSION_CLOSE = 11 * 60 + 30` (11:30 AM ET)
   - Sama persis logikanya: IB range, high-first/low-first detection, single/double/no break classification

2. **`src/components/LondonIBDashboard.tsx`** (baru)
   - Clone dari existing IB dashboard (SummaryTable + IBChart + IBReportHistory pattern)
   - Label disesuaikan: "London IB", waktu sesi London

3. **`src/components/ControlPanel.tsx`**
   - Tambah `"london-ib"` ke type `AnalysisMode`

4. **`src/components/ParameterPanel.tsx`**
   - Tambah opsi `<SelectItem value="london-ib">IB: london session</SelectItem>` (pro only)
   - Tampilkan IB Window selector untuk mode `london-ib`

5. **`src/pages/Index.tsx`**
   - Tambah state `londonIBResult`
   - Di `handleRun`: untuk mode `london-ib`, fetch via `massive-bars` (sama seperti `globex-ib`), lalu panggil `analyzeLondonIB()`
   - Render `LondonIBDashboard` saat mode aktif

6. **`src/hooks/useAIAnalysis.ts`**
   - Tambah case `london-ib` untuk AI analysis support

### Data Flow
```text
User selects "IB: london session"
  → massive-bars edge function (Polygon API, 5min bars)
  → analyzeLondonIB() filters 03:00-11:30 ET bars
  → IB range from first X minutes
  → Track breakouts post-IB until 11:30 AM ET
  → Display via LondonIBDashboard
```

### Catatan
- Hanya untuk Pro users (locked untuk free)
- Reuse komponen IBChart, IBReportHistory, SummaryTable yang sudah ada
- Massive API sudah support pengambilan bar di luar RTH

