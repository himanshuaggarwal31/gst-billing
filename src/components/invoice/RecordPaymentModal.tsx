"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent,
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
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
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
  const outstanding = Math.max(0, invoice.total_amount - totalPaid);
  const paidPct = Math.min(100, invoice.total_amount > 0 ? (totalPaid / invoice.total_amount) * 100 : 0);
  const isFullyPaid = outstanding === 0 && totalPaid > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 overflow-hidden gap-0">
        <div className="flex min-h-0">

          {/* ── Left sidebar: invoice summary ── */}
          <div className="w-56 shrink-0 bg-slate-50 border-r flex flex-col p-5 gap-5">
            {/* Invoice badge */}
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Invoice</span>
              <p className="text-base font-bold text-slate-800 mt-0.5">#{invoice.invoice_number}</p>
            </div>

            {/* Amounts */}
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Invoice Total</p>
                <p className="text-xl font-bold text-slate-800 tabular-nums">{fmt(invoice.total_amount)}</p>
              </div>
              <div className="h-px bg-slate-200" />
              <div>
                <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-widest mb-0.5">Paid</p>
                <p className="text-lg font-bold text-emerald-600 tabular-nums">{fmt(totalPaid)}</p>
              </div>
              <div>
                <p className={`text-[10px] font-semibold uppercase tracking-widest mb-0.5 ${outstanding > 0 ? "text-amber-500" : "text-emerald-500"}`}>
                  Outstanding
                </p>
                <p className={`text-lg font-bold tabular-nums ${outstanding > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  {fmt(outstanding)}
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-1.5 mt-auto">
              <div className="flex justify-between text-[10px] font-medium text-slate-400">
                <span>Collected</span>
                <span>{Math.round(paidPct)}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isFullyPaid ? "bg-emerald-500" : "bg-blue-500"}`}
                  style={{ width: `${paidPct}%` }}
                />
              </div>
              {isFullyPaid && (
                <p className="text-[11px] text-emerald-600 font-semibold text-center mt-1">✓ Fully paid</p>
              )}
            </div>
          </div>

          {/* ── Right: history + form ── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Modal title */}
            <div className="px-6 pt-5 pb-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {payments.length > 0 ? "Add another payment or view history below." : "Enter the payment details below."}
              </p>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Payment history */}
              {loadingHistory && (
                <p className="text-sm text-muted-foreground py-2">Loading history…</p>
              )}

              {!loadingHistory && payments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Payment History ({payments.length})
                  </p>
                  <div className="rounded-lg border divide-y">
                    {payments.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group">
                        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-base shrink-0">
                          {METHOD_ICONS[p.method] ?? "💰"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-gray-900 tabular-nums">{fmt(Number(p.amount))}</span>
                            <span className="text-xs text-muted-foreground">{fmtDate(p.payment_date)}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-500 rounded-full px-2 py-0.5 font-medium">
                              {METHOD_LABELS[p.method] ?? p.method}
                            </span>
                          </div>
                          {(p.reference_number || p.notes) && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {p.reference_number && <span className="font-mono mr-2">{p.reference_number}</span>}
                              {p.notes}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={removingId === p.id}
                          onClick={() => handleDelete(p.id)}
                          className="text-xs text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 font-medium shrink-0"
                        >
                          {removingId === p.id ? "…" : "Remove"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New payment form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {payments.length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New payment</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      Amount (₹) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="number" step="0.01" min="0.01"
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="0.00"
                      className="font-mono text-base h-10"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      Payment Date <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={form.payment_date}
                      onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
                      className="h-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Payment Method</Label>
                  <Select value={form.method} onValueChange={(v) => setForm((f) => ({ ...f, method: v }))}>
                    <SelectTrigger className="h-10">
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      Reference No.
                      <span className="text-xs text-muted-foreground font-normal ml-1">UTR / cheque / UPI</span>
                    </Label>
                    <Input
                      value={form.reference_number}
                      onChange={(e) => setForm((f) => ({ ...f, reference_number: e.target.value }))}
                      placeholder="e.g. UTR123456789"
                      className="font-mono h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      Notes
                      <span className="text-xs text-muted-foreground font-normal ml-1">optional</span>
                    </Label>
                    <Input
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="e.g. Partial payment, TDS deducted"
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="text-sm text-muted-foreground hover:text-gray-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <Button type="submit" disabled={saving} className="px-8 h-10">
                    {saving ? "Saving…" : "Record Payment"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
