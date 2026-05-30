import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { resolveOwnerId } from "@/lib/resolve-owner";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  const [invoicesRes, expensesRes, clientsRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("invoice_date, total_amount, total_gst, taxable_amount, payment_status, client_id, clients(name)")
      .eq("user_id", ownerId)
      .order("invoice_date", { ascending: true }),
    supabase
      .from("expenses")
      .select("expense_date, amount, gst_amount, total_amount")
      .eq("user_id", ownerId),
    supabase
      .from("clients")
      .select("id, name")
      .eq("user_id", ownerId),
  ]);

  const invoices = invoicesRes.data ?? [];
  const expenses = expensesRes.data ?? [];

  // Monthly revenue (last 12 months)
  const monthlyMap = new Map<string, { revenue: number; gst: number; expenses: number }>();
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap.set(key, { revenue: 0, gst: 0, expenses: 0 });
  }

  for (const inv of invoices) {
    const key = inv.invoice_date.slice(0, 7);
    if (monthlyMap.has(key)) {
      const m = monthlyMap.get(key)!;
      m.revenue += Number(inv.total_amount);
      m.gst += Number(inv.total_gst);
    }
  }

  for (const exp of expenses) {
    const key = exp.expense_date.slice(0, 7);
    if (monthlyMap.has(key)) {
      monthlyMap.get(key)!.expenses += Number(exp.total_amount);
    }
  }

  const monthly = Array.from(monthlyMap.entries()).map(([month, v]) => ({
    month,
    label: new Date(month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    revenue: Math.round(v.revenue),
    gst: Math.round(v.gst),
    expenses: Math.round(v.expenses),
  }));

  // Top 5 clients by total invoiced
  const clientMap = new Map<string, { name: string; total: number; count: number }>();
  for (const inv of invoices) {
    const name = (inv.clients as unknown as { name: string } | null)?.name ?? "Unknown";
    const id = inv.client_id;
    if (!clientMap.has(id)) clientMap.set(id, { name, total: 0, count: 0 });
    const c = clientMap.get(id)!;
    c.total += Number(inv.total_amount);
    c.count += 1;
  }
  const topClients = [...clientMap.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((c) => ({ name: c.name, total: Math.round(c.total), count: c.count }));

  // Payment status breakdown
  const statusMap: Record<string, number> = { paid: 0, pending: 0, partial: 0, draft: 0, overdue: 0 };
  for (const inv of invoices) {
    statusMap[inv.payment_status] = (statusMap[inv.payment_status] ?? 0) + 1;
  }
  const statusBreakdown = Object.entries(statusMap)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({ status, count }));

  // GST summary
  const totalTaxable = invoices.reduce((s, i) => s + Number(i.taxable_amount), 0);
  const totalGstCollected = invoices.reduce((s, i) => s + Number(i.total_gst), 0);
  const totalGstPaid = expenses.reduce((s, e) => s + Number(e.gst_amount), 0);

  return NextResponse.json(apiSuccess({
    monthly,
    topClients,
    statusBreakdown,
    gstSummary: {
      collected: Math.round(totalGstCollected),
      paid: Math.round(totalGstPaid),
      net: Math.round(totalGstCollected - totalGstPaid),
      taxable: Math.round(totalTaxable),
    },
    totals: {
      invoices: invoices.length,
      revenue: Math.round(invoices.reduce((s, i) => s + Number(i.total_amount), 0)),
      expenses: Math.round(expenses.reduce((s, e) => s + Number(e.total_amount), 0)),
      clients: clientsRes.data?.length ?? 0,
    },
  }));
}
