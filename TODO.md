# GST Billing SaaS — Feature TODO

> Update this file as features are completed. Mark `[x]` when done.

---

## ✅ Core MVP (Done)
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

## 🚧 In Progress / Completed

- [x] #4  Custom logo on PDF (upload logo in Settings → appears on every invoice)
- [x] #6  Client portal — shareable public invoice link (`/invoice/[token]`)
- [x] #7  Invoice themes — 2–3 PDF layout choices (classic / minimal / modern)
- [x] #8  Bulk invoice actions (select multiple → mark paid / delete / email)
- [x] #9  Expense tracking (log GST-paid purchases, net liability calculation)
- [x] #10 Recurring invoices (template + frequency → auto-generate monthly)
- [x] #11 Credit notes (issue against a paid invoice for returns/corrections)
- [x] #12 WhatsApp share button (one-click share invoice link via WhatsApp)
- [x] #14 Accountant access (invite CA with read-only role)

---

## 📋 Backlog

- [x] #1  GSTR-1 export (CSV for GST portal filing)
- [x] #2  Analytics charts (revenue trend, top clients, GST breakdown)
- [x] #3  Payment reminders (overdue follow-up emails)
- [ ] #5  UPI QR code on PDF
- [ ] #13 Multi-currency billing (USD/EUR + INR equivalent)
- [ ] Razorpay subscription billing
- [ ] Vercel deployment
- [ ] Custom email domain (Resend verified domain)
- [ ] Sentry error monitoring

---

## AI Instruction
> Whenever a new feature is implemented, update this file (mark `[x]`) AND update `FEATURES.md` with the new capability in the appropriate section. Keep FEATURES.md language benefit-focused and non-technical.



what other features can be added that can make the business demand this app as much as possible?
what other great features will be needed?