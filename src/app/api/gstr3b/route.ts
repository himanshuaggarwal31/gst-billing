import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveOwnerId } from "@/lib/resolve-owner";

/**
 * GET /api/gstr3b?month=YYYY-MM
 *
 * Returns a GSTR-3B summary CSV for the given month:
 *   Table 3.1 — Outward taxable supplies (from invoices)
 *   Table 4A(5) — Input tax credit from purchases (from expenses)
 *   Net tax payable
 *
 * If month is omitted, defaults to the current calendar month.
 */
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  // Parse month (YYYY-MM) from query string
  const rawMonth = req.nextUrl.searchParams.get("month");
  let month: string;
  if (rawMonth && /^\d{4}-\d{2}$/.test(rawMonth)) {
    month = rawMonth;
  } else {
    const now = new Date();
    month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  const [year, mon] = month.split("-");
  const startDate = `${month}-01`;
  const endDate = new Date(Number(year), Number(mon), 0).toISOString().split("T")[0]; // last day

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("gstin, business_name, state_code")
    .eq("id", ownerId)
    .single();

  // ── Table 3.1: Outward supplies (invoices) ──────────────────────────────
  const { data: invoices } = await supabase
    .from("invoices")
    .select("taxable_amount, total_cgst, total_sgst, total_igst, total_gst, total_amount, is_inter_state")
    .eq("user_id", ownerId)
    .gte("invoice_date", startDate)
    .lte("invoice_date", endDate);

  const outward = (invoices ?? []).reduce(
    (acc, inv) => {
      acc.taxable += Number(inv.taxable_amount);
      acc.igst += Number(inv.total_igst);
      acc.cgst += Number(inv.total_cgst);
      acc.sgst += Number(inv.total_sgst);
      acc.totalGst += Number(inv.total_gst);
      return acc;
    },
    { taxable: 0, igst: 0, cgst: 0, sgst: 0, totalGst: 0 }
  );

  // ── Table 4A(5): ITC from expenses ──────────────────────────────────────
  const { data: expenses } = await supabase
    .from("expenses")
    .select("gst_amount, amount")
    .eq("user_id", ownerId)
    .gte("expense_date", startDate)
    .lte("expense_date", endDate);

  const itc = (expenses ?? []).reduce(
    (acc, exp) => {
      acc.taxable += Number(exp.amount);
      acc.gstPaid += Number(exp.gst_amount);
      return acc;
    },
    { taxable: 0, gstPaid: 0 }
  );

  const netPayable = Math.max(0, outward.totalGst - itc.gstPaid);
  const netIgst = Math.max(0, outward.igst - itc.gstPaid * (outward.igst / (outward.totalGst || 1)));
  const netCgst = Math.max(0, outward.cgst - itc.gstPaid * (outward.cgst / (outward.totalGst || 1)));
  const netSgst = Math.max(0, outward.sgst - itc.gstPaid * (outward.sgst / (outward.totalGst || 1)));

  // ── Build CSV ────────────────────────────────────────────────────────────
  const rows: string[][] = [];

  rows.push([`GSTR-3B Monthly Summary`]);
  rows.push([`GSTIN: ${profile?.gstin ?? "Not set"}`, `Business: ${profile?.business_name ?? ""}`, `Month: ${month}`]);
  rows.push([]);

  rows.push(["3. TAX ON OUTWARD AND REVERSE CHARGE INWARD SUPPLIES"]);
  rows.push(["Nature of Supplies", "Total Taxable Value", "IGST", "CGST", "SGST/UTGST", "Cess"]);
  rows.push([
    "3.1(a) Outward taxable supplies (other than zero/nil/exempt)",
    f(outward.taxable), f(outward.igst), f(outward.cgst), f(outward.sgst), "0.00",
  ]);
  rows.push(["3.1(b) Outward taxable supplies (zero rated)", "0.00", "0.00", "0.00", "0.00", "0.00"]);
  rows.push(["3.1(c) Other outward supplies (nil rated / exempt)", "0.00", "0.00", "0.00", "0.00", "0.00"]);
  rows.push(["3.1(d) Inward supplies (reverse charge)", "0.00", "0.00", "0.00", "0.00", "0.00"]);
  rows.push(["3.1(e) Non-GST outward supplies", "0.00", "", "", "", ""]);
  rows.push([]);

  rows.push(["4. ELIGIBLE INPUT TAX CREDIT (ITC)"]);
  rows.push(["Details", "IGST", "CGST", "SGST/UTGST", "Cess"]);
  rows.push(["4A(5) All other ITC (from purchase invoices/expenses)", f(itc.gstPaid), "0.00", "0.00", "0.00"]);
  rows.push([]);

  rows.push(["5. VALUES OF EXEMPT, NIL-RATED AND NON-GST INWARD SUPPLIES"]);
  rows.push(["Nature of Supplies", "Inter-state", "Intra-state"]);
  rows.push(["From a supplier under composition scheme", "0.00", "0.00"]);
  rows.push(["Exempt", "0.00", "0.00"]);
  rows.push(["Nil rated", "0.00", "0.00"]);
  rows.push(["Non-GST", "0.00", "0.00"]);
  rows.push([]);

  rows.push(["6.1 PAYMENT OF TAX — Net Tax Payable"]);
  rows.push(["Tax Head", "Tax Payable", "ITC (IGST)", "ITC (CGST)", "ITC (SGST/UTGST)", "Tax Paid in Cash"]);
  rows.push(["IGST", f(outward.igst), f(itc.gstPaid), "0.00", "0.00", f(netIgst)]);
  rows.push(["CGST", f(outward.cgst), "0.00", "0.00", "0.00", f(netCgst)]);
  rows.push(["SGST/UTGST", f(outward.sgst), "0.00", "0.00", "0.00", f(netSgst)]);
  rows.push([]);

  rows.push(["SUMMARY"]);
  rows.push(["Description", "Amount"]);
  rows.push(["Total outward taxable value", f(outward.taxable)]);
  rows.push(["Total GST collected (output tax)", f(outward.totalGst)]);
  rows.push(["Total ITC from purchases", f(itc.gstPaid)]);
  rows.push(["Net GST payable (output - ITC)", f(netPayable)]);
  rows.push(["Number of invoices", String(invoices?.length ?? 0)]);
  rows.push(["Number of expense bills", String(expenses?.length ?? 0)]);

  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  const filename = `GSTR-3B_${month}_${profile?.gstin ?? "NO-GSTIN"}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function f(n: number): string {
  return n.toFixed(2);
}
