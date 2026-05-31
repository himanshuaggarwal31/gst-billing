import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveOwnerId } from "@/lib/resolve-owner";
import { EWayBillSection } from "@/components/invoice/EWayBillSection";
import { EInvoiceSection } from "@/components/invoice/EInvoiceSection";
import { Button } from "@/components/ui/button";

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_COLORS: Record<string, string> = {
  paid:    "bg-emerald-100 text-emerald-700 border border-emerald-200",
  pending: "bg-amber-100 text-amber-700 border border-amber-200",
  partial: "bg-blue-100 text-blue-700 border border-blue-200",
};

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, clients(*), invoice_line_items(*)")
    .eq("id", id)
    .eq("user_id", ownerId)
    .single();

  if (error || !invoice) notFound();

  const client = invoice.clients as {
    name: string; gstin: string | null; address: string | null;
    city: string | null; state_code: string; pincode: string | null;
    email: string | null; phone: string | null;
  };

  const lines = (invoice.invoice_line_items as Array<{
    description: string; hsn_sac_code: string; quantity: number;
    rate: number; discount_percent: number; gst_rate: number;
    taxable_amount: number; total_gst: number; line_total: number; sort_order: number;
  }>).sort((a, b) => a.sort_order - b.sort_order);

  const isInterState = (invoice.seller_state_code as string)?.trim() !== (invoice.buyer_state_code as string)?.trim();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-gray-900">{invoice.invoice_number}</h1>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${STATUS_COLORS[invoice.payment_status] ?? STATUS_COLORS.pending}`}>
              {invoice.payment_status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {fmtDate(invoice.invoice_date)}
            {invoice.due_date ? ` · Due ${fmtDate(invoice.due_date)}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/api/invoices/${id}/pdf`} target="_blank">PDF</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/invoices/${id}/edit`}>Edit</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/invoices">← Invoices</Link>
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Client</p>
          <p className="font-semibold text-sm leading-snug">{client.name}</p>
          {client.gstin && <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{client.gstin}</p>}
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Taxable</p>
          <p className="font-semibold tabular-nums">{fmt(invoice.taxable_amount)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
            {isInterState ? "IGST" : "CGST + SGST"}
          </p>
          <p className="font-semibold tabular-nums">{fmt(invoice.total_gst)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Total</p>
          <p className="font-bold text-lg tabular-nums">{fmt(invoice.total_amount)}</p>
        </div>
      </div>

      {/* Line items */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Line Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] text-gray-500 uppercase tracking-wide bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Description</th>
                <th className="px-4 py-2 text-left font-medium">HSN/SAC</th>
                <th className="px-4 py-2 text-right font-medium">Qty</th>
                <th className="px-4 py-2 text-right font-medium">Rate</th>
                <th className="px-4 py-2 text-right font-medium">Disc%</th>
                <th className="px-4 py-2 text-right font-medium">GST%</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lines.map((line, idx) => (
                <tr key={idx} className={idx % 2 === 1 ? "bg-gray-50/50" : ""}>
                  <td className="px-4 py-2.5">{line.description}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{line.hsn_sac_code}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{line.quantity}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmt(line.rate)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{line.discount_percent}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{line.gst_rate}%</td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">{fmt(line.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* GST summary */}
      <div className="flex justify-end">
        <div className="w-72 space-y-2 text-sm bg-gray-50 rounded-xl border p-4">
          <div className="flex justify-between text-muted-foreground">
            <span>Taxable Amount</span>
            <span className="tabular-nums">{fmt(invoice.taxable_amount)}</span>
          </div>
          {isInterState ? (
            <div className="flex justify-between text-muted-foreground">
              <span>IGST</span>
              <span className="tabular-nums">{fmt(invoice.total_igst)}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>CGST</span><span className="tabular-nums">{fmt(invoice.total_cgst)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>SGST</span><span className="tabular-nums">{fmt(invoice.total_sgst)}</span>
              </div>
            </>
          )}
          <div className="border-t pt-2 flex justify-between font-bold text-base">
            <span>Total</span>
            <span className="tabular-nums">{fmt(invoice.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* e-Invoice (IRN) */}
      <EInvoiceSection invoiceId={id} />

      {/* e-Way Bill — shown for all invoices; required for goods movement >₹50k */}
      <EWayBillSection apiBase={`/api/invoices/${id}`} />
    </div>
  );
}
