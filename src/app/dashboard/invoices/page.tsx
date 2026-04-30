"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { RecordPaymentModal } from "@/components/invoice/RecordPaymentModal";

type Invoice = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
  total_gst: number;
  payment_status: "pending" | "paid" | "partial";
  public_token: string | null;
  clients: { id: string; name: string; email: string | null };
  created_by_email?: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
  pending: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
  partial: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
}

const FREE_LIMIT = 5;

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<{ plan: string; invoice_count_this_month: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);

  async function fetchInvoices() {
    setLoading(true);
    const [invRes, profileRes] = await Promise.all([
      fetch("/api/invoices"),
      fetch("/api/profile"),
    ]);
    const invJson = await invRes.json();
    const profileJson = await profileRes.json();
    if (invJson.data) setInvoices(invJson.data);
    if (profileJson.data) setPlan({ plan: profileJson.data.plan, invoice_count_this_month: profileJson.data.invoice_count_this_month });
    setLoading(false);
  }

  useEffect(() => { fetchInvoices(); }, []);

  const atLimit = plan?.plan === "free" && (plan?.invoice_count_this_month ?? 0) >= FREE_LIMIT;
  const nearLimit = plan?.plan === "free" && !atLimit && (plan?.invoice_count_this_month ?? 0) >= FREE_LIMIT - 1;

  function markPaid(invoice: Invoice) {
    setPaymentModalInvoice(invoice);
  }

  function shareWhatsApp(invoice: Invoice) {
    const amount = fmt(invoice.total_amount);
    const date = new Date(invoice.invoice_date).toLocaleDateString("en-IN");
    const text = `Hi, please find your Tax Invoice #${invoice.invoice_number} dated ${date} for ${amount}. Please download the PDF here: ${window.location.origin}/api/invoices/${invoice.id}/pdf`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  function downloadPdf(invoice: Invoice) {
    window.open(`/api/invoices/${invoice.id}/pdf`, "_blank");
  }

  async function sendEmail(invoice: Invoice) {
    if (!invoice.clients?.email) {
      toast.error("Client has no email address");
      return;
    }
    const res = await fetch(`/api/invoices/${invoice.id}/email`, { method: "POST" });
    const json = await res.json();
    if (json.error) {
      toast.error(json.error.message);
    } else {
      toast.success(`Invoice emailed to ${invoice.clients.email}`);
    }
  }

  async function handleDelete(invoice: Invoice) {
    if (!confirm(`Delete invoice #${invoice.invoice_number}? This cannot be undone.`)) return;
    const res = await fetch(`/api/invoices/${invoice.id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.error) {
      toast.error(json.error.message);
    } else {
      toast.success("Invoice deleted");
      setInvoices((prev) => prev.filter((inv) => inv.id !== invoice.id));
      setSelected((prev) => { const n = new Set(prev); n.delete(invoice.id); return n; });
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size === invoices.length ? new Set() : new Set(invoices.map((i) => i.id))
    );
  }

  async function bulkMarkPaid() {
    const ids = [...selected].filter(
      (id) => invoices.find((i) => i.id === id)?.payment_status !== "paid"
    );
    if (!ids.length) { toast.info("All selected are already paid"); return; }
    setBulkWorking(true);
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/invoices/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payment_status: "paid" }),
        })
      )
    );
    setInvoices((prev) =>
      prev.map((inv) => (ids.includes(inv.id) ? { ...inv, payment_status: "paid" } : inv))
    );
    toast.success(`${ids.length} invoice${ids.length > 1 ? "s" : ""} marked paid`);
    setSelected(new Set());
    setBulkWorking(false);
  }

  async function bulkDelete() {
    const ids = [...selected];
    if (!confirm(`Delete ${ids.length} invoice${ids.length > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBulkWorking(true);
    await Promise.all(ids.map((id) => fetch(`/api/invoices/${id}`, { method: "DELETE" })));
    setInvoices((prev) => prev.filter((inv) => !ids.includes(inv.id)));
    toast.success(`${ids.length} invoice${ids.length > 1 ? "s" : ""} deleted`);
    setSelected(new Set());
    setBulkWorking(false);
  }

  async function bulkEmail() {
    const targets = invoices.filter((i) => selected.has(i.id) && i.clients?.email);
    if (!targets.length) { toast.error("No selected invoices have client email addresses"); return; }
    setBulkWorking(true);
    let sent = 0;
    for (const inv of targets) {
      const res = await fetch(`/api/invoices/${inv.id}/email`, { method: "POST" });
      const json = await res.json();
      if (!json.error) sent++;
    }
    toast.success(`Emailed ${sent} invoice${sent > 1 ? "s" : ""}`);
    setSelected(new Set());
    setBulkWorking(false);
  }

  async function sendReminder(invoice: Invoice) {
    const res = await fetch(`/api/invoices/${invoice.id}/remind`, { method: "POST" });
    const json = await res.json();
    if (json.error) toast.error(json.error.message);
    else toast.success("Payment reminder sent");
  }

  async function downloadGstr1() {
    const month = prompt("Enter month (YYYY-MM):", new Date().toISOString().slice(0, 7));
    if (!month) return;
    const res = await fetch(`/api/gstr1?month=${month}`);
    if (!res.ok) { toast.error("Export failed"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GSTR1_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadGstr1}>GSTR-1 Export</Button>
          {atLimit ? (
            <Button asChild variant="outline">
              <Link href="/dashboard/billing">Upgrade to add more</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/dashboard/invoices/new">+ New Invoice</Link>
            </Button>
          )}
        </div>
      </div>

      {atLimit && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm text-red-800 font-medium">
            You&apos;ve reached the free plan limit ({FREE_LIMIT}/{FREE_LIMIT} invoices this month).
          </p>
          <Button size="sm" asChild>
            <Link href="/dashboard/billing">Upgrade plan</Link>
          </Button>
        </div>
      )}

      {nearLimit && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm text-amber-800">
            {plan?.invoice_count_this_month}/{FREE_LIMIT} free invoices used this month.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/billing">Upgrade plan</Link>
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : invoices.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No invoices yet.</p>
          <Button className="mt-4" asChild>
            <Link href="/dashboard/invoices/new">Create your first invoice</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border-b border-blue-100">
              <span className="text-sm font-medium text-blue-800">
                {selected.size} selected
              </span>
              <Button size="sm" variant="outline" onClick={bulkMarkPaid} disabled={bulkWorking}>
                Mark Paid
              </Button>
              <Button size="sm" variant="outline" onClick={bulkEmail} disabled={bulkWorking}>
                Email All
              </Button>
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={bulkDelete} disabled={bulkWorking}>
                Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={bulkWorking}>
                Clear
              </Button>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="w-10 pl-4">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={selected.size === invoices.length && invoices.length > 0}
                    onChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="font-semibold text-gray-700">Invoice #</TableHead>
                <TableHead className="font-semibold text-gray-700">Client</TableHead>
                <TableHead className="font-semibold text-gray-700">Date</TableHead>
                <TableHead className="text-right font-semibold text-gray-700">Amount</TableHead>
                <TableHead className="text-right font-semibold text-gray-700">GST</TableHead>
                <TableHead className="font-semibold text-gray-700">Status</TableHead>
                <TableHead className="w-20 text-right pr-4 font-semibold text-gray-700">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow
                  key={invoice.id}
                  className={`group transition-colors ${selected.has(invoice.id) ? "bg-blue-50/60" : "hover:bg-gray-50/70"}`}
                >
                  <TableCell className="pl-4">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={selected.has(invoice.id)}
                      onChange={() => toggleSelect(invoice.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="font-mono font-semibold text-gray-900 text-sm">
                      {invoice.invoice_number}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-gray-800 text-sm">{invoice.clients?.name ?? "—"}</span>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-700">{new Date(invoice.invoice_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                    {invoice.created_by_email && (
                      <div className="text-xs text-gray-400 truncate max-w-[140px] mt-0.5" title={invoice.created_by_email}>
                        by {invoice.created_by_email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-semibold text-gray-900 text-sm">{fmt(invoice.total_amount)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm text-gray-500">{fmt(invoice.total_gst)}</span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_COLORS[invoice.payment_status]}`}>
                      {invoice.payment_status}
                    </span>
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Primary quick actions */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        onClick={() => router.push(`/dashboard/invoices/${invoice.id}/edit`)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        onClick={() => downloadPdf(invoice)}
                      >
                        PDF
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                        onClick={() => setPaymentModalInvoice(invoice)}
                      >
                        {invoice.payment_status === "paid" ? "Payments" : "Record Payment"}
                      </Button>
                      {/* More actions dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                          >
                            <span className="text-base leading-none">⋯</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setPaymentModalInvoice(invoice)}>
                            Record Payment
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => sendEmail(invoice)}>
                            Send Email
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => shareWhatsApp(invoice)}>
                            Share via WhatsApp
                          </DropdownMenuItem>
                          {invoice.public_token && (
                            <DropdownMenuItem onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/invoice/${invoice.public_token}`);
                              toast.success("Link copied!");
                            }}>
                              Copy shareable link
                            </DropdownMenuItem>
                          )}
                          {invoice.payment_status !== "paid" && (
                            <DropdownMenuItem onClick={() => sendReminder(invoice)}>
                              Send reminder
                            </DropdownMenuItem>
                          )}
                          {invoice.payment_status === "paid" && (
                            <DropdownMenuItem onClick={() => router.push(`/dashboard/credit-notes/new?invoice_id=${invoice.id}&client_id=${invoice.clients?.id}`)}>
                              Issue Credit Note
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            onClick={() => handleDelete(invoice)}
                          >
                            Delete invoice
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {paymentModalInvoice && (
        <RecordPaymentModal
          open={!!paymentModalInvoice}
          onOpenChange={(open) => { if (!open) setPaymentModalInvoice(null); }}
          invoice={paymentModalInvoice}
          onSuccess={fetchInvoices}
        />
      )}
    </div>
  );
}
