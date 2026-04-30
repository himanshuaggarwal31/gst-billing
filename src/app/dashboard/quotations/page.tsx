"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { calculateInvoiceTotals, INDIAN_STATE_CODES, GST_RATES } from "@/lib/gst";
import { HSN_SAC_CODES } from "@/lib/hsn-master";

type Client = { id: string; name: string; state_code: string; email: string | null };
type Product = {
  id: string; name: string; hsn_sac_code: string;
  default_rate: number; default_gst_rate: number;
};
type Quotation = {
  id: string; quote_number: string; quote_date: string;
  valid_until: string | null;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted";
  total_amount: number; total_gst: number; converted_invoice_id: string | null;
  clients: { id: string; name: string; email: string | null; state_code: string };
};
type LineItemForm = {
  description: string; hsn_sac_code: string; quantity: string;
  rate: string; gst_rate: string; discount_percent: string;
};

const EMPTY_LINE: LineItemForm = {
  description: "", hsn_sac_code: "", quantity: "1",
  rate: "", gst_rate: "18", discount_percent: "0",
};

const STATUS_META: Record<string, { color: string; label: string }> = {
  draft:     { color: "bg-gray-100 text-gray-600 border-gray-200",         label: "Draft" },
  sent:      { color: "bg-blue-50 text-blue-700 border-blue-200",          label: "Sent" },
  accepted:  { color: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Accepted" },
  rejected:  { color: "bg-red-50 text-red-600 border-red-200",             label: "Rejected" },
  expired:   { color: "bg-amber-50 text-amber-700 border-amber-200",       label: "Expired" },
  converted: { color: "bg-violet-50 text-violet-700 border-violet-200",    label: "Converted" },
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}
function parseNum(s: string) { const n = parseFloat(s); return isNaN(n) ? 0 : n; }

function LineItemRow({
  line, idx, products, canRemove, onChange, onRemove,
}: {
  line: LineItemForm; idx: number; products: Product[]; canRemove: boolean;
  onChange: (idx: number, field: keyof LineItemForm, value: string) => void;
  onRemove: (idx: number) => void;
}) {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const qty = parseNum(line.quantity), rate = parseNum(line.rate);
  const disc = parseNum(line.discount_percent), gst = parseNum(line.gst_rate);
  const taxable = qty * rate * (1 - disc / 100);
  const lineTotal = taxable * (1 + gst / 100);

  return (
    <div className="rounded-lg border bg-white p-3 space-y-2">
      <div className="flex gap-2 items-start">
        <div className="flex-1 space-y-1">
          {products.length > 0 && (
            catalogOpen ? (
              <div className="flex gap-2 items-center mb-1">
                <select
                  autoFocus
                  className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    const p = products.find((p) => p.id === e.target.value);
                    if (p) {
                      onChange(idx, "description", p.name);
                      onChange(idx, "hsn_sac_code", p.hsn_sac_code);
                      onChange(idx, "rate", String(p.default_rate));
                      onChange(idx, "gst_rate", String(p.default_gst_rate));
                      setCatalogOpen(false);
                    }
                  }}
                >
                  <option value="" disabled>Select from catalog…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ₹{p.default_rate} @ {p.default_gst_rate}% GST
                    </option>
                  ))}
                </select>
                <button type="button" className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setCatalogOpen(false)}>Cancel</button>
              </div>
            ) : (
              <button type="button"
                className="text-[11px] text-blue-600 hover:text-blue-800 font-medium mb-1 flex items-center gap-1"
                onClick={() => setCatalogOpen(true)}>
                📦 Pick from catalog
              </button>
            )
          )}
          <Input value={line.description}
            onChange={(e) => onChange(idx, "description", e.target.value)}
            placeholder="Item / service description" required />
        </div>
        <div className="w-28 space-y-1 shrink-0">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">HSN / SAC</p>
          <Input value={line.hsn_sac_code}
            onChange={(e) => onChange(idx, "hsn_sac_code", e.target.value)}
            placeholder="998314" list="hsn-sac-list-q" className="font-mono text-xs" />
        </div>
        {canRemove && (
          <button type="button" onClick={() => onRemove(idx)}
            className="mt-6 text-gray-300 hover:text-red-500 transition-colors text-xl leading-none shrink-0"
            title="Remove row">×</button>
        )}
      </div>

      <div className="grid grid-cols-5 gap-2 items-end">
        {[
          { label: "Qty", field: "quantity" as const, type: "number", step: "0.001", placeholder: "1" },
          { label: "Rate (₹)", field: "rate" as const, type: "number", step: "0.01", placeholder: "0.00" },
        ].map(({ label, field, type, step, placeholder }) => (
          <div key={field} className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <Input type={type} min="0" step={step} value={line[field]}
              onChange={(e) => onChange(idx, field, e.target.value)}
              placeholder={placeholder} required />
          </div>
        ))}
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">GST %</p>
          <select className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
            value={line.gst_rate} onChange={(e) => onChange(idx, "gst_rate", e.target.value)}>
            {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Disc %</p>
          <Input type="number" min="0" max="100" step="0.1" value={line.discount_percent}
            onChange={(e) => onChange(idx, "discount_percent", e.target.value)} />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Line Total</p>
          <div className="rounded-md bg-gray-50 border border-transparent px-3 py-2 text-sm font-semibold text-right tabular-nums">
            {lineTotal > 0 ? fmt(lineTotal) : <span className="text-muted-foreground font-normal">—</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QuotationsPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [converting, setConverting] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const validUntilDefault = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
  const [header, setHeader] = useState({
    client_id: "", quote_number: "", quote_date: today,
    valid_until: validUntilDefault, seller_state_code: "", notes: "",
  });
  const [lines, setLines] = useState<LineItemForm[]>([{ ...EMPTY_LINE }]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [qRes, cRes, pRes] = await Promise.all([
        fetch("/api/quotations").then((r) => r.json()),
        fetch("/api/clients").then((r) => r.json()),
        fetch("/api/products").then((r) => r.json()),
      ]);
      if (qRes.data) setQuotes(qRes.data);
      if (cRes.data) setClients(cRes.data);
      if (pRes.data) setProducts(pRes.data);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchAll(); }, []);

  async function openNew() {
    const res = await fetch("/api/quotations/next-number").then((r) => r.json());
    setHeader({
      client_id: "", quote_number: res.data?.next_number ?? "QUO-001",
      quote_date: today, valid_until: validUntilDefault, seller_state_code: "", notes: "",
    });
    setLines([{ ...EMPTY_LINE }]);
    setFormOpen(true);
  }

  function set(field: string, value: string) { setHeader((h) => ({ ...h, [field]: value })); }
  function handleLineChange(idx: number, field: keyof LineItemForm, value: string) {
    setLines((prev) => { const n = [...prev]; n[idx] = { ...n[idx], [field]: value }; return n; });
  }

  const selectedClient = clients.find((c) => c.id === header.client_id);
  const totals = useCallback(() => {
    if (!header.seller_state_code || !selectedClient) return null;
    const items = lines
      .map((l) => ({
        description: l.description || "—", hsnSacCode: l.hsn_sac_code || "0000",
        quantity: parseNum(l.quantity), rate: parseNum(l.rate),
        gstRate: parseNum(l.gst_rate), discountPercent: parseNum(l.discount_percent),
      }))
      .filter((i) => i.quantity > 0 && i.rate > 0);
    if (items.length === 0) return null;
    return calculateInvoiceTotals(items, header.seller_state_code, selectedClient.state_code);
  }, [lines, header.seller_state_code, header.client_id, clients])(); // eslint-disable-line react-hooks/exhaustive-deps

  const isInterState = header.seller_state_code && selectedClient
    ? header.seller_state_code !== selectedClient.state_code : false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!totals) { toast.error("Add at least one line item with quantity and rate"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...header,
          valid_until: header.valid_until || null, notes: header.notes || null,
          line_items: lines
            .filter((l) => parseNum(l.quantity) > 0 && parseNum(l.rate) > 0)
            .map((l) => ({
              description: l.description, hsn_sac_code: l.hsn_sac_code,
              quantity: parseNum(l.quantity), rate: parseNum(l.rate),
              gst_rate: parseNum(l.gst_rate), discount_percent: parseNum(l.discount_percent),
            })),
        }),
      });
      const json = await res.json();
      if (json.error) toast.error(json.error.message);
      else { toast.success(`Quotation ${header.quote_number} created`); setFormOpen(false); fetchAll(); }
    } finally { setSubmitting(false); }
  }

  async function updateStatus(id: string, status: Quotation["status"]) {
    const res = await fetch(`/api/quotations/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (json.error) toast.error(json.error.message);
    else { toast.success(`Status updated to ${status}`); fetchAll(); }
  }

  async function convertToInvoice(id: string, quoteNumber: string) {
    if (!confirm(`Convert quotation ${quoteNumber} to a Tax Invoice?`)) return;
    setConverting(id);
    try {
      const res = await fetch(`/api/quotations/${id}/convert`, { method: "POST" });
      const json = await res.json();
      if (json.error) toast.error(json.error.message);
      else { toast.success(`Invoice ${json.data.invoice_number} created`); router.push("/dashboard/invoices"); }
    } finally { setConverting(null); }
  }

  async function deleteQuote(id: string, quoteNumber: string) {
    if (!confirm(`Delete quotation ${quoteNumber}?`)) return;
    const res = await fetch(`/api/quotations/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.error) toast.error(json.error.message);
    else { toast.success("Quotation deleted"); fetchAll(); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Send quotes to clients. Convert accepted ones to a Tax Invoice in one click.
          </p>
        </div>
        <Button onClick={openNew}>+ New Quotation</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : quotes.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <p className="text-4xl">📄</p>
            <p className="font-medium text-gray-700">No quotations yet</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Create a quote for a client. Once they accept, convert it to a Tax Invoice in one click — all line items carry over automatically.
            </p>
            <Button className="mt-2" onClick={openNew}>Create your first quotation</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Quote #</TableHead>
                  <TableHead className="font-semibold">Client</TableHead>
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Valid Until</TableHead>
                  <TableHead className="font-semibold text-right">Amount</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((q) => {
                  const isExpired = q.valid_until && q.status === "sent" && new Date(q.valid_until) < new Date();
                  const meta = STATUS_META[q.status] ?? STATUS_META.draft;
                  return (
                    <TableRow key={q.id} className="hover:bg-gray-50/60">
                      <TableCell className="font-mono font-semibold text-sm">{q.quote_number}</TableCell>
                      <TableCell className="font-medium">{q.clients.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{q.quote_date}</TableCell>
                      <TableCell className={`text-sm ${isExpired ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                        {q.valid_until ?? <span className="text-gray-300">—</span>}
                        {isExpired && <span className="ml-1.5 text-[10px] bg-red-100 text-red-600 rounded px-1 py-0.5">expired</span>}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{fmt(q.total_amount)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.color}`}>
                          {meta.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700">
                              <span className="text-base">⋯</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            {q.status === "accepted" && (
                              <DropdownMenuItem
                                onClick={() => convertToInvoice(q.id, q.quote_number)}
                                disabled={converting === q.id}
                                className="text-emerald-700 font-semibold"
                              >
                                {converting === q.id ? "Converting…" : "→ Convert to Invoice"}
                              </DropdownMenuItem>
                            )}
                            {q.status === "draft" && (
                              <DropdownMenuItem onClick={() => updateStatus(q.id, "sent")}>
                                Mark as Sent
                              </DropdownMenuItem>
                            )}
                            {q.status === "sent" && (<>
                              <DropdownMenuItem onClick={() => updateStatus(q.id, "accepted")}>Mark as Accepted</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(q.id, "rejected")}>Mark as Rejected</DropdownMenuItem>
                            </>)}
                            {q.status === "converted" && q.converted_invoice_id && (
                              <DropdownMenuItem asChild>
                                <Link href="/dashboard/invoices">View Invoice →</Link>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600 focus:text-red-600"
                              onClick={() => deleteQuote(q.id, q.quote_number)}>
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── New Quotation Dialog ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
          <div className="px-6 pt-6 pb-4 border-b bg-gray-50 rounded-t-lg">
            <DialogHeader>
              <DialogTitle className="text-xl">New Quotation</DialogTitle>
              <DialogDescription>
                Fill in the details below. Convert to a Tax Invoice once accepted.
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
            {/* Client + meta */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Client <span className="text-red-500">*</span></Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={header.client_id} onChange={(e) => set("client_id", e.target.value)} required>
                  <option value="">Select client…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.state_code})</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Quote Number <span className="text-red-500">*</span></Label>
                <Input value={header.quote_number} onChange={(e) => set("quote_number", e.target.value)}
                  placeholder="QUO-001" className="font-mono" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Quote Date <span className="text-red-500">*</span></Label>
                <Input type="date" value={header.quote_date} onChange={(e) => set("quote_date", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Valid Until</Label>
                <Input type="date" value={header.valid_until} onChange={(e) => set("valid_until", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Your State (seller) <span className="text-red-500">*</span></Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={header.seller_state_code} onChange={(e) => set("seller_state_code", e.target.value)} required>
                  <option value="">Select state…</option>
                  {Object.entries(INDIAN_STATE_CODES).map(([code, name]) => (
                    <option key={code} value={code}>{code} — {name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                {selectedClient && header.seller_state_code ? (
                  <div className={`w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold ${
                    isInterState
                      ? "bg-orange-50 text-orange-700 border border-orange-200"
                      : "bg-green-50 text-green-700 border border-green-200"
                  }`}>
                    {isInterState ? "⚡ Inter-state — IGST applies" : "✓ Intra-state — CGST + SGST"}
                  </div>
                ) : (
                  <div className="w-full rounded-lg px-4 py-2.5 text-center text-xs text-muted-foreground border border-dashed">
                    Select client + state to see GST type
                  </div>
                )}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-sm font-medium">Notes</Label>
                <Textarea value={header.notes} onChange={(e) => set("notes", e.target.value)}
                  rows={2} placeholder="Validity terms, payment terms, scope of work, etc." className="resize-none" />
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Line Items</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => setLines((p) => [...p, { ...EMPTY_LINE }])}>
                  + Add Row
                </Button>
              </div>
              <div className="space-y-2">
                {lines.map((line, idx) => (
                  <LineItemRow key={idx} line={line} idx={idx} products={products}
                    canRemove={lines.length > 1} onChange={handleLineChange}
                    onRemove={(i) => setLines((p) => p.filter((_, j) => j !== i))} />
                ))}
              </div>
            </div>

            {/* Totals */}
            {totals && (
              <div className="rounded-xl bg-gray-50 border p-4">
                <div className="flex justify-end">
                  <div className="space-y-2 text-sm min-w-72">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Taxable Amount</span>
                      <span className="tabular-nums">{fmt(totals.summary.taxableAmount)}</span>
                    </div>
                    {totals.summary.totalCgst > 0 && (<>
                      <div className="flex justify-between text-muted-foreground">
                        <span>CGST</span><span className="tabular-nums">{fmt(totals.summary.totalCgst)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>SGST</span><span className="tabular-nums">{fmt(totals.summary.totalSgst)}</span>
                      </div>
                    </>)}
                    {totals.summary.totalIgst > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>IGST</span><span className="tabular-nums">{fmt(totals.summary.totalIgst)}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 flex justify-between font-bold text-base text-gray-900">
                      <span>Total</span>
                      <span className="tabular-nums">{fmt(totals.summary.totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-1 border-t">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="px-6">
                {submitting ? "Saving…" : "Save Quotation"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <datalist id="hsn-sac-list-q">
        {HSN_SAC_CODES.map((entry) => (
          <option key={entry.code} value={entry.code}>{entry.description} ({entry.gstRate}% GST)</option>
        ))}
      </datalist>
    </div>
  );
}
