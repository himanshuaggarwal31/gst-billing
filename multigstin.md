# Multi-GSTIN & EWB Party Requirements

## The Core Mental Model

```
LOCATIONS  →  Your own places         (warehouses, branches, project sites)
CLIENTS    →  Parties you sell to     (with optional multi-GSTIN branches)
SUPPLIERS  →  Parties you buy from    (NEW — needed for triangular supply)
```

---

## Requirement 1 — Client Multi-GSTIN Branches

### Scenario
Acme Ltd has HQ in UP (GSTIN: 09XXXXX) but wants goods delivered to their Mumbai
office (GSTIN: 27XXXXX). Same company, different state registrations.

### What this means for EWB
- **Bill To**      → Acme Ltd, UP GSTIN  (the invoice party — stays on invoice)
- **Ship To**      → Acme Ltd, Mumbai GSTIN (the delivery address — EWB field)
- NIC transactionType = **4** (Ship To differs from Bill To)

### Database change needed
New table `client_branches`:
```
client_branches
  id          uuid PK
  user_id     uuid → auth.users
  client_id   uuid → clients(id) ON DELETE CASCADE
  label       text  -- e.g. "Mumbai Branch", "Rajasthan Depot"
  gstin       text
  address     text
  city        text
  state_code  char(2)
  pincode     char(6)
  is_active   bool default true
```

### Change to eway_bills
Add column:
```
ship_to_branch_id  uuid → client_branches(id) ON DELETE SET NULL
```

Rule: `ship_to_client_id` (existing) picks the master client.
      `ship_to_branch_id` (new) picks a specific branch of that client.
      Only one should be set at a time.

### UI change needed
- Client detail page: add "Branches" section (same pattern as Locations page)
- EWB Ship To dropdown: show master clients + their branches grouped under each client

---

## Requirement 2 — Supplier Drop-Ship (Triangular Supply)

### Scenario
You purchase material from Supplier S in Rajasthan.
You sell to Client C in UP.
Supplier S ships directly from Rajasthan to Client C's Mumbai warehouse.

### What this means for EWB
- **Seller (Consignor)**  → You (your GSTIN)
- **Buyer (Consignee)**   → Client C, UP GSTIN
- **Dispatch From**       → Supplier S's Rajasthan address  ← NEW party needed
- **Ship To**             → Client C's Mumbai branch       ← Req 1 above
- NIC transactionType = **2** (Combination — both dispatch and delivery differ)

### Why `locations` doesn't work for Dispatch From here
`locations` = your own sites. Supplier S's warehouse is NOT yours.
You don't own it, you don't manage it — you just need to record it for EWB.

### New entity needed: Suppliers
```
suppliers
  id          uuid PK
  user_id     uuid → auth.users
  name        text NOT NULL
  gstin       text
  address     text
  city        text
  state_code  char(2)
  pincode     char(6)
  is_active   bool default true
  created_at  timestamptz
  updated_at  timestamptz
```

### Change to eway_bills
Add column:
```
dispatch_from_supplier_id  uuid → suppliers(id) ON DELETE SET NULL
```

Rule: `dispatch_from_location_id` (existing) = goods dispatched from YOUR location.
      `dispatch_from_supplier_id` (new) = goods dispatched from SUPPLIER's location.
      Only one should be set at a time.

### UI change needed
- New "Suppliers" page (under Purchases or Settings)
- EWB Dispatch From: two-section dropdown — "My Locations" | "Suppliers"

---

## Complete EWB Party Resolution (after both requirements)

```
Dispatch From:
  → null                         = from your registered address (transactionType 1 or 4)
  → dispatch_from_location_id    = from your own warehouse/branch (transactionType 3 or 2)
  → dispatch_from_supplier_id    = from supplier's location (transactionType 3 or 2)

Ship To:
  → null                         = to buyer's registered address (transactionType 1 or 3)
  → ship_to_client_id            = to a different client entirely (transactionType 4 or 2)
  → ship_to_branch_id            = to a branch of the billed client (transactionType 4 or 2)
```

### transactionType mapping (NIC EWB v1.0.0621)
| Dispatch From set? | Ship To set? | transactionType |
|--------------------|--------------|-----------------|
| No                 | No           | 1 — Regular     |
| No                 | Yes          | 4 — Ship To     |
| Yes                | No           | 3 — Dispatch From |
| Yes                | Yes          | 2 — Combination |

---

## Implementation Plan

### Phase 1 — Client Branches (Req 1)
1. Migration: create `client_branches` table
2. Migration: add `ship_to_branch_id` to `eway_bills`
3. API: `GET/POST /api/clients/[id]/branches`, `PATCH/DELETE /api/clients/[id]/branches/[bid]`
4. UI: Branches section on Client detail page
5. EWB Section: update Ship To dropdown to show clients + branches grouped
6. EWB JSON route: resolve `ship_to_branch_id` in party building logic
7. EWB PDF route: same

### Phase 2 — Suppliers (Req 2)
1. Migration: create `suppliers` table
2. Migration: add `dispatch_from_supplier_id` to `eway_bills`
3. API: `GET/POST /api/suppliers`, `PATCH/DELETE /api/suppliers/[id]`
4. UI: New Suppliers page (under dashboard nav)
5. EWB Section: update Dispatch From dropdown — grouped "My Locations" / "Suppliers"
6. EWB JSON route: resolve `dispatch_from_supplier_id` in party building logic
7. EWB PDF route: same

### Phase 3 — Invoice billing by branch (future)
- Allow selecting a client branch as the billing party on an invoice
- Override `buyer_state_code` from the branch's `state_code`

---

## Files to touch (both phases)

| File | Change |
|---|---|
| `supabase/migrations/` | 4 new migration files |
| `src/app/api/clients/[id]/branches/route.ts` | New CRUD |
| `src/app/api/suppliers/route.ts` | New CRUD |
| `src/app/api/suppliers/[id]/route.ts` | New CRUD |
| `src/app/api/invoices/[id]/eway-bill/route.ts` | New Zod fields |
| `src/app/api/challans/[id]/eway-bill/route.ts` | New Zod fields |
| `src/app/api/invoices/[id]/eway-bill/json/route.ts` | Updated party resolution |
| `src/app/api/challans/[id]/eway-bill/json/route.ts` | Updated party resolution |
| `src/app/api/invoices/[id]/eway-bill/pdf/route.ts` | Updated party resolution |
| `src/app/api/challans/[id]/eway-bill/pdf/route.ts` | Updated party resolution |
| `src/components/invoice/EWayBillSection.tsx` | Updated dropdowns |
| `src/app/dashboard/clients/[id]/page.tsx` | Add branches section |
| `src/app/dashboard/suppliers/page.tsx` | New page |
