

# Paddle Sandbox to Live Migration Guide

Berikut adalah tutorial lengkap yang akan saya buatkan sebagai halaman `/docs/paddle-live-guide` dalam format yang bisa di-download sebagai PDF.

## Current Sandbox Configuration

Dari codebase saat ini, berikut yang perlu diganti saat go-live:

| Item | Sandbox Value | Perlu Diganti |
|---|---|---|
| Environment | `"sandbox"` | `"production"` |
| Client Token | `test_906ae7bf74bbcaf25341c87dd7f` | Live client token |
| Price ID | `pri_01kk6rkazpp86ckkdf76wtbg9s` | Live price ID |
| Webhook Secret | `PADDLE_WEBHOOK_SECRET` (env) | Live webhook secret |
| Webhook URL | Edge function URL | Same URL, new notification in Paddle |

## Plan: Create Downloadable PDF Guide

Saya akan membuat sebuah halaman Markdown yang bisa di-print/save sebagai PDF, berisi:

### Content Structure

**Part 1 - Paddle Dashboard Setup (Live)**
1. Login ke Paddle > switch dari Sandbox ke Live
2. Complete business verification (KYC, tax info, domain verification)
3. Create Product: "MyOpenEdge Pro" ($3/month recurring)
4. Copy Live credentials: Client-side token, Price ID
5. Setup Webhook notification pointing to edge function URL
6. Copy Live webhook signing secret

**Part 2 - Code Changes (2 files)**
1. `src/pages/Upgrade.tsx`: Change environment, token, priceId
2. Backend secret: Update `PADDLE_WEBHOOK_SECRET` to live value

**Part 3 - Domain Whitelisting**
1. Add `myopenedge.xyz` to Paddle approved domains
2. Configure "Default payment link" to your domain

**Part 4 - Testing & Go-Live Checklist**
- Test with real card (small amount)
- Verify webhook fires and profile updates
- Verify subscription lifecycle events

### Implementation
- Create `/docs/paddle-guide` page with print-friendly styling
- Add a "Download PDF" button that triggers `window.print()`
- Include all step-by-step instructions with screenshots descriptions
- Style with `@media print` for clean PDF output

### Files to Change/Create
| File | Action |
|---|---|
| `src/pages/PaddleLiveGuide.tsx` | New page with full tutorial content |
| `src/App.tsx` | Add route `/docs/paddle-guide` |

