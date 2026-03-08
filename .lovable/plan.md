

## Security Audit: Pro Feature Access Control

### Vulnerabilities Found

1. **Client-side only gating on `/algos` and `/ai-assistant`** — subscription check happens purely in React. A user can bypass by calling the backend APIs directly via browser DevTools or any HTTP client.

2. **`twelvedata-proxy` edge function** — only checks authentication (valid JWT), but does NOT verify subscription status. Any logged-in free user can call it directly and get unlimited data (5000 bars, any ticker, any interval).

3. **`chat` edge function** — no auth check at all. Anyone can call it without even being logged in. No subscription verification.

4. **`ParameterPanel` restrictions are UI-only** — free users are limited to IB mode, 7 days, 60-min window via disabled dropdowns, but the `handleRun` function in `Index.tsx` accepts any parameters. A free user could call the function with pro parameters via console.

5. **CORS wildcard (`*`)** on all edge functions — allows requests from any origin.

### Plan

#### 1. Add server-side subscription check to `twelvedata-proxy`
- After auth verification, query `profiles` table for the user's `subscription_status`
- If not `active`/`pro`, enforce free-tier limits:
  - Only `outputsize=390` (1 day of 5min bars)
  - Only IB-compatible requests
- Return `403` with upgrade message if limits exceeded

#### 2. Add auth + subscription check to `chat` edge function
- Require Bearer token and verify JWT (same pattern as `twelvedata-proxy`)
- Query `profiles` for subscription status
- Return `403` for non-Pro users

#### 3. Add server-side validation in `Index.tsx` `handleRun`
- Before calling the API, enforce free-tier parameter limits in code (not just UI)
- Clamp `maxDays` to 7 and `ibWindow` to 60 for free users regardless of input

#### 4. Restrict CORS origins on edge functions
- Replace `"*"` with allowed origins: `myopenedge.xyz`, `myopenedge.lovable.app`, and the preview domain

### Files to Change

| File | Change |
|---|---|
| `supabase/functions/twelvedata-proxy/index.ts` | Add subscription check after auth, enforce free-tier limits |
| `supabase/functions/chat/index.ts` | Add auth check + subscription gate |
| `src/pages/Index.tsx` | Server-side parameter clamping for free users in `handleRun` |

### Result
After these changes, even if a user bypasses the UI, the backend will reject or limit requests from free-tier accounts. No edge function will serve Pro-level data without a verified active subscription.

