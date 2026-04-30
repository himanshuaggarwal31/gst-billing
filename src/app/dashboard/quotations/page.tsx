"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { calculateInvoiceTotals, INDIAN_STATE_CODES, GST_RATES } from "@/lib/gst";
import { HSN_SAC_CODES } from "@/lib/hsn-master";

type Client = { id: string; name: string; state_code: string; email: string | null };
type Product = {
  id: string; name: string; hsn_sac_code: string;
  default_rate: number; default_gst_rate: number;
};

type Quotation = {
  id: string;
  quote_number: string;
  quote_date: string;
  valid_until: string | null;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted";
  total_amount: number;
  total_gst: number;
  converted_invoice_id: string | null;
  clients: { id: string; name: string; email: string | null; state_code: string };
};

type LineItemForm = {
  description: string;
  hsn_sac_code: string;
  quantity: string;
  rate: string;
  gst_rate: string;
  discount_percent: string;
};

const EMPTY_LINE: LineItemForm = {
  description: "", hsn_sac_code: "", quantity: "1",
  rate: "", gst_rate: "18", discount_percent: "0",
};

const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-600",
  sent:      "bg-blue-100 text-blue-700",
  accepted:  "bg-emerald-100 text-emerald-700",
  rejected:  "bg-red-100 text-red-700",
  expired:   "bg-amber-100 text-amber-700",
  converted: "bg-purple-100 text-purple-700",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
}
function parseNum(s: string) { const n = parseFloat(s); return isNaN(n) ? 0 : n; }

