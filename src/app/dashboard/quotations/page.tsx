"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type Quotation = {
  id: string; quote_number: string; quote_date: string;
  valid_until: string | null;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted";
  total_amount: number; total_gst: number; converted_invoice_id: string | null;
  clients: { id: string; name: string; email: string | null; state_code: string };
};

const STATUS_META: Record<string, { color: string; label: string }> = {
  draft:     { color: "bg-gray-100 text-gray-600 ring-1 ring-gray-200",          label: "Draft" },
  sent:      { color: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",          label: "Sent" },
  accepted:  { color: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200", label: "Accepted" },
  rejected:  { color: "bg-red-100 text-red-600 ring-1 ring-red-200",             label: "Rejected" },
  expired:   { color: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",       label: "Expired" },
  converted: { color: "bg-violet-100 text-violet-700 ring-1 ring-violet-200",    label: "Converted" },
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

export default function QuotationsPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState<string | null>(null);

  async function fetchAll() {
    setLoading(true);
    const res = await fetch("/api/quotations");
    const json = await res.json();
    if (json.data) setQuotes(json.data);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

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
    else { toast.success("Quotation deleted"); setQuotes((prev) => prev.filter((q) => q.id !== id)); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quotations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {quotes.length} quotation{quotes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/quotations/new">+ New Quotation</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : quotes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No quotations yet.</p>
          <Button className="mt-4" asChild>
            <Link href="/dashboard/quotations/new">Create your first quotation</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="font-semibold text-gray-700">Quote #</TableHead>
                <TableHead className="font-semibold text-gray-700">Client</TableHead>
                <TableHead className="font-semibold text-gray-700">Date</TableHead>
                <TableHead className="font-semibold text-gray-700">Valid Until</TableHead>
                <TableHead className="text-right font-semibold text-gray-700">Amount</TableHead>
                <TableHead className="text-right font-semibold text-gray-700">GST</TableHead>
                <TableHead className="font-semibold text-gray-700">Status</TableHead>
                <TableHead className="text-right pr-4 font-semibold text-gray-700">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => {
                const isExpired = q.valid_until && q.status === "sent" && new Date(q.valid_until) < new Date();
                const meta = STATUS_META[q.status] ?? STATUS_META.draft;
                return (
                  <TableRow key={q.id} className="hover:bg-gray-50/70 transition-colors">
                    <TableCell>
                      <span className="font-mono font-semibold text-gray-900 text-sm">{q.quote_number}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-gray-800 text-sm">{q.clients.name}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-700">
                        {new Date(q.quote_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm ${isExpired ? "text-red-500 font-medium" : "text-gray-500"}`}>
                        {q.valid_until
                          ? new Date(q.valid_until).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                          : <span className="text-gray-300">—</span>}
                        {isExpired && <span className="ml-1.5 text-[10px] bg-red-100 text-red-600 rounded px-1 py-0.5">expired</span>}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold text-gray-900 text-sm tabular-nums">{fmt(q.total_amount)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm text-gray-500 tabular-nums">{fmt(q.total_gst)}</span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${meta.color}`}>
                        {meta.label}
                      </span>
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        onClick={() => window.open(`/api/quotations/${q.id}/pdf`, "_blank")}
                      >
                        PDF
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                            <span className="text-base leading-none">&#8943;</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          {q.status === "accepted" && (
                            <DropdownMenuItem
                              onClick={() => convertToInvoice(q.id, q.quote_number)}
                              disabled={converting === q.id}
                              className="text-emerald-700 font-semibold"
                            >
                              {converting === q.id ? "Converting..." : "Convert to Invoice"}
                            </DropdownMenuItem>
                          )}
                          {q.status === "draft" && (
                            <DropdownMenuItem onClick={() => updateStatus(q.id, "sent")}>
                              Mark as Sent
                            </DropdownMenuItem>
                          )}
                          {q.status === "sent" && (
                            <>
                              <DropdownMenuItem onClick={() => updateStatus(q.id, "accepted")}>Mark as Accepted</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(q.id, "rejected")}>Mark as Rejected</DropdownMenuItem>
                            </>
                          )}
                          {q.status === "converted" && q.converted_invoice_id && (
                            <DropdownMenuItem asChild>
                              <Link href="/dashboard/invoices">View Invoice</Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            onClick={() => deleteQuote(q.id, q.quote_number)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
