"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";

type Invoice = {
  id: string;
  invoice_number: string;
  client_id: string;
  total_amount: number;
  taxable_amount: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_gst: number;
  clients: { name: string };
};

function NewCreditNoteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preInvoiceId = searchParams.get("invoice_id") ?? "";
  const preClientId = searchParams.get("client_id") ?? "";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(preInvoiceId);
  const [creditNoteNumber, setCreditNoteNumber] = useState("");
  const [creditNoteDate, setCreditNoteDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadInvoices() {
      const res = await fetch("/api/invoices");
      const json = await res.json();
      if (json.data) {
        const paid = json.data.filter((i: Invoice & { payment_status: string }) => i.payment_status === "paid");
        setInvoices(paid);
      }
    }
    async function loadNextNumber() {
      const res = await fetch("/api/credit-notes");
      const json = await res.json();
      const count = (json.data?.length ?? 0) + 1;
      setCreditNoteNumber(`CN-${String(count).padStart(3, "0")}`);
    }
    loadInvoices();
    loadNextNumber();
  }, []);

  const selectedInvoice = invoices.find((i) => i.id === selectedInvoiceId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInvoice) { toast.error("Select an invoice"); return; }
    if (!reason.trim()) { toast.error("Reason is required"); return; }
    setSaving(true);
    const res = await fetch("/api/credit-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoice_id: selectedInvoice.id,
        client_id: selectedInvoice.client_id || preClientId,
        credit_note_number: creditNoteNumber,
        credit_note_date: creditNoteDate,
        reason,
        taxable_amount: selectedInvoice.taxable_amount,
        total_cgst: selectedInvoice.total_cgst,
        total_sgst: selectedInvoice.total_sgst,
        total_igst: selectedInvoice.total_igst,
        total_gst: selectedInvoice.total_gst,
        total_amount: selectedInvoice.total_amount,
      }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Credit note created");
      router.push("/dashboard/credit-notes");
    } else {
      toast.error(json.error?.message ?? "Failed to create");
    }
    setSaving(false);
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Credit Note</h1>
        <p className="text-sm text-muted-foreground">Issue a credit note against a paid invoice</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credit Note Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Credit Note Number</Label>
                <Input
                  value={creditNoteNumber}
                  onChange={(e) => setCreditNoteNumber(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={creditNoteDate}
                  onChange={(e) => setCreditNoteDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Against Invoice</Label>
              <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select paid invoice" />
                </SelectTrigger>
                <SelectContent>
                  {invoices.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {inv.clients?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedInvoice && (
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client</span>
                  <span className="font-medium">{selectedInvoice.clients?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">
                    {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(selectedInvoice.total_amount)}
                  </span>
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label>Reason</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Goods returned, billing error, service not delivered..."
                rows={3}
                required
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create Credit Note"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewCreditNotePage() {
  return (
    <Suspense>
      <NewCreditNoteForm />
    </Suspense>
  );
}
