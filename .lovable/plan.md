

## Custom Templates - Implementasi Lengkap

Custom Templates memungkinkan user menyimpan kombinasi parameter analisis (mode, ticker, IB window, date range, body ratio, timeframe) sebagai preset yang bisa di-load kembali dengan satu klik.

### Fungsi Utama
- **Save**: Simpan parameter aktif sebagai template dengan nama custom
- **Load**: Pilih template dari dropdown → semua parameter otomatis terisi
- **Delete**: Hapus template yang tidak diperlukan
- **Per-user**: Setiap user punya template sendiri

### Database

Buat tabel `analysis_templates`:
```sql
CREATE TABLE public.analysis_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'ib',
  symbol TEXT NOT NULL DEFAULT 'QQQ',
  ib_window INTEGER NOT NULL DEFAULT 30,
  max_days INTEGER NOT NULL DEFAULT 15,
  body_ratio TEXT DEFAULT '0.50',
  occ_body_ratio TEXT DEFAULT '0.50',
  occ_timeframe TEXT DEFAULT 'M15',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);
-- RLS: user hanya bisa CRUD template milik sendiri
```

### Perubahan Komponen

**ParameterPanel.tsx**:
1. Fetch templates dari database saat mount
2. Dropdown template berisi template user + "custom – not saved"
3. Tombol "save as new template" → dialog input nama → insert ke DB
4. Saat template dipilih → set semua state (mode, symbol, ibWindow, maxDays, bodyRatio, dll)
5. Tombol delete (icon trash) di setiap template item

**RightSidebar.tsx**:
1. Tampilkan daftar template user di section "custom templates"
2. Klik template → callback ke parent untuk load parameter
3. Filter "this report" menampilkan template yang mode-nya sama dengan mode aktif

### Flow
1. User set parameter → klik "save as new template" → input nama → tersimpan
2. User buka dropdown template → pilih saved template → semua parameter auto-fill
3. User klik "run analysis" dengan parameter dari template

