"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { calculateInvoiceTotals, INDIAN_STATE_CODES, GST_RATES, stateLabel } from "@/lib/gst";
import { HSN_SAC_CODES } from "@/lib/hsn-master";
import type { Client } from "@/components/clients/ClientFormDialog";
import type { Product } from "@/components/products/ProductFormDialog";

type LineItemForm = {
  description: string;
  hsn_sac_code: string;
  quantity: string;
  rate: string;
  gst_rate: string;
  discount_percent: string;
};

const EMPTY_LINE: LineItemForm = {
  description: "",
  hsn_sac_code: "",
  quantity: "1",
  rate: "",
  gst_rate: "18",
  discount_percent: "0",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(n);
}

function parseNum(s: string) {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export type InvoiceFormInitialData = {
  id: string;
  client_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  seller_state_code: string;
  notes: string | null;
  theme?: string | null;
  invoice_line_items: Array<{
    description: string;
    hsn_sac_code: string;
    quantity: number;
    rate: number;
    gst_rate: number;
    discount_percent: number;
  }>;
};

type Props = {
  initialData?: InvoiceFormInitialData;
};

export default function InvoiceForm({ initialData }: Props) {
  const router = useRouter();
  const isEdit = !!initialData;
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingNumber, setLoadingNumber] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState<number | null>(null); // row index

  const today = new Date().toISOString().split("T")[0];

  const [header, setHeader] = useState({
    client_id: initialData?.client_id ?? "",
    invoice_number: initialData?.invoice_number ?? "",
    invoice_date: initialData?.invoice_date ?? today,
    due_date: initialData?.due_date ?? "",
    seller_state_code: initialData?.seller_state_code ?? "",
    notes: initialData?.notes ?? "",
    theme: initialData?.theme ?? "classic",
  });

  const [lines, setLines] = useState<LineItemForm[]>(
    initialData?.invoice_line_items?.length
      ? initialData.invoice_line_items.map((item) => ({
          description: item.description,
          hsn_sac_code: item.hsn_sac_code,
          quantity: String(item.quantity),
          rate: String(item.rate),
          gst_rate: String(item.gst_rate),
          discount_percent: String(item.discount_percent),
        }))
      : [{ ...EMPTY_LINE }]
  );

  async function fetchNextNumber() {
    setLoadingNumber(true);
    try {
      const res = await fetch("/api/invoices/next-number");
      const json = await res.json();
      if (json.data?.next_number) {
        setHeader((h) => ({ ...h, invoice_number: json.data.next_number }));
      }
    } finally {
      setLoadingNumber(false);
    }
  }

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((j) => j.data && setClients(j.data));
    fetch("/api/products")
      .then((r) => r.json())
      .then((j) => j.data && setProducts(j.data));
    if (!isEdit) {
      fetchNextNumber();
      fetch("/api/profile")
        .then((r) => r.json())
        .then((j) => {
          if (j.data?.state_code) {
            setHeader((h) => ({ ...h, seller_state_code: h.seller_state_code || j.data.state_code }));
          }
          if (j.data?.pdf_theme && !(initialData as InvoiceFormInitialData | undefined)?.theme) {
            setHeader((h) => ({ ...h, theme: j.data.pdf_theme }));
          }
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyProduct(idx: number, product: Product) {
    setLines((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        description: product.name,
        hsn_sac_code: product.hsn_sac_code,
        rate: String(product.default_rate),
        gst_rate: String(product.default_gst_rate),
      };
      return next;
    });
    setCatalogOpen(null);
  }

  function set(field: string, value: string) {
    setHeader((h) => ({ ...h, [field]: value }));
  }

  function setLine(idx: number, field: keyof LineItemForm, value: string) {
    setLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  const preview = useCallback(() => {
    const selectedClient = clients.find((c) => c.id === header.client_id);
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
  }, [lines, header.seller_state_code, header.client_id, clients]);

  const totals = preview();
  const selectedClient = clients.find((c) => c.id === header.client_id);
  const isInterState =
    header.seller_state_code && selectedClient
      ? header.seller_state_code.trim() !== selectedClient.state_code.trim()
      : false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!totals) {
      toast.error("Add at least one line item with quantity and rate");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...header,
        due_date: header.due_date || null,
        notes: header.notes || null,
        theme: header.theme || "classic",
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
      };

      const url = isEdit ? `/api/invoices/${initialData!.id}` : "/api/invoices";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error.message);
      } else {
        toast.success(isEdit ? "Invoice updated" : `Invoice #${header.invoice_number} created`);
        router.push("/dashboard/invoices");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {isEdit ? `Edit Invoice #${initialData!.invoice_number}` : "New Invoice"}
        </h1>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/dashboard/invoices")}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : isEdit ? "Save Changes" : "Save Invoice"}
          </Button>
        </div>
      </div>

      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
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
                <option key={c.id} value={c.id}>
                  {c.name} ({c.state_code.trim() ? stateLabel(c.state_code.trim()) : "no state"})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label>Invoice Number *</Label>
            <div className="flex gap-2">
              <Input
                value={header.invoice_number}
                onChange={(e) => set("invoice_number", e.target.value)}
                placeholder="INV-001"
                required
                className="flex-1"
              />
              {!isEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fetchNextNumber}
                  disabled={loadingNumber}
                  title="Suggest next number"
                  className="shrink-0"
                >
                  {loadingNumber ? "…" : "↻"}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Invoice Date *</Label>
            <Input
              type="date"
              value={header.invoice_date}
              onChange={(e) => set("invoice_date", e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <Label>Due Date</Label>
            <Input
              type="date"
              value={header.due_date ?? ""}
              onChange={(e) => set("due_date", e.target.value)}
            />
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
              {Object.entries(INDIAN_STATE_CODES).map(([code]) => (
                <option key={code} value={code}>{stateLabel(code)}</option>
              ))}
            </select>
          </div>

          {selectedClient && header.seller_state_code && (
            <div className="flex items-end pb-1">
              <span
                className={`text-sm font-medium px-3 py-1 rounded-full ${
                  isInterState ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"
                }`}
              >
                {isInterState ? "Inter-state → IGST" : "Intra-state → CGST + SGST"}
              </span>
            </div>
          )}

          <div className="col-span-2 space-y-1">
            <Label>Notes</Label>
            <Textarea
              value={header.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              placeholder="Payment terms, bank details, etc."
            />
          </div>

          <div className="col-span-2 space-y-1">
            <details>
              <summary className="cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 w-fit">
                ⚙ PDF Theme: <span className="font-medium capitalize ml-1">{header.theme}</span>
              </summary>
              <div className="mt-2 flex gap-3">
                {(["classic", "minimal", "modern"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("theme", t)}
                    className={`flex-1 rounded-lg border-2 py-2 text-sm font-medium capitalize transition-colors ${
                      header.theme === t
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </details>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Line Items</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            + Add Row
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
            <div className="col-span-3">Description *</div>
            <div className="col-span-2">HSN/SAC *</div>
            <div className="col-span-1">Qty *</div>
            <div className="col-span-2">Rate (₹) *</div>
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
                {/* Catalog picker — shown only when products exist */}
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs shrink-0"
                          onClick={() => setCatalogOpen(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2"
                        onClick={() => setCatalogOpen(idx)}
                      >
                        📦 Pick from catalog
                      </button>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3">
                    <Input
                      value={line.description}
                      onChange={(e) => setLine(idx, "description", e.target.value)}
                      placeholder="Item description"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      value={line.hsn_sac_code}
                      onChange={(e) => setLine(idx, "hsn_sac_code", e.target.value)}
                      placeholder="998314"
                      list="hsn-sac-list"
                      required
                    />
                  </div>
                  <div className="col-span-1">
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={line.quantity}
                      onChange={(e) => setLine(idx, "quantity", String(Math.floor(Math.max(1, Number(e.target.value)))))}
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.rate}
                      onChange={(e) => setLine(idx, "rate", e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-span-1">
                    <select
                      className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                      value={line.gst_rate}
                      onChange={(e) => setLine(idx, "gst_rate", e.target.value)}
                    >
                      {GST_RATES.map((r) => (
                        <option key={r} value={r}>{r}%</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={line.discount_percent}
                      onChange={(e) => setLine(idx, "discount_percent", e.target.value)}
                    />
                  </div>
                  <div className="col-span-1 text-right text-sm font-medium">
                    {lineTotal > 0 ? fmt(lineTotal) : "—"}
                  </div>
                  <div className="col-span-1 text-center">
                    {lines.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive px-2"
                        onClick={() => removeLine(idx)}
                      >
                        ✕
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Totals */}
      {totals && (
        <Card>
          <CardContent className="pt-6">
            <div className="ml-auto max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxable Amount</span>
                <span>{fmt(totals.summary.taxableAmount)}</span>
              </div>
              {isInterState ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IGST</span>
                  <span>{fmt(totals.summary.igst)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CGST</span>
                    <span>{fmt(totals.summary.cgst)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SGST</span>
                    <span>{fmt(totals.summary.sgst)}</span>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span>{fmt(totals.summary.totalAmount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* HSN/SAC autocomplete datalist */}
      <datalist id="hsn-sac-list">
        {HSN_SAC_CODES.map((entry) => (
          <option key={entry.code} value={entry.code}>
            {entry.description} ({entry.gstRate}% GST)
          </option>
        ))}
      </datalist>
    </form>
  );
}
