# Replika MyOpenEdge ke Project Baru dengan Supabase Eksternal

## Konteks & Batasan

Project ini berjalan di **Lovable Cloud**. Cloud **tidak bisa dilepas** dari project ini setelah ditambahkan. Jadi kita **tidak bisa mengubah** project ini ke Supabase eksternal — solusinya adalah **replika (remix) ke project baru**, lalu connect project baru itu ke akun Supabase milikmu sendiri.

Lingkup: **skema + kode saja** (tanpa data historis). User mendaftar ulang; market data di-download ulang via `/data-source`.

```text
[Project ini — Cloud]  ──remix──▶  [Project baru — tanpa Cloud]  ──connect──▶  [Supabase eksternal milikmu]
```

## Yang harus kamu lakukan di UI Lovable (tidak bisa diotomasi)

1. **Disable Cloud untuk project masa depan**: Connectors → Lovable Cloud → Disable Cloud. (Ini tidak menghapus Cloud dari project ini, hanya untuk project baru.)
2. **Remix project ini** ke project baru: klik nama project (kiri atas) → Settings → "Remix this project". Semua kode, edge function, dan migration file ikut.
3. **Buat project Supabase** di supabase.com (kamu sudah punya akun). Catat: Project URL, anon/publishable key, service role key, database password. Pilih region dekat user (e.g. Singapore).
4. **Connect Supabase eksternal ke project baru**: di project baru, Connectors → Supabase → paste Project URL + publishable key (+ service role key bila diminta). Ini mengisi otomatis `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, dan secret `SUPABASE_*`.

> Setelah langkah 4 selesai, buka chat di project baru dan beritahu saya. Saya akan lanjutkan Phase B di sana.

## Phase B — Yang saya kerjakan di project baru (setelah Supabase ter-connect)

### B1. Jalankan migration skema lengkap
Saya akan menyusun **satu migration SQL terkonsolidasi** dari 25 file migration yang ada, dengan perbaikan kritis: **menambah GRANT ke setiap tabel** (saat ini hanya `market_data_chunks` punya GRANT — sisanya akan error permission denied di Supabase eksternal). Migration ini membuat:
- Tabel: `profiles`, `orders`, `accounts`, `instruments`, `playbooks`, `import_batches`, `trades`, `attachments`, `daily_notes`, `analysis_runs`, `ea_control`, `user_pins`, `analysis_templates`, `api_rate_limits`, `watchlist`, `midtrans_webhook_logs`, `ai_knowledge`, `mc_alert_state`, `user_roles`, `market_data_chunks`
- Enum `app_role`, fungsi `has_role`, `handle_new_user`, `update_updated_at_column`, `check_rate_limit`, `cleanup_old_rate_limits`
- Trigger `updated_at`, auto-create profile on signup
- RLS policies di semua tabel + GRANT yang sesuai (`authenticated` + `service_role`, `anon` hanya untuk tabel yang butuh)
- Ekstensi `pg_cron` (schema pg_catalog) + `pg_net` (schema extensions)
- Index penting

### B2. Storage bucket
Buat bucket `trade-screenshots` (private) via storage tool + RLS policies upload/view/delete/update per user.

### B3. pg_cron schedule (mc-alert)
Aktifkan ekstensi `pg_cron` di dashboard Supabase baru (Database → Extensions) — **butuh Supabase plan berbayar (Pro+)** untuk pg_cron. Lalu buat schedule cron yang memanggil edge function `mc-alert` tiap 15 menit saat sesi trading aktif ( pakai `pg_net` + `CRON_SECRET`).

### B4. Set semua secret (kamu sediakan nilainya)
Secret tidak ikut remix. Yang perlu di-set ulang via add_secret:
- `MASSIVE_API_KEY` — Polygon.io (mc-alert, massive-bars)
- `TWELVEDATA_API_KEY` / `TWELVEDATA_API_KEYS` — data market
- `MIDTRANS_CLIENT_KEY`, `MIDTRANS_SERVER_KEY`
- `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`
- `PADDLE_API_KEY`, `PADDLE_PRICE_ID`, `PADDLE_WEBHOOK_SECRET`
- `TELEGRAM_CHAT_ID` + `TELEGRAM_API_KEY` (via Telegram connector di Connectors)
- `LOVABLE_API_KEY` (AI gateway + connector gateway — ini platform Lovable, tetap perlu)
- `CRON_SECRET` (protect cron-triggered edge functions)

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, dll. terisi otomatis dari koneksi.

### B5. Konfigurasi Auth
- Email/password: enable
- Google OAuth: set redirect URI di Google Cloud Console ke URL project baru (`https://<project-baru>.lovable.app/auth/callback`), lalu configure provider Google via supabase auth settings
- Set Site URL ke URL published project baru

### B6. Deploy edge functions (15 fungsi)
`admin-users`, `analyze-import`, `analyze-screenshot`, `chat`, `create-invoice`, `expire-subscriptions`, `get-command`, `massive-bars`, `mc-alert`, `nowpayments-ipn`, `paddle-webhook`, `reset-command`, `scrape-url`, `twelvedata-proxy`. Deploy via deploy tool.

### B7. Update CORS hardcoded
`chat/index.ts` & `analyze-import/index.ts` hardcode origin ke URL project ini. Update ke URL project baru (preview + published + custom domain).

### B8. Admin user
User `basoukkas.pnup09@gmail.com` sign up di project baru, lalu saya INSERT row `user_roles` (role `admin`) via migration/SQL.

### B9. Custom domain (opsional, kamu)
Re-add `myopenedge.xyz` ke project baru via project settings.

## Phase C — Verifikasi
- Login email + Google
- Profile auto-create on signup
- Akses tabel (confirm no permission error) — run Supabase linter
- Edge functions: twelvedata-proxy, create-invoice, mc-alert, chat
- Update webhook URLs di provider pembayaran (Paddle/Midtrans/NOWPayments) ke URL project baru

## Risiko & Catatan
- **Missing GRANT** (bug terbesar): 18/19 tabel punya RLS tapi tanpa GRANT → akan 403/permission error di Supabase fresh. Migration konsolidasi memperbaiki ini.
- **pg_cron butuh Supabase Pro+**. Tanpa itu, mc-alert tidak ter-schedule (bisa di-trigger manual sementara).
- **AI gateway & Telegram connector** = fitur platform Lovable, bukan Cloud — seharusnya tetap jalan di project baru asalkan `LOVABLE_API_KEY` di-set & connector Telegram terhubung. Jika ternyata tidak jalan, fallback: panggil Gemini API langsung (butuh `GEMINI_API_KEY`) dan Telegram Bot API langsung.
- **Tidak ada data ikut pindah**. User lakukan sign-up ulang; `market_data_chunks` di-download ulang via /data-source.
- **Webhook pembayaran** (Paddle/Midtrans/NOWPayments) harus di-update ke URL project baru atau notifikasi pembayaran tidak masuk.
