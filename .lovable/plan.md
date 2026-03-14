

# Update Terms & Conditions Page

## Changes

### 1. Add language toggle (English / Indonesia)
- Add a pill-shaped toggle in the header (similar to the billing toggle on Landing) with "english" and "indonesia" buttons
- Use `useState` to track active language
- All content rendered conditionally based on selected language

### 2. Replace all Paddle references with Midtrans
- Section 4 (Subscription & Payments): "billed via Midtrans" instead of Paddle
- Refund Section 4: "processed via Midtrans, our payment gateway"
- Privacy Section 4: Fix the broken `<li>` that says "Paddle: Midtrans:" → proper Midtrans description
- Privacy Payment Data: reference Midtrans instead of Paddle

### 3. Content structure
- All 3 tabs (T&Cs, Refund, Privacy) will have full English AND Indonesian translations
- Indonesian translations will be natural/professional legal Indonesian, keeping trading terms untranslated (e.g., "Initial Balance", "Momentum", "OCC", "Gap Fill")

### 4. Implementation approach
- Single file edit: `src/pages/TermsConditions.tsx`
- Define content objects `en` and `id` containing all section text
- Render based on `lang` state
- Language toggle placed next to the header, styled consistently with the app's dark theme

