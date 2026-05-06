# GST Billing SaaS — Feature Requirements

> **AI Instruction:** Mark `[x]` when a feature is done, update `FEATURES.md` with benefit-focused language, and update the pricing table if the plan assignment changes. Never skip this — `FEATURES.md` is shown to potential customers.

---

## ✅ Core MVP — Done

- [x] Google OAuth login
- [x] Client management (CRUD)
- [x] Invoice creation with live GST preview (CGST/SGST/IGST auto-switch)
- [x] Invoice edit mode
- [x] PDF generation (react-pdf)
- [x] Email invoice via Resend
- [x] Free tier limit enforcement (5 invoices/month)
- [x] Invoice number auto-generation
- [x] Products / Services catalog
- [x] Settings page (business name, GSTIN, address, state, PAN, phone)
- [x] Dashboard stats (total billed, GST collected, outstanding)

---

## ✅ Features Completed

- [x] #1  GSTR-1 export (CSV for GST portal filing)
- [x] #2  Analytics charts (revenue trend, top clients, GST breakdown)
- [x] #3  Payment reminders (overdue follow-up emails)
- [x] #4  Custom logo on PDF (upload in Settings → appears on every invoice)
- [x] #6  Client portal — shareable public invoice link (`/invoice/[token]`)
- [x] #7  Invoice themes (classic / minimal / modern PDF layouts)
- [x] #8  Bulk invoice actions (select multiple → mark paid / delete / email)
- [x] #9  Expense tracking (log GST-paid purchases, net liability calculation)
- [x] #10 Recurring invoices (template + frequency → auto-generate monthly)
- [x] #11 Credit notes (issue against a paid invoice for returns/corrections)
- [x] #12 WhatsApp share button (one-click share invoice link via WhatsApp)
- [x] #14 Accountant / CA access (invite with read-only role)
- [x] #15 Payment tracking (record partial/full payments with transaction history, auto-status update)

---

## 🔴 High Priority — GST Compliance (India-specific)

- [x] #16 GSTR-3B export — monthly summary return (CSV/JSON) for GST portal filing
- [x] #17 E-invoice (IRN + QR code) — generate NIC JSON for IRP portal; record IRN/ACK/QR; IRN/ACK/QR printed on invoice PDF (legally mandatory when generated)
- [x] #18 E-way bill generation — NIC JSON export for ewaybillgst.gov.in; transport details form; record bill number; separate printable EWB transport PDF
- [ ] #19 GSTR-2A/2B reconciliation — match your purchase invoices vs supplier-filed data; required for ITC
- [x] #20 ITC (Input Tax Credit) ledger — running balance of GST claimable from purchase bills
- [x] #21 HSN/SAC code master — full code list with GST rate mapping, autocomplete on invoice line items
- [x] PDF branding preferences in Settings — default theme, brand accent colour (16-swatch picker), custom footer text, T&C block, amount in words, two-copy (Original + Duplicate) PDF toggle; theme picker collapsed in forms to save screen space; quantity enforced as whole numbers

---

## 🟠 Medium Priority — Business Operations

- [x] #22 Proforma invoice / Quotation — create a quote, convert to invoice in one click
- [ ] #23 Debit notes — upward revision complement to credit notes
- [ ] #24 Purchase bills recording — log supplier invoices separately for ITC matching and audit
- [x] #25 Client statement of accounts — full transaction history per client (invoices, payments, credits)
- [x] #26 Aging report — 0–30 / 31–60 / 61–90+ days overdue dashboard for collections
- [ ] #27 Delivery challan — goods dispatch document issued before or without an invoice
- [ ] #28 Invoice approval workflow — Draft → Review → Approved → Sent status chain

---

## 🟡 Growth Features — Retention & Stickiness

- [ ] #29 Multiple GSTIN profiles — one login, manage multiple business entities
- [x] #30 CSV / Excel import — bulk import clients, products, and historical invoices from CSV with auto-calculated GST totals
- [ ] #31 Tally export — XML/CSV bridge; most accountants use Tally, this is a dealmaker
- [ ] #32 Audit trail / activity log — who changed what and when; required for CA review
- [ ] #33 Stock / inventory tracking — auto-deduct inventory on invoice; for product sellers
- [ ] #34 OCR receipt scan — photograph paper expense bills; auto-extract amount and GST
- [ ] #35 In-app notifications — invoice viewed by client, payment overdue, recurring invoice generated

---

## 📋 Remaining Backlog

- [ ] #5  UPI QR code on PDF
- [ ] #13 Multi-currency billing (USD/EUR with INR equivalent)
- [ ] Vercel deployment guide
- [ ] Custom email domain (Resend verified domain)
- [ ] Sentry error monitoring

---

## 🚫 Deferred — Payment Infrastructure

> Revisit after core compliance and operations features are stable.

- [ ] Razorpay subscription billing (in-app plan upgrades)
- [ ] Razorpay payment links embedded on invoice PDF / portal
- [ ] Bank reconciliation (match bank statement transactions to recorded payments)
- [ ] Payment gateway webhooks (auto-update invoice status on successful payment)
- [ ] Stripe integration (for international clients paying in foreign currency)