import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { resolveOwnerId } from "@/lib/resolve-owner";

type AgingBucket = "current" | "1_30" | "31_60" | "61_90" | "over_90";

type AgingRow = {
  client_id: string;
  client_name: string;
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
  amount_paid: number;
  outstanding: number;
  days_overdue: number;
  bucket: AgingBucket;
};

/**
 * GET /api/reports/aging
 *
 * Returns outstanding invoice amounts bucketed by days overdue:
 *   current   — due date in the future or today
 *   1_30      — 1-30 days overdue
 *   31_60     — 31-60 days overdue
 *   61_90     — 61-90 days overdue
 *   over_90   — >90 days overdue
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch all non-paid invoices with client info
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select(`
      id, invoice_number, invoice_date, due_date, total_amount, payment_status,
      clients(id, name)
    `)
    .eq("user_id", ownerId)
    .in("payment_status", ["pending", "partial"])
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });

  // Fetch payments for these invoices to compute actual outstanding
  const invoiceIds = (invoices ?? []).map((i) => i.id);
  const { data: payments } = invoiceIds.length
    ? await supabase
        .from("invoice_payments")
        .select("invoice_id, amount")
        .in("invoice_id", invoiceIds)
    : { data: [] };

  const paidMap = new Map<string, number>();
  for (const p of payments ?? []) {
    paidMap.set(p.invoice_id, (paidMap.get(p.invoice_id) ?? 0) + Number(p.amount));
  }

  const rows: AgingRow[] = [];

  for (const inv of invoices ?? []) {
    const client = inv.clients as unknown as { id: string; name: string } | null;
    const totalAmount = Number(inv.total_amount);
    const amountPaid = paidMap.get(inv.id) ?? 0;
    const outstanding = Math.max(0, totalAmount - amountPaid);

    if (outstanding <= 0) continue; // fully paid via payments table

    // Compute days overdue from due_date (or invoice_date + 30 if no due_date)
    const refDateStr = inv.due_date ?? (() => {
      const d = new Date(inv.invoice_date);
      d.setDate(d.getDate() + 30);
      return d.toISOString().split("T")[0];
    })();
    const refDate = new Date(refDateStr);
    refDate.setHours(0, 0, 0, 0);
    const daysOverdue = Math.floor((today.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));

    let bucket: AgingBucket;
    if (daysOverdue <= 0) bucket = "current";
    else if (daysOverdue <= 30) bucket = "1_30";
    else if (daysOverdue <= 60) bucket = "31_60";
    else if (daysOverdue <= 90) bucket = "61_90";
    else bucket = "over_90";

    rows.push({
      client_id: client?.id ?? "",
      client_name: client?.name ?? "Unknown",
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      due_date: inv.due_date,
      total_amount: totalAmount,
      amount_paid: amountPaid,
      outstanding,
      days_overdue: Math.max(0, daysOverdue),
      bucket,
    });
  }

  // Summary by bucket
  const bucketTotals: Record<AgingBucket, { count: number; amount: number }> = {
    current: { count: 0, amount: 0 },
    "1_30":  { count: 0, amount: 0 },
    "31_60": { count: 0, amount: 0 },
    "61_90": { count: 0, amount: 0 },
    over_90: { count: 0, amount: 0 },
  };

  for (const row of rows) {
    bucketTotals[row.bucket].count++;
    bucketTotals[row.bucket].amount += row.outstanding;
  }

  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);

  return NextResponse.json(
    apiSuccess({
      rows,
      bucketTotals,
      totalOutstanding,
      asOf: today.toISOString().split("T")[0],
    })
  );
}
