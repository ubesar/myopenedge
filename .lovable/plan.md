

## Ganti "Screener" dengan "Chart" di Workspace

Perubahan sederhana pada sidebar navigation:

### `src/components/AppNavSidebar.tsx`
- Ganti item `screener` menjadi `chart` dengan icon `CandlestickChart` (atau `LineChart` dari lucide-react)
- Ubah `href` dari `null` ke `/chart`

### `src/pages/Chart.tsx` (baru)
- Halaman baru dengan layout sidebar + area chart utama
- Menggunakan komponen chart yang sudah ada (atau placeholder awal) untuk menampilkan candlestick chart
- Proteksi auth seperti halaman lain

### `src/components/AnimatedRoutes.tsx`
- Tambah route `/chart` → `<Chart />`

