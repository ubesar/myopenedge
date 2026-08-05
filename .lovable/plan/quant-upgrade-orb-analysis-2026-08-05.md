# Quant Upgrade + ORB Analysis

## Bagian 1 — Quant layer untuk semua report bertrade

Semua report yang menghasilkan daftar trade (pullback 50%, momentum candle fib pullback, IB pullback 25/50/75 kedua varian, momentum candle continuation, dan ORB baru) mendapat panel statistik quant yang seragam di bawah hasilnya.

### Metrik yang ditampilkan

**1. EV setelah cost**
- Gross expectancy per trade (dalam R dan dalam $ per 1 kontrak/share).
- Dikurangi asumsi cost: commission per side + slippage (tick) — keduanya bisa diatur user.
- Output: net expectancy per trade, net expectancy per hari, total net P&L, profit factor, dan breakeven win-rate (win rate minimum agar EV = 0).

**2. Sample & confidence**
- Jumlah trade, wins, losses, unresolved.
- Wilson 95% confidence interval untuk win rate (batas bawah + atas).
- Flag peringatan bila N < 30 ("sample terlalu kecil untuk disimpulkan") dan bila batas bawah CI < breakeven win-rate ("edge belum terbukti positif").

**3. Sizing (fractional Kelly)**
- Kelly fraction dari win rate + payoff ratio: `f = W − (1−W)/R`.
- Tampilkan full Kelly, half Kelly, quarter Kelly (rekomendasi default), dan risiko $ per trade untuk ukuran akun yang diinput user.
- Kelly negatif ditandai merah dengan label "no edge — jangan sizing".

**4. Edge decay**
- Split in-sample (60% pertama) vs out-of-sample (40% terakhir) berdasarkan tanggal: win rate + net expectancy untuk masing-masing, plus delta.
- Rolling win rate per bucket (per bulan, atau per 20 trade bila data pendek) sebagai sparkline/bar chart kecil.
- Label status edge: `stable`, `decaying`, atau `restored`.

### Cara pasangnya
- Modul baru `src/lib/quant-metrics.ts` dengan tipe input generik `QuantTrade { date, side, entry, exit, risk, outcome }` dan fungsi `computeQuantMetrics(trades, options)`.
- Komponen baru `src/components/QuantPanel.tsx` merender 4 blok di atas dengan gaya card lowercase yang sudah ada.
- Tiap dashboard bertrade menambahkan adapter kecil yang memetakan trade internalnya ke `QuantTrade`, lalu me-render `<QuantPanel />`.
- Input cost/akun (commission, slippage tick, tick value, account size, risk %) ditambahkan sebagai grup "quant settings" collapsible di ParameterPanel, dengan default wajar dan disimpan di state Index.

## Bagian 2 — Report baru: ORB (Opening Range Breakout)

Mode baru `orb` di dropdown report (Pro), engine `src/lib/orb-analysis.ts`, dashboard `src/components/ORBDashboard.tsx`.

### Parameter
- OR duration: 5 / 15 / 30 / 60 menit (default 15).
- Arah: long + short (breakout di atas OR high / di bawah OR low), entri pada breakout pertama.
- Batas sesi: sampai 16:00 ET.

### a. Breakout dasar + profit target subreport (edgeful)
- Berapa % hari ada breakout, arah pertama, dan waktu breakout.
- Win rate untuk beberapa profit target sekaligus: 0.5R, 1R, 1.5R, 2R, dan target berbasis ukuran OR (0.5×OR, 1×OR, 2×OR), dengan SL di sisi berlawanan OR.
- Barstack win/loss per target + expectancy per target, sehingga terlihat target mana yang paling optimal.
- Split long vs short.

### b. OR size quintile
- Bagi hari ke 5 kuintil berdasarkan ukuran OR (% dari harga).
- Per kuintil: rata-rata MFE, MAE, breakout rate, dan win rate pada target 1R — mereplikasi Tabel 2 paper.

### c. Retest analysis (paper "Anatomy of the Retest")
- Deteksi retest: harga kembali menyentuh level OR yang ditembus dalam window terdefinisi setelah breakout.
- Metrik: retest rate, distribusi `mins_to_retest` (0–5, 5–10, 10–20, 20–45, 45–60, >60), `MFE_pre` (excursion sebelum retest).
- Outcome setelah retest: continuation vs failure, ditampilkan per bucket waktu retest — pola inti paper (retest cepat = continuation lebih tinggi).
- Tabel continuation rate per bucket dengan N dan 95% CI.

### d. Chart overlay ORB
- Day chart ORB: garis OR high/low, shading area opening range, marker breakout (▲/▼), marker retest (◆), dan garis target/SL.

### e. History
- Tabel per hari: tanggal, OR high/low, OR size, arah breakout, waktu breakout, MFE/MAE, ada/tidaknya retest, mins to retest, outcome per target.

### f. Quant panel
- ORB memakai `QuantPanel` yang sama (target 1R sebagai basis trade list).

## Catatan teknis
- Data tetap dari edge function existing (bar M5 dari massive-bars/twelvedata-proxy); ORB 5-menit memakai granularitas M5 yang tersedia, bukan M1 — akan disebutkan sebagai catatan metodologi di dashboard.
- Wiring: tambah `"orb"` ke `AnalysisMode` di `ControlPanel.tsx`, item dropdown di `ParameterPanel.tsx`, state + handler + render branch di `src/pages/Index.tsx`.
- Semua statistik dihitung di client dari bar yang sudah di-fetch; tidak ada perubahan database atau edge function.
