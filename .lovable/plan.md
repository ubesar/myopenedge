

## Diagnosis

Edge function logs show the exact error repeatedly:

```
JWT validation error: AuthApiError: invalid claim: missing sub claim
```

This means the token sent by the client is **not a valid user JWT** -- it's missing the `sub` (subject/user ID) claim. This happens because raw `fetch()` to the edge function URL doesn't include the proper Supabase auth headers that Lovable Cloud tokens require.

## Root Cause

Both `src/pages/AIAssistant.tsx` and `src/components/AIChatAssistant.tsx` use raw `fetch()` to call the chat edge function. While they send `Authorization: Bearer ${accessToken}`, they're **missing the `apikey` header** that the Supabase auth system needs to properly validate Lovable Cloud ES256 tokens.

## Fix

**Replace raw `fetch()` with a streaming-compatible approach** that includes proper Supabase headers. The simplest fix is to add the `apikey` header alongside the Authorization header in both files:

### 1. `src/pages/AIAssistant.tsx` - Update fetch headers (line ~54-61)
Add the `apikey` header to the fetch call so the edge function runtime can properly contextualize the JWT:

```typescript
const resp = await fetch(CHAT_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  },
  body: JSON.stringify({ messages: allMessages }),
});
```

### 2. `src/components/AIChatAssistant.tsx` - Same fix (line ~59-70)
Apply the same `apikey` header addition to the floating chat widget's fetch call.

### 3. `supabase/functions/chat/index.ts` - No changes needed
The edge function already correctly uses `serviceClient.auth.getUser(token)` with the service role key, and the model is already set to `google/gemini-3-flash-preview`. No backend changes required.

## Summary
Two files need the same 1-line addition (`apikey` header) to fix the 401 error. The model is already `gemini-3-flash-preview` as requested.

