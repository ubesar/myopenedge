

## Paddle Payment Integration Plan

Based on the Paddle docs, here's the full integration plan for your $3/month Pro subscription.

### Prerequisites (You Need to Provide)

You'll need 3 things from your Paddle dashboard:

1. **Client-side Token** — from Paddle > Developer tools > Authentication (starts with `test_` for sandbox)
2. **Price ID** — the `pri_xxxx` ID for your $3/month price
3. **Webhook Secret Key** — from Paddle > Developer tools > Notifications

These will be stored as secure secrets in Lovable Cloud.

---

### Implementation Steps

#### 1. Store Secrets
Add 3 secrets:
- `PADDLE_CLIENT_TOKEN` — used in frontend (will be exposed via an edge function or env)
- `PADDLE_WEBHOOK_SECRET` — used in webhook edge function to verify signatures
- `PADDLE_PRICE_ID` — the price to pass to checkout

Since the client token is a *client-side* token (safe to publish per Paddle docs), we can store it as a `VITE_` env variable or hardcode it. However, to keep it configurable, we'll use a small edge function to serve it, or simply embed it in the frontend code.

**Simpler approach**: Store `PADDLE_CLIENT_TOKEN` and `PADDLE_PRICE_ID` directly in the code since they're client-side safe. Only `PADDLE_WEBHOOK_SECRET` needs to be a secret.

#### 2. Frontend — Upgrade Page (`src/pages/Upgrade.tsx`)
- Add Paddle.js script (`https://cdn.paddle.com/paddle/v2/paddle.js`) to `index.html`
- Initialize Paddle in the Upgrade component:
  ```
  Paddle.Environment.set("sandbox")  // remove for production
  Paddle.Initialize({ token: "<client-token>" })
  ```
- Update `handleUpgrade` to call:
  ```
  Paddle.Checkout.open({
    items: [{ priceId: "<price-id>", quantity: 1 }],
    customer: { email: user.email },
    customData: { user_id: user.id }
  })
  ```
- Add event callback to handle checkout completion (show success toast)

#### 3. Backend — Webhook Edge Function (`supabase/functions/paddle-webhook/index.ts`)
- Receives POST from Paddle on subscription events
- Verifies webhook signature using `PADDLE_WEBHOOK_SECRET`
- Handles these events:
  - `subscription.created` / `subscription.updated` → set `subscription_status = 'active'`, update `subscription_end_date`
  - `subscription.canceled` → set `subscription_status = 'canceled'`
  - `subscription.past_due` → set `subscription_status = 'past_due'`
- Updates `profiles` table based on `custom_data.user_id`

#### 4. Config Updates
- Add `[functions.paddle-webhook]` with `verify_jwt = false` to `supabase/config.toml`
- Set Paddle notification URL to: `https://pyffawxowidfqyhxjlvb.supabase.co/functions/v1/paddle-webhook`

#### 5. Cleanup
- Remove old NOWPayments secrets (optional, not blocking)

---

### Architecture Flow

```text
User clicks "Subscribe Now"
  → Paddle.Checkout.open() (overlay)
  → User pays via Paddle
  → Paddle sends webhook POST
  → paddle-webhook edge function
  → Verifies signature
  → Updates profiles table (status, end_date)
  → useSubscription hook picks up change
  → User gets Pro access
```

---

### What I Need From You

Before I can implement, I need you to:
1. Create a Paddle account (sandbox or live)
2. Create a Product + Price ($3/month) in Paddle dashboard
3. Provide: **Client-side Token**, **Price ID**, and **Webhook Secret Key**

Shall I proceed once you have these ready?

