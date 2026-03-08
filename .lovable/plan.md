

## Problem

The account `justme1989aug@gmail.com` already has `subscription_status = 'pro'` in the database, but `useSubscription` hook only considers `status === "active"` as having full access (`isActive`). This mismatch means the user won't get Pro features.

## Plan

Two changes needed:

1. **Update the database** -- Change `subscription_status` from `'pro'` to `'active'` and extend `subscription_end_date` to a far future date (e.g., 2030-12-31) so it never expires.

2. **Update `useSubscription.ts`** -- Also add `"pro"` as a valid active status in the `isActive` check, so both `"active"` and `"pro"` are treated as full access. This future-proofs the logic.

```typescript
const isActive = status === "active" || status === "pro";
```

This ensures `justme1989aug@gmail.com` gets full access immediately, which is important for the Paddle review process.

