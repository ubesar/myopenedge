# Revamp ORB M15 Pullback

Ganti total engine ORB lama dengan logika bergaya 50% Pullback, khusus candle pertama pembukaan NY.

## Aturan strategi

- Scan hanya candle M15 pertama sesi NY (09:30–09:45). Ini "ORB candle".
- Candle itu harus momentum candle. Range ORB = high − low candle tersebut.
- Setup buy (momentum bullish): buy limit di midpoint candle, SL di low candle, TP = ORB high + 0.5 × range.
- Setup sell (momentum bearish): sell limit di midpoint candle, SL di high candle, TP = ORB low − 0.5 × range.
- RR otomatis 1:2 (risk = 0.5 range, reward = 1.0 range).
- Maksimal 1 entry per hari. Tidak ada setup chaining.
- Limit hanya berlaku pada 2 candle M15 berikutnya (09:45–10:15). Tidak terisi = no trade hari itu.
- Setelah terisi, posisi dibiarkan sampai TP atau SL kena; jika tidak kena keduanya sampai 16:00, exit di close.
- Eksekusi (fill limit, TP, SL) dievaluasi pakai bar M5 agar urutan intrabar akurat; M15 hanya untuk scan momentum candle.
- Jika TP dan SL kena di bar M5 yang sama, hitung sebagai loss (konservatif, sama seperti PB50).

## Deteksi momentum (opsi di UI)

Dua mode yang bisa dipilih di panel parameter:
1. Super body (SMA): avgBody dari 15 bar M15 sebelumnya, termasuk pre-market/hari sebelumnya, body > 1.5 × avgBody.
2. Rasio body tetap: body / range ≥ ambang yang dipilih (50%–70%).

## Detail teknis

- Tulis ulang `src/lib/orb-backtest.ts`: hapus logika C1/C2/trailing stop/cancel-midpoint yang lama. Ekspor `runOrbM15Backtest(symbol, bars, options)` dengan opsi `sessionStartMin`, `momentumMode` ("sma" | "ratio"), `bodyRatio`, `riskUsd`, `side`, `maxDays`. Output tetap `OrbTrade[]` + `OrbStats` supaya UI yang ada tidak pecah, dengan field disesuaikan (`orbCandle`, `midpoint`, `entryPrice`, `stopLoss`, `target`, `outcome`: target | stop | close | no_fill | no_setup).
- Pakai `aggregateBars` dari `src/lib/m15-aggregation.ts` untuk bucket M15 clock-aligned dan `computeMomentumFlags` dari `src/lib/momentum-candle.ts` untuk mode SMA.
- `src/pages/Backtester.tsx`: sesuaikan `toBTTradesORB` ke field baru, ganti kontrol parameter ORB lama (market/minStop) dengan mode momentum + ambang rasio + sisi (both/long/short) + risk, dan pastikan tombol chart mengirim `midpoint`, `exitTime`, `exitPrice`.
- `src/pages/Index.tsx`: samakan blok report + trade log ORB dengan field baru.
- `src/components/ParameterPanel.tsx`: kontrol mode momentum untuk ORB di `/app`.
- Chart trade ORB tetap memakai `TradeChartDialog` (midpoint sebagai level 50%, marker exit).