export default function QuotationsPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [converting, setConverting] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState<number | null>(null);

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
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  async function openNew() {
    const res = await fetch("/api/quotations/next-number").then((r) => r.json());
    setHeader({
      client_id: "", quote_number: res.data?.next_number ?? "QUO-001",
      quote_date: today, valid_until: validUntilDefault,
      seller_state_code: "", notes: "",
    });
    setLines([{ ...EMPTY_LINE }]);
    setFormOpen(true);
  }

  function set(field: string, value: string) { setHeader((h) => ({ ...h, [field]: value })); }
  function setLine(idx: number, field: keyof LineItemForm, value: string) {
    setLines((prev) => { const n = [...prev]; n[idx] = { ...n[idx], [field]: value }; return n; });
  }
  function addLine() { setLines((prev) => [...prev, { ...EMPTY_LINE }]); }
  function removeLine(idx: number) { setLines((prev) => prev.filter((_, i) => i !== idx)); }

  function applyProduct(idx: number, product: Product) {
    setLines((prev) => {
      const n = [...prev];
      n[idx] = {
        ...n[idx],
        description: product.name,
        hsn_sac_code: product.hsn_sac_code,
        rate: String(product.default_rate),
        gst_rate: String(product.default_gst_rate),
      };
      return n;
    });
    setCatalogOpen(null);
  }

  const selectedClient = clients.find((c) => c.id === header.client_id);
  const totals = useCallback(() => {
    if (!header.seller_state_code || !selectedClient) return null;
    const items = lines
      .map((l) => ({
        description: l.description || "—",
        hsnSacCode: l.hsn_sac_code || "0000",
        quantity: parseNum(l.quantity),
        rate: parseNum(l.rate),
        gstRate: parseNum(l.gst_rate),
        discountPercent: parseNum(l.discount_percent),
      }))
      .filter((i) => i.quantity > 0 && i.rate > 0);
    if (items.length === 0) return null;
    return calculateInvoiceTotals(items, header.seller_state_code, selectedClient.state_code);
  }, [lines, header.seller_state_code, header.client_id, clients])(); // eslint-disable-line react-hooks/exhaustive-deps

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
          valid_until: header.valid_until || null,
          notes: header.notes || null,
          line_items: lines
            .filter((l) => parseNum(l.quantity) > 0 && parseNum(l.rate) > 0)
            .map((l) => ({
              description: l.description,
              hsn_sac_code: l.hsn_sac_code,
              quantity: parseNum(l.quantity),
              rate: parseNum(l.rate),
              gst_rate: parseNum(l.gst_rate),
              discount_percent: parseNum(l.discount_percent),
            })),
        }),
      });
      const json = await res.json();
      if (json.error) { toast.error(json.error.message); }
      else {
        toast.success(`Quotation ${header.quote_number} created`);
        setFormOpen(false);
        fetchAll();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(id: string, status: Quotation["status"]) {
    const res = await fetch(`/api/quotations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
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
      if (json.error) { toast.error(json.error.message); }
      else {
        toast.success(`Invoice ${json.data.invoice_number} created`);
        router.push("/dashboard/invoices");
      }
    } finally {
      setConverting(null);
    }
  }

  async function deleteQuote(id: string, quoteNumber: string) {
    if (!confirm(`Delete quotation ${quoteNumber}?`)) return;
    const res = await fetch(`/api/quotations/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.error) toast.error(json.error.message);
    else { toast.success("Quotation deleted"); fetchAll(); }
  }

  const isInterState = header.seller_state_code && selectedClient
    ? header.seller_state_code !== selectedClient.state_code : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create quotes for clients and convert accepted ones to Tax Invoices with one click.
          </p>
        </div>
        <Button onClick={openNew}>+ New Quotation</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : quotes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No quotations yet.</p>
            <Button className="mt-4" onClick={openNew}>Create your first quotation</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((q) => {
                  const expired =
                    q.valid_until &&
                    q.status === "sent" &&
                    new Date(q.valid_until) < new Date();
                  return (
                    <TableRow key={q.id}>
                      <TableCell className="font-mono font-medium">{q.quote_number}</TableCell>
                      <TableCell>{q.clients.name}</TableCell>
                      <TableCell>{q.quote_date}</TableCell>
                      <TableCell className={expired ? "text-red-500 font-medium" : ""}>
                        {q.valid_until ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{fmt(q.total_amount)}</TableCell>
                      <TableCell>
                        <Badge className={`${STATUS_COLORS[q.status]} text-xs capitalize`}>
                          {q.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">⋯</Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {q.status !== "converted" && (
                              <>
                                {q.status === "accepted" && (
                                  <DropdownMenuItem
                                    onClick={() => convertToInvoice(q.id, q.quote_number)}
                                    disabled={converting === q.id}
                                    className="text-emerald-700 font-medium"
                                  >
                                    {converting === q.id ? "Converting…" : "→ Convert to Invoice"}
                                  </DropdownMenuItem>
                                )}
                                {q.status === "draft" && (
                                  <DropdownMenuItem onClick={() => updateStatus(q.id, "sent")}>
                                    Mark as Sent
                                  </DropdownMenuItem>
                                )}
                                {q.status === "sent" && (
                                  <>
                                    <DropdownMenuItem onClick={() => updateStatus(q.id, "accepted")}>
                                      Mark as Accepted
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => updateStatus(q.id, "rejected")}>
                                      Mark as Rejected
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuSeparator />
                              </>
                            )}
                            {q.status === "converted" && q.converted_invoice_id && (
                              <>
                                <DropdownMenuItem asChild>
                                  <Link href="/dashboard/invoices">View Invoice</Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => deleteQuote(q.id, q.quote_number)}
                            >
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

      {/* New Quotation Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Quotation</DialogTitle>
            <DialogDescription>
              Create a quotation for a client. Convert it to a Tax Invoice once accepted.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Client *</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={header.client_id}
                  onChange={(e) => set("client_id", e.target.value)}
                  required
                >
                  <option value="">Select client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.state_code})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label>Quote Number *</Label>
                <Input
                  value={header.quote_number}
                  onChange={(e) => set("quote_number", e.target.value)}
                  placeholder="QUO-001"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label>Quote Date *</Label>
                <Input type="date" value={header.quote_date}
                  onChange={(e) => set("quote_date", e.target.value)} required />
              </div>

              <div className="space-y-1">
                <Label>Valid Until</Label>
                <Input type="date" value={header.valid_until}
                  onChange={(e) => set("valid_until", e.target.value)} />
              </div>

              <div className="space-y-1">
                <Label>Your State Code * (seller)</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={header.seller_state_code}
                  onChange={(e) => set("seller_state_code", e.target.value)}
                  required
                >
                  <option value="">Select state…</option>
                  {Object.entries(INDIAN_STATE_CODES).map(([code, name]) => (
                    <option key={code} value={code}>{code} — {name}</option>
                  ))}
                </select>
              </div>

              {selectedClient && header.seller_state_code && (
                <div className="flex items-end pb-1">
                  <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                    isInterState ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"
                  }`}>
                    {isInterState ? "Inter-state → IGST" : "Intra-state → CGST + SGST"}
                  </span>
                </div>
              )}

              <div className="col-span-2 space-y-1">
                <Label>Notes</Label>
                <Textarea value={header.notes} onChange={(e) => set("notes", e.target.value)}
                  rows={2} placeholder="Validity terms, payment terms, etc." />
              </div>
            </div>

            <Separator />

            {/* Line items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">Line Items</h3>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>+ Add Row</Button>
              </div>

              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                <div className="col-span-3">Description *</div>
                <div className="col-span-2">HSN/SAC</div>
                <div className="col-span-1">Qty</div>
                <div className="col-span-2">Rate (₹)</div>
                <div className="col-span-1">GST%</div>
                <div className="col-span-1">Disc%</div>
                <div className="col-span-1 text-right">Total</div>
                <div className="col-span-1"></div>
              </div>

              {lines.map((line, idx) => {
                const qty = parseNum(line.quantity);
                const rate = parseNum(line.rate);
                const disc = parseNum(line.discount_percent);
                const gst = parseNum(line.gst_rate);
                const taxable = qty * rate * (1 - disc / 100);
                const lineTotal = taxable + (taxable * gst) / 100;

                return (
                  <div key={idx} className="space-y-1">
                    {products.length > 0 && (
                      <div className="flex items-center gap-2">
                        {catalogOpen === idx ? (
                          <>
                            <select
                              autoFocus
                              className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                              defaultValue=""
                              onChange={(e) => {
                                const p = products.find((p) => p.id === e.target.value);
                                if (p) applyProduct(idx, p);
                              }}
                            >
                              <option value="" disabled>Select from catalog…</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} — ₹{p.default_rate} @ {p.default_gst_rate}% GST
                                </option>
                              ))}
                            </select>
                            <Button type="button" variant="ghost" size="sm"
                              className="text-xs" onClick={() => setCatalogOpen(null)}>Cancel</Button>
                          </>
                        ) : (
                          <button type="button"
                            className="text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2"
                            onClick={() => setCatalogOpen(idx)}>
                            📦 Pick from catalog
                          </button>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-3">
                        <Input value={line.description}
                          onChange={(e) => setLine(idx, "description", e.target.value)}
                          placeholder="Item description" required />
                      </div>
                      <div className="col-span-2">
                        <Input value={line.hsn_sac_code}
                          onChange={(e) => setLine(idx, "hsn_sac_code", e.target.value)}
                          placeholder="998314" list="hsn-sac-list-q" />
                      </div>
                      <div className="col-span-1">
                        <Input type="number" min="0" step="0.001" value={line.quantity}
                          onChange={(e) => setLine(idx, "quantity", e.target.value)} required />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" min="0" step="0.01" value={line.rate}
                          onChange={(e) => setLine(idx, "rate", e.target.value)} required />
                      </div>
                      <div className="col-span-1">
                        <select className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                          value={line.gst_rate} onChange={(e) => setLine(idx, "gst_rate", e.target.value)}>
                          {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </div>
                      <div className="col-span-1">
                        <Input type="number" min="0" max="100" step="0.1" value={line.discount_percent}
                          onChange={(e) => setLine(idx, "discount_percent", e.target.value)} />
                      </div>
                      <div className="col-span-1 text-right text-sm font-medium">
                        {lineTotal > 0 ? fmt(lineTotal) : "—"}
                      </div>
                      <div className="col-span-1 text-right">
                        {lines.length > 1 && (
                          <Button type="button" variant="ghost" size="sm"
                            className="text-red-500 h-7 w-7 p-0" onClick={() => removeLine(idx)}>×</Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {totals && (
              <>
                <Separator />
                <div className="flex justify-end">
                  <div className="space-y-1.5 text-sm min-w-64">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Taxable Amount</span>
                      <span>{fmt(totals.summary.taxableAmount)}</span>
                    </div>
                    {totals.summary.totalCgst > 0 && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">CGST</span>
                          <span>{fmt(totals.summary.totalCgst)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">SGST</span>
                          <span>{fmt(totals.summary.totalSgst)}</span>
                        </div>
                      </>
                    )}
                    {totals.summary.totalIgst > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">IGST</span>
                        <span>{fmt(totals.summary.totalIgst)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold text-base">
                      <span>Total</span>
                      <span>{fmt(totals.summary.totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Save Quotation"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <datalist id="hsn-sac-list-q">
        {HSN_SAC_CODES.map((entry) => (
          <option key={entry.code} value={entry.code}>
            {entry.description} ({entry.gstRate}% GST)
          </option>
        ))}
      </datalist>
    </div>
  );
}
