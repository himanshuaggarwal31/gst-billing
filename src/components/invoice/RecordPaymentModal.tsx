"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export type InvoicePayment = {
  id: string; invoice_id: string; amount: number; payment_date: string;
  method: string; reference_number: string | null; notes: string | null;
  recorded_by_email: string | null; created_at: string;
};

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank Transfer / NEFT",
  upi: "UPI",
  cheque: "Cheque / DD",
  cash: "Cash",
  card: "Card",
  other: "Other",
};

const METHOD_ICONS: Record<string, string> = {
  bank_transfer: "🏦", upi: "📱", cheque: "📝", cash: "💵", card: "💳", other: "🔖",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

interface RecordPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: { id: string; invoice_number: string; total_amount: number };
  onSuccess: () => void;
}

export function RecordPaymentModal({ open, onOpenChange, invoice, onSuccess }: RecordPaymentModalProps) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    amount: "", payment_date: today, method: "bank_transfer",
    reference_number: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPayments([]);
    setLoadingHistory(true);
    fetch(`/api/invoices/${invoice.id}/payments`)
      .then((r) => r.json())
      .then((json) => { if (json.data) setPayments(json.data); })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [open, invoice.id]);

  useEffect(() => {
    if (loadingHistory) return;
    const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
    const outstanding = Math.max(0, invoice.total_amount - paid);
    setForm((f) => ({ ...f, amount: outstanding > 0 ? String(outstanding) : "" }));
  }, [payments, loadingHistory, invoice.total_amount]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amt, payment_date: form.payment_date, method: form.method,
        reference_number: form.reference_number || null, notes: form.notes || null,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.error) toast.error(json.error.message);
    else {
      toast.success(`Payment of ${fmt(amt)} recorded`);
      onSuccess();
      onOpenChange(false);
    }
  }

  async function handleDelete(paymentId: string) {
    setRemovingId(paymentId);
    const res = await fetch(`/api/invoices/${invoice.id}/payments?payment_id=${paymentId}`, { method: "DELETE" });
    const json = await res.json();
    setRemovingId(null);
    if (json.error) toast.error(json.error.message);
    else {
      setPayments((prev) => prev.filter((p) => p.id !== paymentId));
      toast.success("Payment entry removed");
      onSuccess();
    }
  }

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = invoice.total_amount - totalPaid;
  const paidPct = Math.min(100, (totalPaid / invoice.total_amount) * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        {/* ── Header / Invoice summary ── */}
        <div className="bg-gray-900 text-white px-6 py-5">
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-semibold">
              Record Payment
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-sm mt-0.5">
              Invoice #{invoice.invoice_number}
            </DialogDescription>
          </DialogHeader>

          {/* Amount cards */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="rounded-lg bg-white/10 px-3 py-2.5 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Invoice Total</p>
              <p className="text-sm font-bold mt-0.5 tabular-nums">{fmt(invoice.total_amount)}</p>
            </div>
            <div className="rounded-lg bg-emerald-500/20 px-3 py-2.5 text-center">
              <p className="text-[10px] text-emerald-300 uppercase tracking-wide">Paid</p>
              <p className="text-sm font-bold text-emerald-300 mt-0.5 tabular-nums">{fmt(totalPaid)}</p>
            </div>
            <div className={`rounded-lg px-3 py-2.5 text-center ${outstanding > 0 ? "bg-amber-500/20" : "bg-emerald-500/20"}`}>
              <p className={`text-[10px] uppercase tracking-wide ${outstanding > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                Outstanding
              </p>
              <p className={`text-sm font-bold mt-0.5 tabular-nums ${outstanding > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                {fmt(Math.max(0, outstanding))}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all duration-500"
              style={{ width: `${paidPct}%` }}
            />
          </div>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[60vh]">
          {/* ── Payment history ── */}
          {loadingHistory && (
            <p className="text-sm text-muted-foreground text-center py-2">Loading history…</p>
          )}

          {!loadingHistory && payments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Payment History
              </p>
              <div className="rounded-xl border divide-y overflow-hidden">
                {payments.map((p) => (
                  <div key={p.id} className="px-4 py-3 flex items-start justify-between gap-3 bg-white hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="text-xl mt-0.5 shrink-0">{METHOD_ICONS[p.method] ?? "💰"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-bold text-emerald-700 tabular-nums">{fmt(Number(p.amount))}</span>
                          <span className="text-xs text-muted-foreground">{fmtDate(p.payment_date)}</span>
                          <span className="text-[11px] bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                            {METHOD_LABELS[p.method] ?? p.method}
                          </span>
                        </div>
                        {p.reference_number && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Ref: <span className="font-mono text-gray-700">{p.reference_number}</span>
                          </p>
                        )}
                        {p.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.notes}</p>}
                        {p.recorded_by_email && (
                          <p className="text-[11px] text-muted-foreground/60 mt-0.5">by {p.recorded_by_email}</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={removingId === p.id}
                      onClick={() => handleDelete(p.id)}
                      className="text-[11px] text-gray-300 hover:text-red-500 transition-colors shrink-0 mt-1 font-medium"
                    >
                      {removingId === p.id ? "…" : "Remove"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── New payment form ── */}
          <div>
            {payments.length > 0 && (
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Add Another Payment
              </p>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Amount (₹) <span className="text-red-500">*</span></Label>
                  <Input
                    type="number" step="0.01" min="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder={String(invoice.total_amount)}
                    className="tabular-nums font-mono"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Payment Date <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    value={form.payment_date}
                    onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Payment Method</Label>
                <Select value={form.method} onValueChange={(v) => setForm((f) => ({ ...f, method: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(METHOD_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        <span className="mr-2">{METHOD_ICONS[value]}</span>{label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Reference Number
                  <span className="text-xs text-muted-foreground font-normal ml-1.5">UTR, cheque no., UPI ref…</span>
                </Label>
                <Input
                  value={form.reference_number}
                  onChange={(e) => setForm((f) => ({ ...f, reference_number: e.target.value }))}
                  placeholder="e.g. UTR123456789"
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Notes
                  <span className="text-xs text-muted-foreground font-normal ml-1.5">optional</span>
                </Label>
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Partial payment, TDS deducted…"
                  className="resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={saving} className="px-6">
                  {saving ? "Saving…" : "Record Payment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
