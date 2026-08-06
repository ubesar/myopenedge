

## Update Chart Page: 24-Hour Data via Massive API

### Konsep
Saat ini chart hanya menampilkan data RTH (jam pasar) via TwelveData. Dengan beralih ke Massive API (Polygon), chart bisa menampilkan data 24 jam termasuk pre-market, after-hours, dan overnight — karena Polygon menyediakan bar di luar jam reguler.

### Perubahan

**1. TradingViewChart.tsx — Ganti data source ke massive-bars**
- Ganti fetch dari `twelvedata-proxy` ke `massive-bars` edge function
- Hitung `from`/`to` date range otomatis (misal: 5 hari terakhir untuk intraday, 365 hari untuk daily)
- Map interval UI ke Polygon format: `5min→(5,minute)`, `15min→(15,minute)`, `30min→(30,minute)`, `1h→(1,hour)`
- Parse response: massive-bars mengembalikan datetime dalam ET string, convert ke unix timestamp untuk lightweight-charts
- Volume data tetap ditampilkan

**2. Chart.tsx — Tambah timeframe 1D**
- Tambah opsi `{ label: "1D", value: "1day" }` ke array intervals
- Massive API support daily bars juga (`timespan: "day"`)

**3. Sesuaikan IB & MC overlay logic**
- IB overlay: sudah filter berdasarkan waktu 09:30-16:00, tetap bekerja
- MC overlay: sudah filter 09:30-12:00, tetap bekerja
- Kedua overlay menggunakan datetime string yang di-parse, compatible dengan format massive-bars

### Data Flow
```text
User pilih symbol + interval
  → POST massive-bars { symbol, from, to, multiplier, timespan }
  → Polygon API returns 24h bars (pre/post/overnight)
  → Parse datetime ET → unix timestamp
  → Display di lightweight-charts
```

### Catatan
- MASSIVE_API_KEY sudah dikonfigurasi sebagai secret
- massive-bars edge function sudah support batching untuk range panjang
- Tidak perlu edge function baru

