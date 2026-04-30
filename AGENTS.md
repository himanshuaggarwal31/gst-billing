<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-agent-rules -->
## Feature Tracking — MANDATORY

After implementing any new feature:
1. Mark it `[x]` in `TODO.md`
2. Add it to the correct section in `FEATURES.md` using benefit-focused language (what the user gains, not what the code does)
3. Update the pricing table in `FEATURES.md` if the feature belongs to a specific plan

Do NOT skip this. `FEATURES.md` is shown to potential customers.

---

## Tech Stack — Quick Reference

| Layer | Technology |
|---|---|
| Framework | Next.js App Router (TypeScript), `src/` layout |
| Auth + DB | Supabase — RLS enabled on all tables |
| Server routes | Use Supabase **service role key** (never expose in client components) |
| UI | shadcn/ui + Tailwind CSS |
| PDF | `@react-pdf/renderer` |
| Email | Resend |
| Validation | Zod — use `.issues[0].message` (NOT `.errors[0].message`) |
| DB migrations | Add SQL files to `supabase/migrations/` with incremental timestamp prefix |

---

## Multi-User / Delegation Pattern

All API routes must use `resolveOwnerId()` from `src/lib/resolve-owner.ts` to identify the data owner. This supports accountant/delegate access where the authenticated user (`auth.uid()`) may not be the record owner.

```ts
const { ownerId, role } = await resolveOwnerId(supabase, authedUserId);
```

- **Viewer role cannot mutate** — always check `role === "viewer"` before any write/delete operation and return 403.
- RLS on tables uses `user_id = auth.uid()` for direct owners. Delegated access is enforced at the API layer.

---

## API Conventions

- All responses use helpers from `src/lib/api-response.ts`: `ok(data)` and `err(status, message)`
- Zod validation errors: `.issues[0].message` not `.errors[0].message`
- Route files live at `src/app/api/[resource]/[id]/route.ts`

---

## Deferred — Do Not Implement Unless Explicitly Asked

The following are intentionally deferred to a later phase:

- Payment gateway integration (Razorpay, Stripe)
- Payment links on invoices
- Bank reconciliation
- Payment gateway webhooks
- In-app subscription billing

---

## TODO.md Structure Reference

| Section | Meaning |
|---|---|
| ✅ Core MVP | Original launch features, all done |
| ✅ Features Completed | Post-MVP features that are built and live |
| 🔴 High Priority | GST compliance features, India-specific, build next |
| 🟠 Medium Priority | Business operations features |
| 🟡 Growth Features | Retention, stickiness, power-user features |
| 📋 Remaining Backlog | Misc items not yet prioritised |
| 🚫 Deferred | Payment infrastructure — do not build yet |
<!-- END:project-agent-rules -->

