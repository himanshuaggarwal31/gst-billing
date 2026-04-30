"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type InvoicePayment = {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  method: string;
  reference_number: string | null;
  notes: string | null;
  recorded_by_email: string | null;
  created_at: string;
};

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank Transfer / NEFT / RTGS",
  upi: "UPI",
  cheque: "Cheque / DD",
  cash: "Cash",
  card: "Card",
  other: "Other",
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
  invoice: {
    id: string;
    invoice_number: string;
    total_amount: number;
  };
  onSuccess: () => void;
}

export function RecordPaymentModal({ open, onOpenChange, invoice, onSuccess }: RecordPaymentModalProps) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    amount: "",
    payment_date: today,
    method: "bank_transfer",
    reference_number: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load payment history whenever modal opens
  useEffect(() => {
    if (!open) return;
    setPayments([]);
    setLoadingHistory(true);
    fetch(`/api/invoices/${invoice.id}/payments`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setPayments(json.data);
        setLoadingHistory(false);
      })
      .catch(() => setLoadingHistory(false));
  }, [open, invoice.id]);

  // Once payments load, default amount to outstanding balance
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
        amount: amt,
        payment_date: form.payment_date,
        method: form.method,
        reference_number: form.reference_number || null,
        notes: form.notes || null,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.error) {
      toast.error(json.error.message);
    } else {
      toast.success(`Payment of ${fmt(amt)} recorded`);
      onSuccess();
      onOpenChange(false);
    }
  }

  async function handleDeletePayment(paymentId: string) {
    const res = await fetch(`/api/invoices/${invoice.id}/payments?payment_id=${paymentId}`, { method: "DELETE" });
    const json = await res.json();
    if (json.error) {
      toast.error(json.error.message);
    } else {
      setPayments((prev) => prev.filter((p) => p.id !== paymentId));
      toast.success("Payment entry removed");
      onSuccess();
    }
  }

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = invoice.total_amount - totalPaid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Payment — Invoice #{invoice.invoice_number}</DialogTitle>
          <DialogDescription>
            Record one or more payment transactions. Invoice status updates automatically.
          </DialogDescription>
        </DialogHeader>

        {/* Payment history */}
        {loadingHistory && <p className="text-sm text-muted-foreground">Loading history…</p>}
        {!loadingHistory && payments.length > 0 && (
          <div className="rounded-lg border bg-muted/30 divide-y text-sm">
            <div className="px-3 py-2 flex justify-between font-medium text-xs uppercase text-muted-foreground tracking-wide">
              <span>Payment History</span>
              <span>Total: {fmt(invoice.total_amount)}</span>
            </div>
            {payments.map((p) => (
              <div key={p.id} className="px-3 py-2 flex items-start justify-between gap-2">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-emerald-700">{fmt(Number(p.amount))}</span>
                    <span className="text-muted-foreground">{fmtDate(p.payment_date)}</span>
                    <span className="bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 text-xs">{METHOD_LABELS[p.method] ?? p.method}</span>
                  </div>
                  {p.reference_number && (
                    <p className="text-xs text-muted-foreground">Ref: <span className="font-mono text-foreground">{p.reference_number}</span></p>
                  )}
                  {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
                  {p.recorded_by_email && <p className="text-xs text-muted-foreground/60">Recorded by {p.recorded_by_email}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeletePayment(p.id)}
                  className="text-xs text-red-400 hover:text-red-600 shrink-0 mt-0.5"
                >
                  Remove
                </button>
              </div>
            ))}
            <div className="px-3 py-2 flex justify-between text-xs font-medium">
              <span className="text-muted-foreground">Outstanding</span>
              <span className={outstanding > 0 ? "text-amber-600" : "text-emerald-600"}>
                {fmt(Math.max(0, outstanding))}
              </span>
            </div>
          </div>
        )}

        {/* New payment form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Amount (₹) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder={String(invoice.total_amount)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Payment Date *</Label>
              <Input
                type="date"
                value={form.payment_date}
                onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Payment Method</Label>
            <Select value={form.method} onValueChange={(v) => setForm((f) => ({ ...f, method: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(METHOD_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>
              Transaction / Reference Number
              <span className="text-xs text-muted-foreground font-normal ml-1">(UTR, cheque no., UPI ref…)</span>
            </Label>
            <Input
              value={form.reference_number}
              onChange={(e) => setForm((f) => ({ ...f, reference_number: e.target.value }))}
              placeholder="e.g. UTR123456789 or CHQ/2024/001"
              className="font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label>Notes <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. Partial payment, TDS deducted, etc."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Record Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
